import { NotFoundException } from '@nestjs/common';
import { ProjectRole } from '@tabliodb/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../database.js';
import { UserPreferenceService } from './user-preference.service.js';

const auth: AuthContext = {
  user: {
    avatarUrl: null,
    cursorColor: '#58cc02',
    email: 'owner@tabliodb.local',
    id: 'user-id',
    name: 'Tabliodb Owner',
    passwordChangeRequired: false,
  },
};

const organization = {
  allowMemberProjectCreate: true,
  createdAt: new Date('2026-08-13T01:00:00.000Z'),
  defaultProjectRole: null,
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Personal Workspace',
  slug: 'personal-workspace',
  updatedAt: new Date('2026-08-13T01:00:00.000Z'),
};

const project = {
  createdAt: new Date('2026-08-13T01:10:00.000Z'),
  description: null,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Library System',
  organizationId: organization.id,
  organizationName: organization.name,
  organizationSlug: organization.slug,
  projectRole: ProjectRole.Owner,
  slug: 'library-system',
  updatedAt: new Date('2026-08-13T01:10:00.000Z'),
};

const diagram = {
  archivedAt: null,
  createdAt: new Date('2026-08-13T01:20:00.000Z'),
  dialect: 'postgresql',
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Main schema',
  organizationId: organization.id,
  projectId: project.id,
  slug: null,
  status: 'draft',
  updatedAt: new Date('2026-08-13T01:20:00.000Z'),
};

const preferenceRow = {
  createdAt: new Date('2026-08-13T02:00:00.000Z'),
  lastOpenedDiagramId: diagram.id,
  lastOpenedOrganizationId: organization.id,
  lastOpenedProjectId: project.id,
  updatedAt: new Date('2026-08-13T02:15:00.000Z'),
  userId: auth.user.id,
};

