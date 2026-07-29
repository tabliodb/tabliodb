import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '@tabliodb/shared';
import type { AuthenticatedRequest } from './auth.guard.js';
import { PermissionService, type PermissionTarget } from '../services/permission.service.js';

const permissionMetadataKey = 'tabliodb:permission';

export type PermissionTargetSource = 'body' | 'param' | 'query';

export type PermissionTargetSelector =
  | { type: 'global' }
  | { key: string; source: PermissionTargetSource; type: 'diagram' | 'project' };

export type PermissionMetadata = {
  permission: Permission;
  target: PermissionTargetSelector;
};

export function RequirePermission(
  permission: Permission,
  target: PermissionTargetSelector = { type: 'global' },
): MethodDecorator & ClassDecorator {
  return SetMetadata(permissionMetadataKey, { permission, target });
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.getAllAndOverride<PermissionMetadata | undefined>(permissionMetadataKey, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!metadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new UnauthorizedException('Authentication required');
    }

    await this.permissionService.assertAllowed(request.user, {
      permission: metadata.permission,
      target: this.resolveTarget(metadata.target, request),
    });

    return true;
  }

  private resolveTarget(selector: PermissionTargetSelector, request: AuthenticatedRequest): PermissionTarget {
    if (selector.type === 'global') {
      return { type: 'global' };
    }

    const id = this.readValue(request, selector.source, selector.key);
    if (!id) {
      throw new BadRequestException(`${selector.key} is required for permission check`);
    }

    return {
      id,
      type: selector.type,
    };
  }

  private readValue(request: AuthenticatedRequest, source: PermissionTargetSource, key: string): string | null {
    const container = (source === 'param' ? request.params : request[source]) as Record<string, unknown> | undefined;
    const value = container?.[key];

    // Route params and body/query UUID fields must resolve to a single string before permission lookup.
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }
}
