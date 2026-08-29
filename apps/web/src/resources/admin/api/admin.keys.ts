import type { PaginationQuery } from '@tabliodb/shared';

export type AdminAuditLogListQuery = PaginationQuery & {
  action?: string;
  organizationId?: string;
  search?: string;
};

export type AdminBackgroundJobListQuery = PaginationQuery & {
  queue?: string;
  search?: string;
  status?: 'completed' | 'dead' | 'failed' | 'queued' | 'running';
  type?: string;
};

export const adminKeys = {
  all: ['admin'] as const,
  auditLogsRoot: () => [...adminKeys.all, 'audit-logs'] as const,
  auditLogs: (query: AdminAuditLogListQuery = {}) => [...adminKeys.auditLogsRoot(), query] as const,
  backgroundJobsRoot: () => [...adminKeys.all, 'background-jobs'] as const,
  backgroundJobs: (query: AdminBackgroundJobListQuery = {}) => [...adminKeys.backgroundJobsRoot(), query] as const,
};
