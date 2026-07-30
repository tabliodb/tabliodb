import { getRelationshipColumnPairs, type DiagramModel } from '@tabliodb/schema-core';
import type { CommentTargetType, CommentThreadListItemDto } from '@tabliodb/sdk';

export type CommentMarkerCount = {
  open: number;
  total: number;
};

export type CommentMarkerSummary = {
  byColumnId: Map<string, CommentMarkerCount>;
  byRelationshipId: Map<string, CommentMarkerCount>;
  byTableId: Map<string, CommentMarkerCount>;
  byTargetKey: Map<string, CommentMarkerCount>;
  diagram: CommentMarkerCount;
};

export const emptyCommentMarkerCount: CommentMarkerCount = {
  open: 0,
  total: 0,
};

export function createCommentMarkerSummary(
  model: DiagramModel,
  threads: CommentThreadListItemDto[],
): CommentMarkerSummary {
  const summary: CommentMarkerSummary = {
    byColumnId: new Map(),
    byRelationshipId: new Map(),
    byTableId: new Map(),
    byTargetKey: new Map(),
    diagram: { ...emptyCommentMarkerCount },
  };

  for (const thread of threads) {
    if (thread.targetType === 'diagram') {
      incrementCount(summary.diagram, thread);
    }

    if (thread.targetId) {
      incrementMapCount(summary.byTargetKey, createCommentTargetKey(thread.targetType, thread.targetId), thread);
    }

    // Marker visual hanya menampilkan thread open supaya resolved discussion tidak memenuhi canvas.
    if (thread.status !== 'open') {
      continue;
    }

    addOpenThreadToRelatedEntities(summary, model, thread);
  }

  return summary;
}

export function createCommentTargetKey(targetType: CommentTargetType, targetId: string): string {
  return `${targetType}:${targetId}`;
}

export function getCommentMarkerCountForTarget(
  summary: CommentMarkerSummary,
  targetType: CommentTargetType,
  targetId: string | null | undefined,
): CommentMarkerCount {
  if (targetType === 'diagram') {
    return summary.diagram;
  }

  return targetId
    ? (summary.byTargetKey.get(createCommentTargetKey(targetType, targetId)) ?? emptyCommentMarkerCount)
    : emptyCommentMarkerCount;
}

export function getColumnCommentMarkerCount(summary: CommentMarkerSummary, columnId: string): CommentMarkerCount {
  return summary.byColumnId.get(columnId) ?? emptyCommentMarkerCount;
}

export function getRelationshipCommentMarkerCount(
  summary: CommentMarkerSummary,
  relationshipId: string,
): CommentMarkerCount {
  return summary.byRelationshipId.get(relationshipId) ?? emptyCommentMarkerCount;
}

export function getTableCommentMarkerCount(summary: CommentMarkerSummary, tableId: string): CommentMarkerCount {
  return summary.byTableId.get(tableId) ?? emptyCommentMarkerCount;
}

export function formatCommentMarkerCount(count: CommentMarkerCount): string {
  return count.open > 99 ? '99+' : String(count.open);
}

export function formatCommentMarkerTitle(count: CommentMarkerCount, label: string): string {
  const noun = count.open === 1 ? 'comment' : 'comments';

  return `${count.open} open ${noun} on ${label}`;
}

export function hasOpenCommentMarkers(count: CommentMarkerCount): boolean {
  return count.open > 0;
}

function addOpenThreadToRelatedEntities(
  summary: CommentMarkerSummary,
  model: DiagramModel,
  thread: CommentThreadListItemDto,
) {
  if (!thread.targetId) {
    return;
  }

  if (thread.targetType === 'table') {
    if (model.tables[thread.targetId]) {
      incrementMapCount(summary.byTableId, thread.targetId, thread);
    }

    return;
  }

  if (thread.targetType === 'column') {
    const column = model.columns[thread.targetId];

    if (column) {
      incrementMapCount(summary.byColumnId, column.id, thread);
      incrementMapCount(summary.byTableId, column.tableId, thread);
    }

    return;
  }

  if (thread.targetType === 'index') {
    const index = model.indexes[thread.targetId];

    if (index) {
      incrementMapCount(summary.byTableId, index.tableId, thread);
      // Composite index bisa berisi column yang sama dari hasil import aneh; Set mencegah satu thread menggandakan marker row.
      for (const columnId of new Set(index.columns.map((indexedColumn) => indexedColumn.columnId))) {
        incrementMapCount(summary.byColumnId, columnId, thread);
      }
    }

    return;
  }

  if (thread.targetType === 'check') {
    const check = model.checks[thread.targetId];

    if (check) {
      incrementMapCount(summary.byTableId, check.tableId, thread);

      if (check.columnId) {
        incrementMapCount(summary.byColumnId, check.columnId, thread);
      }
    }

    return;
  }

  if (thread.targetType === 'relationship') {
    const relationship = model.relationships[thread.targetId];

    if (relationship) {
      incrementMapCount(summary.byRelationshipId, relationship.id, thread);

      // Self-relation tetap hanya menaikkan satu marker table/column agar count mewakili jumlah thread, bukan jumlah endpoint.
      for (const tableId of new Set([relationship.sourceTableId, relationship.targetTableId])) {
        incrementMapCount(summary.byTableId, tableId, thread);
      }

      const columnIds = new Set(
        getRelationshipColumnPairs(relationship).flatMap((columnPair) => [
          columnPair.sourceColumnId,
          columnPair.targetColumnId,
        ]),
      );

      for (const columnId of columnIds) {
        incrementMapCount(summary.byColumnId, columnId, thread);
      }
    }
  }
}

function incrementMapCount(map: Map<string, CommentMarkerCount>, key: string, thread: CommentThreadListItemDto) {
  const count = map.get(key) ?? { ...emptyCommentMarkerCount };

  incrementCount(count, thread);
  map.set(key, count);
}

function incrementCount(count: CommentMarkerCount, thread: CommentThreadListItemDto) {
  count.total += 1;

  if (thread.status === 'open') {
    count.open += 1;
  }
}
