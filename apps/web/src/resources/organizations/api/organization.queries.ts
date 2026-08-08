import type { PaginationQuery } from '@tabliodb/shared';
import {
  getOrganizationAuditLogs,
  getOrganizationMembers,
  getOrganizationSettings,
  getOrganizations,
  type AuditLogListResponseDtoOutput,
  type OrganizationListResponseDtoOutput,
  type OrganizationMemberListResponseDtoOutput,
  type OrganizationSettingsDtoOutput,
} from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { organizationsKeys } from './organization.keys';

type OrganizationsQueries = {
  auditLogs: (
    organizationId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<AuditLogListResponseDtoOutput, ReturnType<typeof organizationsKeys.auditLogs>>;
  list: (
    query?: PaginationQuery,
  ) => AppQueryOptions<OrganizationListResponseDtoOutput, ReturnType<typeof organizationsKeys.list>>;
  members: (
    organizationId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<OrganizationMemberListResponseDtoOutput, ReturnType<typeof organizationsKeys.members>>;
  settings: (
    organizationId: string,
  ) => AppQueryOptions<OrganizationSettingsDtoOutput, ReturnType<typeof organizationsKeys.settings>>;
};

export const organizationsQueries: OrganizationsQueries = {
  auditLogs: (organizationId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(organizationId),
      queryFn: () => getOrganizationAuditLogs({ organizationId, ...query }),
      queryKey: organizationsKeys.auditLogs(organizationId, query),
    }),

  list: (query: PaginationQuery = {}) =>
    appQueryOptions({
      queryFn: () => getOrganizations(query),
      queryKey: organizationsKeys.list(query),
    }),

  members: (organizationId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(organizationId),
      queryFn: () => getOrganizationMembers({ organizationId, ...query }),
      queryKey: organizationsKeys.members(organizationId, query),
    }),

  settings: (organizationId: string) =>
    appQueryOptions({
      enabled: Boolean(organizationId),
      queryFn: () => getOrganizationSettings({ organizationId }),
      queryKey: organizationsKeys.settings(organizationId),
    }),
};
