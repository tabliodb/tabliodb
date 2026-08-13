import { afterEach, describe, expect, it, vi } from 'vitest';
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
        shutdownTimeoutMs: 15_000,
      },
      server: {
        webPublicUrl: 'https://app.tabliodb.test',
      },
    })),
  };
  const mailService = {
    sendTransactionalMail: vi.fn(),
  };
  const notificationRepository = {
    getCommentDeliveryRecipients: vi.fn(),
    getCommentNotificationDelivery: vi.fn(),
  };

  function createService() {
    vi.resetAllMocks();
    configRepository.getEnv.mockReturnValue({
      backgroundJobs: {
        batchSize: 10,
        enabled: false,
        lockTtlMs: 120_000,
        pollIntervalMs: 2_500,
        shutdownTimeoutMs: 15_000,
      },
      server: {
        webPublicUrl: 'https://app.tabliodb.test',
      },
    });

    return new BackgroundJobService(
      backgroundJobRepository as never,
      configRepository as never,
      mailService as never,
      notificationRepository as never,
    );
  }

  afterEach(() => {
    vi.useRealTimers();
  });

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
    notificationRepository.getCommentNotificationDelivery.mockResolvedValue({
      actorEmail: 'actor@tabliodb.local',
      actorName: 'Comment Author',
      commentBodyText: 'Please review this column.',
      commentCreatedAt: new Date('2026-08-09T03:00:00.000Z'),
      commentId: 'comment-id',
      diagramId: 'diagram-id',
      diagramName: 'Library schema',
      organizationName: 'Library Workspace',
      organizationSlug: 'library-workspace',
      projectId: 'project-id',
      projectName: 'Library System',
      recipients: [
        {
          email: 'owner@tabliodb.local',
          name: 'Owner',
          reasons: ['mention', 'reply'],
          userId: 'owner-id',
        },
        {
          email: 'teammate@tabliodb.local',
          name: 'Teammate',
          reasons: ['mention'],
          userId: 'teammate-id',
        },
      ],
      threadId: 'thread-id',
    });
    mailService.sendTransactionalMail.mockResolvedValue({
      messageId: 'smtp-message-id',
      recipientCount: 1,
      status: 'sent',
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
      emailSentCount: 2,
      emailSkippedCount: 0,
      mentionRecipientCount: 2,
      recipientCount: 2,
      replyRecipientCount: 1,
      source: 'comment.created',
      status: 'delivered',
      threadId: 'thread-id',
    });
    expect(notificationRepository.getCommentDeliveryRecipients).toHaveBeenCalledWith({
      actorId: 'actor-id',
      commentId: 'comment-id',
    });
    expect(mailService.sendTransactionalMail).toHaveBeenCalledTimes(2);
    expect(mailService.sendTransactionalMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Comment Author mentioned you in Library schema',
        to: [
          {
            email: 'owner@tabliodb.local',
            name: 'Owner',
          },
        ],
      }),
    );
  });

  it('does not schedule another poll after shutdown starts during an active tick', async () => {
    vi.useFakeTimers();
    const service = createService();
    let finishRequeue!: () => void;

    configRepository.getEnv.mockReturnValue({
      backgroundJobs: {
        batchSize: 10,
        enabled: true,
        lockTtlMs: 120_000,
        pollIntervalMs: 2_500,
        shutdownTimeoutMs: 15_000,
      },
      server: {
        webPublicUrl: 'https://app.tabliodb.test',
      },
    });
    backgroundJobRepository.requeueExpiredRunningJobs.mockReturnValue(
      new Promise<void>((resolve) => {
        finishRequeue = resolve;
      }),
    );
    backgroundJobRepository.claimNextBatch.mockResolvedValue([]);

    service.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);

    const destroyPromise = service.onModuleDestroy();

    finishRequeue();
    await destroyPromise;

    // Shutdown must prevent the tick finally-block from scheduling the next polling timer.
    expect(vi.getTimerCount()).toBe(0);
    expect(backgroundJobRepository.claimNextBatch).toHaveBeenCalledTimes(1);
  });

  it('bounds shutdown waiting when the active tick does not finish', async () => {
    vi.useFakeTimers();
    const service = createService();
    const warnSpy = vi.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);

    configRepository.getEnv.mockReturnValue({
      backgroundJobs: {
        batchSize: 10,
        enabled: true,
        lockTtlMs: 120_000,
        pollIntervalMs: 2_500,
        shutdownTimeoutMs: 250,
      },
      server: {
        webPublicUrl: 'https://app.tabliodb.test',
      },
    });
    backgroundJobRepository.requeueExpiredRunningJobs.mockReturnValue(new Promise(() => undefined));

    service.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);

    const destroyPromise = service.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(250);

    await expect(destroyPromise).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      'Background job shutdown timed out while waiting for the active tick to finish.',
    );
  });
});
