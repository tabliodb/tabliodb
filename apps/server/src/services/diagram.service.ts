import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { generateDiagramMarkdown } from '@tabliodb/docs';
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
import { OrganizationRole, Permission, ProjectRole, isGranted, permissionsForProjectRole } from '@tabliodb/shared';
import { generateCreateSchemaSqlWithWarnings, parseCreateSchemaSql } from '@tabliodb/sql';
import { AuditAction } from '../constants.js';
import { AuthContext } from '../database.js';
import {
  DiagramCreateDto,
  DiagramExportQueryDto,
  DiagramExportResponseDto,
  DiagramImportDto,
  DiagramImportResponseDto,
  DiagramListQueryDto,
  DiagramResponseDto,
  DiagramUpdateDto,
  WorkspaceDiagramCreateDto,
} from '../dtos/diagram.dto.js';
import { AuditLogRepository } from '../repositories/audit-log.repository.js';
import { CollaborationRepository } from '../repositories/collaboration.repository.js';
import { DiagramRepository } from '../repositories/diagram.repository.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { ReviewSignalRepository } from '../repositories/review-signal.repository.js';
import type { JsonValue } from '../schema/index.js';
import { toIsoDateTime } from '../utils/date-time.js';
import { clampPaginationLimit } from '../utils/pagination.js';

const defaultWorkspaceDiagramFolder = {
  description: 'Default folder for diagrams created directly from the workspace.',
  name: 'General',
  slug: 'general',
} as const;

