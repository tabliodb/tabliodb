import { Injectable, NotFoundException } from '@nestjs/common';
import { Permission } from '@tabliodb/shared';
import { AuditAction } from '../constants.js';
import type { AuthContext } from '../database.js';
import {
  DiagramReviewActionCreateDto,
  DiagramReviewEventListQueryDto,
  DiagramReviewSummaryDto,
} from '../dtos/diagram-review.dto.js';
import { AuditLogRepository } from '../repositories/audit-log.repository.js';
import {
  DiagramReviewRepository,
  type DiagramReviewAction,
  type DiagramReviewStatus,
} from '../repositories/diagram-review.repository.js';
import { toIsoDateTime } from '../utils/date-time.js';
import { clampPaginationLimit } from '../utils/pagination.js';
import { DiagramService } from './diagram.service.js';

type DiagramReviewEventRow = NonNullable<
  Awaited<ReturnType<DiagramReviewRepository['getReviewSummary']>>
>['recentEvents'][number];

@Injectable()
export class DiagramReviewService {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly diagramReviewRepository: DiagramReviewRepository,
    private readonly diagramService: DiagramService,
  ) {}

  async getSummary(auth: AuthContext, diagramId: string): Promise<DiagramReviewSummaryDto> {
    await this.diagramService.requireDiagram(auth, diagramId, Permission.DiagramRead);
    const summary = await this.diagramReviewRepository.getReviewSummary(diagramId);

    if (!summary) {
      throw new NotFoundException('Diagram review was not found.');
    }

    return {
      approvedCount: summary.approvedCount,
      changesRequestedCount: summary.changesRequestedCount,
      commentedCount: summary.commentedCount,
      currentStatus: summary.diagram.status,
      diagramId,
      eventCount: summary.eventCount,
      latestEvent: summary.latestEvent ? this.serializeEvent(summary.latestEvent) : null,
      recentEvents: summary.recentEvents.map((event) => this.serializeEvent(event)),
    };
  }

  async listEvents(auth: AuthContext, diagramId: string, query: DiagramReviewEventListQueryDto) {
    await this.diagramService.requireDiagram(auth, diagramId, Permission.DiagramRead);
    const events = await this.diagramReviewRepository.listReviewEvents(diagramId, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
    });

    return {
      ...events,
      items: events.items.map((event) => this.serializeEvent(event)),
    };
  }

  async createAction(auth: AuthContext, diagramId: string, dto: DiagramReviewActionCreateDto) {
    await this.diagramService.requireDiagram(auth, diagramId, Permission.DiagramComment);

    const result = await this.diagramReviewRepository.createReviewEvent({
      action: dto.action,
      createdById: auth.user.id,
      diagramId,
      message: normalizeDiagramReviewMessage(dto.message),
    });
    await this.recordReviewAudit(auth, result.scope, result.event.id, dto.action, result.event.previousStatus);

    return this.getSummary(auth, diagramId);
  }

  async recordCommented(auth: AuthContext, diagramId: string, metadata: { commentId: string; threadId: string }) {
    const result = await this.diagramReviewRepository.createReviewEvent({
      action: 'commented',
      createdById: auth.user.id,
      diagramId,
      message: null,
    });

    await this.recordReviewAudit(auth, result.scope, result.event.id, 'commented', result.event.previousStatus, metadata);
  }

  private recordReviewAudit(
    auth: AuthContext,
    scope: {
      id: string;
      organizationId: string;
      folderId: string | null;
      status: DiagramReviewStatus;
    },
    eventId: string,
    action: DiagramReviewAction,
    previousStatus: DiagramReviewStatus,
    metadata: Record<string, string> = {},
  ) {
    return this.auditLogRepository.create({
      action: getDiagramReviewAuditAction(action),
      actorId: auth.user.id,
      diagramId: scope.id,
      entityId: eventId,
      entityType: 'diagram_review_event',
      ipAddress: auth.request?.ipAddress ?? null,
      metadata: {
        ...metadata,
        action,
        nextStatus: scope.status,
        previousStatus,
      },
      organizationId: scope.organizationId,
      folderId: scope.folderId,
      requestId: auth.request?.requestId ?? null,
      userAgent: auth.request?.userAgent ?? null,
    });
  }

  private serializeEvent(event: DiagramReviewEventRow) {
    return {
      action: event.action,
      createdAt: toIsoDateTime(event.createdAt),
      createdById: event.createdById,
      diagramId: event.diagramId,
      id: event.id,
      message: event.message,
      nextStatus: event.nextStatus,
      previousStatus: event.previousStatus,
      reviewer: {
        avatarUrl: event.reviewerAvatarUrl,
        cursorColor: event.reviewerCursorColor,
        email: event.reviewerEmail,
        id: event.reviewerId,
        name: event.reviewerName,
      },
      snapshotId: event.snapshotId,
    };
  }
}

function normalizeDiagramReviewMessage(message: string | null | undefined): string | null {
  const normalized = message?.trim() ?? '';

  return normalized.length > 0 ? normalized : null;
}

function getDiagramReviewAuditAction(action: DiagramReviewAction): AuditAction {
  if (action === 'approved') {
    return AuditAction.DiagramReviewApproved;
  }

  if (action === 'changes_requested') {
    return AuditAction.DiagramReviewChangesRequested;
  }

  return AuditAction.DiagramReviewCommented;
}
