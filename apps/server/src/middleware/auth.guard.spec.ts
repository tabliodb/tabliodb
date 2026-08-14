import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../database.js';
import { Authenticated, AuthGuard } from './auth.guard.js';

const auth: AuthContext = {
  session: {
    bindingAlgorithm: 'ecdsa-p256-sha256',
    bindingKeyFingerprint: 'fingerprint-browser',
    bindingPublicKeyJwk: {},
    bindingRequired: true,
    id: 'session-id',
    source: 'cookie',
  },
  user: {
    avatarUrl: null,
    cursorColor: '#58cc02',
    email: 'owner@tabliodb.local',
    id: 'user-id',
    name: 'Tabliodb Owner',
    passwordChangeRequired: false,
  },
};

class PublicController {
  route() {
    return null;
  }
}

class AuthenticatedController {
  @Authenticated()
  route() {
    return null;
  }
}

class BrowserSubresourceController {
  @Authenticated({ requireSessionProof: false })
  route() {
    return null;
  }
}

describe(AuthGuard.name, () => {
  const authService = {
    authenticate: vi.fn(),
    verifySessionProof: vi.fn(),
  };

  let guard: AuthGuard;

  beforeEach(() => {
    vi.resetAllMocks();
    authService.authenticate.mockResolvedValue(auth);
    authService.verifySessionProof.mockResolvedValue(undefined);
    guard = new AuthGuard(authService as never, new Reflector());
  });

  it('allows public routes without authenticating', async () => {
    await expect(guard.canActivate(createContext(PublicController))).resolves.toBe(true);

    expect(authService.authenticate).not.toHaveBeenCalled();
    expect(authService.verifySessionProof).not.toHaveBeenCalled();
  });

  it('requires session proof for authenticated routes by default', async () => {
    const request = createRequest();

    await expect(guard.canActivate(createContext(AuthenticatedController, request))).resolves.toBe(true);

    expect(authService.authenticate).toHaveBeenCalledWith({
      headers: request.headers,
      queryParams: request.query,
    });
    expect(authService.verifySessionProof).toHaveBeenCalledWith(expect.objectContaining({ user: auth.user }), {
      headers: request.headers,
      ipAddress: request.ip,
      method: request.method,
      path: request.originalUrl,
      userAgent: 'Tabliodb Browser',
    });
  });

  it('keeps authentication but skips session proof for browser subresource routes', async () => {
    const request = createRequest({
      originalUrl: '/api/files/avatar-file-id',
    });

    await expect(guard.canActivate(createContext(BrowserSubresourceController, request))).resolves.toBe(true);

    expect(authService.authenticate).toHaveBeenCalledWith({
      headers: request.headers,
      queryParams: request.query,
    });
    expect(authService.verifySessionProof).not.toHaveBeenCalled();
    expect(request.user).toMatchObject({
      request: {
        ipAddress: request.ip,
        requestId: 'request-id',
        userAgent: 'Tabliodb Browser',
      },
      user: auth.user,
    });
  });
});

function createRequest(overrides: Partial<AuthRequestShape> = {}): AuthRequestShape {
  return {
    headers: {
      'user-agent': 'Tabliodb Browser',
      'x-request-id': 'request-id',
    },
    ip: '127.0.0.1',
    method: 'GET',
    originalUrl: '/api/auth/me',
    query: {},
    ...overrides,
  };
}

function createContext(controller: Function, request = createRequest()): ExecutionContext {
  const handler = (controller.prototype as Record<string, unknown>).route;

  return {
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({
      // AuthGuard only consumes the Express request surface, so the test context stays intentionally tiny.
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

type AuthRequestShape = {
  headers: Record<string, string>;
  ip: string;
  method: string;
  originalUrl: string;
  query: Record<string, string | undefined>;
  user?: AuthContext;
};
