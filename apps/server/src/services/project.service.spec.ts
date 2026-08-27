import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationRole, Permission, ProjectRole } from '@tabliodb/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../database.js';
import { ProjectService } from './project.service.js';

const auth: AuthContext = {
  user: {
    avatarUrl: null,
    cursorColor: '#58cc02',
    email: 'owner@tabliodb.local',
    id: 'owner-id',
    name: 'Project Owner',
    passwordChangeRequired: false,
  },
};

const authWithReadApiKey: AuthContext = {
  ...auth,
  apiKey: {
    id: 'api-key-id',
    permissions: [Permission.ProjectRead],
  },
};

const project = {
  createdAt: new Date('2026-07-29T10:00:00.000Z'),
  description: null,
  id: 'project-id',
  name: 'Library System',
  organizationId: 'organization-id',
  organizationName: 'Default Workspace',
  organizationSlug: 'default-workspace',
  projectRole: ProjectRole.Owner,
  slug: 'library-system',
  updatedAt: new Date('2026-07-29T10:00:00.000Z'),
};

describe(ProjectService.name, () => {
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
  const projectRepository = {
    archive: vi.fn(),
    create: vi.fn(),
    getByIdForUser: vi.fn(),
    getMember: vi.fn(),
    getMembers: vi.fn(),
    getProjectRole: vi.fn(),
    getProjectOwnerCount: vi.fn(),
    getVisibleToUser: vi.fn(),
    removeMember: vi.fn(),
    transferOwnership: vi.fn(),
    update: vi.fn(),
    updateMember: vi.fn(),
    upsertMember: vi.fn(),
  };
  const userRepository = {
    getByEmail: vi.fn(),
  };

  let service: ProjectService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new ProjectService(
      auditLogRepository as never,
      organizationRepository as never,
      projectRepository as never,
      userRepository as never,
    );

    projectRepository.getByIdForUser.mockResolvedValue(project);
  });

  it('blocks project updates from project viewers at the service boundary', async () => {
    projectRepository.getByIdForUser.mockResolvedValue({
      ...project,
      projectRole: ProjectRole.Viewer,
    });

    await expect(
      service.update(auth, 'project-id', {
        name: 'Readonly Rename',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Controller decorators are not the only protection; service callers must also respect project roles.
    expect(projectRepository.update).not.toHaveBeenCalled();
  });

  it('blocks low-scope API keys before project member management lookups', async () => {
    await expect(
      service.addMember(authWithReadApiKey, 'project-id', {
        email: 'editor@tabliodb.local',
        role: ProjectRole.Editor,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // API-key scope is checked before loading the project so low-scope tokens cannot probe project existence.
    expect(projectRepository.getByIdForUser).not.toHaveBeenCalled();
    expect(userRepository.getByEmail).not.toHaveBeenCalled();
    expect(projectRepository.upsertMember).not.toHaveBeenCalled();
  });

  it('adds an existing workspace user as a project member', async () => {
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
    projectRepository.upsertMember.mockResolvedValue({
      avatarUrl: null,
      cursorColor: '#58cc02',
      createdAt: new Date('2026-07-29T11:00:00.000Z'),
      email: 'editor@tabliodb.local',
      name: 'Editor User',
      role: ProjectRole.Editor,
      updatedAt: new Date('2026-07-29T11:00:00.000Z'),
      userId: 'editor-id',
    });

    await expect(
      service.addMember(auth, 'project-id', {
        email: 'editor@tabliodb.local',
        role: ProjectRole.Editor,
      }),
    ).resolves.toMatchObject({
      email: 'editor@tabliodb.local',
      role: ProjectRole.Editor,
      userId: 'editor-id',
    });

    expect(organizationRepository.addMemberIfAbsent).toHaveBeenCalledWith({
      createdById: 'owner-id',
      organizationId: 'organization-id',
      role: OrganizationRole.Guest,
      userId: 'editor-id',
    });
    expect(projectRepository.upsertMember).toHaveBeenCalledWith('project-id', {
      createdById: 'owner-id',
      role: ProjectRole.Editor,
      userId: 'editor-id',
    });
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'project.member_added',
        actorId: 'owner-id',
        entityId: 'editor-id',
        entityType: 'project_member',
        organizationId: 'organization-id',
        projectId: 'project-id',
      }),
    );
  });

  it('returns a conflict error when project slug already exists in the workspace', async () => {
    organizationRepository.getByIdForUser.mockResolvedValue({
      allowMemberProjectCreate: true,
      id: 'organization-id',
      role: OrganizationRole.Owner,
    });
    projectRepository.create.mockRejectedValue({
      code: '23505',
      constraint: 'projects_organization_id_slug_key',
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
    projectRepository.upsertMember.mockResolvedValue({
      avatarUrl: null,
      cursorColor: '#1cb0f6',
      createdAt: new Date('2026-07-29T11:30:00.000Z'),
      email: 'outsider@tabliodb.local',
      name: 'Outsider User',
      role: ProjectRole.Viewer,
      updatedAt: new Date('2026-07-29T11:30:00.000Z'),
      userId: 'outsider-id',
    });

    await expect(
      service.addMember(auth, 'project-id', {
        email: 'outsider@tabliodb.local',
        role: ProjectRole.Viewer,
      }),
    ).resolves.toMatchObject({
      email: 'outsider@tabliodb.local',
      role: ProjectRole.Viewer,
      userId: 'outsider-id',
    });

    // Folder grants pull existing users into the workspace as guests, matching the direct diagram invite flow.
    expect(organizationRepository.addMemberIfAbsent).toHaveBeenCalledWith({
      createdById: 'owner-id',
      organizationId: 'organization-id',
      role: OrganizationRole.Guest,
      userId: 'outsider-id',
    });
    expect(projectRepository.upsertMember).toHaveBeenCalledWith('project-id', {
      createdById: 'owner-id',
      role: ProjectRole.Viewer,
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
      service.addMember(auth, 'project-id', {
        email: 'suspended@tabliodb.local',
        role: ProjectRole.Viewer,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Existing suspended/pending workspace rows are never reactivated through lower-scope grants.
    expect(projectRepository.upsertMember).not.toHaveBeenCalled();
  });

  it('prevents demoting the last project owner', async () => {
    projectRepository.getMember.mockResolvedValue({
      role: ProjectRole.Owner,
      userId: 'another-owner-id',
    });
    projectRepository.getProjectOwnerCount.mockResolvedValue(1);

    await expect(
      service.updateMember(auth, 'project-id', 'another-owner-id', {
        role: ProjectRole.Editor,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(projectRepository.updateMember).not.toHaveBeenCalled();
  });

  it('prevents removing the last project owner', async () => {
    projectRepository.getMember.mockResolvedValue({
      role: ProjectRole.Owner,
      userId: 'another-owner-id',
    });
    projectRepository.getProjectOwnerCount.mockResolvedValue(1);

    await expect(service.removeMember(auth, 'project-id', 'another-owner-id')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(projectRepository.removeMember).not.toHaveBeenCalled();
  });

  it('prevents changing your own project folder access', async () => {
    await expect(
      service.updateMember(auth, 'project-id', 'owner-id', {
        role: ProjectRole.Viewer,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Self-management is rejected before member lookup so an owner cannot demote and re-promote themselves.
    expect(projectRepository.getMember).not.toHaveBeenCalled();
    expect(projectRepository.updateMember).not.toHaveBeenCalled();
  });

  it('prevents assigning folder owner through the generic member create endpoint', async () => {
    await expect(
      service.addMember(auth, 'project-id', {
        email: 'editor@tabliodb.local',
        // This intentionally simulates a stale/generated-client bypass attempt; Owner must only flow through transferOwnership.
        role: ProjectRole.Owner as never,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(userRepository.getByEmail).not.toHaveBeenCalled();
    expect(projectRepository.upsertMember).not.toHaveBeenCalled();
  });

  it('prevents adding yourself through the generic folder access endpoint', async () => {
    userRepository.getByEmail.mockResolvedValue({
      email: auth.user.email,
      id: auth.user.id,
      name: auth.user.name,
    });

    await expect(
      service.addMember(auth, 'project-id', {
        email: auth.user.email,
        role: ProjectRole.Viewer,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Folder owner/admin self role changes must stay out of the generic add/upsert path.
    expect(organizationRepository.addMemberIfAbsent).not.toHaveBeenCalled();
    expect(projectRepository.upsertMember).not.toHaveBeenCalled();
  });

  it('prevents assigning folder owner through the generic member update endpoint', async () => {
    await expect(
      service.updateMember(auth, 'project-id', 'editor-id', {
        // Generic role edits cannot promote Owner because they would bypass the explicit transfer audit trail.
        role: ProjectRole.Owner as never,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(projectRepository.getMember).not.toHaveBeenCalled();
    expect(projectRepository.updateMember).not.toHaveBeenCalled();
  });

  it('transfers folder ownership to an existing active folder collaborator', async () => {
    organizationRepository.getMember.mockResolvedValue({
      role: OrganizationRole.Member,
      status: 'active',
      userId: 'editor-id',
    });
    projectRepository.getProjectRole.mockResolvedValue({ role: ProjectRole.Editor });
    projectRepository.getMember.mockResolvedValue({
      role: ProjectRole.Editor,
      userId: 'editor-id',
    });
    projectRepository.transferOwnership.mockResolvedValue({
      avatarUrl: null,
      cursorColor: '#1cb0f6',
      createdAt: new Date('2026-07-29T12:00:00.000Z'),
      email: 'editor@tabliodb.local',
      name: 'Editor User',
      role: ProjectRole.Owner,
      updatedAt: new Date('2026-07-29T12:00:00.000Z'),
      userId: 'editor-id',
    });

    await expect(
      service.transferOwnership(auth, 'project-id', {
        userId: 'editor-id',
      }),
    ).resolves.toMatchObject({
      role: ProjectRole.Owner,
      userId: 'editor-id',
    });

    expect(projectRepository.transferOwnership).toHaveBeenCalledWith('project-id', {
      createdById: 'owner-id',
      userId: 'editor-id',
    });
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'project.member_role_updated',
        actorId: 'owner-id',
        entityId: 'editor-id',
        entityType: 'project_member',
        metadata: expect.objectContaining({
          transfer: true,
        }),
        organizationId: 'organization-id',
        projectId: 'project-id',
      }),
    );
  });

  it('prevents transferring folder ownership to a user outside the workspace', async () => {
    organizationRepository.getMember.mockResolvedValue(undefined);

    await expect(
      service.transferOwnership(auth, 'project-id', {
        userId: 'outsider-id',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(projectRepository.getProjectRole).not.toHaveBeenCalled();
    expect(projectRepository.transferOwnership).not.toHaveBeenCalled();
  });

  it('prevents removing your own project folder access', async () => {
    await expect(service.removeMember(auth, 'project-id', 'owner-id')).rejects.toBeInstanceOf(BadRequestException);

    // Self-removal has to be an explicit transfer/leave flow, not the generic member delete endpoint.
    expect(projectRepository.getMember).not.toHaveBeenCalled();
    expect(projectRepository.removeMember).not.toHaveBeenCalled();
  });

  it('throws not found when a target member does not exist', async () => {
    projectRepository.getMember.mockResolvedValue(undefined);

    await expect(
      service.updateMember(auth, 'project-id', 'missing-user-id', {
        role: ProjectRole.Viewer,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
