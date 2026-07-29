import { Injectable } from '@nestjs/common';
import { AuthContext } from '../database.js';
import { CommentThreadCreateDto, CommentThreadListQueryDto } from '../dtos/comment.dto.js';
import { CommentRepository } from '../repositories/comment.repository.js';
import { clampPaginationLimit } from '../utils/pagination.js';
import { DiagramService } from './diagram.service.js';

@Injectable()
export class CommentService {
  constructor(
    private readonly commentRepository: CommentRepository,
    private readonly diagramService: DiagramService,
  ) {}

  async createThread(auth: AuthContext, dto: CommentThreadCreateDto) {
    await this.diagramService.requireDiagram(auth, dto.diagramId);

    return this.commentRepository.createThreadWithComment({
      diagramId: dto.diagramId,
      targetType: dto.targetType,
      targetId: dto.targetId,
      body: dto.body,
      createdById: auth.user.id,
    });
  }

  async getThreads(auth: AuthContext, diagramId: string, query: CommentThreadListQueryDto) {
    await this.diagramService.requireDiagram(auth, diagramId);

    return this.commentRepository.getThreads(diagramId, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
    });
  }
}
