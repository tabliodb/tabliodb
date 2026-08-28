import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { generateDiagramMarkdown, generateDiagramMermaid } from '@tabliodb/docs';
import { generateDiagramSvg } from '@tabliodb/render';
import {
  createEmptyDiagramModel,
  decodeDiagramModelFromYjsUpdate,
  defaultDiagramReviewSettings,
  getDiagramModelIntegrityWarnings,
  getDiagramReviewSignals,
  normalizeDiagramModel,
  repairDiagramModel,
  serializeDiagramModel,
  stringifyDiagramModel,
  type DatabaseDialect,
  type DiagramModel,
} from '@tabliodb/schema-core';
import {
  OrganizationRole,
  type OrganizationRoleValue,
  Permission,
  AccessRole,
  isGranted,
  permissionsForOrganizationRole,
  permissionsForAccessRole,
} from '@tabliodb/shared';
import { generateCreateSchemaSqlWithWarnings, parseCreateSchemaSql } from '@tabliodb/sql';
import { AuditAction } from '../constants.js';
import { AuthContext } from '../database.js';
import {
  DiagramCreateDto,
  DiagramEffectiveAccessDto,
  DiagramEffectiveAccessListResponseDto,
  DiagramEffectiveAccessSourceDto,
  DiagramExportQueryDto,
  DiagramExportResponseDto,
  DiagramImportDto,
  DiagramImportResponseDto,
  DiagramListQueryDto,
  DiagramMemberCreateDto,
  DiagramMemberDto,
  DiagramMemberListQueryDto,
  DiagramMemberListResponseDto,
  DiagramMemberRemoveResponseDto,
  DiagramMemberUpdateDto,
  DiagramOwnershipTransferDto,
  DiagramResponseDto,
  DiagramUpdateDto,
  WorkspaceDiagramCreateDto,
} from '../dtos/diagram.dto.js';
import { AuditLogRepository } from '../repositories/audit-log.repository.js';
import { CollaborationRepository } from '../repositories/collaboration.repository.js';
import { DiagramRepository } from '../repositories/diagram.repository.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { FolderRepository } from '../repositories/folder.repository.js';
import { ReviewSignalRepository } from '../repositories/review-signal.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { JsonValue } from '../schema/index.js';
import { toIsoDateTime } from '../utils/date-time.js';
import { clampPaginationLimit } from '../utils/pagination.js';

@Injectable()
export class DiagramService {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly collaborationRepository: CollaborationRepository,
    private readonly diagramRepository: DiagramRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly folderRepository: FolderRepository,
    private readonly reviewSignalRepository: ReviewSignalRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async create(auth: AuthContext, dto: DiagramCreateDto): Promise<DiagramResponseDto> {
    const folderId = dto.folderId ?? null;

    if (folderId) {
      const folder = await this.folderRepository.getByIdForUser(auth.user.id, folderId);
      if (!folder || folder.organizationId !== dto.organizationId) {
        throw new NotFoundException('Folder not found');
      }

      this.assertFolderPermission(auth, folder.folderRole, Permission.DiagramCreate);
    } else {
      await this.assertOrganizationPermission(auth, dto.organizationId, Permission.DiagramCreate);
    }

    const diagram = await this.diagramRepository.create({
      organizationId: dto.organizationId,
      folderId,
      name: dto.name,
      dialect: dto.dialect,
      reviewSettings: defaultDiagramReviewSettings,
      createdById: auth.user.id,
    });

    return this.serializeDiagram({ ...diagram, role: AccessRole.Owner });
  }

  async createInOrganization(
    auth: AuthContext,
    organizationId: string,
    dto: WorkspaceDiagramCreateDto,
  ): Promise<DiagramResponseDto> {
    // Workspace-level creation is a real root diagram now; folders can be assigned later as optional organization.
    return this.create(auth, {
      dialect: dto.dialect,
      name: dto.name,
      organizationId,
      folderId: null,
    });
  }

  async getByOrganization(auth: AuthContext, organizationId: string, query: DiagramListQueryDto) {
    await this.assertOrganizationPermission(auth, organizationId, Permission.OrganizationRead);

    const diagrams = await this.diagramRepository.getByOrganization(organizationId, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
      userId: auth.user.id,
    });

