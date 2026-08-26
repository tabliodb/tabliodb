import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationRole, Permission } from '@tabliodb/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../database.js';
import { OrganizationService } from './organization.service.js';

const auth: AuthContext = {
  user: {
    avatarUrl: null,
    cursorColor: '#58cc02',
    email: 'owner@tabliodb.local',
    id: 'owner-id',
    name: 'Workspace Owner',
    passwordChangeRequired: false,
  },
};

const authWithReadApiKey: AuthContext = {
  ...auth,
  apiKey: {
    id: 'api-key-id',
    permissions: [Permission.OrganizationRead],
  },
};

const ownerMember = {
  avatarUrl: null,
  cursorColor: '#58cc02',
  createdAt: new Date('2026-07-29T10:00:00.000Z'),
  email: 'owner@tabliodb.local',
  joinedAt: new Date('2026-07-29T10:00:00.000Z'),
  name: 'Workspace Owner',
  role: OrganizationRole.Owner,
  status: 'active' as const,
  updatedAt: new Date('2026-07-29T10:00:00.000Z'),
  userId: 'owner-id',
};

describe(OrganizationService.name, () => {
  const auditLogRepository = {
    create: vi.fn(),
  };
  const organizationRepository = {
    addMemberIfAbsent: vi.fn(),
    getRole: vi.fn(),
    getMember: vi.fn(),
    getMembers: vi.fn(),
    getOrganizationOwnerCount: vi.fn(),
    getSettingsForUser: vi.fn(),
    listForUser: vi.fn(),
    removeMember: vi.fn(),
    transferOwnership: vi.fn(),
    updateMemberRole: vi.fn(),
    updateSettings: vi.fn(),
  };
  const userRepository = {
    getByEmail: vi.fn(),
  };

  let service: OrganizationService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new OrganizationService(
      auditLogRepository as never,
      organizationRepository as never,
      userRepository as never,
    );
    organizationRepository.getRole.mockResolvedValue({ role: OrganizationRole.Owner });
  });

  it('blocks workspace members from updating workspace settings at the service boundary', async () => {
    organizationRepository.getRole.mockResolvedValue({ role: OrganizationRole.Member });

    await expect(
      service.updateSettings(auth, 'organization-id', {
        name: 'Member Rename',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Service-level permission prevents internal callers from relying only on controller decorators.
    expect(organizationRepository.getSettingsForUser).not.toHaveBeenCalled();
    expect(organizationRepository.updateSettings).not.toHaveBeenCalled();
  });

  it('blocks low-scope API keys before workspace member list lookups', async () => {
    await expect(service.getMembers(authWithReadApiKey, 'organization-id', { limit: 10 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    // API-key scope is rejected before membership lookup so low-scope tokens cannot probe workspace existence.
    expect(organizationRepository.getRole).not.toHaveBeenCalled();
    expect(organizationRepository.getMembers).not.toHaveBeenCalled();
  });

  it('prevents demoting the last workspace owner', async () => {
    organizationRepository.getMember.mockResolvedValue({
      ...ownerMember,
      email: 'another-owner@tabliodb.local',
      name: 'Another Owner',
      userId: 'another-owner-id',
    });
    organizationRepository.getOrganizationOwnerCount.mockResolvedValue(1);

    await expect(
      service.updateMemberRole(auth, 'organization-id', 'another-owner-id', {
        role: OrganizationRole.Member,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // A workspace without an owner would lock everyone out of organization management.
    expect(organizationRepository.updateMemberRole).not.toHaveBeenCalled();
  });

  it('prevents removing the last workspace owner', async () => {
    organizationRepository.getMember.mockResolvedValue({
      ...ownerMember,
      email: 'another-owner@tabliodb.local',
      name: 'Another Owner',
      userId: 'another-owner-id',
    });
    organizationRepository.getOrganizationOwnerCount.mockResolvedValue(1);

    await expect(service.removeMember(auth, 'organization-id', 'another-owner-id')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    // Last-owner protection must run before the delete query.
    expect(organizationRepository.removeMember).not.toHaveBeenCalled();
  });

  it('prevents changing your own workspace role', async () => {
    await expect(
      service.updateMemberRole(auth, 'organization-id', 'owner-id', {
        role: OrganizationRole.Member,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Self-management is rejected before member lookup so an owner cannot demote and re-promote themselves.
    expect(organizationRepository.getMember).not.toHaveBeenCalled();
    expect(organizationRepository.updateMemberRole).not.toHaveBeenCalled();
  });

  it('prevents assigning workspace owner through the generic member create endpoint', async () => {
    await expect(
      service.addMember(auth, 'organization-id', {
        email: 'member@tabliodb.local',
        // Owner is intentionally tested as an invalid payload because generated clients and malicious callers can drift.
        role: OrganizationRole.Owner as never,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(userRepository.getByEmail).not.toHaveBeenCalled();
    expect(organizationRepository.addMemberIfAbsent).not.toHaveBeenCalled();
  });

  it('prevents assigning workspace owner through the generic member update endpoint', async () => {
    await expect(
      service.updateMemberRole(auth, 'organization-id', 'member-id', {
        // Ownership is not a normal role update; transferOwnership is the only auditable promotion path.
        role: OrganizationRole.Owner as never,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(organizationRepository.getMember).not.toHaveBeenCalled();
    expect(organizationRepository.updateMemberRole).not.toHaveBeenCalled();
  });

  it('prevents workspace admins from transferring workspace ownership', async () => {
    organizationRepository.getRole.mockResolvedValue({ role: OrganizationRole.Admin });

    await expect(
      service.transferOwnership(auth, 'organization-id', {
        userId: 'member-id',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(organizationRepository.getMember).not.toHaveBeenCalled();
    expect(organizationRepository.transferOwnership).not.toHaveBeenCalled();
  });

  it('transfers workspace ownership to an existing active workspace member', async () => {
    organizationRepository.getMember.mockResolvedValue({
      ...ownerMember,
      email: 'admin@tabliodb.local',
      name: 'Admin User',
      role: OrganizationRole.Admin,
      userId: 'admin-id',
    });
    organizationRepository.transferOwnership.mockResolvedValue({
      ...ownerMember,
      email: 'admin@tabliodb.local',
      name: 'Admin User',
      role: OrganizationRole.Owner,
      userId: 'admin-id',
    });

    await expect(
      service.transferOwnership(auth, 'organization-id', {
        userId: 'admin-id',
      }),
    ).resolves.toMatchObject({
      role: OrganizationRole.Owner,
      userId: 'admin-id',
    });

    expect(organizationRepository.transferOwnership).toHaveBeenCalledWith('organization-id', 'admin-id');
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'organization.member_role_updated',
        actorId: 'owner-id',
        entityId: 'admin-id',
        entityType: 'organization_member',
        metadata: expect.objectContaining({
          transfer: true,
        }),
        organizationId: 'organization-id',
      }),
    );
  });

  it('prevents removing your own workspace access', async () => {
    await expect(service.removeMember(auth, 'organization-id', 'owner-id')).rejects.toBeInstanceOf(BadRequestException);

    // Self-removal has to be an explicit transfer/leave flow, not the generic member delete endpoint.
    expect(organizationRepository.getMember).not.toHaveBeenCalled();
    expect(organizationRepository.removeMember).not.toHaveBeenCalled();
  });

  it('updates a workspace member role and records audit metadata', async () => {
    organizationRepository.getMember.mockResolvedValue({
      ...ownerMember,
      email: 'member@tabliodb.local',
      name: 'Member User',
      role: OrganizationRole.Member,
      userId: 'member-id',
    });
    organizationRepository.updateMemberRole.mockResolvedValue({
      ...ownerMember,
      email: 'member@tabliodb.local',
      name: 'Member User',
      role: OrganizationRole.Admin,
      userId: 'member-id',
    });

    await expect(
      service.updateMemberRole(auth, 'organization-id', 'member-id', {
        role: OrganizationRole.Admin,
      }),
    ).resolves.toMatchObject({
      email: 'member@tabliodb.local',
      role: OrganizationRole.Admin,
      userId: 'member-id',
    });

    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'organization.member_role_updated',
        actorId: 'owner-id',
        entityId: 'member-id',
        entityType: 'organization_member',
        organizationId: 'organization-id',
      }),
    );
  });

  it('adds an existing user to a workspace and records audit metadata', async () => {
    userRepository.getByEmail.mockResolvedValue({
      email: 'member@tabliodb.local',
      id: 'member-id',
      name: 'Member User',
    });
    organizationRepository.getMember.mockResolvedValue(undefined);
    organizationRepository.addMemberIfAbsent.mockResolvedValue({
      ...ownerMember,
      email: 'member@tabliodb.local',
      name: 'Member User',
      role: OrganizationRole.Member,
      userId: 'member-id',
    });

    await expect(
      service.addMember(auth, 'organization-id', {
        email: 'member@tabliodb.local',
        role: OrganizationRole.Member,
      }),
    ).resolves.toMatchObject({
      email: 'member@tabliodb.local',
      role: OrganizationRole.Member,
      userId: 'member-id',
    });

    expect(organizationRepository.addMemberIfAbsent).toHaveBeenCalledWith({
      createdById: 'owner-id',
      organizationId: 'organization-id',
      role: OrganizationRole.Member,
      userId: 'member-id',
    });
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'organization.member_added',
        actorId: 'owner-id',
        entityId: 'member-id',
        entityType: 'organization_member',
        organizationId: 'organization-id',
      }),
    );
  });

  it('throws not found when a target workspace member does not exist', async () => {
    organizationRepository.getMember.mockResolvedValue(undefined);

    await expect(
      service.updateMemberRole(auth, 'organization-id', 'missing-user-id', {
        role: OrganizationRole.Guest,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
