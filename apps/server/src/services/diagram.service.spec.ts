import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createStarterDiagramModel, encodeDiagramModelAsYjsUpdate } from '@tabliodb/schema-core';
import { OrganizationRole, Permission, AccessRole } from '@tabliodb/shared';
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

const folder = {
  createdAt: new Date('2026-07-29T10:00:00.000Z'),
  description: null,
  id: 'folder-id',
  name: 'Library System',
  organizationId: 'organization-id',
  organizationName: 'Default Workspace',
  organizationSlug: 'default-workspace',
  folderRole: AccessRole.Editor,
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
  folderId: 'folder-id',
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
    getByFolder: vi.fn(),
    getDiagramOwnerCount: vi.fn(),
    getMember: vi.fn(),
    replaceDocumentModel: vi.fn(),
    removeMember: vi.fn(),
    transferOwnership: vi.fn(),
    update: vi.fn(),
    updateMember: vi.fn(),
    upsertMember: vi.fn(),
  };
  const organizationRepository = {
    addMemberIfAbsent: vi.fn(),
    getByIdForUser: vi.fn(),
    getMember: vi.fn(),
    getRole: vi.fn(),
  };
  const folderRepository = {
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
      folderRepository as never,
      reviewSignalRepository as never,
      userRepository as never,
    );
  });

  it('blocks a folder viewer from creating diagrams', async () => {
    folderRepository.getByIdForUser.mockResolvedValue({
      ...folder,
      folderRole: AccessRole.Viewer,
    });

    await expect(
      service.create(auth, {
        dialect: 'postgresql',
        name: 'Read only schema',
        organizationId: 'organization-id',
        folderId: 'folder-id',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Service-level permission keeps the write path protected even outside HTTP decorators.
    expect(diagramRepository.create).not.toHaveBeenCalled();
  });

  it('allows a folder editor to create diagrams', async () => {
    folderRepository.getByIdForUser.mockResolvedValue(folder);
    diagramRepository.create.mockResolvedValue(diagram);

    await expect(
      service.create(auth, {
        dialect: 'postgresql',
        name: 'Main schema',
        organizationId: 'organization-id',
        folderId: 'folder-id',
      }),
    ).resolves.toMatchObject({
      id: 'diagram-id',
      name: 'Main schema',
      folderId: 'folder-id',
    });
  });

  it('creates a root workspace diagram without creating a folder', async () => {
    organizationRepository.getRole.mockResolvedValue({ role: 'member' });
    diagramRepository.create.mockResolvedValue({
      ...diagram,
      folderId: null,
    });

    await expect(
      service.createInOrganization(auth, 'organization-id', {
        dialect: 'postgresql',
        name: 'Inventory ERD',
      }),
    ).resolves.toMatchObject({
      name: 'Main schema',
      organizationId: 'organization-id',
      folderId: null,
    });

    expect(folderRepository.create).not.toHaveBeenCalled();
    expect(diagramRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Inventory ERD',
        organizationId: 'organization-id',
        folderId: null,
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

    expect(folderRepository.create).not.toHaveBeenCalled();
    expect(diagramRepository.create).not.toHaveBeenCalled();
  });

  it('blocks a folder viewer from update-class diagram permissions', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Viewer });

    await expect(service.requireDiagram(auth, 'diagram-id', Permission.SnapshotCreate)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    // The diagram row is not loaded when role permissions already reject the requested write.
    expect(diagramRepository.getById).not.toHaveBeenCalled();
  });

  it('allows a folder editor to use update-class diagram permissions', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Editor });
    diagramRepository.getById.mockResolvedValue(diagram);

    await expect(service.requireDiagram(auth, 'diagram-id', Permission.SnapshotCreate)).resolves.toMatchObject({
      id: 'diagram-id',
    });
  });

  it('blocks API keys without the requested diagram scope even when the owning user can edit', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Editor });

    await expect(
      service.requireDiagram(authWithReadApiKey, 'diagram-id', Permission.SnapshotCreate),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // API-key scope is checked before loading the diagram body, so low-scope automation cannot use user role as a bypass.
    expect(diagramRepository.getById).not.toHaveBeenCalled();
  });

  it('allows API keys when both token scope and folder role satisfy the requested diagram permission', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Viewer });
    diagramRepository.getById.mockResolvedValue(diagram);

    await expect(
      service.requireDiagram(authWithReadApiKey, 'diagram-id', Permission.DiagramRead),
    ).resolves.toMatchObject({
      id: 'diagram-id',
    });
  });

  it('returns effective diagram access after checking manage permission', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Owner });
    diagramRepository.getById.mockResolvedValue(diagram);
    diagramRepository.getEffectiveAccess.mockResolvedValue({
      items: [
        {
          accessType: 'mixed',
          avatarUrl: null,
          cursorColor: '#58cc02',
          directRole: AccessRole.Viewer,
          email: 'member@tabliodb.local',
          name: 'Member User',
          role: AccessRole.Editor,
          sources: [
            {
              inherited: false,
              role: AccessRole.Viewer,
              sourceId: 'diagram-id',
              sourceLabel: 'Direct access',
              sourceName: 'Main schema',
              sourceType: 'direct',
            },
            {
              inherited: true,
              role: AccessRole.Editor,
              sourceId: 'folder-id',
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
          directRole: AccessRole.Viewer,
          role: AccessRole.Editor,
          sources: [{ sourceLabel: 'Direct access' }, { sourceLabel: 'Folder: Library System' }],
        },
      ],
      totalCount: 1,
    });

    expect(diagramRepository.getEffectiveAccess).toHaveBeenCalledWith('diagram-id', { cursor: undefined, limit: 10 });
  });

  it('prevents changing your own direct diagram access', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Owner });
    diagramRepository.getById.mockResolvedValue(diagram);

    await expect(
      service.updateMember(auth, 'diagram-id', 'user-id', {
        role: AccessRole.Viewer,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Self-management is rejected before member lookup so an owner cannot demote and re-promote themselves.
    expect(diagramRepository.getMember).not.toHaveBeenCalled();
    expect(diagramRepository.updateMember).not.toHaveBeenCalled();
  });

  it('prevents assigning diagram owner through the generic member update endpoint', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Owner });
    diagramRepository.getById.mockResolvedValue(diagram);

    await expect(
      service.updateMember(auth, 'diagram-id', 'target-user-id', {
        role: AccessRole.Owner,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Owner changes must go through transferOwnership so the audit trail and single-owner normalization stay consistent.
    expect(diagramRepository.getMember).not.toHaveBeenCalled();
    expect(diagramRepository.updateMember).not.toHaveBeenCalled();
  });

  it('prevents assigning diagram owner through the generic member create endpoint', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Owner });
    diagramRepository.getById.mockResolvedValue(diagram);

    await expect(
      service.addMember(auth, 'diagram-id', {
        email: 'target@tabliodb.local',
        role: AccessRole.Owner,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    // The email is not resolved when the role itself is invalid for this generic endpoint.
    expect(userRepository.getByEmail).not.toHaveBeenCalled();
    expect(diagramRepository.upsertMember).not.toHaveBeenCalled();
  });

  it('anchors an existing user as a workspace guest before adding direct diagram access', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Owner });
    diagramRepository.getById.mockResolvedValue(diagram);
    userRepository.getByEmail.mockResolvedValue({
      email: 'viewer@tabliodb.local',
      id: 'viewer-id',
      name: 'Viewer User',
    });
    organizationRepository.addMemberIfAbsent.mockResolvedValue({
      role: OrganizationRole.Guest,
      status: 'active',
      userId: 'viewer-id',
    });
    diagramRepository.getMember.mockResolvedValue(undefined);
    diagramRepository.upsertMember.mockResolvedValue({
      avatarUrl: null,
      createdAt: new Date('2026-07-29T11:45:00.000Z'),
      cursorColor: '#1cb0f6',
      email: 'viewer@tabliodb.local',
      name: 'Viewer User',
      role: AccessRole.Viewer,
      updatedAt: new Date('2026-07-29T11:45:00.000Z'),
      userId: 'viewer-id',
    });

    await expect(
      service.addMember(auth, 'diagram-id', {
        email: 'viewer@tabliodb.local',
        role: AccessRole.Viewer,
      }),
    ).resolves.toMatchObject({
      email: 'viewer@tabliodb.local',
      role: AccessRole.Viewer,
      userId: 'viewer-id',
    });

    expect(organizationRepository.addMemberIfAbsent).toHaveBeenCalledWith({
      createdById: 'user-id',
      organizationId: 'organization-id',
      role: OrganizationRole.Guest,
      userId: 'viewer-id',
    });
    expect(diagramRepository.upsertMember).toHaveBeenCalledWith('diagram-id', {
      createdById: 'user-id',
      role: AccessRole.Viewer,
      userId: 'viewer-id',
    });
  });

  it('rejects adding suspended workspace users to direct diagram access', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Owner });
    diagramRepository.getById.mockResolvedValue(diagram);
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
      service.addMember(auth, 'diagram-id', {
        email: 'suspended@tabliodb.local',
        role: AccessRole.Viewer,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Existing suspended/pending workspace rows are not reactivated by a direct diagram grant.
    expect(diagramRepository.upsertMember).not.toHaveBeenCalled();
  });

  it('prevents adding yourself through the generic direct diagram access endpoint', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Owner });
    diagramRepository.getById.mockResolvedValue(diagram);
    userRepository.getByEmail.mockResolvedValue({
      email: auth.user.email,
      id: auth.user.id,
      name: auth.user.name,
    });

    await expect(
      service.addMember(auth, 'diagram-id', {
        email: auth.user.email,
        role: AccessRole.Viewer,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Self role changes belong to explicit ownership/leave flows, not the generic add/upsert route.
    expect(organizationRepository.addMemberIfAbsent).not.toHaveBeenCalled();
    expect(diagramRepository.upsertMember).not.toHaveBeenCalled();
  });

  it('prevents transferring diagram ownership to yourself', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Owner });
    diagramRepository.getById.mockResolvedValue(diagram);

    await expect(
      service.transferOwnership(auth, 'diagram-id', {
        userId: 'user-id',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Self-transfer is rejected before workspace/member lookup because it does not change ownership meaningfully.
    expect(organizationRepository.getMember).not.toHaveBeenCalled();
    expect(diagramRepository.transferOwnership).not.toHaveBeenCalled();
  });

  it('prevents transferring diagram ownership to a user without diagram access', async () => {
    folderRepository.getDiagramRole
      .mockResolvedValueOnce({ role: AccessRole.Owner })
      .mockResolvedValueOnce(undefined);
    diagramRepository.getById.mockResolvedValue(diagram);
    organizationRepository.getMember.mockResolvedValue({
      status: 'active',
      userId: 'target-user-id',
    });

    await expect(
      service.transferOwnership(auth, 'diagram-id', {
        userId: 'target-user-id',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // A target must already be visible in effective access before they can receive ownership.
    expect(diagramRepository.transferOwnership).not.toHaveBeenCalled();
  });

  it('transfers diagram ownership to an existing collaborator', async () => {
    folderRepository.getDiagramRole
      .mockResolvedValueOnce({ role: AccessRole.Owner })
      .mockResolvedValueOnce({ role: AccessRole.Viewer });
    diagramRepository.getById.mockResolvedValue(diagram);
    organizationRepository.getMember.mockResolvedValue({
      status: 'active',
      userId: 'target-user-id',
    });
    diagramRepository.getMember.mockResolvedValue({
      avatarUrl: null,
      createdAt: new Date('2026-07-29T11:30:00.000Z'),
      cursorColor: '#1cb0f6',
      email: 'target@tabliodb.local',
      name: 'Target User',
      role: AccessRole.Viewer,
      updatedAt: new Date('2026-07-29T11:30:00.000Z'),
      userId: 'target-user-id',
    });
    diagramRepository.transferOwnership.mockResolvedValue({
      avatarUrl: null,
      createdAt: new Date('2026-07-29T11:30:00.000Z'),
      cursorColor: '#1cb0f6',
      email: 'target@tabliodb.local',
      name: 'Target User',
      role: AccessRole.Owner,
      updatedAt: new Date('2026-07-29T12:00:00.000Z'),
      userId: 'target-user-id',
    });

    await expect(
      service.transferOwnership(auth, 'diagram-id', {
        userId: 'target-user-id',
      }),
    ).resolves.toMatchObject({
      email: 'target@tabliodb.local',
      role: AccessRole.Owner,
      updatedAt: '2026-07-29T12:00:00.000Z',
    });

    expect(diagramRepository.transferOwnership).toHaveBeenCalledWith('diagram-id', {
      createdById: 'user-id',
      userId: 'target-user-id',
    });
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'diagram.member_role_updated',
        entityId: 'target-user-id',
        metadata: expect.objectContaining({
          role: {
            after: AccessRole.Owner,
            before: AccessRole.Viewer,
          },
          transfer: true,
        }),
      }),
    );
  });

  it('prevents removing your own direct diagram access', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Owner });
    diagramRepository.getById.mockResolvedValue(diagram);

    await expect(service.removeMember(auth, 'diagram-id', 'user-id')).rejects.toBeInstanceOf(BadRequestException);

    // Self-removal has to be an explicit transfer/leave flow, not the generic member delete endpoint.
    expect(diagramRepository.getMember).not.toHaveBeenCalled();
    expect(diagramRepository.removeMember).not.toHaveBeenCalled();
  });

  it('rejects an empty diagram settings update', async () => {
    await expect(service.update(auth, 'diagram-id', {})).rejects.toBeInstanceOf(BadRequestException);

    // Empty updates are rejected before permission lookup so the API returns a precise client error.
    expect(folderRepository.getDiagramRole).not.toHaveBeenCalled();
    expect(diagramRepository.update).not.toHaveBeenCalled();
  });

  it('blocks a folder viewer from updating diagram settings', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Viewer });

    await expect(
      service.update(auth, 'diagram-id', {
        name: 'Readonly rename',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Service-level permission protects SDK/API-key callers even if a controller decorator is bypassed in tests.
    expect(diagramRepository.update).not.toHaveBeenCalled();
  });

  it('allows a folder editor to update diagram settings', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Editor });
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

  it('allows a diagram editor to move a diagram into an accessible folder', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Editor });
    diagramRepository.getById.mockResolvedValue({
      ...diagram,
      folderId: null,
    });
    folderRepository.getByIdForUser.mockResolvedValue({
      ...folder,
      id: 'target-folder-id',
      slug: 'target-folder',
    });
    diagramRepository.update.mockResolvedValue({
      ...diagram,
      folderId: 'target-folder-id',
      updatedAt: new Date('2026-07-29T12:15:00.000Z'),
    });

    await expect(
      service.update(auth, 'diagram-id', {
        folderId: 'target-folder-id',
      }),
    ).resolves.toMatchObject({
      id: 'diagram-id',
      folderId: 'target-folder-id',
      updatedAt: '2026-07-29T12:15:00.000Z',
    });

    // Destination folder access is checked before the diagram row is moved.
    expect(folderRepository.getByIdForUser).toHaveBeenCalledWith('user-id', 'target-folder-id');
    expect(diagramRepository.update).toHaveBeenCalledWith('diagram-id', {
      folderId: 'target-folder-id',
    });
  });

  it('allows a diagram editor to move a diagram back to the workspace root when the workspace permits creation', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Editor });
    diagramRepository.getById.mockResolvedValue(diagram);
    organizationRepository.getRole.mockResolvedValue({ role: 'member' });
    diagramRepository.update.mockResolvedValue({
      ...diagram,
      folderId: null,
      updatedAt: new Date('2026-07-29T12:20:00.000Z'),
    });

    await expect(
      service.update(auth, 'diagram-id', {
        folderId: null,
      }),
    ).resolves.toMatchObject({
      id: 'diagram-id',
      folderId: null,
    });

    // Root moves use workspace-level diagram creation permission because there is no destination folder role.
    expect(organizationRepository.getRole).toHaveBeenCalledWith('user-id', 'organization-id');
    expect(diagramRepository.update).toHaveBeenCalledWith('diagram-id', {
      folderId: null,
    });
  });

  it('blocks moving a diagram into a folder from another workspace or without access', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Editor });
    diagramRepository.getById.mockResolvedValue(diagram);
    folderRepository.getByIdForUser.mockResolvedValue({
      ...folder,
      id: 'foreign-folder-id',
      organizationId: 'other-organization-id',
    });

    await expect(
      service.update(auth, 'diagram-id', {
        folderId: 'foreign-folder-id',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    // The row is not mutated unless the destination is visible and belongs to the same workspace.
    expect(diagramRepository.update).not.toHaveBeenCalled();
  });

  it('allows a folder viewer to export a diagram as SQL', async () => {
    const model = createStarterDiagramModel('Library System', 'postgresql');
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Viewer });
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

  it('allows a folder viewer to export a diagram as Mermaid ERD', async () => {
    const model = createStarterDiagramModel('Library System', 'postgresql');

    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Viewer });
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

  it('blocks a folder viewer from importing a diagram', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Viewer });

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

  it('allows a folder editor to import SQL into a diagram draft', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Editor });
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
