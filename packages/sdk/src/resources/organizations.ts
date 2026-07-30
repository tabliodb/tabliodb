import type { OrganizationRole, Paginated, PaginationQuery, ProjectRole } from '@tabliodb/shared';
import type { RequestOpts } from '@oazapfts/runtime';
import type {
  OrganizationMemberUpdateDto as GeneratedOrganizationMemberUpdateDto,
  OrganizationSettingsUpdateDto as GeneratedOrganizationSettingsUpdateDto,
} from '../fetch-client.js';
import {
  getOrganizations,
  getOrganizationAuditLogs,
  getOrganizationMembers,
  getOrganizationSettings,
  removeOrganizationMember as removeOrganizationMemberRequest,
  updateOrganizationMember as updateOrganizationMemberRequest,
  updateOrganizationSettings as updateOrganizationSettingsRequest,
} from '../fetch-client.js';

export type OrganizationDto = {
  allowMemberProjectCreate: boolean;
  createdAt: string;
  defaultProjectRole: ProjectRole.Commenter | ProjectRole.Editor | ProjectRole.Viewer | null;
  id: string;
  name: string;
  role: OrganizationRole;
  slug: string;
  status: string;
  updatedAt: string;
};

export type OrganizationListResponseDto = Paginated<OrganizationDto>;

export type OrganizationMemberStatus = 'active' | 'pending' | 'suspended';

export type OrganizationMemberDto = {
  avatarUrl: string | null;
  cursorColor: string;
  createdAt: string;
  email: string;
  joinedAt: string | null;
  name: string;
  role: OrganizationRole;
  status: OrganizationMemberStatus;
  updatedAt: string;
  userId: string;
};

export type OrganizationMemberListResponseDto = Paginated<OrganizationMemberDto>;

export type OrganizationMemberUpdateDto = {
  role: OrganizationRole;
};

export type OrganizationMemberRemoveResponseDto = {
  successful: boolean;
};

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
  list: (query?: PaginationQuery) => Promise<OrganizationListResponseDto>;
  listMembers: (organizationId: string, query?: PaginationQuery) => Promise<OrganizationMemberListResponseDto>;
  removeMember: (organizationId: string, userId: string) => Promise<OrganizationMemberRemoveResponseDto>;
  updateMember: (
    organizationId: string,
    userId: string,
    body: OrganizationMemberUpdateDto,
  ) => Promise<OrganizationMemberDto>;
  updateSettings: (organizationId: string, body: OrganizationSettingsUpdateDto) => Promise<OrganizationSettingsDto>;
};

export function createOrganizationsResource(opts?: RequestOpts): OrganizationsResource {
  return {
    list: (query: PaginationQuery = {}) =>
      getOrganizations(query, opts) as unknown as Promise<OrganizationListResponseDto>,
    getAuditLogs: (organizationId: string, query: PaginationQuery = {}) =>
      getOrganizationAuditLogs({ organizationId, ...query }, opts) as unknown as Promise<AuditLogListResponseDto>,
    getSettings: (organizationId: string) =>
      getOrganizationSettings({ organizationId }, opts) as unknown as Promise<OrganizationSettingsDto>,
    listMembers: (organizationId: string, query: PaginationQuery = {}) =>
      getOrganizationMembers(
        { organizationId, ...query },
        opts,
      ) as unknown as Promise<OrganizationMemberListResponseDto>,
    updateMember: (organizationId: string, userId: string, body: OrganizationMemberUpdateDto) =>
      // Generated OpenAPI role enum stays private to the resource boundary; app code uses shared OrganizationRole.
      updateOrganizationMemberRequest(
        {
          organizationId,
          userId,
          organizationMemberUpdateDto: body as unknown as GeneratedOrganizationMemberUpdateDto,
        },
        opts,
      ) as unknown as Promise<OrganizationMemberDto>,
    removeMember: (organizationId: string, userId: string) =>
      removeOrganizationMemberRequest({ organizationId, userId }, opts) as Promise<OrganizationMemberRemoveResponseDto>,
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
