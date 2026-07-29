import { queryOptions } from '@tanstack/react-query';
import type { DiagramModel } from '@tabliodb/schema-core';
import type { DiagramResponseDto, SnapshotResponseDto } from '@tabliodb/sdk';
import { sdk } from '@/services/sdk';
import { snapshotsKeys } from './snapshot.keys';

type InitialSnapshotFactory = (diagram: DiagramResponseDto) => DiagramModel;

export const snapshotsQueries = {
  listByDiagram: (diagramId: string) =>
    queryOptions({
      enabled: Boolean(diagramId),
      queryFn: () => sdk.snapshots.listByDiagram(diagramId),
      queryKey: snapshotsKeys.listByDiagram(diagramId),
    }),

  listOrCreateInitial: (diagram: DiagramResponseDto | null, createInitialSnapshot: InitialSnapshotFactory) =>
    queryOptions({
      enabled: Boolean(diagram?.id),
      queryFn: () => listOrCreateInitialSnapshots(diagram, createInitialSnapshot),
      queryKey: snapshotsKeys.listByDiagram(diagram?.id ?? 'missing-diagram'),
    }),
};

async function listOrCreateInitialSnapshots(
  diagram: DiagramResponseDto | null,
  createInitialSnapshot: InitialSnapshotFactory,
): Promise<SnapshotResponseDto[]> {
  if (!diagram) {
    return [];
  }

  const snapshots = await sdk.snapshots.listByDiagram(diagram.id);

  if (snapshots.length > 0) {
    return snapshots;
  }

  const snapshot = await sdk.snapshots.create({
    diagramId: diagram.id,
    message: 'Initial schema',
    snapshot: createInitialSnapshot(diagram),
  });

  return [snapshot];
}
