import type { PaginationQuery } from '@tabliodb/shared';
import {
  getDiagramSnapshots,
  getSnapshotDiff,
  type SnapshotDiffResponseDtoOutput,
  type SnapshotListResponseDtoOutput,
} from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { snapshotsKeys } from './snapshot.keys';

type SnapshotsQueries = {
  diff: (
    fromSnapshotId: string | null,
    toSnapshotId: string | null,
  ) => AppQueryOptions<SnapshotDiffResponseDtoOutput, ReturnType<typeof snapshotsKeys.diff>>;
  listByDiagram: (
    diagramId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<SnapshotListResponseDtoOutput, ReturnType<typeof snapshotsKeys.listByDiagram>>;
};

export const snapshotsQueries: SnapshotsQueries = {
  diff: (fromSnapshotId: string | null, toSnapshotId: string | null) =>
    appQueryOptions({
      enabled: Boolean(fromSnapshotId && toSnapshotId),
      queryFn: () => getSnapshotDiff({ fromSnapshotId: fromSnapshotId ?? '', toSnapshotId: toSnapshotId ?? '' }),
      // Null id tetap dipetakan ke key stabil supaya hook bisa dibuat sebelum user memilih snapshot pembanding.
      queryKey: snapshotsKeys.diff(fromSnapshotId ?? 'missing-from-snapshot', toSnapshotId ?? 'missing-to-snapshot'),
    }),

  listByDiagram: (diagramId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(diagramId),
      queryFn: () => getDiagramSnapshots({ diagramId, ...query }),
      queryKey: snapshotsKeys.listByDiagram(diagramId, query),
    }),
};
