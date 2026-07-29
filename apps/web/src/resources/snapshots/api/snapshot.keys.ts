import type { PaginationQuery } from '@tabliodb/shared';

export const snapshotsKeys = {
  all: ['snapshots'] as const,
  lists: () => [...snapshotsKeys.all, 'list'] as const,
  listByDiagram: (diagramId: string, query: PaginationQuery = {}) =>
    [...snapshotsKeys.lists(), { diagramId }, query] as const,
};
