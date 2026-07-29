import type { PaginationQuery } from '@tabliodb/shared';

export const organizationsKeys = {
  all: ['organizations'] as const,
  lists: () => [...organizationsKeys.all, 'list'] as const,
  list: (query: PaginationQuery = {}) => [...organizationsKeys.lists(), query] as const,
  auditLogsRoot: (organizationId: string) => [...organizationsKeys.all, 'audit-logs', organizationId] as const,
  auditLogs: (organizationId: string, query: PaginationQuery = {}) =>
    [...organizationsKeys.auditLogsRoot(organizationId), query] as const,
  settingsRoot: (organizationId: string) => [...organizationsKeys.all, 'settings', organizationId] as const,
  settings: (organizationId: string) => [...organizationsKeys.settingsRoot(organizationId)] as const,
};
