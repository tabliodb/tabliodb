import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OrganizationRole, ProjectRole } from '@tabliodb/shared';
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
    createPersonalOrganization: vi.fn(),
    getByIdForUser: vi.fn(),
    getFirstForUser: vi.fn(),
  };
  const projectRepository = {
    archive: vi.fn(),
    create: vi.fn(),
    getByIdForUser: vi.fn(),
    getMember: vi.fn(),
    getMembers: vi.fn(),
    getProjectOwnerCount: vi.fn(),
    getVisibleToUser: vi.fn(),
    removeMember: vi.fn(),
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

  it('adds an existing workspace user as a project member', async () => {
    userRepository.getByEmail.mockResolvedValue({
      email: 'editor@tabliodb.local',
      id: 'editor-id',
      name: 'Editor User',
    });
    organizationRepository.getByIdForUser.mockResolvedValue({ id: 'organization-id' });
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

  it('rejects adding a user that is not in the project workspace', async () => {
    userRepository.getByEmail.mockResolvedValue({
      email: 'outsider@tabliodb.local',
      id: 'outsider-id',
      name: 'Outsider User',
    });
    organizationRepository.getByIdForUser.mockResolvedValue(undefined);

    await expect(
      service.addMember(auth, 'project-id', {
        email: 'outsider@tabliodb.local',
        role: ProjectRole.Viewer,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Cross-workspace membership must fail before writing project_members.
    expect(projectRepository.upsertMember).not.toHaveBeenCalled();
  });

  it('prevents demoting the last project owner', async () => {
    projectRepository.getMember.mockResolvedValue({
      role: ProjectRole.Owner,
      userId: 'owner-id',
    });
    projectRepository.getProjectOwnerCount.mockResolvedValue(1);

    await expect(
      service.updateMember(auth, 'project-id', 'owner-id', {
        role: ProjectRole.Editor,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(projectRepository.updateMember).not.toHaveBeenCalled();
  });

  it('prevents removing the last project owner', async () => {
    projectRepository.getMember.mockResolvedValue({
      role: ProjectRole.Owner,
      userId: 'owner-id',
    });
    projectRepository.getProjectOwnerCount.mockResolvedValue(1);

    await expect(service.removeMember(auth, 'project-id', 'owner-id')).rejects.toBeInstanceOf(BadRequestException);

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
