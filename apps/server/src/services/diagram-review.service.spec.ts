import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Permission } from '@tabliodb/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditAction } from '../constants.js';
import type { AuthContext } from '../database.js';
import { DiagramReviewService } from './diagram-review.service.js';

const auth: AuthContext = {
  request: {
    ipAddress: '127.0.0.1',
    requestId: 'request-id',
    userAgent: 'vitest',
  },
  user: {
    avatarUrl: null,
    cursorColor: '#58cc02',
    email: 'reviewer@tabliodb.local',
    id: 'reviewer-id',
    name: 'Reviewer User',
    passwordChangeRequired: false,
  },
};

const reviewEvent = {
  action: 'approved' as const,
  createdAt: new Date('2026-08-02T04:00:00.000Z'),
  createdById: 'reviewer-id',
  diagramId: 'diagram-id',
  id: 'review-event-id',
  message: null,
  nextStatus: 'approved' as const,
  previousStatus: 'reviewed' as const,
  reviewerAvatarUrl: null,
  reviewerCursorColor: '#58cc02',
  reviewerEmail: 'reviewer@tabliodb.local',
  reviewerId: 'reviewer-id',
  reviewerName: 'Reviewer User',
  snapshotId: 'snapshot-id',
};

describe(DiagramReviewService.name, () => {
  const auditLogRepository = {
    create: vi.fn(),
  };
  const diagramReviewRepository = {
    createReviewEvent: vi.fn(),
    getReviewSummary: vi.fn(),
    listReviewEvents: vi.fn(),
  };
  const diagramService = {
    requireDiagram: vi.fn(),
  };

  let service: DiagramReviewService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new DiagramReviewService(
      auditLogRepository as never,
      diagramReviewRepository as never,
      diagramService as never,
    );
  });

  it('returns the current diagram review summary after diagram read permission passes', async () => {
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });
    diagramReviewRepository.getReviewSummary.mockResolvedValue({
      approvedCount: 1,
      changesRequestedCount: 0,
      commentedCount: 2,
      diagram: {
        id: 'diagram-id',
        status: 'approved',
      },
      eventCount: 3,
      latestEvent: reviewEvent,
      recentEvents: [reviewEvent],
    });

    await expect(service.getSummary(auth, 'diagram-id')).resolves.toMatchObject({
      approvedCount: 1,
      currentStatus: 'approved',
      diagramId: 'diagram-id',
      eventCount: 3,
      latestEvent: {
        action: 'approved',
        createdAt: '2026-08-02T04:00:00.000Z',
        reviewer: {
          email: 'reviewer@tabliodb.local',
          id: 'reviewer-id',
        },
      },
    });

    expect(diagramService.requireDiagram).toHaveBeenCalledWith(auth, 'diagram-id', Permission.DiagramRead);
  });

  it('rejects creating review actions without diagram comment permission', async () => {
    diagramService.requireDiagram.mockRejectedValue(new ForbiddenException());

    await expect(
      service.createAction(auth, 'diagram-id', { action: 'approved', message: 'Ready.' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(diagramService.requireDiagram).toHaveBeenCalledWith(auth, 'diagram-id', Permission.DiagramComment);
    expect(diagramReviewRepository.createReviewEvent).not.toHaveBeenCalled();
  });

  it('creates a changes-requested review event and records an audit entry', async () => {
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });
    diagramReviewRepository.createReviewEvent.mockResolvedValue({
      event: {
        ...reviewEvent,
        action: 'changes_requested',
        nextStatus: 'changes_requested',
      },
      scope: {
        id: 'diagram-id',
        organizationId: 'organization-id',
        projectId: 'project-id',
        status: 'changes_requested',
      },
    });
    diagramReviewRepository.getReviewSummary.mockResolvedValue({
      approvedCount: 0,
      changesRequestedCount: 1,
      commentedCount: 0,
      diagram: {
        id: 'diagram-id',
        status: 'changes_requested',
      },
      eventCount: 1,
      latestEvent: {
        ...reviewEvent,
        action: 'changes_requested',
        nextStatus: 'changes_requested',
      },
      recentEvents: [
        {
          ...reviewEvent,
          action: 'changes_requested',
          nextStatus: 'changes_requested',
        },
      ],
    });

    await expect(
      service.createAction(auth, 'diagram-id', {
        action: 'changes_requested',
        message: 'Please add missing foreign-key indexes.',
      }),
    ).resolves.toMatchObject({
      currentStatus: 'changes_requested',
      changesRequestedCount: 1,
    });

    expect(diagramReviewRepository.createReviewEvent).toHaveBeenCalledWith({
      action: 'changes_requested',
      createdById: 'reviewer-id',
      diagramId: 'diagram-id',
      message: 'Please add missing foreign-key indexes.',
    });
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.DiagramReviewChangesRequested,
        actorId: 'reviewer-id',
        diagramId: 'diagram-id',
        entityId: 'review-event-id',
        entityType: 'diagram_review_event',
        metadata: {
          action: 'changes_requested',
          nextStatus: 'changes_requested',
          previousStatus: 'reviewed',
        },
        organizationId: 'organization-id',
        projectId: 'project-id',
        requestId: 'request-id',
      }),
    );
  });

  it('throws not found when the repository cannot find the review scope', async () => {
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });
    diagramReviewRepository.getReviewSummary.mockResolvedValue(undefined);

    await expect(service.getSummary(auth, 'diagram-id')).rejects.toBeInstanceOf(NotFoundException);
  });
});
