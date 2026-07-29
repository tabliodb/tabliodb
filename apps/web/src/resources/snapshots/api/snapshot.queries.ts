import type { DiagramModel } from '@tabliodb/schema-core';
import { Permission, isGranted, permissionsForProjectRole, type PaginationQuery } from '@tabliodb/shared';
import type {
  DiagramResponseDto,
  ProjectResponseDto,
  SnapshotListResponseDto,
  SnapshotResponseDto,
} from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { snapshotsKeys } from './snapshot.keys';

type InitialSnapshotFactory = (diagram: DiagramResponseDto) => DiagramModel;

type SnapshotsQueries = {
  listByDiagram: (
    diagramId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<SnapshotListResponseDto, ReturnType<typeof snapshotsKeys.listByDiagram>>;
  listOrCreateInitial: (
    diagram: DiagramResponseDto | null,
    project: ProjectResponseDto | null,
    createInitialSnapshot: InitialSnapshotFactory,
  ) => AppQueryOptions<SnapshotResponseDto[], ReturnType<typeof snapshotsKeys.listByDiagram>>;
};

export const snapshotsQueries: SnapshotsQueries = {
  listByDiagram: (diagramId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(diagramId),
      queryFn: () => sdk.snapshots.listByDiagram(diagramId, query),
      queryKey: snapshotsKeys.listByDiagram(diagramId, query),
    }),

  listOrCreateInitial: (
    diagram: DiagramResponseDto | null,
    project: ProjectResponseDto | null,
    createInitialSnapshot: InitialSnapshotFactory,
  ) =>
    appQueryOptions({
      enabled: Boolean(diagram?.id),
      queryFn: () => listOrCreateInitialSnapshots(diagram, project, createInitialSnapshot),
      queryKey: snapshotsKeys.listByDiagram(diagram?.id ?? 'missing-diagram', { limit: 20 }),
    }),
};

async function listOrCreateInitialSnapshots(
  diagram: DiagramResponseDto | null,
  project: ProjectResponseDto | null,
  createInitialSnapshot: InitialSnapshotFactory,
): Promise<SnapshotResponseDto[]> {
  if (!diagram) {
    return [];
  }

  const snapshots = await sdk.snapshots.listByDiagram(diagram.id, { limit: 20 });

  if (snapshots.items.length > 0) {
    return snapshots.items;
  }

  if (
    !project ||
    !isGranted({ current: permissionsForProjectRole(project.projectRole), requested: [Permission.SnapshotCreate] })
  ) {
    // View-only access can read existing snapshot history but must not create the initial snapshot for an empty diagram.
    return [];
  }

  const snapshot = await sdk.snapshots.create({
    diagramId: diagram.id,
    message: 'Initial schema',
    snapshot: createInitialSnapshot(diagram),
  });

  return [snapshot];
}
