import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationRole, Permission, AccessRole } from '@tabliodb/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../database.js';
import { PermissionService } from './permission.service.js';

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

describe(PermissionService.name, () => {
  const organizationRepository = {
    getRole: vi.fn(),
  };
  const folderRepository = {
    getDiagramRole: vi.fn(),
    getAccessRole: vi.fn(),
  };

  let service: PermissionService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new PermissionService(organizationRepository as never, folderRepository as never);
  });

  it('allows a folder editor to create diagrams in that folder', async () => {
    folderRepository.getAccessRole.mockResolvedValue({ role: AccessRole.Editor });

    await expect(
      service.assertAllowed(auth, {
        permission: Permission.DiagramCreate,
        target: { id: 'folder-id', type: 'folder' },
      }),
    ).resolves.toBeUndefined();
  });

  it('blocks a folder viewer from creating snapshots', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Viewer });

    await expect(
      service.assertAllowed(auth, {
        permission: Permission.SnapshotCreate,
        target: { id: 'diagram-id', type: 'diagram' },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('hides missing folder access grantship as not found', async () => {
    folderRepository.getAccessRole.mockResolvedValue(undefined);

    await expect(
      service.assertAllowed(auth, {
        permission: Permission.FolderRead,
        target: { id: 'folder-id', type: 'folder' },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows an organization admin to update workspace settings', async () => {
    organizationRepository.getRole.mockResolvedValue({ role: OrganizationRole.Admin });

    await expect(
      service.assertAllowed(auth, {
        permission: Permission.OrganizationManage,
        target: { id: 'organization-id', type: 'organization' },
      }),
    ).resolves.toBeUndefined();
  });

  it('blocks an organization member from managing workspace settings', async () => {
    organizationRepository.getRole.mockResolvedValue({ role: OrganizationRole.Member });

    await expect(
      service.assertAllowed(auth, {
        permission: Permission.OrganizationManage,
        target: { id: 'organization-id', type: 'organization' },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('checks API key scope before folder access grantship lookup', async () => {
    await expect(
      service.assertAllowed(
        {
          ...auth,
          apiKey: {
            id: 'api-key-id',
            permissions: [Permission.FolderRead],
          },
        },
        {
          permission: Permission.DiagramCreate,
          target: { id: 'folder-id', type: 'folder' },
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Scope failure exits before DB lookup so limited API keys cannot probe whether a folder exists.
    expect(folderRepository.getAccessRole).not.toHaveBeenCalled();
  });
});
