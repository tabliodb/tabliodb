import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { TabliodbCookie, TabliodbHeader } from '../constants.js';
import type { AuthenticatedRequest } from './auth.guard.js';
import { CsrfGuard } from './csrf.guard.js';

describe(CsrfGuard.name, () => {
  const guard = new CsrfGuard();

  it('allows safe methods without a CSRF token', () => {
    expect(guard.canActivate(createContext(createRequest({ method: 'GET', source: 'cookie' })))).toBe(true);
  });

  it('rejects cookie-authenticated unsafe requests without a matching token', () => {
    expect(() => guard.canActivate(createContext(createRequest({ method: 'POST', source: 'cookie' })))).toThrow(
      ForbiddenException,
    );
  });

  it('allows cookie-authenticated unsafe requests with a matching double-submit token', () => {
    expect(
      guard.canActivate(
        createContext(
          createRequest({
            csrfCookie: 'token-aman',
            csrfHeader: 'token-aman',
            method: 'PATCH',
            source: 'cookie',
          }),
        ),
      ),
    ).toBe(true);
  });

  it('does not require CSRF for explicit non-cookie session auth', () => {
    expect(guard.canActivate(createContext(createRequest({ method: 'DELETE', source: 'bearer' })))).toBe(true);
  });
});

function createRequest(options: {
  csrfCookie?: string;
  csrfHeader?: string;
  method: string;
  source: 'bearer' | 'cookie' | 'header' | 'query';
}): AuthenticatedRequest {
  return {
    headers: {
      cookie: options.csrfCookie ? `${TabliodbCookie.CsrfToken}=${encodeURIComponent(options.csrfCookie)}` : '',
      [TabliodbHeader.CsrfToken]: options.csrfHeader,
    },
    method: options.method,
    user: {
      session: {
        id: 'session-id',
        source: options.source,
      },
      user: {
        avatarUrl: null,
        cursorColor: '#58cc02',
        email: 'owner@tabliodb.local',
        id: 'user-id',
        name: 'Tabliodb Owner',
      },
    },
  } as unknown as AuthenticatedRequest;
}

function createContext(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}
