import type { DiagramModel } from '@tabliodb/schema-core';
import type { Paginated, PaginationQuery } from '@tabliodb/shared';
import type { TabliodbClient } from '../fetch-client.js';

export type SnapshotCreateDto = {
  diagramId: string;
  message?: string;
  snapshot: DiagramModel;
};

export type SnapshotResponseDto = {
  id: string;
  diagramId: string;
  version: number;
  message: string | null;
  snapshot: DiagramModel;
  createdAt: string;
};

export type SnapshotListResponseDto = Paginated<SnapshotResponseDto>;

export function createSnapshotsResource(client: TabliodbClient) {
  return {
    create: (body: SnapshotCreateDto) => client.request<SnapshotResponseDto>('/snapshots', { body, method: 'POST' }),
    listByDiagram: (diagramId: string, query: PaginationQuery = {}) =>
      client.request<SnapshotListResponseDto>(`/snapshots/diagram/${diagramId}`, { query }),
  };
}
