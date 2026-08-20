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
    passwordChangeRequired: false,
  },
};

const team = {
  createdAt: new Date('2026-08-02T07:00:00.000Z'),
  description: 'Backend and API maintainers',
  diagramAccessCount: 0,
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

const diagramAccess = {
  createdAt: new Date('2026-08-02T09:30:00.000Z'),
  diagramId: 'diagram-id',
  diagramName: 'Main schema',
  projectId: null,
  role: ProjectRole.Commenter,
  updatedAt: new Date('2026-08-02T09:30:00.000Z'),
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
    getDiagramAccess: vi.fn(),
    getDiagramAccesses: vi.fn(),
    getDiagramInOrganization: vi.fn(),
    getMember: vi.fn(),
    getMembers: vi.fn(),
    getProjectAccess: vi.fn(),
    getProjectAccesses: vi.fn(),
    getProjectInOrganization: vi.fn(),
    list: vi.fn(),
    removeMember: vi.fn(),
    removeDiagramAccess: vi.fn(),
    removeProjectAccess: vi.fn(),
    update: vi.fn(),
    upsertDiagramAccess: vi.fn(),
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

  it('grants same-workspace diagram access through a team', async () => {
    teamRepository.getDiagramInOrganization.mockResolvedValue({
      id: diagramAccess.diagramId,
      name: diagramAccess.diagramName,
      organizationId: team.organizationId,
      projectId: null,
    });
    teamRepository.getDiagramAccess.mockResolvedValue(undefined);
    teamRepository.upsertDiagramAccess.mockResolvedValue(diagramAccess);

    await expect(
      service.upsertDiagramAccess(auth, 'team-id', {
        diagramId: diagramAccess.diagramId,
        role: ProjectRole.Commenter,
      }),
    ).resolves.toMatchObject({
      diagramId: diagramAccess.diagramId,
      role: ProjectRole.Commenter,
    });

    expect(teamRepository.upsertDiagramAccess).toHaveBeenCalledWith('team-id', {
      createdById: 'owner-id',
      diagramId: diagramAccess.diagramId,
      role: ProjectRole.Commenter,
    });
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.TeamDiagramAccessUpdated,
        diagramId: diagramAccess.diagramId,
        entityId: diagramAccess.diagramId,
        entityType: 'team_diagram_access',
        organizationId: team.organizationId,
      }),
    );
  });

  it('rejects diagram access grants across workspace boundaries', async () => {
    teamRepository.getDiagramInOrganization.mockResolvedValue(undefined);

    await expect(
      service.upsertDiagramAccess(auth, 'team-id', {
        diagramId: 'foreign-diagram-id',
        role: ProjectRole.Viewer,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Direct team-to-diagram grants must keep the same workspace boundary as folder grants.
    expect(teamRepository.upsertDiagramAccess).not.toHaveBeenCalled();
  });
});
