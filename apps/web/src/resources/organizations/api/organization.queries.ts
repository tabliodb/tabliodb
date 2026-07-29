import type { PaginationQuery } from '@tabliodb/shared';
import type { AuditLogListResponseDto, OrganizationListResponseDto, OrganizationSettingsDto } from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { organizationsKeys } from './organization.keys';

type OrganizationsQueries = {
  auditLogs: (
    organizationId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<AuditLogListResponseDto, ReturnType<typeof organizationsKeys.auditLogs>>;
  list: (
    query?: PaginationQuery,
  ) => AppQueryOptions<OrganizationListResponseDto, ReturnType<typeof organizationsKeys.list>>;
  settings: (
    organizationId: string,
  ) => AppQueryOptions<OrganizationSettingsDto, ReturnType<typeof organizationsKeys.settings>>;
};

export const organizationsQueries: OrganizationsQueries = {
  auditLogs: (organizationId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(organizationId),
      queryFn: () => sdk.organizations.getAuditLogs(organizationId, query),
      queryKey: organizationsKeys.auditLogs(organizationId, query),
    }),

  list: (query: PaginationQuery = {}) =>
    appQueryOptions({
      queryFn: () => sdk.organizations.list(query),
      queryKey: organizationsKeys.list(query),
    }),

  settings: (organizationId: string) =>
    appQueryOptions({
      enabled: Boolean(organizationId),
      queryFn: () => sdk.organizations.getSettings(organizationId),
      queryKey: organizationsKeys.settings(organizationId),
    }),
};
