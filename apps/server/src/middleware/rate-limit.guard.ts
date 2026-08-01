import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { RedisService, type FixedWindowHit } from '../services/redis.service.js';
import type { AuthRequest } from './auth.guard.js';

const rateLimitMetadataKey = 'tabliodb:rate-limit';
const maxTrackedBuckets = 10_000;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

export function RateLimit(options: RateLimitOptions): MethodDecorator & ClassDecorator {
  return SetMetadata(rateLimitMetadataKey, options);
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private lastPrunedAt = 0;

  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(rateLimitMetadataKey, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const now = Date.now();
    const bucketKey = `rate-limit:${options.key}:${getRequestIdentity(request)}`;
    const redisHit = await this.redisService.incrementFixedWindow(bucketKey, options.windowMs);

    if (redisHit) {
      return this.assertBucketAllowsRequest(redisHit, options.limit, response);
    }

    // Redis menjadi store utama untuk deployment multi-instance; fallback memory menjaga dev tetap jalan saat Redis belum hidup.
    return this.consumeMemoryBucket({
      bucketKey,
      limit: options.limit,
      now,
      response,
      windowMs: options.windowMs,
    });
  }

  private consumeMemoryBucket(options: {
    bucketKey: string;
    limit: number;
    now: number;
    response: Response;
    windowMs: number;
  }): boolean {
    const bucket = this.buckets.get(options.bucketKey);

    this.pruneExpiredBuckets(options.now);

    if (!bucket || options.now >= bucket.resetAt) {
      this.buckets.set(options.bucketKey, {
        count: 1,
        resetAt: options.now + options.windowMs,
      });

      return true;
    }

    if (bucket.count >= options.limit) {
      return this.assertBucketAllowsRequest(
        { count: bucket.count + 1, resetAt: bucket.resetAt },
        options.limit,
        options.response,
      );
    }

    bucket.count += 1;

    return true;
  }

  private assertBucketAllowsRequest(hit: FixedWindowHit, limit: number, response: Response): boolean {
    if (hit.count <= limit) {
      return true;
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((hit.resetAt - Date.now()) / 1000));

    response.setHeader('Retry-After', String(retryAfterSeconds));
    throw new HttpException(
      {
        message: `Too many requests. Try again in ${retryAfterSeconds} seconds.`,
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private pruneExpiredBuckets(now: number) {
    if (this.buckets.size <= maxTrackedBuckets && now - this.lastPrunedAt < 60_000) {
      return;
    }

    this.lastPrunedAt = now;

    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt) {
        this.buckets.delete(key);
      }
    }
  }
}

function getRequestIdentity(request: AuthRequest): string {
  if (request.user?.apiKey) {
    return `api-key:${request.user.apiKey.id}`;
  }

  if (request.user) {
    return `user:${request.user.user.id}`;
  }

  // Public routes can reuse this guard later; IP is only a fallback because authenticated user identity is stronger.
  return `ip:${readClientIp(request)}`;
}

function readClientIp(request: AuthRequest): string {
  const forwardedFor = readHeader(request.headers['x-forwarded-for']);

  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  return request.ip || request.socket.remoteAddress || 'unknown';
}

function readHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
