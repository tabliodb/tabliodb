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
import {
  NotificationRepository,
  type CommentNotificationDeliveryContext,
  type CommentNotificationDeliveryRecipient,
} from '../repositories/notification.repository.js';
import type { JsonValue } from '../schema/index.js';
import { MailService, type MailDeliveryResult } from './mail.service.js';

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
  private currentTickPromise: Promise<void> | null = null;
  private isShuttingDown = false;
  private timer: NodeJS.Timeout | null = null;
  private isTickRunning = false;

  constructor(
    private readonly backgroundJobRepository: BackgroundJobRepository,
    private readonly configRepository: ConfigRepository,
    private readonly mailService: MailService,
    private readonly notificationRepository: NotificationRepository,
  ) {}

  onModuleInit(): void {
    const { backgroundJobs } = this.configRepository.getEnv();

    if (!backgroundJobs.enabled) {
      this.logger.log('Background job worker is disabled.');
      return;
    }

    this.isShuttingDown = false;
    this.scheduleTick(0);
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    await this.waitForCurrentTick();
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
    if (this.isShuttingDown) {
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;

      const tickPromise = this.tick();
      this.currentTickPromise = tickPromise;

      void tickPromise.finally(() => {
        if (this.currentTickPromise === tickPromise) {
          this.currentTickPromise = null;
        }
      });
    }, delayMs);
    this.timer.unref?.();
  }

  private async tick(): Promise<void> {
    const { backgroundJobs } = this.configRepository.getEnv();

    if (!backgroundJobs.enabled || this.isShuttingDown) {
      return;
    }

    if (this.isTickRunning) {
      if (!this.isShuttingDown) {
        this.scheduleTick(backgroundJobs.pollIntervalMs);
      }
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

      if (!this.isShuttingDown) {
        this.scheduleTick(backgroundJobs.pollIntervalMs);
      }
    }
  }

  private async waitForCurrentTick(): Promise<void> {
    const currentTickPromise = this.currentTickPromise;

    if (!currentTickPromise) {
      return;
    }

    const { backgroundJobs } = this.configRepository.getEnv();
    const didTimeOut = await waitForPromiseOrTimeout(currentTickPromise, Math.max(0, backgroundJobs.shutdownTimeoutMs));

    if (didTimeOut) {
      this.logger.warn('Background job shutdown timed out while waiting for the active tick to finish.');
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
    const [recipientSummary, delivery] = await Promise.all([
      this.notificationRepository.getCommentDeliveryRecipients({
        actorId: parsedPayload.actorId,
        commentId: parsedPayload.commentId,
      }),
      this.notificationRepository.getCommentNotificationDelivery({
        actorId: parsedPayload.actorId,
        commentId: parsedPayload.commentId,
      }),
    ]);
    const recipientIds = new Set([
      ...recipientSummary.mentionUserIds,
      ...(recipientSummary.replyUserId ? [recipientSummary.replyUserId] : []),
    ]);

    if (!delivery || delivery.recipients.length === 0) {
      return {
        commentId: parsedPayload.commentId,
        emailSentCount: 0,
        emailSkippedCount: 0,
        mentionRecipientCount: recipientSummary.mentionUserIds.length,
        recipientCount: recipientIds.size,
        replyRecipientCount: recipientSummary.replyUserId ? 1 : 0,
        source: parsedPayload.source,
        status: 'skipped',
        threadId: parsedPayload.threadId,
      };
    }

    const mailResults = await this.sendCommentNotificationEmails(delivery, parsedPayload.source);

    return {
      commentId: parsedPayload.commentId,
      emailSentCount: mailResults.filter((result) => result.status === 'sent').length,
      emailSkippedCount: mailResults.filter((result) => result.status === 'skipped').length,
      mentionRecipientCount: recipientSummary.mentionUserIds.length,
      recipientCount: recipientIds.size,
      replyRecipientCount: recipientSummary.replyUserId ? 1 : 0,
      source: parsedPayload.source,
      status: 'delivered',
      threadId: parsedPayload.threadId,
    };
  }

  private async sendCommentNotificationEmails(
    delivery: CommentNotificationDeliveryContext,
    source: CommentNotificationDeliveryPayload['source'],
  ): Promise<MailDeliveryResult[]> {
    const results: MailDeliveryResult[] = [];

    for (const recipient of delivery.recipients) {
      const url = this.createCommentNotificationUrl(delivery);

      // Send one message per recipient so private email addresses are not exposed to other project members.
      results.push(
        await this.mailService.sendTransactionalMail({
          html: createCommentNotificationHtml(delivery, recipient, source, url),
          subject: createCommentNotificationSubject(delivery, recipient),
          text: createCommentNotificationText(delivery, recipient, source, url),
          to: [
            {
              email: recipient.email,
              name: recipient.name,
            },
          ],
        }),
      );
    }

    return results;
  }

  private createCommentNotificationUrl(delivery: CommentNotificationDeliveryContext): string {
    const baseUrl = this.configRepository.getEnv().server.webPublicUrl;
    const pathSegments = delivery.projectId
      ? ['workspaces', delivery.organizationSlug, 'projects', delivery.projectId, 'diagrams', delivery.diagramId]
      : ['workspaces', delivery.organizationSlug, 'diagrams', delivery.diagramId];
    const path = pathSegments
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const url = new URL(`/${path}`, baseUrl);

    url.searchParams.set('commentThreadId', delivery.threadId);

    return url.toString();
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

function createCommentNotificationSubject(
  delivery: CommentNotificationDeliveryContext,
  recipient: CommentNotificationDeliveryRecipient,
): string {
  return `${delivery.actorName} ${createCommentNotificationReason(recipient)} in ${delivery.diagramName}`;
}

function createCommentNotificationText(
  delivery: CommentNotificationDeliveryContext,
  recipient: CommentNotificationDeliveryRecipient,
  source: CommentNotificationDeliveryPayload['source'],
  url: string,
): string {
  const action = source === 'comment.updated' ? 'updated a comment' : 'left a comment';
  const locationLabel = createCommentNotificationLocation(delivery);

  return [
    `Hi ${recipient.name},`,
    '',
    `${delivery.actorName} ${createCommentNotificationReason(recipient)} and ${action} in ${locationLabel}.`,
    '',
    truncateCommentBody(delivery.commentBodyText),
    '',
    `Open comment: ${url}`,
  ].join('\n');
}

function createCommentNotificationHtml(
  delivery: CommentNotificationDeliveryContext,
  recipient: CommentNotificationDeliveryRecipient,
  source: CommentNotificationDeliveryPayload['source'],
  url: string,
): string {
  const action = source === 'comment.updated' ? 'updated a comment' : 'left a comment';
  const locationLabel = createCommentNotificationLocation(delivery);

  return [
    '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#2f3542">',
    `<p>Hi ${escapeHtml(recipient.name)},</p>`,
    `<p><strong>${escapeHtml(delivery.actorName)}</strong> ${escapeHtml(createCommentNotificationReason(recipient))} and ${escapeHtml(action)} in <strong>${escapeHtml(locationLabel)}</strong>.</p>`,
    `<blockquote style="border-left:4px solid #58cc02;margin:16px 0;padding:8px 12px;color:#4b5563;background:#f7fee7">${escapeHtml(truncateCommentBody(delivery.commentBodyText))}</blockquote>`,
    `<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#58cc02;color:#ffffff;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:10px">Open comment</a></p>`,
    '</div>',
  ].join('');
}

function createCommentNotificationLocation(delivery: CommentNotificationDeliveryContext): string {
  // Root diagrams have no project/folder, so notification copy falls back to workspace / diagram.
  return `${delivery.projectName ?? delivery.organizationName} / ${delivery.diagramName}`;
}

function createCommentNotificationReason(recipient: CommentNotificationDeliveryRecipient): string {
  if (recipient.reasons.includes('mention')) {
    return 'mentioned you';
  }

  return 'replied to you';
}

function truncateCommentBody(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim();

  return compact.length > 320 ? `${compact.slice(0, 317)}...` : compact;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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

async function waitForPromiseOrTimeout(promise: Promise<unknown>, timeoutMs: number): Promise<boolean> {
  if (timeoutMs <= 0) {
    return true;
  }

  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise.then(
        () => false,
        () => false,
      ),
      new Promise<boolean>((resolve) => {
        timeout = setTimeout(() => resolve(true), timeoutMs);
        timeout.unref?.();
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
