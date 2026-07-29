import { Injectable } from '@nestjs/common';
import { Permission } from '@tabliodb/shared';
import { AuthContext } from '../database.js';
import { CommentThreadCreateDto, CommentThreadListQueryDto } from '../dtos/comment.dto.js';
import { CommentRepository } from '../repositories/comment.repository.js';
import { toIsoDateTime, toNullableIsoDateTime } from '../utils/date-time.js';
import { clampPaginationLimit } from '../utils/pagination.js';
import { DiagramService } from './diagram.service.js';

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
      thread: {
        id: result.thread.id,
        diagramId: result.thread.diagramId,
        targetType: result.thread.targetType,
        targetId: result.thread.targetId,
        resolvedAt: toNullableIsoDateTime(result.thread.resolvedAt),
        createdAt: toIsoDateTime(result.thread.createdAt),
        updatedAt: toIsoDateTime(result.thread.updatedAt),
      },
      comment: {
        id: result.comment.id,
        threadId: result.comment.threadId,
        body: result.comment.body,
        createdAt: toIsoDateTime(result.comment.createdAt),
        updatedAt: toIsoDateTime(result.comment.updatedAt),
      },
    };
  }

  async getThreads(auth: AuthContext, diagramId: string, query: CommentThreadListQueryDto) {
    await this.diagramService.requireDiagram(auth, diagramId, Permission.DiagramRead);

    const threads = await this.commentRepository.getThreads(diagramId, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
    });

    return {
      ...threads,
      items: threads.items.map((thread) => ({
        ...thread,
        // Comment thread timestamps dipakai UI review, jadi response diserialisasi konsisten sebagai ISO string.
        resolvedAt: toNullableIsoDateTime(thread.resolvedAt),
        createdAt: toIsoDateTime(thread.createdAt),
        updatedAt: toIsoDateTime(thread.updatedAt),
      })),
    };
  }
}
