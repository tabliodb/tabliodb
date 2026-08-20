import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable, type Subscriber } from 'rxjs';
import { RedisService } from './redis.service.js';

type NotificationRealtimeReason = 'comment_changed' | 'thread_read';

type NotificationRealtimeData = {
  commentId?: string;
  occurredAt: string;
  reason: NotificationRealtimeReason;
  threadId?: string;
};

type NotificationRealtimeRedisMessage = {
  data: NotificationRealtimeData;
  originId: string;
  userId: string;
};

const notificationRedisChannel = 'notifications:changed';
const notificationSseEventName = 'notification.changed';
const notificationReadyEventName = 'notification.ready';
const notificationHeartbeatEventName = 'notification.heartbeat';
const heartbeatIntervalMs = 30_000;

@Injectable()
export class NotificationRealtimeService implements OnModuleDestroy {
  private readonly instanceId = randomUUID();
  private readonly subscribersByUserId = new Map<string, Set<Subscriber<MessageEvent>>>();
  private redisUnsubscribe: (() => Promise<void>) | null = null;
  private redisSubscriptionPromise: Promise<void> | null = null;

  constructor(private readonly redisService: RedisService) {}

  streamForUser(userId: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const subscribers = this.subscribersByUserId.get(userId) ?? new Set<Subscriber<MessageEvent>>();

      subscribers.add(subscriber);
      this.subscribersByUserId.set(userId, subscribers);

      // Event ready membantu client membedakan "stream berhasil terbuka" dari koneksi yang diam karena belum ada notifikasi.
      subscriber.next({
        data: {
          connectedAt: new Date().toISOString(),
        },
        type: notificationReadyEventName,
      });

      const heartbeatTimer = setInterval(() => {
        subscriber.next({
          data: {
            at: new Date().toISOString(),
          },
          type: notificationHeartbeatEventName,
        });
      }, heartbeatIntervalMs);

      void this.ensureRedisSubscription();

      return () => {
        clearInterval(heartbeatTimer);
        const currentSubscribers = this.subscribersByUserId.get(userId);

        currentSubscribers?.delete(subscriber);

        if (currentSubscribers?.size === 0) {
          this.subscribersByUserId.delete(userId);
        }
      };
    });
  }

  async emitUserChanged(
    userId: string,
    data: Omit<NotificationRealtimeData, 'occurredAt'> & { occurredAt?: string },
  ): Promise<void> {
    const eventData: NotificationRealtimeData = {
      ...data,
      occurredAt: data.occurredAt ?? new Date().toISOString(),
    };

    this.emitLocal(userId, eventData);

    const payload: NotificationRealtimeRedisMessage = {
      data: eventData,
      originId: this.instanceId,
      userId,
    };

    // Redis bersifat best-effort untuk scale-out. Jika Redis down, instance lokal tetap sudah menerima event.
    await this.redisService.publish(notificationRedisChannel, JSON.stringify(payload));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redisUnsubscribe) {
      await this.redisUnsubscribe();
      this.redisUnsubscribe = null;
    }

    for (const subscribers of this.subscribersByUserId.values()) {
      for (const subscriber of subscribers) {
        subscriber.complete();
      }
    }

    this.subscribersByUserId.clear();
  }

  private emitLocal(userId: string, data: NotificationRealtimeData): void {
    for (const subscriber of this.subscribersByUserId.get(userId) ?? []) {
      subscriber.next({
        data,
        type: notificationSseEventName,
      });
    }
  }

  private async ensureRedisSubscription(): Promise<void> {
    if (this.redisUnsubscribe || this.redisSubscriptionPromise) {
      await this.redisSubscriptionPromise;
      return;
    }

    this.redisSubscriptionPromise = this.redisService
      .subscribe(notificationRedisChannel, (message) => this.handleRedisMessage(message))
      .then((unsubscribe) => {
        this.redisUnsubscribe = unsubscribe;
      })
      .finally(() => {
        this.redisSubscriptionPromise = null;
      });

    await this.redisSubscriptionPromise;
  }

  private handleRedisMessage(message: string): void {
    const payload = parseNotificationRedisMessage(message);

    if (!payload || payload.originId === this.instanceId) {
      return;
    }

    this.emitLocal(payload.userId, payload.data);
  }
}

function parseNotificationRedisMessage(message: string): NotificationRealtimeRedisMessage | null {
  try {
    const payload = JSON.parse(message) as Partial<NotificationRealtimeRedisMessage>;

    if (
      !payload ||
      typeof payload.originId !== 'string' ||
      typeof payload.userId !== 'string' ||
      !payload.data ||
      typeof payload.data !== 'object' ||
      typeof payload.data.occurredAt !== 'string' ||
      (payload.data.reason !== 'comment_changed' && payload.data.reason !== 'thread_read')
    ) {
      return null;
    }

    return {
      data: {
        commentId: typeof payload.data.commentId === 'string' ? payload.data.commentId : undefined,
        occurredAt: payload.data.occurredAt,
        reason: payload.data.reason,
        threadId: typeof payload.data.threadId === 'string' ? payload.data.threadId : undefined,
      },
      originId: payload.originId,
      userId: payload.userId,
    };
  } catch {
    return null;
  }
}
