import type { PaginationQuery } from '@tabliodb/shared';

export const snapshotsKeys = {
  all: ['snapshots'] as const,
  details: () => [...snapshotsKeys.all, 'detail'] as const,
  diff: (fromSnapshotId: string, toSnapshotId: string) =>
    [...snapshotsKeys.details(), 'diff', { fromSnapshotId, toSnapshotId }] as const,
  lists: () => [...snapshotsKeys.all, 'list'] as const,
  listByDiagram: (diagramId: string, query: PaginationQuery = {}) =>
    [...snapshotsKeys.lists(), { diagramId }, query] as const,
};
