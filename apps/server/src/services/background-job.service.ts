import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { BackgroundJobType } from '../constants.js';
import { ConfigRepository } from '../repositories/config.repository.js';
import {
  BackgroundJobRecord,
  BackgroundJobRepository,
  type BackgroundJobEnqueueOptions,
} from '../repositories/background-job.repository.js';
import { NotificationRepository } from '../repositories/notification.repository.js';
import type { JsonValue } from '../schema/index.js';

type CommentNotificationDeliveryPayload = {
  actorId: string;
  commentId: string;
  source: 'comment.created' | 'comment.updated';
  threadId: string;
};

@Injectable()
export class BackgroundJobService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackgroundJobService.name);
  private readonly workerId = `${hostname()}:${process.pid}:${randomUUID()}`;
  private timer: NodeJS.Timeout | null = null;
  private isTickRunning = false;

  constructor(
    private readonly backgroundJobRepository: BackgroundJobRepository,
    private readonly configRepository: ConfigRepository,
    private readonly notificationRepository: NotificationRepository,
  ) {}

  onModuleInit(): void {
    const { backgroundJobs } = this.configRepository.getEnv();

    if (!backgroundJobs.enabled) {
      this.logger.log('Background job worker is disabled.');
      return;
    }

    this.scheduleTick(0);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  enqueueCommentNotificationDelivery(payload: CommentNotificationDeliveryPayload) {
    return this.enqueue({
      maxAttempts: 5,
      payload,
      queue: 'notifications',
      type: BackgroundJobType.CommentNotificationDelivery,
    });
  }

  enqueue(options: BackgroundJobEnqueueOptions): Promise<BackgroundJobRecord> {
    return this.backgroundJobRepository.enqueue(options);
  }

  private scheduleTick(delayMs: number): void {
    this.timer = setTimeout(() => void this.tick(), delayMs);
    this.timer.unref?.();
  }

  private async tick(): Promise<void> {
    const { backgroundJobs } = this.configRepository.getEnv();

    if (!backgroundJobs.enabled) {
      return;
    }

    if (this.isTickRunning) {
      this.scheduleTick(backgroundJobs.pollIntervalMs);
      return;
    }

    this.isTickRunning = true;

    try {
      await this.backgroundJobRepository.requeueExpiredRunningJobs(backgroundJobs.lockTtlMs);

      const jobs = await this.backgroundJobRepository.claimNextBatch({
        limit: backgroundJobs.batchSize,
        queues: ['notifications'],
        workerId: this.workerId,
      });

      for (const job of jobs) {
        await this.processJob(job);
      }
    } catch (error) {
      this.logger.warn(`Background job tick failed. ${formatErrorMessage(error)}`);
    } finally {
      this.isTickRunning = false;
      this.scheduleTick(backgroundJobs.pollIntervalMs);
    }
  }

  private async processJob(job: BackgroundJobRecord): Promise<void> {
    try {
      const result = await this.runJob(job);
      await this.backgroundJobRepository.complete(job.id, result);
    } catch (error) {
      const retryAt = new Date(Date.now() + this.getRetryDelayMs(job.attempts));

      await this.backgroundJobRepository.fail(job, serializeJobError(error), retryAt);
    }
  }

  private async runJob(job: BackgroundJobRecord): Promise<JsonValue> {
    if (job.type === BackgroundJobType.CommentNotificationDelivery) {
      return this.processCommentNotificationDelivery(job.payload);
    }

    throw new Error(`Unknown background job type: ${job.type}`);
  }

  private async processCommentNotificationDelivery(payload: JsonValue): Promise<JsonValue> {
    const parsedPayload = parseCommentNotificationDeliveryPayload(payload);
    const recipients = await this.notificationRepository.getCommentDeliveryRecipients({
      actorId: parsedPayload.actorId,
      commentId: parsedPayload.commentId,
    });
    const recipientIds = new Set([
      ...recipients.mentionUserIds,
      ...(recipients.replyUserId ? [recipients.replyUserId] : []),
    ]);

    return {
      commentId: parsedPayload.commentId,
      mentionRecipientCount: recipients.mentionUserIds.length,
      recipientCount: recipientIds.size,
      replyRecipientCount: recipients.replyUserId ? 1 : 0,
      source: parsedPayload.source,
      threadId: parsedPayload.threadId,
    };
  }

  private getRetryDelayMs(attempts: number): number {
    // Exponential backoff keeps a broken downstream integration from hot-looping while still retrying quickly in development.
    return Math.min(60_000, 1_000 * 2 ** Math.max(0, attempts - 1));
  }
}

function parseCommentNotificationDeliveryPayload(payload: JsonValue): CommentNotificationDeliveryPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid notification delivery payload.');
  }

  const record = payload as Record<string, JsonValue>;
  if (
    typeof record.actorId !== 'string' ||
    typeof record.commentId !== 'string' ||
    typeof record.threadId !== 'string' ||
    (record.source !== 'comment.created' && record.source !== 'comment.updated')
  ) {
    throw new Error('Invalid notification delivery payload.');
  }

  return {
    actorId: record.actorId,
    commentId: record.commentId,
    source: record.source,
    threadId: record.threadId,
  };
}

function serializeJobError(error: unknown): JsonValue {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack ?? null,
    };
  }

  return {
    message: String(error),
    name: 'UnknownError',
  };
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
