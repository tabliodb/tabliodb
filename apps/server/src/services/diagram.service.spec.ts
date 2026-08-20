import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { createStarterDiagramModel, encodeDiagramModelAsYjsUpdate } from '@tabliodb/schema-core';
import { Permission, ProjectRole } from '@tabliodb/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../database.js';
import { DiagramService } from './diagram.service.js';

const auth: AuthContext = {
  user: {
    avatarUrl: null,
    cursorColor: '#58cc02',
    email: 'editor@tabliodb.local',
    id: 'user-id',
    name: 'Editor User',
    passwordChangeRequired: false,
  },
};

const authWithReadApiKey: AuthContext = {
  ...auth,
  apiKey: {
    id: 'api-key-id',
    permissions: [Permission.DiagramRead],
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
  organizationId: 'organization-id',
  projectId: 'project-id',
  reviewSettings: { disabledRuleKeys: [] },
  slug: null,
  status: 'draft',
  updatedAt: new Date('2026-07-29T11:00:00.000Z'),
};

describe(DiagramService.name, () => {
  const auditLogRepository = {
    create: vi.fn(),
  };
  const collaborationRepository = {
    loadDocument: vi.fn(),
  };
  const diagramRepository = {
    create: vi.fn(),
    getById: vi.fn(),
    getEffectiveAccess: vi.fn(),
    getByOrganization: vi.fn(),
    getByProject: vi.fn(),
    replaceDocumentModel: vi.fn(),
    update: vi.fn(),
  };
  const organizationRepository = {
    getByIdForUser: vi.fn(),
    getRole: vi.fn(),
  };
  const projectRepository = {
    create: vi.fn(),
    getActiveBySlugInOrganization: vi.fn(),
    getByIdForUser: vi.fn(),
    getBySlugForUser: vi.fn(),
    getDiagramRole: vi.fn(),
    upsertMember: vi.fn(),
  };
  const reviewSignalRepository = {
    getSettingsForDiagram: vi.fn(),
    syncGeneratedSignals: vi.fn(),
  };
  const userRepository = {
    getByEmail: vi.fn(),
  };

  let service: DiagramService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new DiagramService(
      auditLogRepository as never,
      collaborationRepository as never,
      diagramRepository as never,
      organizationRepository as never,
      projectRepository as never,
      reviewSignalRepository as never,
      userRepository as never,
    );
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
        organizationId: 'organization-id',
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
        organizationId: 'organization-id',
        projectId: 'project-id',
      }),
    ).resolves.toMatchObject({
      id: 'diagram-id',
      name: 'Main schema',
      projectId: 'project-id',
    });
  });

  it('creates a root workspace diagram without creating a folder', async () => {
    organizationRepository.getRole.mockResolvedValue({ role: 'member' });
    diagramRepository.create.mockResolvedValue({
      ...diagram,
      projectId: null,
    });

    await expect(
      service.createInOrganization(auth, 'organization-id', {
        dialect: 'postgresql',
        name: 'Inventory ERD',
      }),
    ).resolves.toMatchObject({
      name: 'Main schema',
      organizationId: 'organization-id',
      projectId: null,
    });

    expect(projectRepository.create).not.toHaveBeenCalled();
    expect(diagramRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Inventory ERD',
        organizationId: 'organization-id',
        projectId: null,
      }),
    );
  });

  it('blocks workspace guests from creating root diagrams', async () => {
    organizationRepository.getRole.mockResolvedValue({ role: 'guest' });

    await expect(
      service.createInOrganization(auth, 'organization-id', {
        dialect: 'postgresql',
        name: 'Orders ERD',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(projectRepository.create).not.toHaveBeenCalled();
    expect(diagramRepository.create).not.toHaveBeenCalled();
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

  it('blocks API keys without the requested diagram scope even when the owning user can edit', async () => {
    projectRepository.getDiagramRole.mockResolvedValue({ role: ProjectRole.Editor });

    await expect(
      service.requireDiagram(authWithReadApiKey, 'diagram-id', Permission.SnapshotCreate),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // API-key scope is checked before loading the diagram body, so low-scope automation cannot use user role as a bypass.
    expect(diagramRepository.getById).not.toHaveBeenCalled();
  });

  it('allows API keys when both token scope and project role satisfy the requested diagram permission', async () => {
    projectRepository.getDiagramRole.mockResolvedValue({ role: ProjectRole.Viewer });
    diagramRepository.getById.mockResolvedValue(diagram);

    await expect(
      service.requireDiagram(authWithReadApiKey, 'diagram-id', Permission.DiagramRead),
    ).resolves.toMatchObject({
      id: 'diagram-id',
    });
  });

  it('returns effective diagram access after checking manage permission', async () => {
    projectRepository.getDiagramRole.mockResolvedValue({ role: ProjectRole.Owner });
    diagramRepository.getById.mockResolvedValue(diagram);
    diagramRepository.getEffectiveAccess.mockResolvedValue({
      items: [
        {
          accessType: 'mixed',
          avatarUrl: null,
          cursorColor: '#58cc02',
          directRole: ProjectRole.Viewer,
          email: 'member@tabliodb.local',
          name: 'Member User',
          role: ProjectRole.Editor,
          sources: [
            {
              inherited: false,
              role: ProjectRole.Viewer,
              sourceId: 'diagram-id',
              sourceLabel: 'Direct access',
              sourceName: 'Main schema',
              sourceType: 'direct',
            },
            {
              inherited: true,
              role: ProjectRole.Editor,
              sourceId: 'project-id',
              sourceLabel: 'Folder: Library System',
              sourceName: 'Library System',
              sourceType: 'folder',
            },
          ],
          userId: 'member-id',
        },
      ],
      nextCursor: null,
      totalCount: 1,
    });

    await expect(service.getEffectiveAccess(auth, 'diagram-id', { limit: 10 })).resolves.toMatchObject({
      items: [
        {
          accessType: 'mixed',
          directRole: ProjectRole.Viewer,
          role: ProjectRole.Editor,
          sources: [{ sourceLabel: 'Direct access' }, { sourceLabel: 'Folder: Library System' }],
        },
      ],
      totalCount: 1,
    });

    expect(diagramRepository.getEffectiveAccess).toHaveBeenCalledWith('diagram-id', { cursor: undefined, limit: 10 });
  });

  it('rejects an empty diagram settings update', async () => {
    await expect(service.update(auth, 'diagram-id', {})).rejects.toBeInstanceOf(BadRequestException);

    // Empty updates are rejected before permission lookup so the API returns a precise client error.
    expect(projectRepository.getDiagramRole).not.toHaveBeenCalled();
    expect(diagramRepository.update).not.toHaveBeenCalled();
  });

  it('blocks a project viewer from updating diagram settings', async () => {
    projectRepository.getDiagramRole.mockResolvedValue({ role: ProjectRole.Viewer });

    await expect(
      service.update(auth, 'diagram-id', {
        name: 'Readonly rename',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Service-level permission protects SDK/API-key callers even if a controller decorator is bypassed in tests.
    expect(diagramRepository.update).not.toHaveBeenCalled();
  });

  it('allows a project editor to update diagram settings', async () => {
    projectRepository.getDiagramRole.mockResolvedValue({ role: ProjectRole.Editor });
    diagramRepository.getById.mockResolvedValue(diagram);
    diagramRepository.update.mockResolvedValue({
      ...diagram,
      dialect: 'mysql',
      name: 'Warehouse schema',
      updatedAt: new Date('2026-07-29T12:00:00.000Z'),
    });

    await expect(
      service.update(auth, 'diagram-id', {
        dialect: 'mysql',
        name: '  Warehouse schema  ',
      }),
    ).resolves.toMatchObject({
      dialect: 'mysql',
      id: 'diagram-id',
      name: 'Warehouse schema',
      updatedAt: '2026-07-29T12:00:00.000Z',
    });

    expect(diagramRepository.update).toHaveBeenCalledWith('diagram-id', {
      dialect: 'mysql',
      name: 'Warehouse schema',
    });
  });

  it('allows a project viewer to export a diagram as SQL', async () => {
    const model = createStarterDiagramModel('Library System', 'postgresql');
    projectRepository.getDiagramRole.mockResolvedValue({ role: ProjectRole.Viewer });
    diagramRepository.getById.mockResolvedValue(diagram);
    collaborationRepository.loadDocument.mockResolvedValue(encodeDiagramModelAsYjsUpdate(model));

    const response = await service.exportDiagram(auth, 'diagram-id', {
      format: 'sql',
    });

    expect(response).toMatchObject({
      filename: 'library-system.postgresql.sql',
      format: 'sql',
      mediaType: 'application/sql',
    });
    expect(response.content).toContain('CREATE TABLE');
  });

  it('allows a project viewer to export a diagram as Mermaid ERD', async () => {
    const model = createStarterDiagramModel('Library System', 'postgresql');

    projectRepository.getDiagramRole.mockResolvedValue({ role: ProjectRole.Viewer });
    diagramRepository.getById.mockResolvedValue(diagram);
    collaborationRepository.loadDocument.mockResolvedValue(encodeDiagramModelAsYjsUpdate(model));

    const response = await service.exportDiagram(auth, 'diagram-id', {
      format: 'mermaid',
    });

    expect(response).toMatchObject({
      filename: 'library-system.erd.mmd',
      format: 'mermaid',
      mediaType: 'text/vnd.mermaid',
    });
    expect(response.content).toContain('erDiagram');
    expect(response.content).toContain('USERS ||--o{ BORROWINGS');
  });

  it('blocks a project viewer from importing a diagram', async () => {
    projectRepository.getDiagramRole.mockResolvedValue({ role: ProjectRole.Viewer });

    await expect(
      service.importDiagram(auth, 'diagram-id', {
        content: '{"schemaVersion":1}',
        mode: 'replace',
        source: 'tabliodb_json',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(diagramRepository.replaceDocumentModel).not.toHaveBeenCalled();
    expect(reviewSignalRepository.syncGeneratedSignals).not.toHaveBeenCalled();
  });

  it('allows a project editor to import SQL into a diagram draft', async () => {
    projectRepository.getDiagramRole.mockResolvedValue({ role: ProjectRole.Editor });
    diagramRepository.getById.mockResolvedValue(diagram);
    diagramRepository.replaceDocumentModel.mockResolvedValue({
      ...diagram,
      name: 'Main schema',
      updatedAt: new Date('2026-07-29T12:30:00.000Z'),
    });

    const response = await service.importDiagram(auth, 'diagram-id', {
      content: 'CREATE TABLE authors (id uuid PRIMARY KEY, name varchar(120) NOT NULL);',
      dialect: 'postgresql',
      mode: 'replace',
      source: 'sql',
    });

    expect(diagramRepository.replaceDocumentModel).toHaveBeenCalledWith(
      'diagram-id',
      expect.objectContaining({
        dialect: 'postgresql',
        metadata: expect.objectContaining({ name: 'Main schema' }),
      }),
      'user-id',
    );
    expect(reviewSignalRepository.syncGeneratedSignals).toHaveBeenCalledWith('diagram-id', expect.any(Array));
    expect(Object.values(response.model.tables)).toContainEqual(expect.objectContaining({ name: 'authors' }));
  });
});