describe(UserPreferenceService.name, () => {
  const diagramRepository = {
    getById: vi.fn(),
  };
  const organizationRepository = {
    getSettingsForUser: vi.fn(),
  };
  const projectRepository = {
    getByIdForUser: vi.fn(),
    getDiagramRole: vi.fn(),
  };
  const userPreferenceRepository = {
    deleteEditorPreference: vi.fn(),
    getEditorPreference: vi.fn(),
    upsertEditorPreference: vi.fn(),
  };

  let service: UserPreferenceService;

  beforeEach(() => {
    vi.resetAllMocks();

    service = new UserPreferenceService(
      diagramRepository as never,
      organizationRepository as never,
      projectRepository as never,
      userPreferenceRepository as never,
    );

    organizationRepository.getSettingsForUser.mockResolvedValue(organization);
    projectRepository.getByIdForUser.mockResolvedValue(project);
    projectRepository.getDiagramRole.mockResolvedValue({ role: ProjectRole.Owner });
    diagramRepository.getById.mockResolvedValue(diagram);
    userPreferenceRepository.upsertEditorPreference.mockResolvedValue(preferenceRow);
  });

  it('returns an empty editor preference when the user has not opened an editor target yet', async () => {
    userPreferenceRepository.getEditorPreference.mockResolvedValue(undefined);

    await expect(service.getEditorPreference(auth)).resolves.toEqual({
      diagramId: null,
      diagramName: null,
      organizationId: null,
      organizationName: null,
      projectId: null,
      projectName: null,
      updatedAt: null,
      workspaceSlug: null,
    });

    expect(userPreferenceRepository.getEditorPreference).toHaveBeenCalledWith('user-id');
    expect(userPreferenceRepository.deleteEditorPreference).not.toHaveBeenCalled();
  });

  it('resolves the stored editor preference only when the user can still access every target', async () => {
    userPreferenceRepository.getEditorPreference.mockResolvedValue(preferenceRow);

    await expect(service.getEditorPreference(auth)).resolves.toEqual({
      diagramId: diagram.id,
      diagramName: 'Main schema',
      organizationId: organization.id,
      organizationName: 'Personal Workspace',
      projectId: project.id,
      projectName: 'Library System',
      updatedAt: '2026-08-13T02:15:00.000Z',
      workspaceSlug: 'personal-workspace',
    });

    expect(organizationRepository.getSettingsForUser).toHaveBeenCalledWith('user-id', organization.id);
    expect(projectRepository.getByIdForUser).toHaveBeenCalledWith('user-id', project.id);
    expect(projectRepository.getDiagramRole).toHaveBeenCalledWith('user-id', diagram.id);
  });

  it('deletes stale editor preference when the saved workspace is no longer visible', async () => {
    userPreferenceRepository.getEditorPreference.mockResolvedValue(preferenceRow);
    organizationRepository.getSettingsForUser.mockResolvedValue(undefined);

    await expect(service.getEditorPreference(auth)).resolves.toMatchObject({
      diagramId: null,
      organizationId: null,
      projectId: null,
    });

    // Preference lama dibersihkan secara lazy agar login berikutnya tidak terus mencoba target yang sudah tidak accessible.
    expect(userPreferenceRepository.deleteEditorPreference).toHaveBeenCalledWith('user-id');
    expect(projectRepository.getByIdForUser).not.toHaveBeenCalled();
    expect(diagramRepository.getById).not.toHaveBeenCalled();
  });

  it('stores a valid workspace, project, and diagram target for the current user', async () => {
    await expect(
      service.updateEditorPreference(auth, {
        diagramId: diagram.id,
        organizationId: organization.id,
        projectId: project.id,
      }),
    ).resolves.toMatchObject({
      diagramId: diagram.id,
      organizationId: organization.id,
      projectId: project.id,
    });

    expect(userPreferenceRepository.upsertEditorPreference).toHaveBeenCalledWith('user-id', {
      lastOpenedDiagramId: diagram.id,
      lastOpenedOrganizationId: organization.id,
      lastOpenedProjectId: project.id,
    });
  });

  it('stores workspace-only preference when the workspace has no accessible project yet', async () => {
    userPreferenceRepository.upsertEditorPreference.mockResolvedValue({
      ...preferenceRow,
      lastOpenedDiagramId: null,
      lastOpenedProjectId: null,
    });

    await expect(
      service.updateEditorPreference(auth, {
        organizationId: organization.id,
      }),
    ).resolves.toEqual({
      diagramId: null,
      diagramName: null,
      organizationId: organization.id,
      organizationName: organization.name,
      projectId: null,
      projectName: null,
      updatedAt: '2026-08-13T02:15:00.000Z',
      workspaceSlug: organization.slug,
    });

    expect(projectRepository.getByIdForUser).not.toHaveBeenCalled();
    expect(userPreferenceRepository.upsertEditorPreference).toHaveBeenCalledWith('user-id', {
      lastOpenedDiagramId: null,
      lastOpenedOrganizationId: organization.id,
      lastOpenedProjectId: null,
    });
  });

  it('stores a root workspace diagram target without a project target', async () => {
    userPreferenceRepository.upsertEditorPreference.mockResolvedValue({
      ...preferenceRow,
      lastOpenedProjectId: null,
    });

    await expect(
      service.updateEditorPreference(auth, {
        diagramId: diagram.id,
        organizationId: organization.id,
      }),
    ).resolves.toMatchObject({
      diagramId: diagram.id,
      organizationId: organization.id,
      projectId: null,
    });

    expect(projectRepository.getByIdForUser).not.toHaveBeenCalled();
    expect(userPreferenceRepository.upsertEditorPreference).toHaveBeenCalledWith('user-id', {
      lastOpenedDiagramId: diagram.id,
      lastOpenedOrganizationId: organization.id,
      lastOpenedProjectId: null,
    });
  });

  it('rejects project targets that do not belong to the selected workspace', async () => {
    projectRepository.getByIdForUser.mockResolvedValue({
      ...project,
      organizationId: '99999999-9999-4999-8999-999999999999',
    });

    await expect(
      service.updateEditorPreference(auth, {
        organizationId: organization.id,
        projectId: project.id,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    // Cross-workspace preferences would create confusing redirects, so they stop before any write.
    expect(userPreferenceRepository.upsertEditorPreference).not.toHaveBeenCalled();
  });

  it('rejects diagram targets the user cannot access anymore', async () => {
    projectRepository.getDiagramRole.mockResolvedValue(undefined);

    await expect(
      service.updateEditorPreference(auth, {
        diagramId: diagram.id,
        organizationId: organization.id,
        projectId: project.id,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(userPreferenceRepository.upsertEditorPreference).not.toHaveBeenCalled();
  });
});
