import type { PaginationQuery } from '@tabliodb/shared';

export type AdminWorkspaceListQuery = PaginationQuery & {
  search?: string;
};

export const organizationsKeys = {
  all: ['organizations'] as const,
  adminWorkspacesRoot: () => [...organizationsKeys.all, 'admin-workspaces'] as const,
  adminWorkspaces: (query: AdminWorkspaceListQuery = {}) =>
    [...organizationsKeys.adminWorkspacesRoot(), query] as const,
  lists: () => [...organizationsKeys.all, 'list'] as const,
  list: (query: PaginationQuery = {}) => [...organizationsKeys.lists(), query] as const,
  auditLogsRoot: (organizationId: string) => [...organizationsKeys.all, 'audit-logs', organizationId] as const,
  auditLogs: (organizationId: string, query: PaginationQuery = {}) =>
    [...organizationsKeys.auditLogsRoot(organizationId), query] as const,
  membersRoot: (organizationId: string) => [...organizationsKeys.all, 'members', organizationId] as const,
  members: (organizationId: string, query: PaginationQuery = {}) =>
    [...organizationsKeys.membersRoot(organizationId), query] as const,
  settingsRoot: (organizationId: string) => [...organizationsKeys.all, 'settings', organizationId] as const,
  settings: (organizationId: string) => [...organizationsKeys.settingsRoot(organizationId)] as const,
};
