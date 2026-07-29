import type { DiagramModel } from '@tabliodb/schema-core';
import type { Paginated, PaginationQuery } from '@tabliodb/shared';
import type { RequestOpts } from '@oazapfts/runtime';
import {
  createSnapshot as createSnapshotRequest,
  getDiagramSnapshots,
  type SnapshotCreateDto as GeneratedSnapshotCreateDto,
} from '../fetch-client.js';

export type SnapshotCreateDto = {
  diagramId: string;
  message?: string;
  snapshot: DiagramModel;
};

export type SnapshotResponseDto = {
  createdAt: string;
  diagramId: string;
  id: string;
  message: string | null;
  snapshot: DiagramModel;
  version: number;
};

export type SnapshotListResponseDto = Paginated<SnapshotResponseDto>;

export type SnapshotsResource = {
  create: (body: SnapshotCreateDto) => Promise<SnapshotResponseDto>;
  listByDiagram: (diagramId: string, query?: PaginationQuery) => Promise<SnapshotListResponseDto>;
};

export function createSnapshotsResource(opts?: RequestOpts): SnapshotsResource {
  return {
    create: (body: SnapshotCreateDto) =>
      // DiagramModelSchema di OpenAPI menghasilkan enum generated; facade tetap mengekspos tipe domain schema-core ke frontend.
      createSnapshotRequest(
        { snapshotCreateDto: body as GeneratedSnapshotCreateDto },
        opts,
      ) as Promise<SnapshotResponseDto>,
    listByDiagram: (diagramId: string, query: PaginationQuery = {}) =>
      getDiagramSnapshots({ diagramId, ...query }, opts) as Promise<SnapshotListResponseDto>,
  };
}
