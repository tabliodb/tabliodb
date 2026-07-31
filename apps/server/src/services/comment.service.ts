import { Injectable, NotFoundException } from '@nestjs/common';
import type { Selectable } from 'kysely';
import { Permission } from '@tabliodb/shared';
import { AuthContext } from '../database.js';
import { CommentReplyCreateDto, CommentThreadCreateDto, CommentThreadListQueryDto } from '../dtos/comment.dto.js';
import { CommentRepository } from '../repositories/comment.repository.js';
import type { CommentThreadTable } from '../schema/index.js';
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

    const result = await this.commentRepository.createThreadWithComment({
      diagramId: dto.diagramId,
      targetType: dto.targetType,
      targetId: dto.targetId,
      body: dto.body,
      createdById: auth.user.id,
    });

    return {
      thread: this.serializeThread(result.thread),
      comment: {
        author: this.serializeAuthor(auth.user),
        id: result.comment.id,
        threadId: result.comment.threadId,
        body: result.comment.body,
        bodyFormat: result.comment.bodyFormat,
        createdById: result.comment.createdById,
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
      items: comments.items.map((comment) => ({
        author: {
          avatarUrl: comment.authorAvatarUrl,
          cursorColor: comment.authorCursorColor,
          email: comment.authorEmail,
          id: comment.authorId,
          name: comment.authorName,
        },
        body: comment.body,
        bodyFormat: comment.bodyFormat,
        createdAt: toIsoDateTime(comment.createdAt),
        createdById: comment.createdById,
        editedAt: toNullableIsoDateTime(comment.editedAt),
        id: comment.id,
        parentCommentId: comment.parentCommentId,
        replyCount: Number(comment.replyCount),
        threadId: comment.threadId,
        updatedAt: toIsoDateTime(comment.updatedAt),
      })),
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

    if (parentCommentId) {
      const parentComment = await this.commentRepository.getCommentInThread(parentCommentId, thread.id);

      if (!parentComment) {
        throw new NotFoundException('Parent comment was not found in this thread.');
      }
    }

    const result = await this.commentRepository.createCommentReply({
      body: dto.body,
      createdById: auth.user.id,
      parentCommentId,
      threadId: thread.id,
    });

    return {
      thread: this.serializeThread(result.thread),
      comment: {
        author: this.serializeAuthor(auth.user),
        body: result.comment.body,
        bodyFormat: result.comment.bodyFormat,
        createdAt: toIsoDateTime(result.comment.createdAt),
        createdById: result.comment.createdById,
        editedAt: toNullableIsoDateTime(result.comment.editedAt),
        id: result.comment.id,
        parentCommentId: result.comment.parentCommentId,
        replyCount: 0,
        threadId: result.comment.threadId,
        updatedAt: toIsoDateTime(result.comment.updatedAt),
      },
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
