import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationRole, Permission, AccessRole } from '@tabliodb/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../database.js';
import { FolderService } from './folder.service.js';

const auth: AuthContext = {
  user: {
    avatarUrl: null,
    cursorColor: '#58cc02',
    email: 'owner@tabliodb.local',
    id: 'owner-id',
    name: 'Folder Owner',
    passwordChangeRequired: false,
  },
};

const authWithReadApiKey: AuthContext = {
  ...auth,
  apiKey: {
    id: 'api-key-id',
    permissions: [Permission.FolderRead],
  },
};

const folder = {
  createdAt: new Date('2026-07-29T10:00:00.000Z'),
  description: null,
  id: 'folder-id',
  name: 'Library System',
  organizationId: 'organization-id',
  organizationName: 'Default Workspace',
  organizationSlug: 'default-workspace',
  folderRole: AccessRole.Owner,
  slug: 'library-system',
  updatedAt: new Date('2026-07-29T10:00:00.000Z'),
};

describe(FolderService.name, () => {
  const auditLogRepository = {
    create: vi.fn(),
  };
  const organizationRepository = {
    addMemberIfAbsent: vi.fn(),
    createPersonalOrganization: vi.fn(),
    getByIdForUser: vi.fn(),
    getFirstForUser: vi.fn(),
    getMember: vi.fn(),
    getRole: vi.fn(),
  };
  const folderRepository = {
    archive: vi.fn(),
    create: vi.fn(),
    getByIdForUser: vi.fn(),
    getAccess: vi.fn(),
    getAccessList: vi.fn(),
    getAccessRole: vi.fn(),
    getFolderOwnerCount: vi.fn(),
    getVisibleToUser: vi.fn(),
    removeAccess: vi.fn(),
    transferOwnership: vi.fn(),
    update: vi.fn(),
    updateAccess: vi.fn(),
    upsertAccess: vi.fn(),
  };
  const userRepository = {
    getByEmail: vi.fn(),
  };

  let service: FolderService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new FolderService(
      auditLogRepository as never,
      organizationRepository as never,
      folderRepository as never,
      userRepository as never,
    );

    folderRepository.getByIdForUser.mockResolvedValue(folder);
  });

  it('blocks folder updates from folder viewers at the service boundary', async () => {
    folderRepository.getByIdForUser.mockResolvedValue({
      ...folder,
      folderRole: AccessRole.Viewer,
    });

    await expect(
      service.update(auth, 'folder-id', {
        name: 'Readonly Rename',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Controller decorators are not the only protection; service callers must also respect folder roles.
    expect(folderRepository.update).not.toHaveBeenCalled();
  });

  it('blocks low-scope API keys before folder access management lookups', async () => {
    await expect(
      service.addAccess(authWithReadApiKey, 'folder-id', {
        email: 'editor@tabliodb.local',
        role: AccessRole.Editor,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // API-key scope is checked before loading the folder so low-scope tokens cannot probe folder existence.
    expect(folderRepository.getByIdForUser).not.toHaveBeenCalled();
    expect(userRepository.getByEmail).not.toHaveBeenCalled();
    expect(folderRepository.upsertAccess).not.toHaveBeenCalled();
  });

  it('adds an existing workspace user to folder access', async () => {
    userRepository.getByEmail.mockResolvedValue({
      email: 'editor@tabliodb.local',
      id: 'editor-id',
      name: 'Editor User',
    });
    organizationRepository.addMemberIfAbsent.mockResolvedValue({
      role: OrganizationRole.Member,
      status: 'active',
      userId: 'editor-id',
    });
    folderRepository.upsertAccess.mockResolvedValue({
      avatarUrl: null,
      cursorColor: '#58cc02',
      createdAt: new Date('2026-07-29T11:00:00.000Z'),
      email: 'editor@tabliodb.local',
      name: 'Editor User',
      role: AccessRole.Editor,
      updatedAt: new Date('2026-07-29T11:00:00.000Z'),
      userId: 'editor-id',
    });

    await expect(
      service.addAccess(auth, 'folder-id', {
        email: 'editor@tabliodb.local',
        role: AccessRole.Editor,
      }),
    ).resolves.toMatchObject({
      email: 'editor@tabliodb.local',
      role: AccessRole.Editor,
      userId: 'editor-id',
    });

    expect(organizationRepository.addMemberIfAbsent).toHaveBeenCalledWith({
      createdById: 'owner-id',
      organizationId: 'organization-id',
      role: OrganizationRole.Guest,
      userId: 'editor-id',
    });
    expect(folderRepository.upsertAccess).toHaveBeenCalledWith('folder-id', {
      createdById: 'owner-id',
      role: AccessRole.Editor,
      userId: 'editor-id',
    });
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'folder.access_added',
        actorId: 'owner-id',
        entityId: 'editor-id',
        entityType: 'folder_access',
        organizationId: 'organization-id',
        folderId: 'folder-id',
      }),
    );
  });

  it('returns a conflict error when folder slug already exists in the workspace', async () => {
    organizationRepository.getByIdForUser.mockResolvedValue({
      allowMemberFolderCreate: true,
      id: 'organization-id',
      role: OrganizationRole.Owner,
    });
    folderRepository.create.mockRejectedValue({
      code: '23505',
      constraint: 'folders_organization_id_slug_key',
    });

    await expect(
      service.create(auth, {
        name: 'Library System',
        organizationId: 'organization-id',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('anchors an existing user as a workspace guest before adding folder access', async () => {
    userRepository.getByEmail.mockResolvedValue({
      email: 'outsider@tabliodb.local',
      id: 'outsider-id',
      name: 'Outsider User',
    });
    organizationRepository.addMemberIfAbsent.mockResolvedValue({
      role: OrganizationRole.Guest,
      status: 'active',
      userId: 'outsider-id',
    });
    folderRepository.upsertAccess.mockResolvedValue({
      avatarUrl: null,
      cursorColor: '#1cb0f6',
      createdAt: new Date('2026-07-29T11:30:00.000Z'),
      email: 'outsider@tabliodb.local',
      name: 'Outsider User',
      role: AccessRole.Viewer,
      updatedAt: new Date('2026-07-29T11:30:00.000Z'),
      userId: 'outsider-id',
    });

    await expect(
      service.addAccess(auth, 'folder-id', {
        email: 'outsider@tabliodb.local',
        role: AccessRole.Viewer,
      }),
    ).resolves.toMatchObject({
      email: 'outsider@tabliodb.local',
      role: AccessRole.Viewer,
      userId: 'outsider-id',
    });

    // Folder grants pull existing users into the workspace as guests, matching the direct diagram invite flow.
    expect(organizationRepository.addMemberIfAbsent).toHaveBeenCalledWith({
      createdById: 'owner-id',
      organizationId: 'organization-id',
      role: OrganizationRole.Guest,
      userId: 'outsider-id',
    });
    expect(folderRepository.upsertAccess).toHaveBeenCalledWith('folder-id', {
      createdById: 'owner-id',
      role: AccessRole.Viewer,
      userId: 'outsider-id',
    });
  });

  it('rejects adding a suspended workspace user to a folder', async () => {
    userRepository.getByEmail.mockResolvedValue({
      email: 'suspended@tabliodb.local',
      id: 'suspended-id',
      name: 'Suspended User',
    });
    organizationRepository.addMemberIfAbsent.mockResolvedValue({
      role: OrganizationRole.Guest,
      status: 'suspended',
      userId: 'suspended-id',
    });

    await expect(
      service.addAccess(auth, 'folder-id', {
        email: 'suspended@tabliodb.local',
        role: AccessRole.Viewer,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Existing suspended/pending workspace rows are never reactivated through lower-scope grants.
    expect(folderRepository.upsertAccess).not.toHaveBeenCalled();
  });

  it('prevents demoting the last folder owner', async () => {
    folderRepository.getAccess.mockResolvedValue({
      role: AccessRole.Owner,
      userId: 'another-owner-id',
    });
    folderRepository.getFolderOwnerCount.mockResolvedValue(1);

    await expect(
      service.updateAccess(auth, 'folder-id', 'another-owner-id', {
        role: AccessRole.Editor,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(folderRepository.updateAccess).not.toHaveBeenCalled();
  });

  it('prevents removing the last folder owner', async () => {
    folderRepository.getAccess.mockResolvedValue({
      role: AccessRole.Owner,
      userId: 'another-owner-id',
    });
    folderRepository.getFolderOwnerCount.mockResolvedValue(1);

    await expect(service.removeAccess(auth, 'folder-id', 'another-owner-id')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(folderRepository.removeAccess).not.toHaveBeenCalled();
  });

  it('prevents changing your own folder access', async () => {
    await expect(
      service.updateAccess(auth, 'folder-id', 'owner-id', {
        role: AccessRole.Viewer,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Self-management is rejected before member lookup so an owner cannot demote and re-promote themselves.
    expect(folderRepository.getAccess).not.toHaveBeenCalled();
    expect(folderRepository.updateAccess).not.toHaveBeenCalled();
  });

  it('prevents assigning folder owner through the generic member create endpoint', async () => {
    await expect(
      service.addAccess(auth, 'folder-id', {
        email: 'editor@tabliodb.local',
        // This intentionally simulates a stale/generated-client bypass attempt; Owner must only flow through transferOwnership.
        role: AccessRole.Owner as never,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(userRepository.getByEmail).not.toHaveBeenCalled();
    expect(folderRepository.upsertAccess).not.toHaveBeenCalled();
  });

  it('prevents adding yourself through the generic folder access endpoint', async () => {
    userRepository.getByEmail.mockResolvedValue({
      email: auth.user.email,
      id: auth.user.id,
      name: auth.user.name,
    });

    await expect(
      service.addAccess(auth, 'folder-id', {
        email: auth.user.email,
        role: AccessRole.Viewer,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Folder owner/admin self role changes must stay out of the generic add/upsert path.
    expect(organizationRepository.addMemberIfAbsent).not.toHaveBeenCalled();
    expect(folderRepository.upsertAccess).not.toHaveBeenCalled();
  });

  it('prevents assigning folder owner through the generic member update endpoint', async () => {
    await expect(
      service.updateAccess(auth, 'folder-id', 'editor-id', {
        // Generic role edits cannot promote Owner because they would bypass the explicit transfer audit trail.
        role: AccessRole.Owner as never,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(folderRepository.getAccess).not.toHaveBeenCalled();
    expect(folderRepository.updateAccess).not.toHaveBeenCalled();
  });

  it('transfers folder ownership to an existing active folder collaborator', async () => {
    organizationRepository.getMember.mockResolvedValue({
      role: OrganizationRole.Member,
      status: 'active',
      userId: 'editor-id',
    });
    folderRepository.getAccessRole.mockResolvedValue({ role: AccessRole.Editor });
    folderRepository.getAccess.mockResolvedValue({
      role: AccessRole.Editor,
      userId: 'editor-id',
    });
    folderRepository.transferOwnership.mockResolvedValue({
      avatarUrl: null,
      cursorColor: '#1cb0f6',
      createdAt: new Date('2026-07-29T12:00:00.000Z'),
      email: 'editor@tabliodb.local',
      name: 'Editor User',
      role: AccessRole.Owner,
      updatedAt: new Date('2026-07-29T12:00:00.000Z'),
      userId: 'editor-id',
    });

    await expect(
      service.transferOwnership(auth, 'folder-id', {
        userId: 'editor-id',
      }),
    ).resolves.toMatchObject({
      role: AccessRole.Owner,
      userId: 'editor-id',
    });

    expect(folderRepository.transferOwnership).toHaveBeenCalledWith('folder-id', {
      createdById: 'owner-id',
      userId: 'editor-id',
    });
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'folder.access_role_updated',
        actorId: 'owner-id',
        entityId: 'editor-id',
        entityType: 'folder_access',
        metadata: expect.objectContaining({
          transfer: true,
        }),
        organizationId: 'organization-id',
        folderId: 'folder-id',
      }),
    );
  });

  it('prevents transferring folder ownership to a user outside the workspace', async () => {
    organizationRepository.getMember.mockResolvedValue(undefined);

    await expect(
      service.transferOwnership(auth, 'folder-id', {
        userId: 'outsider-id',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(folderRepository.getAccessRole).not.toHaveBeenCalled();
    expect(folderRepository.transferOwnership).not.toHaveBeenCalled();
  });

  it('prevents removing your own folder access', async () => {
    await expect(service.removeAccess(auth, 'folder-id', 'owner-id')).rejects.toBeInstanceOf(BadRequestException);

    // Self-removal has to be an explicit transfer/leave flow, not the generic member delete endpoint.
    expect(folderRepository.getAccess).not.toHaveBeenCalled();
    expect(folderRepository.removeAccess).not.toHaveBeenCalled();
  });

  it('throws not found when a target member does not exist', async () => {
    folderRepository.getAccess.mockResolvedValue(undefined);

    await expect(
      service.updateAccess(auth, 'folder-id', 'missing-user-id', {
        role: AccessRole.Viewer,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
