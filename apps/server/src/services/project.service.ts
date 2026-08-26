import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { defaultDiagramReviewSettings } from '@tabliodb/schema-core';
import { OrganizationRole, Permission, ProjectRole, isGranted, permissionsForProjectRole } from '@tabliodb/shared';
import { AuditAction } from '../constants.js';
import { AuthContext } from '../database.js';
import {
  ProjectArchiveResponseDto,
  ProjectCreateDto,
  ProjectListQueryDto,
  ProjectListResponseDto,
  ProjectMemberCreateDto,
  ProjectMemberDto,
  ProjectMemberListQueryDto,
  ProjectMemberListResponseDto,
  ProjectMemberRemoveResponseDto,
  ProjectMemberUpdateDto,
  ProjectOwnershipTransferDto,
  ProjectResponseDto,
  ProjectUpdateDto,
} from '../dtos/project.dto.js';
import { AuditLogRepository } from '../repositories/audit-log.repository.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { JsonValue } from '../schema/index.js';
import { toIsoDateTime } from '../utils/date-time.js';
import { clampPaginationLimit } from '../utils/pagination.js';
import { slugify } from '../utils/slug.js';

@Injectable()
export class ProjectService {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async getAll(auth: AuthContext, query: ProjectListQueryDto): Promise<ProjectListResponseDto> {
    this.assertApiKeyScope(auth, Permission.ProjectRead);

    const projects = await this.projectRepository.getVisibleToUser(auth.user.id, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
      organizationId: query.organizationId,
    });

