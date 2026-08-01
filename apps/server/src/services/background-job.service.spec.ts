import { describe, expect, it, vi } from 'vitest';
import { BackgroundJobType } from '../constants.js';
import { BackgroundJobService } from './background-job.service.js';

describe(BackgroundJobService.name, () => {
  const backgroundJobRepository = {
    claimNextBatch: vi.fn(),
    complete: vi.fn(),
    enqueue: vi.fn(),
    fail: vi.fn(),
    requeueExpiredRunningJobs: vi.fn(),
  };
  const configRepository = {
    getEnv: vi.fn(() => ({
      backgroundJobs: {
        batchSize: 10,
        enabled: false,
        lockTtlMs: 120_000,
        pollIntervalMs: 2_500,
      },
    })),
  };
  const notificationRepository = {
    getCommentDeliveryRecipients: vi.fn(),
  };

  function createService() {
    vi.resetAllMocks();
    configRepository.getEnv.mockReturnValue({
      backgroundJobs: {
        batchSize: 10,
        enabled: false,
        lockTtlMs: 120_000,
        pollIntervalMs: 2_500,
      },
    });

    return new BackgroundJobService(
      backgroundJobRepository as never,
      configRepository as never,
      notificationRepository as never,
    );
  }

  it('enqueues comment notification delivery in the notifications queue', async () => {
    const service = createService();

    backgroundJobRepository.enqueue.mockResolvedValue({ id: 'job-id' });

    await service.enqueueCommentNotificationDelivery({
      actorId: 'actor-id',
      commentId: 'comment-id',
      source: 'comment.created',
      threadId: 'thread-id',
    });

    expect(backgroundJobRepository.enqueue).toHaveBeenCalledWith({
      maxAttempts: 5,
      payload: {
        actorId: 'actor-id',
        commentId: 'comment-id',
        source: 'comment.created',
        threadId: 'thread-id',
      },
      queue: 'notifications',
      type: BackgroundJobType.CommentNotificationDelivery,
    });
  });

  it('summarizes notification recipients without double-counting mentioned reply owners', async () => {
    const service = createService();

    notificationRepository.getCommentDeliveryRecipients.mockResolvedValue({
      mentionUserIds: ['owner-id', 'teammate-id'],
      replyUserId: 'owner-id',
    });

    await expect(
      service['processCommentNotificationDelivery']({
        actorId: 'actor-id',
        commentId: 'comment-id',
        source: 'comment.created',
        threadId: 'thread-id',
      }),
    ).resolves.toEqual({
      commentId: 'comment-id',
      mentionRecipientCount: 2,
      recipientCount: 2,
      replyRecipientCount: 1,
      source: 'comment.created',
      threadId: 'thread-id',
    });
    expect(notificationRepository.getCommentDeliveryRecipients).toHaveBeenCalledWith({
      actorId: 'actor-id',
      commentId: 'comment-id',
    });
  });
});
