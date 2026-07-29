import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Permission, isGranted, permissionsForProjectRole } from '@tabliodb/shared';
import type { AuthContext } from '../database.js';
import { ProjectRepository } from '../repositories/project.repository.js';

export type PermissionTarget =
  | { type: 'global' }
  | { id: string; type: 'diagram' }
  | { id: string; type: 'project' };

export type PermissionRequirement = {
  permission: Permission;
  target: PermissionTarget;
};

@Injectable()
export class PermissionService {
  constructor(private readonly projectRepository: ProjectRepository) {}

  async assertAllowed(auth: AuthContext, requirement: PermissionRequirement): Promise<void> {
    this.assertApiKeyScope(auth, requirement.permission);

    if (requirement.target.type === 'global') {
      return;
    }

    const role =
      requirement.target.type === 'project'
        ? await this.projectRepository.getProjectRole(auth.user.id, requirement.target.id)
        : await this.projectRepository.getDiagramRole(auth.user.id, requirement.target.id);

    if (!role) {
      throw new NotFoundException(`${this.formatTarget(requirement.target.type)} not found`);
    }

    if (
      !isGranted({
        current: permissionsForProjectRole(role.role),
        requested: [requirement.permission],
      })
    ) {
      throw new ForbiddenException(`${requirement.permission} permission is required`);
    }
  }

  private assertApiKeyScope(auth: AuthContext, permission: Permission): void {
    if (!auth.apiKey) {
      return;
    }

    if (!isGranted({ current: auth.apiKey.permissions, requested: [permission] })) {
      // API key permissions are checked before project role so a leaked low-scope key cannot probe project existence.
      throw new ForbiddenException(`${permission} API key scope is required`);
    }
  }

  private formatTarget(type: Exclude<PermissionTarget['type'], 'global'>): string {
    return type[0].toUpperCase() + type.slice(1);
  }
}
