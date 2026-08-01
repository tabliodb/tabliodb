import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Selectable } from 'kysely';
import { Permission } from '@tabliodb/shared';
import { AuthContext } from '../database.js';
import { AuditAction } from '../constants.js';
import {
  CommentListQueryDto,
  CommentReplyCreateDto,
  CommentThreadCreateDto,
  CommentThreadListQueryDto,
  CommentUpdateDto,
} from '../dtos/comment.dto.js';
import { AuditLogRepository } from '../repositories/audit-log.repository.js';
import { CommentRepository } from '../repositories/comment.repository.js';
import type { CommentThreadTable, JsonValue } from '../schema/index.js';
import {
  createPlainTextCommentLexicalDocument,
  extractCommentMentionUserIds,
  normalizeCommentLexicalBody,
  type CommentLexicalDocument,
} from '../utils/comment-body.js';
import { toIsoDateTime, toNullableIsoDateTime } from '../utils/date-time.js';
import { clampPaginationLimit } from '../utils/pagination.js';
import { BackgroundJobService } from './background-job.service.js';
import { DiagramService } from './diagram.service.js';

type CommentTargetType =
  'check' | 'column' | 'diagram' | 'enum' | 'group' | 'index' | 'note' | 'relationship' | 'table';
type CommentThreadRow = Selectable<CommentThreadTable>;
type CommentThreadScopedRow = NonNullable<Awaited<ReturnType<CommentRepository['getThreadWithScope']>>>;
type CommentResponseRow = NonNullable<Awaited<ReturnType<CommentRepository['getCommentForResponse']>>>;

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly backgroundJobService: BackgroundJobService,
    private readonly commentRepository: CommentRepository,
    private readonly diagramService: DiagramService,
  ) {}

  async createThread(auth: AuthContext, dto: CommentThreadCreateDto) {
    await this.diagramService.requireDiagram(auth, dto.diagramId, Permission.DiagramComment);
    const normalizedBody = normalizeCommentLexicalBody(dto.bodyJson);
    const mentionUserIds = await this.resolveMentionUserIds(dto.diagramId, normalizedBody, auth.user.id);

    const result = await this.commentRepository.createThreadWithComment({
      bodyJson: normalizedBody.bodyJson,
      bodyText: normalizedBody.bodyText,
      diagramId: dto.diagramId,
      targetType: dto.targetType,
      targetId: dto.targetId,
      createdById: auth.user.id,
      mentionUserIds,
    });
    await this.queueCommentNotificationDelivery({
      actorId: auth.user.id,
      commentId: result.comment.id,
      source: 'comment.created',
      threadId: result.comment.threadId,
    });

    return {
      thread: this.serializeThread(result.thread),
      comment: {
        author: this.serializeAuthor(auth.user),
        id: result.comment.id,
        mentionedUserIds: mentionUserIds,
        threadId: result.comment.threadId,
        body: result.comment.bodyText,
        bodyFormat: result.comment.bodyFormat,
        bodyJson: this.serializeCommentBodyJson(result.comment.bodyJson),
        bodyText: result.comment.bodyText,
        createdById: result.comment.createdById,
        deletedAt: null,
        editedAt: toNullableIsoDateTime(result.comment.editedAt),
        createdAt: toIsoDateTime(result.comment.createdAt),
        parentCommentId: result.comment.parentCommentId,
        replyCount: 0,
        updatedAt: toIsoDateTime(result.comment.updatedAt),
      },
    };
  }

  async getThreads(auth: AuthContext, diagramId: string, query: CommentThreadListQueryDto) {
    await this.diagramService.requireDiagram(auth, diagramId, Permission.DiagramRead);

    const threads = await this.commentRepository.getThreads(diagramId, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
      userId: auth.user.id,
    });

    return {
      ...threads,
      // Comment thread timestamps dipakai UI review, jadi response diserialisasi konsisten sebagai ISO string.
      items: threads.items.map((thread) => this.serializeThread(thread)),
    };
  }

  async getDiagramSummary(auth: AuthContext, diagramId: string) {
    await this.diagramService.requireDiagram(auth, diagramId, Permission.DiagramRead);
    const summary = await this.commentRepository.getDiagramSummary(diagramId, auth.user.id);

    return {
      diagramId,
      openCount: summary.openCount,
      resolvedCount: summary.resolvedCount,
      targets: summary.targets.map((target) => ({
        openCount: target.openCount,
        resolvedCount: target.resolvedCount,
        targetId: target.targetId,
        targetType: target.targetType as CommentTargetType,
        totalCount: target.totalCount,
        unreadCount: target.unreadCount,
        updatedAt: toNullableIsoDateTime(target.updatedAt),
      })),
      totalCount: summary.totalCount,
      unreadCount: summary.unreadCount,
      // Summary timestamp memberi cache/invalidation UI satu nilai murah tanpa membaca seluruh list thread.
      updatedAt: toNullableIsoDateTime(summary.updatedAt),
    };
  }

  async getThreadComments(auth: AuthContext, threadId: string, query: CommentListQueryDto) {
    const thread = await this.requireCommentThread(auth, threadId, Permission.DiagramRead);
    const comments = await this.commentRepository.getComments(thread.id, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
      parentCommentId: query.parentCommentId,
    });

    return {
      ...comments,
      items: comments.items.map((comment) => this.serializeComment(comment)),
    };
  }

  async getThreadRootComments(auth: AuthContext, threadId: string, query: CommentThreadListQueryDto) {
    const thread = await this.requireCommentThread(auth, threadId, Permission.DiagramRead);
    const comments = await this.commentRepository.getComments(thread.id, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
      // Root comments adalah level pertama di dalam thread, sehingga parent harus null secara eksplisit.
      parentCommentId: null,
    });

    return {
      ...comments,
      items: comments.items.map((comment) => this.serializeComment(comment)),
    };
  }

  async getCommentReplies(auth: AuthContext, commentId: string, query: CommentThreadListQueryDto) {
    const comment = await this.commentRepository.getCommentThreadScope(commentId);

    if (!comment) {
      throw new NotFoundException('Comment was not found.');
    }

    await this.diagramService.requireDiagram(auth, comment.diagramId, Permission.DiagramRead);

    const comments = await this.commentRepository.getComments(comment.threadId, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
      parentCommentId: comment.id,
    });

    return {
      ...comments,
      items: comments.items.map((reply) => this.serializeComment(reply)),
    };
  }

  async getThreadReadState(auth: AuthContext, threadId: string) {
    const thread = await this.requireCommentThread(auth, threadId, Permission.DiagramRead);
    const state = await this.commentRepository.getThreadReadState(thread.id, auth.user.id);

    return this.serializeReadState(thread.id, state);
  }

  async markThreadRead(auth: AuthContext, threadId: string) {
    const thread = await this.requireCommentThread(auth, threadId, Permission.DiagramRead);

    await this.commentRepository.markThreadRead(thread.id, auth.user.id);
    const state = await this.commentRepository.getThreadReadState(thread.id, auth.user.id);

    return this.serializeReadState(thread.id, state);
  }

  async replyToThread(auth: AuthContext, threadId: string, dto: CommentReplyCreateDto) {
    const thread = await this.requireCommentThread(auth, threadId, Permission.DiagramComment);
    const parentCommentId = dto.parentCommentId ?? null;
    const normalizedBody = normalizeCommentLexicalBody(dto.bodyJson);
    const mentionUserIds = await this.resolveMentionUserIds(thread.diagramId, normalizedBody, auth.user.id);

    if (parentCommentId) {
      const parentComment = await this.commentRepository.getCommentInThread(parentCommentId, thread.id);

      if (!parentComment) {
        throw new NotFoundException('Parent comment was not found in this thread.');
      }
    }

    const result = await this.commentRepository.createCommentReply({
      bodyJson: normalizedBody.bodyJson,
      bodyText: normalizedBody.bodyText,
      createdById: auth.user.id,
      mentionUserIds,
      parentCommentId,
      threadId: thread.id,
    });
    await this.queueCommentNotificationDelivery({
      actorId: auth.user.id,
      commentId: result.comment.id,
      source: 'comment.created',
      threadId: result.comment.threadId,
    });

    return {
      thread: this.serializeThread(result.thread),
      comment: {
        author: this.serializeAuthor(auth.user),
        body: result.comment.bodyText,
        bodyFormat: result.comment.bodyFormat,
        bodyJson: this.serializeCommentBodyJson(result.comment.bodyJson),
        bodyText: result.comment.bodyText,
        createdAt: toIsoDateTime(result.comment.createdAt),
        createdById: result.comment.createdById,
        deletedAt: null,
        editedAt: toNullableIsoDateTime(result.comment.editedAt),
        id: result.comment.id,
        mentionedUserIds: mentionUserIds,
        parentCommentId: result.comment.parentCommentId,
        replyCount: 0,
        threadId: result.comment.threadId,
        updatedAt: toIsoDateTime(result.comment.updatedAt),
      },
    };
  }

  async replyToComment(auth: AuthContext, commentId: string, dto: CommentReplyCreateDto) {
    const comment = await this.commentRepository.getCommentWithThread(commentId);

    if (!comment) {
      throw new NotFoundException('Comment was not found.');
    }

    if (dto.parentCommentId && dto.parentCommentId !== comment.id) {
      throw new BadRequestException('Reply parent must match the route comment.');
    }

    // Route comment menjadi parent tunggal agar client tidak bisa tanpa sengaja membuat reply ke parent lain.
    return this.replyToThread(auth, comment.threadId, {
      bodyJson: dto.bodyJson,
      parentCommentId: comment.id,
    });
  }

  async updateComment(auth: AuthContext, commentId: string, dto: CommentUpdateDto) {
    const comment = await this.commentRepository.getCommentWithThread(commentId);

    if (!comment) {
      throw new NotFoundException('Comment was not found.');
    }

    await this.diagramService.requireDiagram(auth, comment.diagramId, Permission.DiagramComment);

    if (comment.createdById !== auth.user.id) {
      throw new ForbiddenException('Only the comment author can edit this comment.');
    }

    const normalizedBody = normalizeCommentLexicalBody(dto.bodyJson);
    const mentionUserIds = await this.resolveMentionUserIds(comment.diagramId, normalizedBody, auth.user.id);
    const updatedComment = await this.commentRepository.updateComment({
      bodyJson: normalizedBody.bodyJson,
      bodyText: normalizedBody.bodyText,
      commentId: comment.id,
      editedById: auth.user.id,
      mentionUserIds,
    });
    await this.auditLogRepository.create({
      action: AuditAction.CommentEdited,
      actorId: auth.user.id,
      diagramId: comment.diagramId,
      entityId: comment.id,
      entityType: 'comment',
      ipAddress: auth.request?.ipAddress ?? null,
      metadata: {
        // Audit log tidak menyimpan body comment supaya perubahan sensitif tidak ikut tersebar ke workspace activity.
        mentionedUserCount: mentionUserIds.length,
        parentCommentId: comment.parentCommentId,
        threadId: comment.threadId,
      },
      organizationId: comment.organizationId,
      projectId: comment.projectId,
      requestId: auth.request?.requestId ?? null,
      userAgent: auth.request?.userAgent ?? null,
    });
    await this.queueCommentNotificationDelivery({
      actorId: auth.user.id,
      commentId: updatedComment.id,
      source: 'comment.updated',
      threadId: updatedComment.threadId,
    });

    return {
      author: this.serializeAuthor(auth.user),
      body: updatedComment.bodyText,
      bodyFormat: updatedComment.bodyFormat,
      bodyJson: this.serializeCommentBodyJson(updatedComment.bodyJson),
      bodyText: updatedComment.bodyText,
      createdAt: toIsoDateTime(updatedComment.createdAt),
      createdById: updatedComment.createdById,
      deletedAt: null,
      editedAt: toNullableIsoDateTime(updatedComment.editedAt),
      id: updatedComment.id,
      mentionedUserIds: mentionUserIds,
      parentCommentId: updatedComment.parentCommentId,
      replyCount: updatedComment.replyCount,
      threadId: updatedComment.threadId,
      updatedAt: toIsoDateTime(updatedComment.updatedAt),
    };
  }

  async deleteComment(auth: AuthContext, commentId: string) {
    const comment = await this.commentRepository.getCommentWithThread(commentId);

    if (!comment) {
      throw new NotFoundException('Comment was not found.');
    }

    await this.diagramService.requireDiagram(auth, comment.diagramId, Permission.DiagramComment);

    if (comment.createdById !== auth.user.id) {
      // Author delete hanya membutuhkan hak comment; moderasi comment orang lain membutuhkan hak update diagram.
      await this.diagramService.requireDiagram(auth, comment.diagramId, Permission.DiagramUpdate);
    }

    await this.commentRepository.deleteComment(comment.id);
    await this.auditLogRepository.create({
      action: AuditAction.CommentDeleted,
      actorId: auth.user.id,
      diagramId: comment.diagramId,
      entityId: comment.id,
      entityType: 'comment',
      ipAddress: auth.request?.ipAddress ?? null,
      metadata: {
        deletedByAuthor: comment.createdById === auth.user.id,
        parentCommentId: comment.parentCommentId,
        threadId: comment.threadId,
      },
      organizationId: comment.organizationId,
      projectId: comment.projectId,
      requestId: auth.request?.requestId ?? null,
      userAgent: auth.request?.userAgent ?? null,
    });

    const deletedComment = await this.commentRepository.getCommentForResponse(comment.id);

    if (!deletedComment) {
      throw new NotFoundException('Deleted comment was not found.');
    }

    return this.serializeComment(deletedComment);
  }

  async resolveThread(auth: AuthContext, threadId: string) {
    const thread = await this.requireCommentThreadWithScope(auth, threadId, Permission.DiagramComment);
    const updatedThread = await this.commentRepository.resolveThread(thread.id, auth.user.id);

    await this.recordThreadAudit(auth, thread, AuditAction.CommentThreadResolved);

    return this.serializeThread(updatedThread);
  }

  async unresolveThread(auth: AuthContext, threadId: string) {
    const thread = await this.requireCommentThreadWithScope(auth, threadId, Permission.DiagramComment);
    const updatedThread = await this.commentRepository.unresolveThread(thread.id);

    await this.recordThreadAudit(auth, thread, AuditAction.CommentThreadReopened);

    return this.serializeThread(updatedThread);
  }

  private async requireCommentThread(auth: AuthContext, threadId: string, permission: Permission) {
    const thread = await this.commentRepository.getThreadById(threadId);

    if (!thread) {
      throw new NotFoundException('Comment thread was not found.');
    }

    // Permission untuk route berbasis thread harus dicek setelah thread dibaca karena diagramId tidak ada di URL/body.
    await this.diagramService.requireDiagram(auth, thread.diagramId, permission);

    return thread;
  }

  private async requireCommentThreadWithScope(auth: AuthContext, threadId: string, permission: Permission) {
    const thread = await this.commentRepository.getThreadWithScope(threadId);

    if (!thread) {
      throw new NotFoundException('Comment thread was not found.');
    }

    // Audit entries need project/workspace scope, so this variant returns thread scope while preserving the same permission path.
    await this.diagramService.requireDiagram(auth, thread.diagramId, permission);

    return thread;
  }

  private recordThreadAudit(auth: AuthContext, thread: CommentThreadScopedRow, action: AuditAction) {
    return this.auditLogRepository.create({
      action,
      actorId: auth.user.id,
      diagramId: thread.diagramId,
      entityId: thread.id,
      entityType: 'comment_thread',
      ipAddress: auth.request?.ipAddress ?? null,
      metadata: {
        previousStatus: thread.status,
        targetId: thread.targetId,
        targetType: thread.targetType,
      },
      organizationId: thread.organizationId,
      projectId: thread.projectId,
      requestId: auth.request?.requestId ?? null,
      userAgent: auth.request?.userAgent ?? null,
    });
  }

  private serializeThread(thread: CommentThreadRow) {
    return {
      createdAt: toIsoDateTime(thread.createdAt),
      createdById: thread.createdById,
      diagramId: thread.diagramId,
      id: thread.id,
      resolvedAt: toNullableIsoDateTime(thread.resolvedAt),
      resolvedById: thread.resolvedById,
      status: thread.status,
      targetId: thread.targetId,
      targetType: thread.targetType as CommentTargetType,
      unreadCount: 'unreadCount' in thread && typeof thread.unreadCount === 'number' ? thread.unreadCount : 0,
      updatedAt: toIsoDateTime(thread.updatedAt),
    };
  }

  private serializeComment(comment: CommentResponseRow) {
    const isDeleted = Boolean(comment.deletedAt);
    const bodyText = isDeleted ? '' : comment.bodyText;

    return {
      author: {
        avatarUrl: comment.authorAvatarUrl,
        cursorColor: comment.authorCursorColor,
        email: comment.authorEmail,
        id: comment.authorId,
        name: comment.authorName,
      },
      body: bodyText,
      bodyFormat: comment.bodyFormat,
      // Deleted comments stay in the response as tombstones so nested replies do not lose their parent path.
      bodyJson: this.serializeCommentBodyJson(isDeleted ? createPlainTextCommentLexicalDocument('') : comment.bodyJson),
      bodyText,
      createdAt: toIsoDateTime(comment.createdAt),
      createdById: comment.createdById,
      deletedAt: toNullableIsoDateTime(comment.deletedAt),
      editedAt: toNullableIsoDateTime(comment.editedAt),
      id: comment.id,
      parentCommentId: comment.parentCommentId,
      mentionedUserIds: isDeleted ? [] : (comment.mentionedUserIds ?? []),
      replyCount: Number(comment.replyCount),
      threadId: comment.threadId,
      updatedAt: toIsoDateTime(comment.updatedAt),
    };
  }

  private serializeReadState(threadId: string, state: Awaited<ReturnType<CommentRepository['getThreadReadState']>>) {
    return {
      lastReadAt: state.readState ? toIsoDateTime(state.readState.lastReadAt) : null,
      lastReadCommentId: state.readState?.lastReadCommentId ?? null,
      readers: state.readers.map((reader) => ({
        lastReadAt: toIsoDateTime(reader.lastReadAt),
        lastReadCommentId: reader.lastReadCommentId,
        user: {
          avatarUrl: reader.userAvatarUrl,
          cursorColor: reader.userCursorColor,
          email: reader.userEmail,
          id: reader.userId,
          name: reader.userName,
        },
      })),
      threadId,
      totalReaderCount: state.totalReaderCount,
      unreadCount: state.unreadCount,
      updatedAt: state.readState ? toIsoDateTime(state.readState.updatedAt) : null,
    };
  }

  private serializeCommentBodyJson(bodyJson: unknown): CommentLexicalDocument {
    // DB writes go through normalizeCommentLexicalBody(), so reads can safely expose the stored JSON as the DTO Lexical shape.
    return bodyJson as CommentLexicalDocument;
  }

  private async resolveMentionUserIds(
    diagramId: string,
    body: { bodyJson: JsonValue; bodyText: string },
    authorId: string,
  ): Promise<string[]> {
    const nodeMentionUserIds = new Set(extractCommentMentionUserIds(body.bodyJson));

    if (nodeMentionUserIds.size === 0 && !body.bodyText.includes('@')) {
      return [];
    }

    const mentionableUsers = await this.commentRepository.getMentionableUsersForDiagram(diagramId);
    const mentionedUserIds = new Set<string>();

    for (const user of mentionableUsers) {
      if (user.userId === authorId) {
        continue;
      }

      if (
        nodeMentionUserIds.has(user.userId) ||
        matchesPlainTextMention(body.bodyText, user.name) ||
        matchesPlainTextMention(body.bodyText, user.email)
      ) {
        mentionedUserIds.add(user.userId);
      }
    }

    return [...mentionedUserIds];
  }

  private async queueCommentNotificationDelivery(payload: {
    actorId: string;
    commentId: string;
    source: 'comment.created' | 'comment.updated';
    threadId: string;
  }): Promise<void> {
    try {
      await this.backgroundJobService.enqueueCommentNotificationDelivery(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Comment writes should not fail only because an async delivery side effect cannot be queued.
      this.logger.warn(`Failed to enqueue comment notification delivery job. ${message}`);
    }
  }

  private serializeAuthor(user: AuthContext['user']) {
    return {
      avatarUrl: user.avatarUrl,
      cursorColor: user.cursorColor,
      email: user.email,
      id: user.id,
      name: user.name,
    };
  }
}

function matchesPlainTextMention(text: string, label: string): boolean {
  const mentionLabel = label.trim();

  if (mentionLabel.length === 0) {
    return false;
  }

  return new RegExp(`(^|[\\s([{])@${escapeRegExp(mentionLabel)}(?=$|[\\s.,:;!?)}\\]])`, 'iu').test(text);
}

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
