import {
  getAdminAuditLogs,
  getAdminBackgroundJobs,
  type AdminBackgroundJobListResponseDtoOutput,
  type AuditLogListResponseDtoOutput,
} from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { adminKeys, type AdminAuditLogListQuery, type AdminBackgroundJobListQuery } from './admin.keys';

type AdminQueries = {
  auditLogs: (
    query?: AdminAuditLogListQuery,
  ) => AppQueryOptions<AuditLogListResponseDtoOutput, ReturnType<typeof adminKeys.auditLogs>>;
  backgroundJobs: (
    query?: AdminBackgroundJobListQuery,
  ) => AppQueryOptions<AdminBackgroundJobListResponseDtoOutput, ReturnType<typeof adminKeys.backgroundJobs>>;
};

export const adminQueries: AdminQueries = {
  auditLogs: (query: AdminAuditLogListQuery = {}) =>
    appQueryOptions({
      queryFn: () => getAdminAuditLogs(query),
      queryKey: adminKeys.auditLogs(query),
    }),

  backgroundJobs: (query: AdminBackgroundJobListQuery = {}) =>
    appQueryOptions({
      queryFn: () =>
        getAdminBackgroundJobs({
          ...query,
          // The generated client exposes the query parameter named "type" as "$type"; resource callers keep the domain term.
          $type: query.type,
        }),
      queryKey: adminKeys.backgroundJobs(query),
    }),
};