    return {
      ...diagrams,
      items: diagrams.items.map((diagram) => ({
        ...diagram,
        // Response list mengikuti bentuk JSON yang diterima SDK: timestamp ISO string, bukan Date object server-side.
        createdAt: toIsoDateTime(diagram.createdAt),
        updatedAt: toIsoDateTime(diagram.updatedAt),
      })),
    };
  }

  async getMembers(
    auth: AuthContext,
    diagramId: string,
    query: DiagramMemberListQueryDto,
  ): Promise<DiagramMemberListResponseDto> {
    await this.requireDiagram(auth, diagramId, Permission.DiagramMemberManage);

    const members = await this.diagramRepository.getMembers(diagramId, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
    });

    return {
      ...members,
      items: members.items.map((member) => this.serializeMember(member)),
    };
  }

  async getEffectiveAccess(
    auth: AuthContext,
    diagramId: string,
    query: DiagramMemberListQueryDto,
  ): Promise<DiagramEffectiveAccessListResponseDto> {
    await this.requireDiagram(auth, diagramId, Permission.DiagramMemberManage);

    const access = await this.diagramRepository.getEffectiveAccess(diagramId, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
    });

    return {
      ...access,
      items: access.items.map((member) => this.serializeEffectiveAccess(member)),
    };
  }

  async addMember(auth: AuthContext, diagramId: string, dto: DiagramMemberCreateDto): Promise<DiagramMemberDto> {
    const diagram = await this.requireDiagram(auth, diagramId, Permission.DiagramMemberManage);
    this.assertAssignableDiagramMemberRole(dto.role ?? AccessRole.Viewer);
    const user = await this.userRepository.getByEmail(dto.email.trim().toLowerCase());

    if (!user) {
      throw new NotFoundException('User not found. Create an invitation for new users first.');
    }

    if (user.id === auth.user.id) {
      throw new BadRequestException('You already have access to this diagram');
    }

    // Direct diagram access still anchors the invited user inside the workspace as a guest tenant member.
    const workspaceMember = await this.organizationRepository.addMemberIfAbsent({
      createdById: auth.user.id,
      organizationId: diagram.organizationId,
      role: OrganizationRole.Guest,
      userId: user.id,
    });

    if (!workspaceMember) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspaceMember.status !== 'active') {
      throw new BadRequestException('User is not an active workspace member');
    }

    const existingMember = await this.diagramRepository.getMember(diagramId, user.id);
    const member = await this.diagramRepository.upsertMember(diagramId, {
      createdById: auth.user.id,
      role: dto.role ?? AccessRole.Viewer,
      userId: user.id,
    });

    if (!member) {
      throw new NotFoundException('Diagram member could not be loaded');
    }

    if (!existingMember) {
      await this.recordDiagramMemberAudit(auth, {
        action: AuditAction.DiagramMemberAdded,
        diagram,
        entityId: user.id,
        metadata: {
          email: user.email,
          name: user.name,
          role: member.role,
        },
      });
    } else if (existingMember.role !== member.role) {
      await this.recordDiagramMemberAudit(auth, {
        action: AuditAction.DiagramMemberRoleUpdated,
        diagram,
        entityId: user.id,
        metadata: {
          email: user.email,
          name: user.name,
          role: {
            after: member.role,
            before: existingMember.role,
          },
        },
      });
    }

    return this.serializeMember(member);
  }

  async updateMember(
    auth: AuthContext,
    diagramId: string,
    userId: string,
    dto: DiagramMemberUpdateDto,
  ): Promise<DiagramMemberDto> {
    const diagram = await this.requireDiagram(auth, diagramId, Permission.DiagramMemberManage);
    this.assertNotSelfMemberMutation(auth, userId, 'change your own diagram access');
    this.assertAssignableDiagramMemberRole(dto.role);
    const currentMember = await this.assertCanChangeOwnerRole(diagramId, userId, dto.role);

    const member = await this.diagramRepository.updateMember(diagramId, userId, dto.role);
    if (!member) {
      throw new NotFoundException('Diagram member not found');
    }

    if (currentMember.role !== member.role) {
      await this.recordDiagramMemberAudit(auth, {
        action: AuditAction.DiagramMemberRoleUpdated,
        diagram,
        entityId: userId,
        metadata: {
          email: member.email,
          name: member.name,
          role: {
            after: member.role,
            before: currentMember.role,
          },
        },
      });
    }

    return this.serializeMember(member);
  }

  async transferOwnership(
    auth: AuthContext,
    diagramId: string,
    dto: DiagramOwnershipTransferDto,
  ): Promise<DiagramMemberDto> {
    const diagram = await this.requireDiagram(auth, diagramId, Permission.DiagramMemberManage);

    if (auth.user.id === dto.userId) {
      throw new BadRequestException('Choose another collaborator to receive ownership');
    }

    const workspaceMember = await this.organizationRepository.getMember(diagram.organizationId, dto.userId);
    if (!workspaceMember || workspaceMember.status !== 'active') {
      throw new BadRequestException('New owner must be an active workspace member');
    }

    const effectiveRole = await this.folderRepository.getDiagramRole(dto.userId, diagramId);
    if (!effectiveRole) {
      throw new BadRequestException('New owner must already have diagram access');
    }

    const currentMember = await this.diagramRepository.getMember(diagramId, dto.userId);
    if (currentMember?.role === AccessRole.Owner) {
      throw new BadRequestException('User already owns this diagram');
    }

    const member = await this.diagramRepository.transferOwnership(diagramId, {
      createdById: auth.user.id,
      userId: dto.userId,
    });

    if (!member) {
      throw new NotFoundException('Diagram member not found');
    }

    await this.recordDiagramMemberAudit(auth, {
      action: AuditAction.DiagramMemberRoleUpdated,
      diagram,
      entityId: dto.userId,
      metadata: {
        email: member.email,
        name: member.name,
        role: {
          after: member.role,
          before: currentMember?.role ?? null,
        },
        // Ownership transfer is separated from generic role editing so audits can explain this sensitive permission change.
        transfer: true,
      },
    });

    return this.serializeMember(member);
  }

  async removeMember(auth: AuthContext, diagramId: string, userId: string): Promise<DiagramMemberRemoveResponseDto> {
    const diagram = await this.requireDiagram(auth, diagramId, Permission.DiagramMemberManage);
    this.assertNotSelfMemberMutation(auth, userId, 'remove your own diagram access');
    const currentMember = await this.diagramRepository.getMember(diagramId, userId);
    if (!currentMember) {
      throw new NotFoundException('Diagram member not found');
    }

    if (
      currentMember.role === AccessRole.Owner &&
      (await this.diagramRepository.getDiagramOwnerCount(diagramId)) <= 1
    ) {
      throw new BadRequestException('Diagram must keep at least one owner');
    }

    await this.diagramRepository.removeMember(diagramId, userId);

    await this.recordDiagramMemberAudit(auth, {
      action: AuditAction.DiagramMemberRemoved,
      diagram,
      entityId: userId,
      metadata: {
        email: currentMember.email,
        name: currentMember.name,
        role: currentMember.role,
      },
    });

    return { successful: true };
  }

  async getByFolder(auth: AuthContext, folderId: string, query: DiagramListQueryDto) {
    const folder = await this.folderRepository.getByIdForUser(auth.user.id, folderId);
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    this.assertFolderPermission(auth, folder.folderRole, Permission.DiagramRead);

    const diagrams = await this.diagramRepository.getByFolder(folderId, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
    });

    return {
      ...diagrams,
      items: diagrams.items.map((diagram) => ({
        ...diagram,
        // The folder endpoint is folder-scoped, so its effective role matches the folder role already authorized above.
        role: folder.folderRole,
        // Response list mengikuti bentuk JSON yang diterima SDK: timestamp ISO string, bukan Date object server-side.
        createdAt: toIsoDateTime(diagram.createdAt),
        updatedAt: toIsoDateTime(diagram.updatedAt),
      })),
    };
  }

  async requireDiagram(auth: AuthContext, diagramId: string, permission: Permission = Permission.DiagramRead) {
    const role = await this.folderRepository.getDiagramRole(auth.user.id, diagramId);
    if (!role) {
      throw new NotFoundException('Diagram not found');
    }

    this.assertFolderPermission(auth, role.role, permission);

    const diagram = await this.diagramRepository.getById(diagramId);
    if (!diagram) {
      throw new NotFoundException('Diagram not found');
    }

    return { ...diagram, role: role.role };
  }

  async getCurrentModel(
    auth: AuthContext,
    diagramId: string,
    permission: Permission = Permission.DiagramRead,
  ): Promise<DiagramModel> {
    const diagram = await this.requireDiagram(auth, diagramId, permission);

    return this.loadCurrentModel(diagram);
  }

  async update(auth: AuthContext, diagramId: string, dto: DiagramUpdateDto): Promise<DiagramResponseDto> {
    if (dto.name === undefined && dto.dialect === undefined && dto.folderId === undefined) {
      throw new BadRequestException('At least one diagram field is required');
    }

    const nextName = dto.name?.trim();
    if (dto.name !== undefined && !nextName) {
      throw new BadRequestException('Diagram name is required');
    }

    // requireDiagram centralizes folder-role lookup, archived filtering, and permission enforcement for every diagram write.
    const currentDiagram = await this.requireDiagram(auth, diagramId, Permission.DiagramUpdate);
    const nextFolderId = dto.folderId ?? null;

    if (dto.folderId !== undefined && nextFolderId !== currentDiagram.folderId) {
      // Moving into a location must be authorized against the destination, not only the diagram the user can edit today.
      await this.assertDiagramMoveTarget(auth, currentDiagram.organizationId, nextFolderId);
    }

    const updatePayload: { dialect?: DatabaseDialect; name?: string; folderId?: string | null } = {};

    if (dto.dialect !== undefined) {
      updatePayload.dialect = dto.dialect;
    }

    if (dto.name !== undefined) {
      // Keep the repository payload minimal so partial update tests mirror the exact client intent.
      updatePayload.name = nextName;
    }

    if (dto.folderId !== undefined) {
      // Undefined means "do not move"; null means "move to workspace root".
      updatePayload.folderId = nextFolderId;
    }

    const diagram = await this.diagramRepository.update(diagramId, updatePayload);

    if (!diagram) {
      throw new NotFoundException('Diagram not found');
    }

    return this.serializeDiagram({ ...diagram, role: currentDiagram.role });
  }

  async exportDiagram(
    auth: AuthContext,
    diagramId: string,
    query: DiagramExportQueryDto,
  ): Promise<DiagramExportResponseDto> {
    const diagram = await this.requireDiagram(auth, diagramId, Permission.DiagramRead);
    const model = await this.loadCurrentModel(diagram);
    const format = query.format ?? 'tabliodb_json';
    const filenameBase = toFilenameBase(model.metadata.name || diagram.name);
    const integrityWarnings = getDiagramModelIntegrityWarnings(model).map(normalizeTransferWarning);

    if (format === 'sql') {
      const dialect = query.dialect ?? model.dialect;
      const result = generateCreateSchemaSqlWithWarnings(model, {
        dialect,
        includeComments: query.includeComments,
      });

      return {
        content: result.sql,
        filename: `${filenameBase}.${dialect}.sql`,
        format,
        mediaType: 'application/sql',
        warnings: [...integrityWarnings, ...result.warnings.map(normalizeTransferWarning)],
      };
    }

    if (format === 'markdown') {
      return {
        content: generateDiagramMarkdown(model),
        filename: `${filenameBase}.md`,
        format,
        mediaType: 'text/markdown',
        warnings: integrityWarnings,
      };
    }

    if (format === 'mermaid') {
      return {
        content: generateDiagramMermaid(model),
        filename: `${filenameBase}.erd.mmd`,
        format,
        mediaType: 'text/vnd.mermaid',
        warnings: integrityWarnings,
      };
    }

    if (format === 'svg') {
      return {
        content: generateDiagramSvg(model),
        filename: `${filenameBase}.svg`,
        format,
        mediaType: 'image/svg+xml',
        warnings: integrityWarnings,
      };
    }

    return {
      content: stringifyDiagramModel(model),
      filename: `${filenameBase}.tabliodb.json`,
      format,
      mediaType: 'application/json',
      warnings: integrityWarnings,
    };
  }

  async importDiagram(auth: AuthContext, diagramId: string, dto: DiagramImportDto): Promise<DiagramImportResponseDto> {
    const diagram = await this.requireDiagram(auth, diagramId, Permission.DiagramUpdate);
    const imported = this.parseImportPayload(diagram, dto);
    const model = this.normalizeImportedModel(imported.model, diagram);
    const diagramRow = await this.diagramRepository.replaceDocumentModel(diagramId, model, auth.user.id);

    if (!diagramRow) {
      throw new NotFoundException('Diagram not found');
    }

    const reviewSettings = await this.reviewSignalRepository.getSettingsForDiagram(diagramId);

    // Import mengganti live document langsung, jadi review cache ikut disync dengan effective lint settings diagram saat ini.
    await this.reviewSignalRepository.syncGeneratedSignals(
      diagramId,
      getDiagramReviewSignals(model, reviewSettings?.effective ?? defaultDiagramReviewSettings),
    );

    return {
      diagram: this.serializeDiagram({ ...diagramRow, role: diagram.role }),
      model,
      warnings: [...imported.warnings, ...getDiagramModelIntegrityWarnings(model).map(normalizeTransferWarning)],
    };
  }

  private assertFolderPermission(auth: AuthContext, role: AccessRole, permission: Permission): void {
    this.assertApiKeyScope(auth, permission);

    if (
      !isGranted({
        current: permissionsForAccessRole(role),
        requested: [permission],
      })
    ) {
      throw new ForbiddenException(`${permission} permission is required`);
    }
  }

  private assertApiKeyScope(auth: AuthContext, permission: Permission): void {
    if (auth.apiKey && !isGranted({ current: auth.apiKey.permissions, requested: [permission] })) {
      // Service-level diagram checks cover internal callers and routes where the URL does not expose the final folder id.
      throw new ForbiddenException(`${permission} API key scope is required`);
    }
  }

  private async assertOrganizationPermission(
    auth: AuthContext,
    organizationId: string,
    permission: Permission,
  ): Promise<void> {
    this.assertApiKeyScope(auth, permission);
    const membership = await this.organizationRepository.getRole(auth.user.id, organizationId);

    if (!membership) {
      throw new NotFoundException('Workspace not found');
    }

    if (
      !isGranted({
        current: permissionsForOrganizationRole(membership.role as OrganizationRoleValue),
        requested: [permission],
      })
    ) {
      throw new ForbiddenException(`${permission} permission is required`);
    }
  }

  private async assertDiagramMoveTarget(
    auth: AuthContext,
    organizationId: string,
    folderId: string | null,
  ): Promise<void> {
    if (!folderId) {
      // A root diagram belongs directly to the workspace, so the workspace role is the destination permission source.
      await this.assertOrganizationPermission(auth, organizationId, Permission.DiagramCreate);
      return;
    }

    const folder = await this.folderRepository.getByIdForUser(auth.user.id, folderId);
    if (!folder || folder.organizationId !== organizationId) {
      throw new NotFoundException('Folder not found');
    }

    // Moving into a folder consumes the same capability as creating a diagram there.
    this.assertFolderPermission(auth, folder.folderRole, Permission.DiagramCreate);
  }

  private serializeDiagram(
    diagram: NonNullable<Awaited<ReturnType<DiagramRepository['getById']>>> & { role: AccessRole },
  ): DiagramResponseDto {
    return {
      id: diagram.id,
      organizationId: diagram.organizationId,
      folderId: diagram.folderId,
      name: diagram.name,
      // Kysely membaca kolom dialect sebagai text karena database menyimpannya generik, sedangkan kontrak API mengekspos union dialect canonical.
      dialect: diagram.dialect as DatabaseDialect,
      status: diagram.status,
      role: diagram.role,
      createdAt: toIsoDateTime(diagram.createdAt),
      updatedAt: toIsoDateTime(diagram.updatedAt),
    };
  }

  private serializeMember(member: {
    avatarUrl?: string | null;
    cursorColor: string;
    createdAt: Date | string;
    email: string;
    name: string;
    role: AccessRole;
    updatedAt: Date | string;
    userId: string;
  }): DiagramMemberDto {
    return {
      ...member,
      avatarUrl: member.avatarUrl ?? null,
      // Member timestamps are serialized here so every generated SDK response receives stable ISO strings.
      createdAt: toIsoDateTime(member.createdAt),
      updatedAt: toIsoDateTime(member.updatedAt),
    };
  }

  private serializeEffectiveAccess(member: {
    accessType: DiagramEffectiveAccessDto['accessType'];
    avatarUrl?: string | null;
    cursorColor: string;
    directRole: AccessRole | null;
    email: string;
    name: string;
    role: AccessRole;
    sources: DiagramEffectiveAccessSourceDto[];
    userId: string;
  }): DiagramEffectiveAccessDto {
    return {
      ...member,
      avatarUrl: member.avatarUrl ?? null,
    };
  }

  private async assertCanChangeOwnerRole(diagramId: string, userId: string, nextRole: AccessRole) {
    const currentMember = await this.diagramRepository.getMember(diagramId, userId);
    if (!currentMember) {
      throw new NotFoundException('Diagram member not found');
    }

    if (currentMember.role === AccessRole.Owner && nextRole !== AccessRole.Owner) {
      const ownerCount = await this.diagramRepository.getDiagramOwnerCount(diagramId);

      if (ownerCount <= 1) {
        throw new BadRequestException('Diagram must keep at least one owner');
      }
    }

    return currentMember;
  }

  private assertAssignableDiagramMemberRole(role: AccessRole): void {
    if (role !== AccessRole.Owner) {
      return;
    }

    // Owner is intentionally outside the generic role picker/API path; transferOwnership is the auditable owner handoff.
    throw new BadRequestException('Use transfer ownership to assign a diagram owner');
  }

  private assertNotSelfMemberMutation(auth: AuthContext, userId: string, action: string): void {
    if (auth.user.id !== userId) {
      return;
    }

    // Self role changes create a lockout/privilege loop; ownership transfer should be handled by another owner/admin flow.
    throw new BadRequestException(`Use another owner account to ${action}`);
  }

  private recordDiagramMemberAudit(
    auth: AuthContext,
    options: {
      action: AuditAction;
      diagram: NonNullable<Awaited<ReturnType<DiagramRepository['getById']>>>;
      entityId: string;
      metadata: Record<string, JsonValue>;
    },
  ) {
    return this.auditLogRepository.create({
      action: options.action,
      actorId: auth.user.id,
      diagramId: options.diagram.id,
      entityId: options.entityId,
      entityType: 'diagram_member',
      ipAddress: auth.request?.ipAddress ?? null,
      metadata: options.metadata,
      organizationId: options.diagram.organizationId,
      folderId: options.diagram.folderId,
      requestId: auth.request?.requestId ?? null,
      userAgent: auth.request?.userAgent ?? null,
    });
  }

  private async loadCurrentModel(
    diagram: NonNullable<Awaited<ReturnType<DiagramRepository['getById']>>>,
  ): Promise<DiagramModel> {
    const fallback = createEmptyDiagramModel(diagram.name, diagram.dialect as DatabaseDialect);
    const update = await this.collaborationRepository.loadDocument(diagram.id);

    if (!update) {
      return fallback;
    }

    return serializeDiagramModel(normalizeDiagramModel(decodeDiagramModelFromYjsUpdate(update, fallback)));
  }

  private parseImportPayload(
    diagram: NonNullable<Awaited<ReturnType<DiagramRepository['getById']>>>,
    dto: DiagramImportDto,
  ): { model: DiagramModel; warnings: DiagramExportResponseDto['warnings'] } {
    if (dto.mode !== 'replace') {
      throw new BadRequestException('Only replace import mode is supported');
    }

    if (dto.source === 'sql') {
      const result = parseCreateSchemaSql(dto.content, {
        dialect: dto.dialect ?? (diagram.dialect as DatabaseDialect),
        diagramName: diagram.name,
      });

      return {
        model: result.model,
        warnings: result.warnings.map(normalizeTransferWarning),
      };
    }

    try {
      const model = repairDiagramModel(JSON.parse(dto.content));

      return {
        model,
        // JSON import may be structurally valid but still risky; surface warnings instead of letting the editor discover them later.
        warnings: getDiagramModelIntegrityWarnings(model).map(normalizeTransferWarning),
      };
    } catch {
      throw new BadRequestException('Import content is not a valid Tabliodb JSON diagram');
    }
  }

  private normalizeImportedModel(
    model: DiagramModel,
    diagram: NonNullable<Awaited<ReturnType<DiagramRepository['getById']>>>,
  ): DiagramModel {
    return serializeDiagramModel(
      normalizeDiagramModel({
        ...model,
        metadata: {
          ...model.metadata,
          name: model.metadata.name.trim() || diagram.name,
          updatedAt: new Date().toISOString(),
        },
      }),
    );
  }
}

function normalizeTransferWarning(warning: {
  code: string;
  message: string;
  statement?: string;
  target?: { id: string; type: string };
}): DiagramExportResponseDto['warnings'][number] {
  return {
    code: warning.code,
    message: warning.message,
    statement: warning.statement,
    target: warning.target,
  };
}

function toFilenameBase(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/^-|-$/g, '') || 'diagram'
  );
}
