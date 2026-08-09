import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrganizationRole } from '@tabliodb/shared';
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
    getMember: vi.fn(),
    getMembers: vi.fn(),
    getOrganizationOwnerCount: vi.fn(),
    getSettingsForUser: vi.fn(),
    listForUser: vi.fn(),
    removeMember: vi.fn(),
    updateMemberRole: vi.fn(),
    updateSettings: vi.fn(),
  };

  let service: OrganizationService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new OrganizationService(auditLogRepository as never, organizationRepository as never);
  });

  it('prevents demoting the last workspace owner', async () => {
    organizationRepository.getMember.mockResolvedValue(ownerMember);
    organizationRepository.getOrganizationOwnerCount.mockResolvedValue(1);

    await expect(
      service.updateMemberRole(auth, 'organization-id', 'owner-id', {
        role: OrganizationRole.Member,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // A workspace without an owner would lock everyone out of organization management.
    expect(organizationRepository.updateMemberRole).not.toHaveBeenCalled();
  });

  it('prevents removing the last workspace owner', async () => {
    organizationRepository.getMember.mockResolvedValue(ownerMember);
    organizationRepository.getOrganizationOwnerCount.mockResolvedValue(1);

    await expect(service.removeMember(auth, 'organization-id', 'owner-id')).rejects.toBeInstanceOf(BadRequestException);

    // Last-owner protection must run before the delete query.
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

  it('throws not found when a target workspace member does not exist', async () => {
    organizationRepository.getMember.mockResolvedValue(undefined);

    await expect(
      service.updateMemberRole(auth, 'organization-id', 'missing-user-id', {
        role: OrganizationRole.Guest,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
