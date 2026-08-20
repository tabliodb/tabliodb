import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis as RedisClient } from 'ioredis';
import type { Redis as RedisInstance } from 'ioredis';
import { ConfigRepository } from '../repositories/config.repository.js';

export type FixedWindowHit = {
  count: number;
  resetAt: number;
};
export type RedisMessageHandler = (message: string) => void;

const fixedWindowIncrementScript = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return { count, ttl }
`;

const getAndDeleteScript = `
local value = redis.call("GET", KEYS[1])
if value then
  redis.call("DEL", KEYS[1])
end
return value
`;

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client?: RedisInstance;
  private readonly subscriberClient?: RedisInstance;
  private readonly subscriptionHandlers = new Map<string, Set<RedisMessageHandler>>();
  private connectPromise?: Promise<RedisInstance | null>;
  private subscriberConnectPromise?: Promise<RedisInstance | null>;
  private warnedUnavailable = false;

  constructor(@Inject(ConfigRepository) private readonly configRepository: ConfigRepository) {
    const { redis } = this.configRepository.getEnv();

    if (!redis.url) {
      return;
    }

    const client = new RedisClient(redis.url, {
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    const subscriberClient = new RedisClient(redis.url, {
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    this.client = client;
    this.subscriberClient = subscriberClient;
    client.on('error', (error) => this.warnUnavailable(error));
    client.on('ready', () => {
      this.warnedUnavailable = false;
      this.logger.log('Redis connection ready for server ephemeral state.');
    });
    subscriberClient.on('error', (error) => this.warnUnavailable(error));
    subscriberClient.on('message', (channel, message) => {
      // Redis pub/sub callbacks stay inside RedisService so callers do not need to manage raw ioredis lifecycle details.
      for (const handler of this.subscriptionHandlers.get(channel) ?? []) {
        handler(message);
      }
    });
  }

  async incrementFixedWindow(key: string, windowMs: number): Promise<FixedWindowHit | null> {
    const client = await this.getReadyClient();

    if (!client) {
      return null;
    }

    try {
      const result = (await client.eval(fixedWindowIncrementScript, 1, this.createKey(key), String(windowMs))) as [
        number | string,
        number | string,
      ];
      const count = Number(result[0]);
      const ttl = Number(result[1]);

      if (!Number.isFinite(count) || !Number.isFinite(ttl)) {
        return null;
      }

      return {
        count,
        // Redis owns the bucket TTL; converting it to an absolute timestamp keeps the guard response logic shared.
        resetAt: Date.now() + Math.max(0, ttl),
      };
    } catch (error) {
      this.warnUnavailable(error);
      return null;
    }
  }

  async setIfAbsent(key: string, value: string, ttlMs: number): Promise<boolean | null> {
    const client = await this.getReadyClient();

    if (!client) {
      return null;
    }

    try {
      const result = await client.set(this.createKey(key), value, 'PX', ttlMs, 'NX');
      return result === 'OK';
    } catch (error) {
      this.warnUnavailable(error);
      return null;
    }
  }

  async getAndDelete(key: string): Promise<string | null> {
    const client = await this.getReadyClient();

    if (!client) {
      return null;
    }

    try {
      // Redis GETDEL is not available everywhere a self-hoster might run, so a tiny Lua script keeps consume atomic.
      const result = await client.eval(getAndDeleteScript, 1, this.createKey(key));
      return typeof result === 'string' ? result : null;
    } catch (error) {
      this.warnUnavailable(error);
      return null;
    }
  }

  async publish(channel: string, message: string): Promise<boolean> {
    const client = await this.getReadyClient();

    if (!client) {
      return false;
    }

    try {
      await client.publish(this.createKey(channel), message);
      return true;
    } catch (error) {
      this.warnUnavailable(error);
      return false;
    }
  }

  async subscribe(channel: string, handler: RedisMessageHandler): Promise<(() => Promise<void>) | null> {
    const client = await this.getReadySubscriberClient();

    if (!client) {
      return null;
    }

    const redisChannel = this.createKey(channel);
    const handlers = this.subscriptionHandlers.get(redisChannel) ?? new Set<RedisMessageHandler>();
    const shouldSubscribe = handlers.size === 0;

    handlers.add(handler);
    this.subscriptionHandlers.set(redisChannel, handlers);

    try {
      if (shouldSubscribe) {
        await client.subscribe(redisChannel);
      }
    } catch (error) {
      handlers.delete(handler);

      if (handlers.size === 0) {
        this.subscriptionHandlers.delete(redisChannel);
      }

      this.warnUnavailable(error);
      return null;
    }

    return async () => {
      const currentHandlers = this.subscriptionHandlers.get(redisChannel);

      if (!currentHandlers) {
        return;
      }

      currentHandlers.delete(handler);

      if (currentHandlers.size > 0) {
        return;
      }

      this.subscriptionHandlers.delete(redisChannel);

      try {
        await client.unsubscribe(redisChannel);
      } catch (error) {
        this.warnUnavailable(error);
      }
    };
  }

  isConfigured(): boolean {
    return Boolean(this.client);
  }

  async ping(): Promise<void> {
    const client = await this.getReadyClient();

    if (!client) {
      throw new Error(this.client ? 'Redis client is not ready.' : 'Redis URL is not configured.');
    }

    // PING menjaga healthcheck Redis tidak bergantung pada key rate-limit/job tertentu yang bisa berubah di masa depan.
    const response = await client.ping();

    if (response !== 'PONG') {
      throw new Error('Redis returned an unexpected PING response.');
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.subscriptionHandlers.clear();

    if (this.subscriberClient && this.subscriberClient.status !== 'end') {
      try {
        await this.subscriberClient.quit();
      } catch {
        // During shutdown we prefer a fast process exit over waiting on a broken Redis socket.
        this.subscriberClient.disconnect(false);
      }
    }

    if (!this.client || this.client.status === 'end') {
      return;
    }

    try {
      await this.client.quit();
    } catch {
      // During shutdown we prefer a fast process exit over waiting on a broken Redis socket.
      this.client.disconnect(false);
    }
  }

  private async getReadyClient(): Promise<RedisInstance | null> {
    if (!this.client) {
      return null;
    }

    if (this.client.status === 'ready') {
      return this.client;
    }

    if (this.client.status !== 'wait') {
      return null;
    }

    this.connectPromise ??= this.client
      .connect()
      .then(() => this.client ?? null)
      .catch((error) => {
        this.warnUnavailable(error);
        return null;
      })
      .finally(() => {
        this.connectPromise = undefined;
      });

    return this.connectPromise;
  }

  private async getReadySubscriberClient(): Promise<RedisInstance | null> {
    if (!this.subscriberClient) {
      return null;
    }

    if (this.subscriberClient.status === 'ready') {
      return this.subscriberClient;
    }

    if (this.subscriberClient.status !== 'wait') {
      return null;
    }

    this.subscriberConnectPromise ??= this.subscriberClient
      .connect()
      .then(() => this.subscriberClient ?? null)
      .catch((error) => {
        this.warnUnavailable(error);
        return null;
      })
      .finally(() => {
        this.subscriberConnectPromise = undefined;
      });

    return this.subscriberConnectPromise;
  }

  private createKey(key: string): string {
    return `tabliodb:${key}`;
  }

  private warnUnavailable(error: unknown): void {
    if (this.warnedUnavailable) {
      return;
    }

    this.warnedUnavailable = true;
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Redis is unavailable; falling back to in-memory ephemeral state. ${message}`);
  }
}
