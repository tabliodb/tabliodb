import type { DiagramModel } from '@tabliodb/schema-core';
import { Permission, ProjectRole, isGranted, permissionsForProjectRole, type PaginationQuery } from '@tabliodb/shared';
import {
  createSnapshot,
  getDiagramSnapshots,
  getSnapshotDiff,
  type DiagramResponseDtoOutput,
  type ProjectResponseDtoOutput,
  type SnapshotCreateDto,
  type SnapshotDiffResponseDtoOutput,
  type SnapshotListResponseDtoOutput,
  type SnapshotResponseDtoOutput,
} from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { snapshotsKeys } from './snapshot.keys';

type InitialSnapshotFactory = (diagram: DiagramResponseDtoOutput) => DiagramModel;

type SnapshotsQueries = {
  diff: (
    fromSnapshotId: string | null,
    toSnapshotId: string | null,
  ) => AppQueryOptions<SnapshotDiffResponseDtoOutput, ReturnType<typeof snapshotsKeys.diff>>;
  listByDiagram: (
    diagramId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<SnapshotListResponseDtoOutput, ReturnType<typeof snapshotsKeys.listByDiagram>>;
  listOrCreateInitial: (
    diagram: DiagramResponseDtoOutput | null,
    project: ProjectResponseDtoOutput | null,
    createInitialSnapshot: InitialSnapshotFactory,
  ) => AppQueryOptions<SnapshotResponseDtoOutput[], ReturnType<typeof snapshotsKeys.listByDiagram>>;
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

  listOrCreateInitial: (
    diagram: DiagramResponseDtoOutput | null,
    project: ProjectResponseDtoOutput | null,
    createInitialSnapshot: InitialSnapshotFactory,
  ) =>
    appQueryOptions({
      enabled: Boolean(diagram?.id),
      queryFn: () => listOrCreateInitialSnapshots(diagram, project, createInitialSnapshot),
      queryKey: snapshotsKeys.listByDiagram(diagram?.id ?? 'missing-diagram', { limit: 20 }),
    }),
};

async function listOrCreateInitialSnapshots(
  diagram: DiagramResponseDtoOutput | null,
  project: ProjectResponseDtoOutput | null,
  createInitialSnapshot: InitialSnapshotFactory,
): Promise<SnapshotResponseDtoOutput[]> {
  if (!diagram) {
    return [];
  }

  const snapshots = await getDiagramSnapshots({ diagramId: diagram.id, limit: 20 });

  if (snapshots.items.length > 0) {
    return snapshots.items;
  }

  if (
    !project ||
    !isGranted({
      current: permissionsForProjectRole(project.projectRole as unknown as ProjectRole),
      requested: [Permission.SnapshotCreate],
    })
  ) {
    // View-only access can read existing snapshot history but must not create the initial snapshot for an empty diagram.
    return [];
  }

  const snapshot = await createSnapshot({
    snapshotCreateDto: {
      diagramId: diagram.id,
      message: 'Initial schema',
      snapshot: createInitialSnapshot(diagram) as unknown as SnapshotCreateDto['snapshot'],
    },
  });

  return [snapshot];
}
