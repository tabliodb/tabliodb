import type { DiagramModel } from '@tabliodb/schema-core';
import type { Paginated, PaginationQuery } from '@tabliodb/shared';
import type { RequestOpts } from '@oazapfts/runtime';
import {
  createSnapshot as createSnapshotRequest,
  getDiagramSnapshots,
  getSnapshotDiff,
  restoreSnapshot,
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
  restoredFromSnapshotId: string | null;
  snapshot: DiagramModel;
  version: number;
};

export type SnapshotListResponseDto = Paginated<SnapshotResponseDto>;

export type SnapshotReferenceDto = Omit<SnapshotResponseDto, 'snapshot'>;

export type SnapshotEntityChangeSummaryDto = {
  added: number;
  changed: number;
  removed: number;
};

export type SnapshotTableChangeSummaryDto = SnapshotEntityChangeSummaryDto & {
  renamed: Array<{
    fromName: string;
    id: string;
    toName: string;
  }>;
};

export type SnapshotDiffResponseDto = {
  checks: SnapshotEntityChangeSummaryDto;
  columns: SnapshotEntityChangeSummaryDto;
  dialectChanged: boolean;
  enums: SnapshotEntityChangeSummaryDto;
  fromSnapshot: SnapshotReferenceDto;
  groups: SnapshotEntityChangeSummaryDto;
  indexes: SnapshotEntityChangeSummaryDto;
  metadataChanged: boolean;
  notes: SnapshotEntityChangeSummaryDto;
  relationships: SnapshotEntityChangeSummaryDto;
  schemaVersionChanged: boolean;
  tables: SnapshotTableChangeSummaryDto;
  toSnapshot: SnapshotReferenceDto;
};

export type SnapshotsResource = {
  create: (body: SnapshotCreateDto) => Promise<SnapshotResponseDto>;
  diff: (fromSnapshotId: string, toSnapshotId: string) => Promise<SnapshotDiffResponseDto>;
  listByDiagram: (diagramId: string, query?: PaginationQuery) => Promise<SnapshotListResponseDto>;
  restore: (snapshotId: string) => Promise<SnapshotResponseDto>;
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
    diff: (fromSnapshotId: string, toSnapshotId: string) =>
      getSnapshotDiff({ fromSnapshotId, toSnapshotId }, opts) as Promise<SnapshotDiffResponseDto>,
    restore: (snapshotId: string) => restoreSnapshot({ snapshotId }, opts) as Promise<SnapshotResponseDto>,
  };
}
