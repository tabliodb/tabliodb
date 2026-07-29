import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Permission, ProjectRole } from '@tabliodb/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../database.js';
import { PermissionService } from './permission.service.js';

const auth: AuthContext = {
  user: {
    avatarColor: null,
    email: 'editor@tabliodb.local',
    id: 'user-id',
    name: 'Editor User',
  },
};

describe(PermissionService.name, () => {
  const projectRepository = {
    getDiagramRole: vi.fn(),
    getProjectRole: vi.fn(),
  };

  let service: PermissionService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new PermissionService(projectRepository as never);
  });

  it('allows a project editor to create diagrams in that project', async () => {
    projectRepository.getProjectRole.mockResolvedValue({ role: ProjectRole.Editor });

    await expect(
      service.assertAllowed(auth, {
        permission: Permission.DiagramCreate,
        target: { id: 'project-id', type: 'project' },
      }),
    ).resolves.toBeUndefined();
  });

  it('blocks a project viewer from creating snapshots', async () => {
    projectRepository.getDiagramRole.mockResolvedValue({ role: ProjectRole.Viewer });

    await expect(
      service.assertAllowed(auth, {
        permission: Permission.SnapshotCreate,
        target: { id: 'diagram-id', type: 'diagram' },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('hides missing project membership as not found', async () => {
    projectRepository.getProjectRole.mockResolvedValue(undefined);

    await expect(
      service.assertAllowed(auth, {
        permission: Permission.ProjectRead,
        target: { id: 'project-id', type: 'project' },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('checks API key scope before project membership lookup', async () => {
    await expect(
      service.assertAllowed(
        {
          ...auth,
          apiKey: {
            id: 'api-key-id',
            permissions: [Permission.ProjectRead],
          },
        },
        {
          permission: Permission.DiagramCreate,
          target: { id: 'project-id', type: 'project' },
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Scope failure exits before DB lookup so limited API keys cannot probe whether a project exists.
    expect(projectRepository.getProjectRole).not.toHaveBeenCalled();
  });
});
