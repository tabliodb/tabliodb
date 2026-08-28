import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationRole, Permission, AccessRole } from '@tabliodb/shared';
import { AuditAction } from '../constants.js';
import type { AuthContext } from '../database.js';
import {
  TeamArchiveResponseDto,
  TeamCreateDto,
  TeamDiagramAccessDto,
  TeamDiagramAccessListQueryDto,
  TeamDiagramAccessListResponseDto,
  TeamDiagramAccessRemoveResponseDto,
  TeamDiagramAccessUpsertDto,
  TeamListQueryDto,
  TeamListResponseDto,
  TeamMemberCreateDto,
  TeamMemberDto,
  TeamMemberListQueryDto,
  TeamMemberListResponseDto,
  TeamMemberRemoveResponseDto,
  TeamFolderAccessDto,
  TeamFolderAccessListQueryDto,
  TeamFolderAccessListResponseDto,
  TeamFolderAccessRemoveResponseDto,
  TeamFolderAccessUpsertDto,
  TeamResponseDto,
  TeamUpdateDto,
} from '../dtos/team.dto.js';
import { AuditLogRepository } from '../repositories/audit-log.repository.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { TeamRepository, type TeamDiagramRole, type TeamAccessRole } from '../repositories/team.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { JsonValue } from '../schema/index.js';
import { toIsoDateTime } from '../utils/date-time.js';
import { clampPaginationLimit } from '../utils/pagination.js';
import { PermissionService } from './permission.service.js';

@Injectable()
export class TeamService {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly permissionService: PermissionService,
    private readonly teamRepository: TeamRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async getAll(auth: AuthContext, query: TeamListQueryDto): Promise<TeamListResponseDto> {
    await this.assertOrganizationPermission(auth, query.organizationId, Permission.OrganizationRead);

    const teams = await this.teamRepository.list({
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
      organizationId: query.organizationId,
    });

    return {
      ...teams,
      items: teams.items.map((team) => this.serializeTeam(team)),
    };
  }

  async create(auth: AuthContext, dto: TeamCreateDto): Promise<TeamResponseDto> {
    await this.assertOrganizationPermission(auth, dto.organizationId, Permission.OrganizationManage);

    const team = await this.teamRepository.create({
      createdById: auth.user.id,
      description: dto.description?.trim() || null,
      name: dto.name.trim(),
      organizationId: dto.organizationId,
    });

    if (!team) {
      throw new NotFoundException('Team could not be loaded');
    }

    await this.recordTeamAudit(auth, {
      action: AuditAction.TeamCreated,
      entityId: team.id,
      entityType: 'team',
      metadata: {
        description: team.description,
        name: team.name,
        slug: team.slug,
      },
      organizationId: team.organizationId,
    });

    return this.serializeTeam(team);
  }

