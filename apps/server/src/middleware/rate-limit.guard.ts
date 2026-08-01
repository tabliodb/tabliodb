import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
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

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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
    const bucketKey = `${options.key}:${getRequestIdentity(request)}`;
    const bucket = this.buckets.get(bucketKey);

    this.pruneExpiredBuckets(now);

    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(bucketKey, {
        count: 1,
        resetAt: now + options.windowMs,
      });

      return true;
    }

    if (bucket.count >= options.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

      response.setHeader('Retry-After', String(retryAfterSeconds));
      throw new HttpException(
        {
          message: `Too many requests. Try again in ${retryAfterSeconds} seconds.`,
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    bucket.count += 1;

    return true;
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
