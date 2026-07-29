import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRole } from '@tabliodb/shared';
import { AuditAction } from '../constants.js';
import type { AuthContext } from '../database.js';
import { AuditLogListQueryDto, AuditLogListResponseDto } from '../dtos/audit-log.dto.js';
import { OrganizationSettingsDto, OrganizationSettingsUpdateDto } from '../dtos/organization.dto.js';
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

  private toDefaultProjectRole(
    role: string | null,
  ): ProjectRole.Commenter | ProjectRole.Editor | ProjectRole.Viewer | null {
    if (role === ProjectRole.Editor || role === ProjectRole.Commenter || role === ProjectRole.Viewer) {
      return role;
    }

    return null;
  }
}

type OrganizationSettingsRow = {
  allowMemberProjectCreate: boolean;
  createdAt: Date | string;
  defaultProjectRole: string | null;
  id: string;
  name: string;
  slug: string;
  updatedAt: Date | string;
};
