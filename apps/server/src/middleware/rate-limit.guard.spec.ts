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
  let response: Pick<Response, 'setHeader'>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T12:00:00.000Z'));
    guard = new RateLimitGuard(new Reflector());
    response = {
      setHeader: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when a route has no rate limit metadata', () => {
    expect(guard.canActivate(createContext(RateLimitedController.prototype.open, createRequest('user-a')))).toBe(true);
  });

  it('allows requests until the configured user bucket is exhausted', () => {
    const context = createContext(RateLimitedController.prototype.limited, createRequest('user-a'), response);

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow(HttpException);
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '60');
  });

  it('resets the bucket after the configured window', () => {
    const context = createContext(RateLimitedController.prototype.limited, createRequest('user-a'), response);

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    vi.advanceTimersByTime(60_000);

    // The fixed window starts fresh after resetAt, so legitimate bursts do not stay blocked forever.
    expect(guard.canActivate(context)).toBe(true);
  });

  it('isolates buckets by authenticated user', () => {
    const userAContext = createContext(RateLimitedController.prototype.limited, createRequest('user-a'), response);
    const userBContext = createContext(RateLimitedController.prototype.limited, createRequest('user-b'), response);

    expect(guard.canActivate(userAContext)).toBe(true);
    expect(guard.canActivate(userAContext)).toBe(true);
    expect(() => guard.canActivate(userAContext)).toThrow(HttpException);

    // Workspace users should not be throttled by another user's comment burst.
    expect(guard.canActivate(userBContext)).toBe(true);
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