@Injectable()
export class DiagramService {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly collaborationRepository: CollaborationRepository,
    private readonly diagramRepository: DiagramRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly reviewSignalRepository: ReviewSignalRepository,
  ) {}

  async create(auth: AuthContext, dto: DiagramCreateDto): Promise<DiagramResponseDto> {
    const project = await this.projectRepository.getByIdForUser(auth.user.id, dto.projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    this.assertProjectPermission(auth, project.projectRole, Permission.DiagramCreate);

    const diagram = await this.diagramRepository.create({
      projectId: dto.projectId,
      name: dto.name,
      dialect: dto.dialect,
      reviewSettings: defaultDiagramReviewSettings,
      createdById: auth.user.id,
    });

    return this.serializeDiagram(diagram);
  }

  async createInOrganization(
    auth: AuthContext,
    organizationId: string,
    dto: WorkspaceDiagramCreateDto,
  ): Promise<DiagramResponseDto> {
    this.assertApiKeyScope(auth, Permission.ProjectCreate);

    const project = await this.getOrCreateDefaultDiagramFolder(auth, organizationId);

    // Workspace-level creation keeps the UI diagram-first while reusing the project-level write path for final role checks.
    return this.create(auth, {
      dialect: dto.dialect,
      name: dto.name,
      projectId: project.id,
    });
  }

  async getByProject(auth: AuthContext, projectId: string, query: DiagramListQueryDto) {
    const project = await this.projectRepository.getByIdForUser(auth.user.id, projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    this.assertProjectPermission(auth, project.projectRole, Permission.DiagramRead);

    const diagrams = await this.diagramRepository.getByProject(projectId, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
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

  async requireDiagram(auth: AuthContext, diagramId: string, permission: Permission = Permission.DiagramRead) {
    const role = await this.projectRepository.getDiagramRole(auth.user.id, diagramId);
    if (!role) {
      throw new NotFoundException('Diagram not found');
    }

    this.assertProjectPermission(auth, role.role, permission);

    const diagram = await this.diagramRepository.getById(diagramId);
    if (!diagram) {
      throw new NotFoundException('Diagram not found');
    }

    return diagram;
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
    if (dto.name === undefined && dto.dialect === undefined) {
      throw new BadRequestException('At least one diagram field is required');
    }

    const nextName = dto.name?.trim();
    if (dto.name !== undefined && !nextName) {
      throw new BadRequestException('Diagram name is required');
    }

    // requireDiagram centralizes project-role lookup, archived filtering, and permission enforcement for every diagram write.
    await this.requireDiagram(auth, diagramId, Permission.DiagramUpdate);

    const diagram = await this.diagramRepository.update(diagramId, {
      dialect: dto.dialect,
      name: nextName,
    });

    if (!diagram) {
      throw new NotFoundException('Diagram not found');
    }

    return this.serializeDiagram(diagram);
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
      diagram: this.serializeDiagram(diagramRow),
      model,
      warnings: [...imported.warnings, ...getDiagramModelIntegrityWarnings(model).map(normalizeTransferWarning)],
    };
  }

  private assertProjectPermission(auth: AuthContext, role: ProjectRole, permission: Permission): void {
    this.assertApiKeyScope(auth, permission);

    if (
      !isGranted({
        current: permissionsForProjectRole(role),
        requested: [permission],
      })
    ) {
      throw new ForbiddenException(`${permission} permission is required`);
    }
  }

  private assertApiKeyScope(auth: AuthContext, permission: Permission): void {
    if (auth.apiKey && !isGranted({ current: auth.apiKey.permissions, requested: [permission] })) {
      // Service-level diagram checks cover internal callers and routes where the URL does not expose the final project id.
      throw new ForbiddenException(`${permission} API key scope is required`);
    }
  }

  private async getOrCreateDefaultDiagramFolder(auth: AuthContext, organizationId: string) {
    const organization = await this.organizationRepository.getByIdForUser(auth.user.id, organizationId);

    if (!organization) {
      throw new NotFoundException('Workspace not found');
    }

    const visibleProject = await this.projectRepository.getBySlugForUser(
      auth.user.id,
      organizationId,
      defaultWorkspaceDiagramFolder.slug,
    );

    if (visibleProject) {
      this.assertProjectPermission(auth, visibleProject.projectRole, Permission.DiagramCreate);

      return visibleProject;
    }

    const existingProject = await this.projectRepository.getActiveBySlugInOrganization(
      organizationId,
      defaultWorkspaceDiagramFolder.slug,
    );

    if (existingProject) {
      return this.attachCurrentUserToDefaultFolder(
        auth,
        organizationId,
        existingProject.id,
        organization.allowMemberProjectCreate,
      );
    }

    await this.assertCanCreateDefaultFolder(auth, organizationId, organization.allowMemberProjectCreate);

    try {
      const project = await this.projectRepository.create({
        createdById: auth.user.id,
        description: defaultWorkspaceDiagramFolder.description,
        name: defaultWorkspaceDiagramFolder.name,
        organizationId,
        reviewSettings: defaultDiagramReviewSettings,
        slug: defaultWorkspaceDiagramFolder.slug,
      });

      await this.recordDefaultFolderAudit(auth, {
        metadata: {
          description: project.description,
          generatedFor: 'workspace_diagram_create',
          name: project.name,
          slug: project.slug,
        },
        organizationId: project.organizationId,
        projectId: project.id,
      });

      return project;
    } catch (error) {
      if (!isProjectSlugConflict(error)) {
        throw error;
      }

      const project = await this.projectRepository.getActiveBySlugInOrganization(
        organizationId,
        defaultWorkspaceDiagramFolder.slug,
      );

      if (!project) {
        throw error;
      }

      // Concurrent first-diagram creates can race on the default folder; the loser joins the row that already exists.
      return this.attachCurrentUserToDefaultFolder(auth, organizationId, project.id, organization.allowMemberProjectCreate);
    }
  }

  private async attachCurrentUserToDefaultFolder(
    auth: AuthContext,
    organizationId: string,
    projectId: string,
    allowMemberProjectCreate: boolean,
  ) {
    await this.assertCanCreateDefaultFolder(auth, organizationId, allowMemberProjectCreate);

    // Existing default folders are utility containers; editor access lets diagram-first creation recover from slug races.
    await this.projectRepository.upsertMember(projectId, {
      createdById: auth.user.id,
      role: ProjectRole.Editor,
      userId: auth.user.id,
    });

    const project = await this.projectRepository.getByIdForUser(auth.user.id, projectId);

    if (!project) {
      throw new ForbiddenException('Default diagram folder is not accessible');
    }

    this.assertProjectPermission(auth, project.projectRole, Permission.DiagramCreate);

    return project;
  }

  private async assertCanCreateDefaultFolder(
    auth: AuthContext,
    organizationId: string,
    allowMemberProjectCreate: boolean,
  ): Promise<void> {
    if (allowMemberProjectCreate) {
      return;
    }

    const membership = await this.organizationRepository.getRole(auth.user.id, organizationId);

    if (membership?.role === OrganizationRole.Owner || membership?.role === OrganizationRole.Admin) {
      return;
    }

    throw new ForbiddenException('Workspace members cannot create diagram folders');
  }

  private recordDefaultFolderAudit(
    auth: AuthContext,
    options: {
      metadata: Record<string, JsonValue>;
      organizationId: string;
      projectId: string;
    },
  ) {
    return this.auditLogRepository.create({
      action: AuditAction.ProjectCreated,
      actorId: auth.user.id,
      entityId: options.projectId,
      entityType: 'project',
      ipAddress: auth.request?.ipAddress ?? null,
      metadata: options.metadata,
      organizationId: options.organizationId,
      projectId: options.projectId,
      requestId: auth.request?.requestId ?? null,
      userAgent: auth.request?.userAgent ?? null,
    });
  }

  private serializeDiagram(
    diagram: NonNullable<Awaited<ReturnType<DiagramRepository['getById']>>>,
  ): DiagramResponseDto {
    return {
      id: diagram.id,
      projectId: diagram.projectId,
      name: diagram.name,
      // Kysely membaca kolom dialect sebagai text karena database menyimpannya generik, sedangkan kontrak API mengekspos union dialect canonical.
      dialect: diagram.dialect as DatabaseDialect,
      status: diagram.status,
      createdAt: toIsoDateTime(diagram.createdAt),
      updatedAt: toIsoDateTime(diagram.updatedAt),
    };
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

function isProjectSlugConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as { code?: unknown; constraint?: unknown };

  return record.code === '23505' && record.constraint === 'projects_organization_id_slug_key';
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
