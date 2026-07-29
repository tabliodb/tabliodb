import type { Paginated, PaginationQuery, ProjectRole } from '@tabliodb/shared';
import type { RequestOpts } from '@oazapfts/runtime';
import type { OrganizationSettingsUpdateDto as GeneratedOrganizationSettingsUpdateDto } from '../fetch-client.js';
import {
  getOrganizationAuditLogs,
  getOrganizationSettings,
  updateOrganizationSettings as updateOrganizationSettingsRequest,
} from '../fetch-client.js';

export type OrganizationSettingsDto = {
  allowMemberProjectCreate: boolean;
  createdAt: string;
  defaultProjectRole: ProjectRole.Commenter | ProjectRole.Editor | ProjectRole.Viewer | null;
  id: string;
  name: string;
  slug: string;
  updatedAt: string;
};

export type OrganizationSettingsUpdateDto = {
  allowMemberProjectCreate?: boolean;
  defaultProjectRole?: ProjectRole.Commenter | ProjectRole.Editor | ProjectRole.Viewer | null;
  name?: string;
};

export type AuditLogDto = {
  action: string;
  actorEmail: string | null;
  actorId: string | null;
  actorName: string | null;
  createdAt: string;
  diagramId: string | null;
  entityId: string;
  entityType: string;
  id: string;
  ipAddress: string | null;
  metadata: Record<string, unknown>;
  organizationId: string | null;
  projectId: string | null;
  requestId: string | null;
  userAgent: string | null;
};

export type AuditLogListResponseDto = Paginated<AuditLogDto>;

export type OrganizationsResource = {
  getAuditLogs: (organizationId: string, query?: PaginationQuery) => Promise<AuditLogListResponseDto>;
  getSettings: (organizationId: string) => Promise<OrganizationSettingsDto>;
  updateSettings: (organizationId: string, body: OrganizationSettingsUpdateDto) => Promise<OrganizationSettingsDto>;
};

export function createOrganizationsResource(opts?: RequestOpts): OrganizationsResource {
  return {
    getAuditLogs: (organizationId: string, query: PaginationQuery = {}) =>
      getOrganizationAuditLogs({ organizationId, ...query }, opts) as unknown as Promise<AuditLogListResponseDto>,
    getSettings: (organizationId: string) =>
      getOrganizationSettings({ organizationId }, opts) as unknown as Promise<OrganizationSettingsDto>,
    updateSettings: (organizationId: string, body: OrganizationSettingsUpdateDto) =>
      // Shared ProjectRole remains the app-facing enum; generated OpenAPI enum stays private to this boundary.
      updateOrganizationSettingsRequest(
        {
          organizationId,
          organizationSettingsUpdateDto: body as unknown as GeneratedOrganizationSettingsUpdateDto,
        },
        opts,
      ) as unknown as Promise<OrganizationSettingsDto>,
  };
}
