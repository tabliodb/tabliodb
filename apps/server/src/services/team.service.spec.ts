import { BadRequestException } from '@nestjs/common';
import { OrganizationRole, Permission, AccessRole } from '@tabliodb/shared';
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
  folderAccessCount: 0,
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

const folderAccess = {
  createdAt: new Date('2026-08-02T09:00:00.000Z'),
  folderId: 'folder-id',
  folderName: 'Library System',
  folderSlug: 'library-system',
  role: AccessRole.Editor,
  updatedAt: new Date('2026-08-02T09:00:00.000Z'),
};

const diagramAccess = {
  createdAt: new Date('2026-08-02T09:30:00.000Z'),
  diagramId: 'diagram-id',
  diagramName: 'Main schema',
  folderId: null,
  role: AccessRole.Commenter,
  updatedAt: new Date('2026-08-02T09:30:00.000Z'),
};

describe(TeamService.name, () => {
  const auditLogRepository = {
    create: vi.fn(),
  };
  const organizationRepository = {
    addMemberIfAbsent: vi.fn(),
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
    getFolderAccess: vi.fn(),
    getFolderAccesses: vi.fn(),
    getFolderInOrganization: vi.fn(),
    list: vi.fn(),
    removeMember: vi.fn(),
    removeDiagramAccess: vi.fn(),
    removeFolderAccess: vi.fn(),
    update: vi.fn(),
    upsertDiagramAccess: vi.fn(),
    upsertFolderAccess: vi.fn(),
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
    organizationRepository.addMemberIfAbsent.mockResolvedValue({
      role: OrganizationRole.Member,
      status: 'active',
      userId: member.userId,
    });
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
    expect(organizationRepository.addMemberIfAbsent).toHaveBeenCalledWith({
      createdById: 'owner-id',
      organizationId: 'organization-id',
      role: OrganizationRole.Guest,
      userId: member.userId,
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

  it('anchors an existing user as a workspace guest before adding team membership', async () => {
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
    teamRepository.getMember.mockResolvedValue(undefined);
    teamRepository.addMember.mockResolvedValue({
      avatarUrl: null,
      createdAt: new Date('2026-08-02T08:30:00.000Z'),
      cursorColor: '#1cb0f6',
      email: 'outsider@tabliodb.local',
      name: 'Outsider User',
      userId: 'outsider-id',
    });

    await expect(service.addMember(auth, 'team-id', { email: 'outsider@tabliodb.local' })).resolves.toMatchObject({
      email: 'outsider@tabliodb.local',
      userId: 'outsider-id',
    });

    expect(organizationRepository.addMemberIfAbsent).toHaveBeenCalledWith({
      createdById: 'owner-id',
      organizationId: 'organization-id',
      role: OrganizationRole.Guest,
      userId: 'outsider-id',
    });
    expect(teamRepository.addMember).toHaveBeenCalledWith('team-id', {
      createdById: 'owner-id',
      userId: 'outsider-id',
    });
  });

  it('rejects adding suspended workspace users to a team', async () => {
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

    await expect(service.addMember(auth, 'team-id', { email: 'suspended@tabliodb.local' })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    // Suspended/pending workspace rows stay inactive; team membership cannot be used as a reactivation shortcut.
    expect(teamRepository.addMember).not.toHaveBeenCalled();
    expect(auditLogRepository.create).not.toHaveBeenCalled();
  });

  it('keeps re-adding an existing team member idempotent without duplicate audit logs', async () => {
    userRepository.getByEmail.mockResolvedValue({
      email: member.email,
      id: member.userId,
      name: member.name,
    });
    organizationRepository.addMemberIfAbsent.mockResolvedValue({
      role: OrganizationRole.Member,
      status: 'active',
      userId: member.userId,
    });
    teamRepository.getMember.mockResolvedValue(member);
    teamRepository.addMember.mockResolvedValue(member);

    await expect(service.addMember(auth, 'team-id', { email: member.email })).resolves.toMatchObject({
      userId: member.userId,
    });

    expect(teamRepository.addMember).toHaveBeenCalled();
    expect(auditLogRepository.create).not.toHaveBeenCalled();
  });

  it('grants same-workspace folder access through a team', async () => {
    teamRepository.getFolderInOrganization.mockResolvedValue({
      id: folderAccess.folderId,
      name: folderAccess.folderName,
      organizationId: team.organizationId,
      slug: folderAccess.folderSlug,
    });
    teamRepository.getFolderAccess.mockResolvedValue(undefined);
    teamRepository.upsertFolderAccess.mockResolvedValue(folderAccess);

    await expect(
      service.upsertFolderAccess(auth, 'team-id', {
        folderId: folderAccess.folderId,
        role: AccessRole.Editor,
      }),
    ).resolves.toMatchObject({
      folderId: folderAccess.folderId,
      role: AccessRole.Editor,
    });

    expect(teamRepository.upsertFolderAccess).toHaveBeenCalledWith('team-id', {
      createdById: 'owner-id',
      folderId: folderAccess.folderId,
      role: AccessRole.Editor,
    });
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.TeamFolderAccessUpdated,
        entityId: folderAccess.folderId,
        entityType: 'team_folder_access',
        organizationId: team.organizationId,
        folderId: folderAccess.folderId,
      }),
    );
  });

  it('rejects folder access grants across workspace boundaries', async () => {
    teamRepository.getFolderInOrganization.mockResolvedValue(undefined);

    await expect(
      service.upsertFolderAccess(auth, 'team-id', {
        folderId: 'foreign-folder-id',
        role: AccessRole.Viewer,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // The service validates folder ownership before inserting the team grant.
    expect(teamRepository.upsertFolderAccess).not.toHaveBeenCalled();
  });

  it('grants same-workspace diagram access through a team', async () => {
    teamRepository.getDiagramInOrganization.mockResolvedValue({
      id: diagramAccess.diagramId,
      name: diagramAccess.diagramName,
      organizationId: team.organizationId,
      folderId: null,
    });
    teamRepository.getDiagramAccess.mockResolvedValue(undefined);
    teamRepository.upsertDiagramAccess.mockResolvedValue(diagramAccess);

    await expect(
      service.upsertDiagramAccess(auth, 'team-id', {
        diagramId: diagramAccess.diagramId,
        role: AccessRole.Commenter,
      }),
    ).resolves.toMatchObject({
      diagramId: diagramAccess.diagramId,
      role: AccessRole.Commenter,
    });

    expect(teamRepository.upsertDiagramAccess).toHaveBeenCalledWith('team-id', {
      createdById: 'owner-id',
      diagramId: diagramAccess.diagramId,
      role: AccessRole.Commenter,
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
        role: AccessRole.Viewer,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Direct team-to-diagram grants must keep the same workspace boundary as folder grants.
    expect(teamRepository.upsertDiagramAccess).not.toHaveBeenCalled();
  });
});
