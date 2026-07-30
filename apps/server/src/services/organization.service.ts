import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationRole, ProjectRole } from '@tabliodb/shared';
import { AuditAction } from '../constants.js';
import type { AuthContext } from '../database.js';
import { AuditLogListQueryDto, AuditLogListResponseDto } from '../dtos/audit-log.dto.js';
import {
  OrganizationDto,
  OrganizationListQueryDto,
  OrganizationListResponseDto,
  OrganizationMemberDto,
  OrganizationMemberListQueryDto,
  OrganizationMemberListResponseDto,
  OrganizationMemberRemoveResponseDto,
  OrganizationMemberUpdateDto,
  OrganizationSettingsDto,
  OrganizationSettingsUpdateDto,
} from '../dtos/organization.dto.js';
import { AuditLogRepository } from '../repositories/audit-log.repository.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import type { JsonValue } from '../schema/index.js';
import { toIsoDateTime } from '../utils/date-time.js';
import { clampPaginationLimit } from '../utils/pagination.js';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly organizationRepository: OrganizationRepository,
  ) {}

  async getAll(auth: AuthContext, query: OrganizationListQueryDto): Promise<OrganizationListResponseDto> {
    const organizations = await this.organizationRepository.listForUser(auth.user.id, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
    });

    return {
      ...organizations,
      items: organizations.items.map((organization) => this.serializeOrganization(organization)),
    };
  }

  async getSettings(auth: AuthContext, organizationId: string): Promise<OrganizationSettingsDto> {
    const organization = await this.organizationRepository.getSettingsForUser(auth.user.id, organizationId);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return this.serializeSettings(organization);
  }

  async updateSettings(
    auth: AuthContext,
    organizationId: string,
    dto: OrganizationSettingsUpdateDto,
  ): Promise<OrganizationSettingsDto> {
    if (dto.name === undefined && dto.defaultProjectRole === undefined && dto.allowMemberProjectCreate === undefined) {
      throw new BadRequestException('At least one workspace setting is required');
    }

    const current = await this.organizationRepository.getSettingsForUser(auth.user.id, organizationId);
    if (!current) {
      throw new NotFoundException('Organization not found');
    }

    const nextName = dto.name?.trim();
    if (dto.name !== undefined && !nextName) {
      throw new BadRequestException('Workspace name is required');
    }

    const organization = await this.organizationRepository.updateSettings(organizationId, {
      allowMemberProjectCreate: dto.allowMemberProjectCreate,
      defaultProjectRole: dto.defaultProjectRole,
      name: nextName,
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    await this.auditLogRepository.create({
      action: AuditAction.OrganizationSettingsUpdated,
      actorId: auth.user.id,
      entityId: organization.id,
      entityType: 'organization',
      ipAddress: auth.request?.ipAddress ?? null,
      metadata: this.buildSettingsMetadata(current, organization),
      organizationId: organization.id,
      requestId: auth.request?.requestId ?? null,
      userAgent: auth.request?.userAgent ?? null,
    });

    return this.serializeSettings(organization);
  }

  async getMembers(
    _auth: AuthContext,
    organizationId: string,
    query: OrganizationMemberListQueryDto,
  ): Promise<OrganizationMemberListResponseDto> {
    const members = await this.organizationRepository.getMembers(organizationId, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
    });

    return {
      ...members,
      items: members.items.map((member) => this.serializeMember(member)),
    };
  }

  async updateMemberRole(
    auth: AuthContext,
    organizationId: string,
    userId: string,
    dto: OrganizationMemberUpdateDto,
  ): Promise<OrganizationMemberDto> {
    const currentMember = await this.assertCanChangeOwnerRole(organizationId, userId, dto.role);
    const member = await this.organizationRepository.updateMemberRole(organizationId, userId, dto.role);

    if (!member) {
      throw new NotFoundException('Workspace member not found');
    }

    if (currentMember.role !== member.role) {
      await this.recordOrganizationAudit(auth, {
        action: AuditAction.OrganizationMemberRoleUpdated,
        entityId: userId,
        entityType: 'organization_member',
        metadata: {
          email: member.email,
          name: member.name,
          role: {
            after: member.role,
            before: currentMember.role,
          },
        },
        organizationId,
      });
    }

    return this.serializeMember(member);
  }

  async removeMember(
    auth: AuthContext,
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMemberRemoveResponseDto> {
    const currentMember = await this.organizationRepository.getMember(organizationId, userId);
    if (!currentMember) {
      throw new NotFoundException('Workspace member not found');
    }

    if (
      currentMember.role === OrganizationRole.Owner &&
      (await this.organizationRepository.getOrganizationOwnerCount(organizationId)) <= 1
    ) {
      throw new BadRequestException('Workspace must keep at least one owner');
    }

    await this.organizationRepository.removeMember(organizationId, userId);

    await this.recordOrganizationAudit(auth, {
      action: AuditAction.OrganizationMemberRemoved,
      entityId: userId,
      entityType: 'organization_member',
      metadata: {
        email: currentMember.email,
        name: currentMember.name,
        role: currentMember.role,
      },
      organizationId,
    });

    return { successful: true };
  }

  async getAuditLogs(
    _auth: AuthContext,
    organizationId: string,
    query: AuditLogListQueryDto,
  ): Promise<AuditLogListResponseDto> {
    const auditLogs = await this.auditLogRepository.listForOrganization({
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
      organizationId,
    });

    return {
      ...auditLogs,
      items: auditLogs.items.map((auditLog) => ({
        ...auditLog,
        createdAt: toIsoDateTime(auditLog.createdAt),
        metadata: auditLog.metadata as Record<string, unknown>,
      })),
    };
  }

  private buildSettingsMetadata(
    before: OrganizationSettingsRow,
    after: OrganizationSettingsRow,
  ): Record<string, JsonValue> {
    const changes: Record<string, JsonValue> = {};

    if (before.name !== after.name) {
      changes.name = { after: after.name, before: before.name };
    }

    if (before.defaultProjectRole !== after.defaultProjectRole) {
      changes.defaultProjectRole = {
        after: after.defaultProjectRole,
        before: before.defaultProjectRole,
      };
    }

    if (before.allowMemberProjectCreate !== after.allowMemberProjectCreate) {
      changes.allowMemberProjectCreate = {
        after: after.allowMemberProjectCreate,
        before: before.allowMemberProjectCreate,
      };
    }

    return { changes };
  }

  private async assertCanChangeOwnerRole(organizationId: string, userId: string, nextRole: OrganizationRole) {
    const currentMember = await this.organizationRepository.getMember(organizationId, userId);
    if (!currentMember) {
      throw new NotFoundException('Workspace member not found');
    }

    if (currentMember.role === OrganizationRole.Owner && nextRole !== OrganizationRole.Owner) {
      const ownerCount = await this.organizationRepository.getOrganizationOwnerCount(organizationId);

      if (ownerCount <= 1) {
        throw new BadRequestException('Workspace must keep at least one owner');
      }
    }

    return currentMember;
  }

  private recordOrganizationAudit(
    auth: AuthContext,
    options: {
      action: AuditAction;
      entityId: string;
      entityType: string;
      metadata: Record<string, JsonValue>;
      organizationId: string;
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
      projectId: null,
      requestId: auth.request?.requestId ?? null,
      userAgent: auth.request?.userAgent ?? null,
    });
  }

  private serializeSettings(organization: OrganizationSettingsRow): OrganizationSettingsDto {
    return {
      allowMemberProjectCreate: organization.allowMemberProjectCreate,
      createdAt: toIsoDateTime(organization.createdAt),
      defaultProjectRole: this.toDefaultProjectRole(organization.defaultProjectRole),
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      updatedAt: toIsoDateTime(organization.updatedAt),
    };
  }

  private serializeOrganization(organization: OrganizationRow): OrganizationDto {
    return {
      allowMemberProjectCreate: organization.allowMemberProjectCreate,
      createdAt: toIsoDateTime(organization.createdAt),
      defaultProjectRole: this.toDefaultProjectRole(organization.defaultProjectRole),
      id: organization.id,
      name: organization.name,
      role: this.toOrganizationRole(organization.role),
      slug: organization.slug,
      status: organization.status,
      updatedAt: toIsoDateTime(organization.updatedAt),
    };
  }

  private serializeMember(member: OrganizationMemberRow): OrganizationMemberDto {
    return {
      avatarUrl: member.avatarUrl ?? null,
      cursorColor: member.cursorColor,
      createdAt: toIsoDateTime(member.createdAt),
      email: member.email,
      joinedAt: member.joinedAt ? toIsoDateTime(member.joinedAt) : null,
      name: member.name,
      role: this.toOrganizationRole(member.role),
      status: member.status,
      updatedAt: toIsoDateTime(member.updatedAt),
      userId: member.userId,
    };
  }

  private toDefaultProjectRole(
    role: string | null,
  ): ProjectRole.Commenter | ProjectRole.Editor | ProjectRole.Viewer | null {
    if (role === ProjectRole.Editor || role === ProjectRole.Commenter || role === ProjectRole.Viewer) {
      return role;
    }

    return null;
  }

  private toOrganizationRole(role: string): OrganizationRole {
    if (Object.values(OrganizationRole).includes(role as OrganizationRole)) {
      return role as OrganizationRole;
    }

    return OrganizationRole.Guest;
  }
}

type OrganizationRow = OrganizationSettingsRow & {
  role: string;
  status: string;
};

type OrganizationSettingsRow = {
  allowMemberProjectCreate: boolean;
  createdAt: Date | string;
  defaultProjectRole: string | null;
  id: string;
  name: string;
  slug: string;
  updatedAt: Date | string;
};

type OrganizationMemberRow = {
  avatarUrl?: string | null;
  cursorColor: string;
  createdAt: Date | string;
  email: string;
  joinedAt: Date | string | null;
  name: string;
  role: string;
  status: 'active' | 'pending' | 'suspended';
  updatedAt: Date | string;
  userId: string;
};