    return {
      ...projects,
      items: projects.items.map((project) => this.serializeProject(project)),
    };
  }

  async create(auth: AuthContext, dto: ProjectCreateDto) {
    this.assertApiKeyScope(auth, Permission.ProjectCreate);

    const organization = await this.organizationRepository.getByIdForUser(auth.user.id, dto.organizationId);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Project creation is intentionally workspace-explicit so self-hosted/internal accounts do not get surprise personal workspaces.
    await this.assertCanCreateProject(auth, organization.id, organization.allowMemberProjectCreate);

    const project = await this.createProjectOrThrowConflict({
      createdById: auth.user.id,
      description: dto.description ?? null,
      name: dto.name,
      organizationId: organization.id,
      reviewSettings: defaultDiagramReviewSettings,
      slug: slugify(dto.name),
    });

    await this.recordProjectAudit(auth, {
      action: AuditAction.ProjectCreated,
      entityId: project.id,
      entityType: 'project',
      metadata: {
        description: project.description,
        name: project.name,
        slug: project.slug,
      },
      organizationId: project.organizationId,
      projectId: project.id,
    });

    return this.serializeProject(project);
  }

  async update(auth: AuthContext, projectId: string, dto: ProjectUpdateDto): Promise<ProjectResponseDto> {
    if (dto.name === undefined && dto.description === undefined) {
      throw new BadRequestException('At least one project field is required');
    }

    const nextName = dto.name?.trim();
    if (dto.name !== undefined && !nextName) {
      throw new BadRequestException('Project name is required');
    }

    await this.requireProject(auth, projectId, Permission.ProjectUpdate);

    const project = await this.projectRepository.update(auth.user.id, projectId, {
      description: dto.description === undefined ? undefined : dto.description?.trim() || null,
      name: nextName,
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.serializeProject(project);
  }

  async archive(auth: AuthContext, projectId: string): Promise<ProjectArchiveResponseDto> {
    const project = await this.requireProject(auth, projectId, Permission.ProjectDelete);
    const archived = await this.projectRepository.archive(projectId);

    if (!archived) {
      throw new NotFoundException('Project not found');
    }

    await this.recordProjectAudit(auth, {
      action: AuditAction.ProjectArchived,
      entityId: project.id,
      entityType: 'project',
      metadata: {
        name: project.name,
        slug: project.slug,
      },
      organizationId: project.organizationId,
      projectId: project.id,
    });

    return { successful: true };
  }

  async getMembers(
    auth: AuthContext,
    projectId: string,
    query: ProjectMemberListQueryDto,
  ): Promise<ProjectMemberListResponseDto> {
    await this.requireProject(auth, projectId, Permission.ProjectMemberManage);

    const members = await this.projectRepository.getMembers(projectId, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
    });

    return {
      ...members,
      items: members.items.map((member) => this.serializeMember(member)),
    };
  }

  async addMember(auth: AuthContext, projectId: string, dto: ProjectMemberCreateDto): Promise<ProjectMemberDto> {
    const project = await this.requireProject(auth, projectId, Permission.ProjectMemberManage);
    this.assertAssignableProjectMemberRole(dto.role ?? ProjectRole.Viewer);
    const user = await this.userRepository.getByEmail(dto.email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const organizationMembership = await this.organizationRepository.getByIdForUser(user.id, project.organizationId);
    if (!organizationMembership) {
      throw new BadRequestException('User must belong to the project workspace before joining the project');
    }

    const existingMember = await this.projectRepository.getMember(projectId, user.id);
    const member = await this.projectRepository.upsertMember(projectId, {
      createdById: auth.user.id,
      role: dto.role ?? ProjectRole.Viewer,
      userId: user.id,
    });

    if (!member) {
      throw new NotFoundException('Project member could not be loaded');
    }

    if (!existingMember) {
      await this.recordProjectAudit(auth, {
        action: AuditAction.ProjectMemberAdded,
        entityId: user.id,
        entityType: 'project_member',
        metadata: {
          email: user.email,
          name: user.name,
          role: member.role,
        },
        organizationId: project.organizationId,
        projectId,
      });
    } else if (existingMember.role !== member.role) {
      await this.recordProjectAudit(auth, {
        action: AuditAction.ProjectMemberRoleUpdated,
        entityId: user.id,
        entityType: 'project_member',
        metadata: {
          email: user.email,
          name: user.name,
          role: {
            after: member.role,
            before: existingMember.role,
          },
        },
        organizationId: project.organizationId,
        projectId,
      });
    }

    return this.serializeMember(member);
  }

  async updateMember(
    auth: AuthContext,
    projectId: string,
    userId: string,
    dto: ProjectMemberUpdateDto,
  ): Promise<ProjectMemberDto> {
    const project = await this.requireProject(auth, projectId, Permission.ProjectMemberManage);
    this.assertNotSelfMemberMutation(auth, userId, 'change your own folder access');
    this.assertAssignableProjectMemberRole(dto.role);
    const currentMember = await this.assertCanEditProjectMemberRole(projectId, userId);

    const member = await this.projectRepository.updateMember(projectId, userId, dto.role);
    if (!member) {
      throw new NotFoundException('Project member not found');
    }

    if (currentMember.role !== member.role) {
      await this.recordProjectAudit(auth, {
        action: AuditAction.ProjectMemberRoleUpdated,
        entityId: userId,
        entityType: 'project_member',
        metadata: {
          email: member.email,
          name: member.name,
          role: {
            after: member.role,
            before: currentMember.role,
          },
        },
        organizationId: project.organizationId,
        projectId,
      });
    }

    return this.serializeMember(member);
  }

  async transferOwnership(
    auth: AuthContext,
    projectId: string,
    dto: ProjectOwnershipTransferDto,
  ): Promise<ProjectMemberDto> {
    const project = await this.requireProject(auth, projectId, Permission.ProjectMemberManage);

    if (auth.user.id === dto.userId) {
      throw new BadRequestException('Choose another collaborator to receive folder ownership');
    }

    const workspaceMember = await this.organizationRepository.getMember(project.organizationId, dto.userId);
    if (!workspaceMember || workspaceMember.status !== 'active') {
      throw new BadRequestException('New folder owner must be an active workspace member');
    }

    const effectiveRole = await this.projectRepository.getProjectRole(dto.userId, projectId);
    if (!effectiveRole) {
      throw new BadRequestException('New folder owner must already have folder access');
    }

    const currentMember = await this.projectRepository.getMember(projectId, dto.userId);
    if (currentMember?.role === ProjectRole.Owner) {
      throw new BadRequestException('User already owns this folder');
    }

    const member = await this.projectRepository.transferOwnership(projectId, {
      createdById: auth.user.id,
      userId: dto.userId,
    });

    if (!member) {
      throw new NotFoundException('Project member not found');
    }

    await this.recordProjectAudit(auth, {
      action: AuditAction.ProjectMemberRoleUpdated,
      entityId: dto.userId,
      entityType: 'project_member',
      metadata: {
        email: member.email,
        name: member.name,
        role: {
          after: member.role,
          before: currentMember?.role ?? null,
        },
        // Ownership transfer is deliberately separated from regular role changes so audit history can flag it as sensitive.
        transfer: true,
      },
      organizationId: project.organizationId,
      projectId,
    });

    return this.serializeMember(member);
  }

  async removeMember(auth: AuthContext, projectId: string, userId: string): Promise<ProjectMemberRemoveResponseDto> {
    const project = await this.requireProject(auth, projectId, Permission.ProjectMemberManage);
    this.assertNotSelfMemberMutation(auth, userId, 'remove your own folder access');
    const currentMember = await this.projectRepository.getMember(projectId, userId);
    if (!currentMember) {
      throw new NotFoundException('Project member not found');
    }

    if (
      currentMember.role === ProjectRole.Owner &&
      (await this.projectRepository.getProjectOwnerCount(projectId)) <= 1
    ) {
      throw new BadRequestException('Project must keep at least one owner');
    }

    await this.projectRepository.removeMember(projectId, userId);

    await this.recordProjectAudit(auth, {
      action: AuditAction.ProjectMemberRemoved,
      entityId: userId,
      entityType: 'project_member',
      metadata: {
        email: currentMember.email,
        name: currentMember.name,
        role: currentMember.role,
      },
      organizationId: project.organizationId,
      projectId,
    });

    return { successful: true };
  }

  async requireProject(auth: AuthContext, projectId: string, permission: Permission = Permission.ProjectRead) {
    this.assertApiKeyScope(auth, permission);

    const project = await this.projectRepository.getByIdForUser(auth.user.id, projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    this.assertProjectRole(project.projectRole, permission);

    return project;
  }

  private assertApiKeyScope(auth: AuthContext, permission: Permission): void {
    if (!auth.apiKey) {
      return;
    }

    if (!isGranted({ current: auth.apiKey.permissions, requested: [permission] })) {
      // Service-level checks protect internal callers and routes whose controller metadata can be bypassed in tests.
      throw new ForbiddenException(`${permission} API key scope is required`);
    }
  }

  private assertProjectRole(role: ProjectRole, permission: Permission): void {
    if (!isGranted({ current: permissionsForProjectRole(role), requested: [permission] })) {
      throw new ForbiddenException(`${permission} permission is required`);
    }
  }

  private async assertCanCreateProject(
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

    throw new ForbiddenException('Workspace members cannot create projects');
  }

  private async createProjectOrThrowConflict(options: Parameters<ProjectRepository['create']>[0]) {
    try {
      return await this.projectRepository.create(options);
    } catch (error) {
      if (isProjectSlugConflict(error)) {
        // Slug unik per workspace menjaga URL/navigasi stabil; duplicate name harus menjadi 409, bukan bocoran error Postgres.
        throw new ConflictException('A project with this name already exists in this workspace');
      }

      throw error;
    }
  }

  private serializeProject(project: {
    createdAt: Date | string;
    description: string | null;
    id: string;
    name: string;
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    projectRole: ProjectRole;
    slug: string;
    updatedAt: Date | string;
  }): ProjectResponseDto {
    return {
      ...project,
      // Project API contract memakai ISO string agar browser SDK tidak perlu menebak timezone dari Date object.
      createdAt: toIsoDateTime(project.createdAt),
      updatedAt: toIsoDateTime(project.updatedAt),
    };
  }

  private async assertCanEditProjectMemberRole(projectId: string, userId: string) {
    const currentMember = await this.projectRepository.getMember(projectId, userId);
    if (!currentMember) {
      throw new NotFoundException('Project member not found');
    }

    if (currentMember.role === ProjectRole.Owner) {
      throw new BadRequestException('Use transfer ownership to change a folder owner');
    }

    return currentMember;
  }

  private assertAssignableProjectMemberRole(role: ProjectRole): void {
    if (role !== ProjectRole.Owner) {
      return;
    }

    // Owner stays outside add/update member flows; transferOwnership is the only path that can promote a folder owner.
    throw new BadRequestException('Use transfer ownership to assign a folder owner');
  }

  private assertNotSelfMemberMutation(auth: AuthContext, userId: string, action: string): void {
    if (auth.user.id !== userId) {
      return;
    }

    // Self role changes create a lockout/privilege loop; ownership transfer should be handled by another owner/admin flow.
    throw new BadRequestException(`Use another owner account to ${action}`);
  }

  private recordProjectAudit(
    auth: AuthContext,
    options: {
      action: AuditAction;
      entityId: string;
      entityType: string;
      metadata: Record<string, JsonValue>;
      organizationId: string;
      projectId: string;
    },
  ) {
    return this.auditLogRepository.create({
      action: options.action,
      actorId: auth.user.id,
      entityId: options.entityId,
      entityType: options.entityType,
      ipAddress: auth.request?.ipAddress ?? null,
      metadata: options.metadata,
      organizationId: options.organizationId,
      projectId: options.projectId,
      requestId: auth.request?.requestId ?? null,
      userAgent: auth.request?.userAgent ?? null,
    });
  }

  private serializeMember(member: {
    avatarUrl?: string | null;
    cursorColor: string;
    createdAt: Date | string;
    email: string;
    name: string;
    role: ProjectRole;
    updatedAt: Date | string;
    userId: string;
  }): ProjectMemberDto {
    return {
      ...member,
      avatarUrl: member.avatarUrl ?? null,
      // Member timestamps follow the rest of the API contract: ISO strings, never Date objects over JSON.
      createdAt: toIsoDateTime(member.createdAt),
      updatedAt: toIsoDateTime(member.updatedAt),
    };
  }
}

function isProjectSlugConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as { code?: unknown; constraint?: unknown };

  return record.code === '23505' && record.constraint === 'projects_organization_id_slug_key';
}
