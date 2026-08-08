import { getRelationshipColumnPairs, type DiagramModel } from '@tabliodb/schema-core';
import type { CommentTargetType, CommentThreadTargetSummaryDto } from '@/resources/comments';

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
  targetSummaries: CommentThreadTargetSummaryDto[],
): CommentMarkerSummary {
  const summary: CommentMarkerSummary = {
    byColumnId: new Map(),
    byRelationshipId: new Map(),
    byTableId: new Map(),
    byTargetKey: new Map(),
    diagram: { ...emptyCommentMarkerCount },
  };

  for (const targetSummary of targetSummaries) {
    if (targetSummary.targetType === 'diagram') {
      incrementCount(summary.diagram, targetSummary);
    }

    if (targetSummary.targetId) {
      incrementMapCount(
        summary.byTargetKey,
        createCommentTargetKey(targetSummary.targetType, targetSummary.targetId),
        targetSummary,
      );
    }

    // Marker visual hanya menampilkan thread open supaya resolved discussion tidak memenuhi canvas.
    if (targetSummary.openCount === 0) {
      continue;
    }

    addOpenTargetSummaryToRelatedEntities(summary, model, targetSummary);
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

function addOpenTargetSummaryToRelatedEntities(
  summary: CommentMarkerSummary,
  model: DiagramModel,
  targetSummary: CommentThreadTargetSummaryDto,
) {
  if (!targetSummary.targetId) {
    return;
  }

  const openOnlyCount = {
    openCount: targetSummary.openCount,
    totalCount: targetSummary.openCount,
  };

  if (targetSummary.targetType === 'table') {
    if (model.tables[targetSummary.targetId]) {
      incrementMapCount(summary.byTableId, targetSummary.targetId, openOnlyCount);
    }

    return;
  }

  if (targetSummary.targetType === 'column') {
    const column = model.columns[targetSummary.targetId];

    if (column) {
      incrementMapCount(summary.byColumnId, column.id, openOnlyCount);
      incrementMapCount(summary.byTableId, column.tableId, openOnlyCount);
    }

    return;
  }

  if (targetSummary.targetType === 'index') {
    const index = model.indexes[targetSummary.targetId];

    if (index) {
      incrementMapCount(summary.byTableId, index.tableId, openOnlyCount);
      // Composite index bisa berisi column yang sama dari hasil import aneh; Set mencegah satu thread menggandakan marker row.
      for (const columnId of new Set(index.columns.map((indexedColumn) => indexedColumn.columnId))) {
        incrementMapCount(summary.byColumnId, columnId, openOnlyCount);
      }
    }

    return;
  }

  if (targetSummary.targetType === 'check') {
    const check = model.checks[targetSummary.targetId];

    if (check) {
      incrementMapCount(summary.byTableId, check.tableId, openOnlyCount);

      if (check.columnId) {
        incrementMapCount(summary.byColumnId, check.columnId, openOnlyCount);
      }
    }

    return;
  }

  if (targetSummary.targetType === 'relationship') {
    const relationship = model.relationships[targetSummary.targetId];

    if (relationship) {
      incrementMapCount(summary.byRelationshipId, relationship.id, openOnlyCount);

      // Self-relation tetap hanya menaikkan satu marker table/column agar count mewakili jumlah thread, bukan jumlah endpoint.
      for (const tableId of new Set([relationship.sourceTableId, relationship.targetTableId])) {
        incrementMapCount(summary.byTableId, tableId, openOnlyCount);
      }

      const columnIds = new Set(
        getRelationshipColumnPairs(relationship).flatMap((columnPair) => [
          columnPair.sourceColumnId,
          columnPair.targetColumnId,
        ]),
      );

      for (const columnId of columnIds) {
        incrementMapCount(summary.byColumnId, columnId, openOnlyCount);
      }
    }
  }
}

function incrementMapCount(
  map: Map<string, CommentMarkerCount>,
  key: string,
  countSource: Pick<CommentThreadTargetSummaryDto, 'openCount' | 'totalCount'>,
) {
  const count = map.get(key) ?? { ...emptyCommentMarkerCount };

  incrementCount(count, countSource);
  map.set(key, count);
}

function incrementCount(
  count: CommentMarkerCount,
  countSource: Pick<CommentThreadTargetSummaryDto, 'openCount' | 'totalCount'>,
) {
  count.open += countSource.openCount;
  count.total += countSource.totalCount;
}
