import { BadRequestException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '@tabliodb/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../database.js';
import type { AuthenticatedRequest } from './auth.guard.js';
import { PermissionGuard, RequirePermission } from './permission.guard.js';

const auth: AuthContext = {
  user: {
    avatarUrl: null,
    cursorColor: '#58cc02',
    email: 'editor@tabliodb.local',
    id: 'user-id',
    name: 'Editor User',
    passwordChangeRequired: false,
  },
};

class OpenController {
  route() {
    return null;
  }
}

class ParamTargetController {
  @RequirePermission(Permission.DiagramRead, { key: 'diagramId', source: 'param', type: 'diagram' })
  route() {
    return null;
  }
}

class BodyTargetController {
  @RequirePermission(Permission.ProjectCreate, { key: 'organizationId', source: 'body', type: 'organization' })
  route() {
    return null;
  }
}

class QueryTargetController {
  @RequirePermission(Permission.ProjectRead, { key: 'projectId', source: 'query', type: 'project' })
  route() {
    return null;
  }
}

@RequirePermission(Permission.OrganizationManage)
class ClassTargetController {
  route() {
    return null;
  }
}

describe(PermissionGuard.name, () => {
  const permissionService = {
    assertAllowed: vi.fn(),
  };

  let guard: PermissionGuard;

  beforeEach(() => {
    vi.resetAllMocks();
    permissionService.assertAllowed.mockResolvedValue(undefined);
    guard = new PermissionGuard(permissionService as never, new Reflector());
  });

  it('allows routes without permission metadata', async () => {
    await expect(guard.canActivate(createContext(OpenController, createRequest()))).resolves.toBe(true);

    expect(permissionService.assertAllowed).not.toHaveBeenCalled();
  });

  it('rejects permission metadata when auth guard did not attach a user', async () => {
    await expect(
      guard.canActivate(
        createContext(
          ParamTargetController,
          createRequest({
            params: { diagramId: 'diagram-id' },
            user: undefined,
          }),
        ),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(permissionService.assertAllowed).not.toHaveBeenCalled();
  });

  it('passes a param target to the permission service', async () => {
    await expect(
      guard.canActivate(
        createContext(
          ParamTargetController,
          createRequest({
            params: { diagramId: 'diagram-id' },
          }),
        ),
      ),
    ).resolves.toBe(true);

    expect(permissionService.assertAllowed).toHaveBeenCalledWith(auth, {
      permission: Permission.DiagramRead,
      target: { id: 'diagram-id', type: 'diagram' },
    });
  });

  it('passes a body target to the permission service', async () => {
    await expect(
      guard.canActivate(
        createContext(
          BodyTargetController,
          createRequest({
            body: { organizationId: 'organization-id' },
          }),
        ),
      ),
    ).resolves.toBe(true);

    expect(permissionService.assertAllowed).toHaveBeenCalledWith(auth, {
      permission: Permission.ProjectCreate,
      target: { id: 'organization-id', type: 'organization' },
    });
  });

  it('passes a query target to the permission service', async () => {
    await expect(
      guard.canActivate(
        createContext(
          QueryTargetController,
          createRequest({
            query: { projectId: 'project-id' },
          }),
        ),
      ),
    ).resolves.toBe(true);

    expect(permissionService.assertAllowed).toHaveBeenCalledWith(auth, {
      permission: Permission.ProjectRead,
      target: { id: 'project-id', type: 'project' },
    });
  });

  it('rejects missing target ids before calling the permission service', async () => {
    await expect(guard.canActivate(createContext(ParamTargetController, createRequest()))).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(permissionService.assertAllowed).not.toHaveBeenCalled();
  });

  it('uses class-level permission metadata for global admin-style routes', async () => {
    await expect(guard.canActivate(createContext(ClassTargetController, createRequest()))).resolves.toBe(true);

    expect(permissionService.assertAllowed).toHaveBeenCalledWith(auth, {
      permission: Permission.OrganizationManage,
      target: { type: 'global' },
    });
  });
});

function createRequest(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    body: {},
    params: {},
    query: {},
    user: auth,
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

function createContext(controller: Function, request: AuthenticatedRequest): ExecutionContext {
  const handler = (controller.prototype as Record<string, unknown>).route;

  return {
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({
      // The guard only needs the HTTP request object, so the test context stays intentionally narrow.
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}
