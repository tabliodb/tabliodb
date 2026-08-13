import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthRequest } from './auth.guard.js';
import { RateLimit, RateLimitGuard } from './rate-limit.guard.js';

class RateLimitedController {
  @RateLimit({ key: 'comments:write', limit: 2, windowMs: 60_000 })
  limited() {
    return undefined;
  }

  open() {
    return undefined;
  }
}

describe(RateLimitGuard.name, () => {
  let guard: RateLimitGuard;
  let redisService: { incrementFixedWindow: ReturnType<typeof vi.fn> };
  let response: Pick<Response, 'setHeader'>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T12:00:00.000Z'));
    redisService = {
      incrementFixedWindow: vi.fn().mockResolvedValue(null),
    };
    guard = new RateLimitGuard(new Reflector(), redisService as never);
    response = {
      setHeader: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when a route has no rate limit metadata', async () => {
    await expect(
      guard.canActivate(createContext(RateLimitedController.prototype.open, createRequest('user-a'))),
    ).resolves.toBe(true);
    expect(redisService.incrementFixedWindow).not.toHaveBeenCalled();
  });

  it('allows requests until the configured user bucket is exhausted', async () => {
    const context = createContext(RateLimitedController.prototype.limited, createRequest('user-a'), response);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: {
        code: 'rate_limited',
        details: ['Retry after 60 seconds.'],
        message: 'Too many requests. Try again in 60 seconds.',
      },
    });
    expect(response.setHeader).toHaveBeenCalledWith('RateLimit-Limit', '2');
    expect(response.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', '1');
    expect(response.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', '0');
    expect(response.setHeader).toHaveBeenCalledWith('RateLimit-Reset', '60');
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '60');
  });

  it('resets the bucket after the configured window', async () => {
    const context = createContext(RateLimitedController.prototype.limited, createRequest('user-a'), response);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    vi.advanceTimersByTime(60_000);

    // The fixed window starts fresh after resetAt, so legitimate bursts do not stay blocked forever.
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('isolates buckets by authenticated user', async () => {
    const userAContext = createContext(RateLimitedController.prototype.limited, createRequest('user-a'), response);
    const userBContext = createContext(RateLimitedController.prototype.limited, createRequest('user-b'), response);

    await expect(guard.canActivate(userAContext)).resolves.toBe(true);
    await expect(guard.canActivate(userAContext)).resolves.toBe(true);
    await expect(guard.canActivate(userAContext)).rejects.toBeInstanceOf(HttpException);

    // Workspace users should not be throttled by another user's comment burst.
    await expect(guard.canActivate(userBContext)).resolves.toBe(true);
  });

  it('uses Redis buckets when Redis is available', async () => {
    const context = createContext(RateLimitedController.prototype.limited, createRequest('user-a'), response);

    redisService.incrementFixedWindow
      .mockResolvedValueOnce({ count: 1, resetAt: Date.now() + 60_000 })
      .mockResolvedValueOnce({ count: 3, resetAt: Date.now() + 60_000 });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(HttpException);

    expect(redisService.incrementFixedWindow).toHaveBeenCalledWith('rate-limit:comments:write:user:user-a', 60_000);
    expect(response.setHeader).toHaveBeenCalledWith('RateLimit-Limit', '2');
    expect(response.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', '1');
    expect(response.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', '0');
    expect(response.setHeader).toHaveBeenCalledWith('RateLimit-Reset', '60');
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '60');
  });
});

function createRequest(userId: string): AuthRequest {
  return {
    headers: {},
    ip: '127.0.0.1',
    socket: {
      remoteAddress: '127.0.0.1',
    },
    user: {
      user: {
        avatarUrl: null,
        cursorColor: '#58cc02',
        email: `${userId}@tabliodb.local`,
        id: userId,
        name: userId,
      },
    },
  } as unknown as AuthRequest;
}

function createContext(
  handler: () => void,
  request: AuthRequest,
  customResponse: Pick<Response, 'setHeader'> = { setHeader: vi.fn() },
): ExecutionContext {
  return {
    getClass: () => RateLimitedController,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => customResponse,
    }),
  } as unknown as ExecutionContext;
}
