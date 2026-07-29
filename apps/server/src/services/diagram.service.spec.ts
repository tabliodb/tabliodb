import { ForbiddenException } from '@nestjs/common';
import { Permission, ProjectRole } from '@tabliodb/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../database.js';
import { DiagramService } from './diagram.service.js';

const auth: AuthContext = {
  user: {
    avatarColor: null,
    email: 'editor@tabliodb.local',
    id: 'user-id',
    name: 'Editor User',
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
  projectRole: ProjectRole.Editor,
  slug: 'library-system',
  updatedAt: new Date('2026-07-29T10:00:00.000Z'),
};

const diagram = {
  archivedAt: null,
  createdAt: new Date('2026-07-29T11:00:00.000Z'),
  createdById: 'user-id',
  currentSnapshotId: null,
  dialect: 'postgresql',
  id: 'diagram-id',
  lastSnapshotVersion: 0,
  name: 'Main schema',
  projectId: 'project-id',
  slug: null,
  status: 'draft',
  updatedAt: new Date('2026-07-29T11:00:00.000Z'),
};

describe(DiagramService.name, () => {
  const diagramRepository = {
    create: vi.fn(),
    getById: vi.fn(),
    getByProject: vi.fn(),
  };
  const projectRepository = {
    getByIdForUser: vi.fn(),
    getDiagramRole: vi.fn(),
  };

  let service: DiagramService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new DiagramService(diagramRepository as never, projectRepository as never);
  });

  it('blocks a project viewer from creating diagrams', async () => {
    projectRepository.getByIdForUser.mockResolvedValue({
      ...project,
      projectRole: ProjectRole.Viewer,
    });

    await expect(
      service.create(auth, {
        dialect: 'postgresql',
        name: 'Read only schema',
        projectId: 'project-id',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Service-level permission keeps the write path protected even outside HTTP decorators.
    expect(diagramRepository.create).not.toHaveBeenCalled();
  });

  it('allows a project editor to create diagrams', async () => {
    projectRepository.getByIdForUser.mockResolvedValue(project);
    diagramRepository.create.mockResolvedValue(diagram);

    await expect(
      service.create(auth, {
        dialect: 'postgresql',
        name: 'Main schema',
        projectId: 'project-id',
      }),
    ).resolves.toMatchObject({
      id: 'diagram-id',
      name: 'Main schema',
      projectId: 'project-id',
    });
  });

  it('blocks a project viewer from update-class diagram permissions', async () => {
    projectRepository.getDiagramRole.mockResolvedValue({ role: ProjectRole.Viewer });

    await expect(service.requireDiagram(auth, 'diagram-id', Permission.SnapshotCreate)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    // The diagram row is not loaded when role permissions already reject the requested write.
    expect(diagramRepository.getById).not.toHaveBeenCalled();
  });

  it('allows a project editor to use update-class diagram permissions', async () => {
    projectRepository.getDiagramRole.mockResolvedValue({ role: ProjectRole.Editor });
    diagramRepository.getById.mockResolvedValue(diagram);

    await expect(service.requireDiagram(auth, 'diagram-id', Permission.SnapshotCreate)).resolves.toMatchObject({
      id: 'diagram-id',
    });
  });
});