  async update(auth: AuthContext, teamId: string, dto: TeamUpdateDto): Promise<TeamResponseDto> {
    if (dto.name === undefined && dto.description === undefined) {
      throw new BadRequestException('At least one team field is required');
    }

    const current = await this.requireTeam(auth, teamId, Permission.OrganizationManage);
    const team = await this.teamRepository.update(teamId, {
      description: dto.description === undefined ? undefined : dto.description?.trim() || null,
      name: dto.name?.trim(),
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    await this.recordTeamAudit(auth, {
      action: AuditAction.TeamUpdated,
      entityId: team.id,
      entityType: 'team',
      metadata: {
        changes: buildTeamChangesMetadata(current, team),
      },
      organizationId: team.organizationId,
    });

    return this.serializeTeam(team);
  }

  async archive(auth: AuthContext, teamId: string): Promise<TeamArchiveResponseDto> {
    const team = await this.requireTeam(auth, teamId, Permission.OrganizationManage);
    const archived = await this.teamRepository.archive(teamId);

    if (!archived) {
      throw new NotFoundException('Team not found');
    }

    await this.recordTeamAudit(auth, {
      action: AuditAction.TeamArchived,
      entityId: team.id,
      entityType: 'team',
      metadata: {
        name: team.name,
        slug: team.slug,
      },
      organizationId: team.organizationId,
    });

    return { successful: true };
  }

  async getMembers(
    auth: AuthContext,
    teamId: string,
    query: TeamMemberListQueryDto,
  ): Promise<TeamMemberListResponseDto> {
    await this.requireTeam(auth, teamId, Permission.OrganizationRead);

    const members = await this.teamRepository.getMembers(teamId, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
    });

    return {
      ...members,
      items: members.items.map((member) => this.serializeMember(member)),
    };
  }

  async addMember(auth: AuthContext, teamId: string, dto: TeamMemberCreateDto): Promise<TeamMemberDto> {
    const team = await this.requireTeam(auth, teamId, Permission.OrganizationManage);
    const user = await this.userRepository.getByEmail(dto.email);

    if (!user) {
      throw new NotFoundException('User not found. Create an invitation for new users first.');
    }

    const workspaceMember = await this.organizationRepository.addMemberIfAbsent({
      createdById: auth.user.id,
      organizationId: team.organizationId,
      // Team membership must still be tenant-anchored; guests only receive permissions through explicit team grants.
      role: OrganizationRole.Guest,
      userId: user.id,
    });

    if (!workspaceMember) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspaceMember.status !== 'active') {
      throw new BadRequestException('User is not an active workspace member');
    }

    const existingMember = await this.teamRepository.getMember(teamId, user.id);
    const member = await this.teamRepository.addMember(teamId, {
      createdById: auth.user.id,
      userId: user.id,
    });

    if (!member) {
      throw new NotFoundException('Team member could not be loaded');
    }

    if (!existingMember) {
      // Re-adding the same user is idempotent because the repository uses ON CONFLICT DO NOTHING.
      await this.recordTeamAudit(auth, {
        action: AuditAction.TeamMemberAdded,
        entityId: user.id,
        entityType: 'team_member',
        metadata: {
          email: user.email,
          name: user.name,
          teamName: team.name,
        },
        organizationId: team.organizationId,
      });
    }

    return this.serializeMember(member);
  }

  async removeMember(auth: AuthContext, teamId: string, userId: string): Promise<TeamMemberRemoveResponseDto> {
    const team = await this.requireTeam(auth, teamId, Permission.OrganizationManage);
    const currentMember = await this.teamRepository.getMember(teamId, userId);
    if (!currentMember) {
      throw new NotFoundException('Team member not found');
    }

    await this.teamRepository.removeMember(teamId, userId);

    await this.recordTeamAudit(auth, {
      action: AuditAction.TeamMemberRemoved,
      entityId: userId,
      entityType: 'team_member',
      metadata: {
        email: currentMember.email,
        name: currentMember.name,
        teamName: team.name,
      },
      organizationId: team.organizationId,
    });

    return { successful: true };
  }

  async getFolderAccesses(
    auth: AuthContext,
    teamId: string,
    query: TeamFolderAccessListQueryDto,
  ): Promise<TeamFolderAccessListResponseDto> {
    await this.requireTeam(auth, teamId, Permission.OrganizationRead);

    const accesses = await this.teamRepository.getFolderAccesses(teamId, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
    });

