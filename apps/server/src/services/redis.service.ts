import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis as RedisClient } from 'ioredis';
import type { Redis as RedisInstance } from 'ioredis';
import { ConfigRepository } from '../repositories/config.repository.js';

export type FixedWindowHit = {
  count: number;
  resetAt: number;
};

const fixedWindowIncrementScript = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return { count, ttl }
`;

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client?: RedisInstance;
  private connectPromise?: Promise<RedisInstance | null>;
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
    this.client = client;
    client.on('error', (error) => this.warnUnavailable(error));
    client.on('ready', () => {
      this.warnedUnavailable = false;
      this.logger.log('Redis connection ready for server ephemeral state.');
    });
  }

  async incrementFixedWindow(key: string, windowMs: number): Promise<FixedWindowHit | null> {
    const client = await this.getReadyClient();

    if (!client) {
      return null;
    }

    try {
      const result = (await client.eval(fixedWindowIncrementScript, 1, `tabliodb:${key}`, String(windowMs))) as [
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
      const result = await client.set(`tabliodb:${key}`, value, 'PX', ttlMs, 'NX');
      return result === 'OK';
    } catch (error) {
      this.warnUnavailable(error);
      return null;
    }
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

  private warnUnavailable(error: unknown): void {
    if (this.warnedUnavailable) {
      return;
    }

    this.warnedUnavailable = true;
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Redis is unavailable; falling back to in-memory ephemeral state. ${message}`);
  }
}
