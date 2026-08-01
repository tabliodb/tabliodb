import { BadRequestException } from '@nestjs/common';
import { Permission, ProjectRole } from '@tabliodb/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditAction } from '../constants.js';
import type { AuthContext } from '../database.js';
import { TeamService } from './team.service.js';

const auth: AuthContext = {
  request: {
    ipAddress: '127.0.0.1',
    requestId: 'request-id',
    userAgent: 'vitest',
  },
  user: {
    avatarUrl: null,
    cursorColor: '#58cc02',
    email: 'owner@tabliodb.local',
    id: 'owner-id',
    name: 'Workspace Owner',
  },
};

const team = {
  createdAt: new Date('2026-08-02T07:00:00.000Z'),
  description: 'Backend and API maintainers',
  id: 'team-id',
  memberCount: 0,
  name: 'Backend team',
  organizationId: 'organization-id',
  projectAccessCount: 0,
  slug: 'backend-team',
  updatedAt: new Date('2026-08-02T07:00:00.000Z'),
};

const member = {
  avatarUrl: null,
  createdAt: new Date('2026-08-02T08:00:00.000Z'),
  cursorColor: '#1cb0f6',
  email: 'editor@tabliodb.local',
  name: 'Editor User',
  userId: 'editor-id',
};

const projectAccess = {
  createdAt: new Date('2026-08-02T09:00:00.000Z'),
  projectId: 'project-id',
  projectName: 'Library System',
  projectSlug: 'library-system',
  role: ProjectRole.Editor,
  updatedAt: new Date('2026-08-02T09:00:00.000Z'),
};

describe(TeamService.name, () => {
  const auditLogRepository = {
    create: vi.fn(),
  };
  const organizationRepository = {
    getMember: vi.fn(),
  };
  const permissionService = {
    assertAllowed: vi.fn(),
  };
  const teamRepository = {
    addMember: vi.fn(),
    archive: vi.fn(),
    create: vi.fn(),
    getById: vi.fn(),
    getMember: vi.fn(),
    getMembers: vi.fn(),
    getProjectAccess: vi.fn(),
    getProjectAccesses: vi.fn(),
    getProjectInOrganization: vi.fn(),
    list: vi.fn(),
    removeMember: vi.fn(),
    removeProjectAccess: vi.fn(),
    update: vi.fn(),
    upsertProjectAccess: vi.fn(),
  };
  const userRepository = {
    getByEmail: vi.fn(),
  };

  let service: TeamService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new TeamService(
      auditLogRepository as never,
      organizationRepository as never,
      permissionService as never,
      teamRepository as never,
      userRepository as never,
    );

    permissionService.assertAllowed.mockResolvedValue(undefined);
    teamRepository.getById.mockResolvedValue(team);
  });

  it('adds an active workspace user to a team and records audit once', async () => {
    userRepository.getByEmail.mockResolvedValue({
      email: member.email,
      id: member.userId,
      name: member.name,
    });
    organizationRepository.getMember.mockResolvedValue({ status: 'active', userId: member.userId });
    teamRepository.getMember.mockResolvedValue(undefined);
    teamRepository.addMember.mockResolvedValue(member);

    await expect(service.addMember(auth, 'team-id', { email: member.email })).resolves.toMatchObject({
      email: member.email,
      userId: member.userId,
    });

    expect(permissionService.assertAllowed).toHaveBeenCalledWith(auth, {
      permission: Permission.OrganizationManage,
      target: {
        id: 'organization-id',
        type: 'organization',
      },
    });
    expect(teamRepository.addMember).toHaveBeenCalledWith('team-id', {
      createdById: 'owner-id',
      userId: member.userId,
    });
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.TeamMemberAdded,
        actorId: 'owner-id',
        entityId: member.userId,
        entityType: 'team_member',
        organizationId: 'organization-id',
      }),
    );
  });

  it('rejects adding users that are not active workspace members', async () => {
    userRepository.getByEmail.mockResolvedValue({
      email: 'outsider@tabliodb.local',
      id: 'outsider-id',
      name: 'Outsider User',
    });
    organizationRepository.getMember.mockResolvedValue(null);

    await expect(service.addMember(auth, 'team-id', { email: 'outsider@tabliodb.local' })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    // A team must never become a shortcut around workspace membership.
    expect(teamRepository.addMember).not.toHaveBeenCalled();
    expect(auditLogRepository.create).not.toHaveBeenCalled();
  });

  it('keeps re-adding an existing team member idempotent without duplicate audit logs', async () => {
    userRepository.getByEmail.mockResolvedValue({
      email: member.email,
      id: member.userId,
      name: member.name,
    });
    organizationRepository.getMember.mockResolvedValue({ status: 'active', userId: member.userId });
    teamRepository.getMember.mockResolvedValue(member);
    teamRepository.addMember.mockResolvedValue(member);

    await expect(service.addMember(auth, 'team-id', { email: member.email })).resolves.toMatchObject({
      userId: member.userId,
    });

    expect(teamRepository.addMember).toHaveBeenCalled();
    expect(auditLogRepository.create).not.toHaveBeenCalled();
  });

  it('grants same-workspace project access through a team', async () => {
    teamRepository.getProjectInOrganization.mockResolvedValue({
      id: projectAccess.projectId,
      name: projectAccess.projectName,
      organizationId: team.organizationId,
      slug: projectAccess.projectSlug,
    });
    teamRepository.getProjectAccess.mockResolvedValue(undefined);
    teamRepository.upsertProjectAccess.mockResolvedValue(projectAccess);

    await expect(
      service.upsertProjectAccess(auth, 'team-id', {
        projectId: projectAccess.projectId,
        role: ProjectRole.Editor,
      }),
    ).resolves.toMatchObject({
      projectId: projectAccess.projectId,
      role: ProjectRole.Editor,
    });

    expect(teamRepository.upsertProjectAccess).toHaveBeenCalledWith('team-id', {
      createdById: 'owner-id',
      projectId: projectAccess.projectId,
      role: ProjectRole.Editor,
    });
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.TeamProjectAccessUpdated,
        entityId: projectAccess.projectId,
        entityType: 'team_project_access',
        organizationId: team.organizationId,
        projectId: projectAccess.projectId,
      }),
    );
  });

  it('rejects project access grants across workspace boundaries', async () => {
    teamRepository.getProjectInOrganization.mockResolvedValue(undefined);

    await expect(
      service.upsertProjectAccess(auth, 'team-id', {
        projectId: 'foreign-project-id',
        role: ProjectRole.Viewer,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // The service validates project ownership before inserting the team grant.
    expect(teamRepository.upsertProjectAccess).not.toHaveBeenCalled();
  });
});