    return {
      ...accesses,
      items: accesses.items.map((access) => this.serializeFolderAccess(access)),
    };
  }

  async upsertFolderAccess(
    auth: AuthContext,
    teamId: string,
    dto: TeamFolderAccessUpsertDto,
  ): Promise<TeamFolderAccessDto> {
    const team = await this.requireTeam(auth, teamId, Permission.OrganizationManage);
    const folder = await this.teamRepository.getFolderInOrganization(dto.folderId, team.organizationId);

    if (!folder) {
      throw new BadRequestException('Folder must belong to the same workspace as the team');
    }

    const currentAccess = await this.teamRepository.getFolderAccess(teamId, dto.folderId);
    const access = await this.teamRepository.upsertFolderAccess(teamId, {
      createdById: auth.user.id,
      folderId: dto.folderId,
      // DTO sudah punya default, tetapi fallback service menjaga caller SDK/API key yang mengirim payload minimal.
      role: (dto.role ?? AccessRole.Viewer) as TeamAccessRole,
    });

    if (!access) {
      throw new NotFoundException('Team folder access could not be loaded');
    }

    if (!currentAccess || currentAccess.role !== access.role) {
      // A no-op grant should stay quiet in audit logs; only new or changed effective access matters.
      await this.recordTeamAudit(auth, {
        action: AuditAction.TeamFolderAccessUpdated,
        entityId: folder.id,
        entityType: 'team_folder_access',
        metadata: {
          folderName: folder.name,
          role: currentAccess ? { after: access.role, before: currentAccess.role } : access.role,
          teamName: team.name,
        },
        organizationId: team.organizationId,
        folderId: folder.id,
      });
    }

    return this.serializeFolderAccess(access);
  }

  async removeFolderAccess(
    auth: AuthContext,
    teamId: string,
    folderId: string,
  ): Promise<TeamFolderAccessRemoveResponseDto> {
    const team = await this.requireTeam(auth, teamId, Permission.OrganizationManage);
    const currentAccess = await this.teamRepository.getFolderAccess(teamId, folderId);

    if (!currentAccess) {
      throw new NotFoundException('Team folder access not found');
    }

    await this.teamRepository.removeFolderAccess(teamId, folderId);

    await this.recordTeamAudit(auth, {
      action: AuditAction.TeamFolderAccessRemoved,
      entityId: folderId,
      entityType: 'team_folder_access',
      metadata: {
        folderName: currentAccess.folderName,
        role: currentAccess.role,
        teamName: team.name,
      },
      organizationId: team.organizationId,
      folderId,
    });

    return { successful: true };
  }

  async getDiagramAccesses(
    auth: AuthContext,
    teamId: string,
    query: TeamDiagramAccessListQueryDto,
  ): Promise<TeamDiagramAccessListResponseDto> {
    await this.requireTeam(auth, teamId, Permission.OrganizationRead);

    const accesses = await this.teamRepository.getDiagramAccesses(teamId, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
    });

    return {
      ...accesses,
      items: accesses.items.map((access) => this.serializeDiagramAccess(access)),
    };
  }

  async upsertDiagramAccess(
    auth: AuthContext,
    teamId: string,
    dto: TeamDiagramAccessUpsertDto,
  ): Promise<TeamDiagramAccessDto> {
    const team = await this.requireTeam(auth, teamId, Permission.OrganizationManage);
    const diagram = await this.teamRepository.getDiagramInOrganization(dto.diagramId, team.organizationId);

    if (!diagram) {
      throw new BadRequestException('Diagram must belong to the same workspace as the team');
    }

    const currentAccess = await this.teamRepository.getDiagramAccess(teamId, dto.diagramId);
    const access = await this.teamRepository.upsertDiagramAccess(teamId, {
      createdById: auth.user.id,
      diagramId: dto.diagramId,
      // Direct diagram team grants reuse folder roles because the effective permission matrix is the same.
      role: (dto.role ?? AccessRole.Viewer) as TeamDiagramRole,
    });

    if (!access) {
      throw new NotFoundException('Team diagram access could not be loaded');
    }

    if (!currentAccess || currentAccess.role !== access.role) {
      await this.recordTeamAudit(auth, {
        action: AuditAction.TeamDiagramAccessUpdated,
        diagramId: diagram.id,
        entityId: diagram.id,
        entityType: 'team_diagram_access',
        metadata: {
          diagramName: diagram.name,
          role: currentAccess ? { after: access.role, before: currentAccess.role } : access.role,
          teamName: team.name,
        },
        organizationId: team.organizationId,
        folderId: diagram.folderId,
      });
    }

    return this.serializeDiagramAccess(access);
  }

  async removeDiagramAccess(
    auth: AuthContext,
    teamId: string,
    diagramId: string,
  ): Promise<TeamDiagramAccessRemoveResponseDto> {
    const team = await this.requireTeam(auth, teamId, Permission.OrganizationManage);
    const currentAccess = await this.teamRepository.getDiagramAccess(teamId, diagramId);

    if (!currentAccess) {
      throw new NotFoundException('Team diagram access not found');
    }

    await this.teamRepository.removeDiagramAccess(teamId, diagramId);

    await this.recordTeamAudit(auth, {
      action: AuditAction.TeamDiagramAccessRemoved,
      diagramId,
      entityId: diagramId,
      entityType: 'team_diagram_access',
      metadata: {
        diagramName: currentAccess.diagramName,
        role: currentAccess.role,
        teamName: team.name,
      },
      organizationId: team.organizationId,
      folderId: currentAccess.folderId,
    });

    return { successful: true };
  }

  private async requireTeam(auth: AuthContext, teamId: string, permission: Permission) {
    const team = await this.teamRepository.getById(teamId);

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    await this.assertOrganizationPermission(auth, team.organizationId, permission);

    return team;
  }

  private assertOrganizationPermission(auth: AuthContext, organizationId: string, permission: Permission) {
    return this.permissionService.assertAllowed(auth, {
      permission,
      target: {
        id: organizationId,
        type: 'organization',
      },
    });
  }

  private recordTeamAudit(
    auth: AuthContext,
    options: {
      action: AuditAction;
      entityId: string;
      entityType: string;
      diagramId?: string | null;
      metadata: Record<string, JsonValue>;
      organizationId: string;
      folderId?: string | null;
    },
  ) {
    return this.auditLogRepository.create({
      action: options.action,
      actorId: auth.user.id,
      diagramId: options.diagramId ?? null,
      entityId: options.entityId,
      entityType: options.entityType,
      ipAddress: auth.request?.ipAddress ?? null,
      metadata: options.metadata,
      organizationId: options.organizationId,
      folderId: options.folderId ?? null,
      requestId: auth.request?.requestId ?? null,
      userAgent: auth.request?.userAgent ?? null,
    });
  }

  private serializeTeam(team: TeamRow): TeamResponseDto {
    return {
      description: team.description,
      diagramAccessCount: Number(team.diagramAccessCount),
      id: team.id,
      memberCount: Number(team.memberCount),
      name: team.name,
      organizationId: team.organizationId,
      folderAccessCount: Number(team.folderAccessCount),
      slug: team.slug,
      createdAt: toIsoDateTime(team.createdAt),
      updatedAt: toIsoDateTime(team.updatedAt),
    };
  }

  private serializeMember(member: TeamMemberRow): TeamMemberDto {
    return {
      avatarUrl: member.avatarUrl ?? null,
      cursorColor: member.cursorColor,
      email: member.email,
      name: member.name,
      userId: member.userId,
      createdAt: toIsoDateTime(member.createdAt),
    };
  }

  private serializeFolderAccess(access: TeamFolderAccessRow): TeamFolderAccessDto {
    return {
      folderId: access.folderId,
      folderName: access.folderName,
      folderSlug: access.folderSlug,
      role: access.role as AccessRole.Editor | AccessRole.Commenter | AccessRole.Viewer,
      createdAt: toIsoDateTime(access.createdAt),
      updatedAt: toIsoDateTime(access.updatedAt),
    };
  }

  private serializeDiagramAccess(access: TeamDiagramAccessRow): TeamDiagramAccessDto {
    return {
      createdAt: toIsoDateTime(access.createdAt),
      diagramId: access.diagramId,
      diagramName: access.diagramName,
      folderId: access.folderId,
      role: access.role as AccessRole.Editor | AccessRole.Commenter | AccessRole.Viewer,
      updatedAt: toIsoDateTime(access.updatedAt),
    };
  }
}

type TeamRow = {
  createdAt: Date | string;
  description: string | null;
  diagramAccessCount: number;
  id: string;
  memberCount: number;
  name: string;
  organizationId: string;
  folderAccessCount: number;
  slug: string;
  updatedAt: Date | string;
};

type TeamMemberRow = {
  avatarUrl?: string | null;
  createdAt: Date | string;
  cursorColor: string;
  email: string;
  name: string;
  userId: string;
};

type TeamFolderAccessRow = {
  createdAt: Date | string;
  folderId: string;
  folderName: string;
  folderSlug: string;
  role: string;
  updatedAt: Date | string;
};

type TeamDiagramAccessRow = {
  createdAt: Date | string;
  diagramId: string;
  diagramName: string;
  folderId: string | null;
  role: string;
  updatedAt: Date | string;
};

function buildTeamChangesMetadata(before: TeamRow, after: TeamRow): Record<string, JsonValue> {
  const changes: Record<string, JsonValue> = {};

  if (before.name !== after.name) {
    changes.name = { after: after.name, before: before.name };
  }

  if (before.description !== after.description) {
    changes.description = { after: after.description, before: before.description };
  }

  return changes;
}
