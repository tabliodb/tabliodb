import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Selectable } from 'kysely';
import { Permission } from '@tabliodb/shared';
import { AuthContext } from '../database.js';
import {
  CommentReplyCreateDto,
  CommentThreadCreateDto,
  CommentThreadListQueryDto,
  CommentUpdateDto,
} from '../dtos/comment.dto.js';
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
import { DiagramService } from './diagram.service.js';

type CommentTargetType =
  'check' | 'column' | 'diagram' | 'enum' | 'group' | 'index' | 'note' | 'relationship' | 'table';
type CommentThreadRow = Selectable<CommentThreadTable>;

@Injectable()
export class CommentService {
  constructor(
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

  async getThreadComments(auth: AuthContext, threadId: string, query: CommentThreadListQueryDto) {
    const thread = await this.requireCommentThread(auth, threadId, Permission.DiagramRead);
    const comments = await this.commentRepository.getComments(thread.id, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
    });

    return {
      ...comments,
      items: comments.items.map((comment) => this.serializeComment(comment)),
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
      mentionUserIds,
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

  async resolveThread(auth: AuthContext, threadId: string) {
    const thread = await this.requireCommentThread(auth, threadId, Permission.DiagramComment);
    const updatedThread = await this.commentRepository.resolveThread(thread.id, auth.user.id);

    return this.serializeThread(updatedThread);
  }

  async unresolveThread(auth: AuthContext, threadId: string) {
    const thread = await this.requireCommentThread(auth, threadId, Permission.DiagramComment);
    const updatedThread = await this.commentRepository.unresolveThread(thread.id);

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

  private serializeComment(comment: Awaited<ReturnType<CommentRepository['getComments']>>['items'][number]) {
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
