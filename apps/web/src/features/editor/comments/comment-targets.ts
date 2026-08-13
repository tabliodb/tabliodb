import { getRelationshipColumnPairs, type DiagramModel } from '@tabliodb/schema-core';
import type { CommentThreadListItemDto, CommentTargetType } from '@/resources/comments';
import type { CommentTargetReference, EditorCommentTarget } from './types';

export function getActiveCommentTarget(
  model: DiagramModel,
  selectedTableId: string | null,
  selectedCommentTarget: EditorCommentTarget | null,
): { detail: string; label: string; targetId: string | null; targetType: CommentTargetType } {
  if (selectedCommentTarget && isCommentTargetAvailable(model, selectedCommentTarget)) {
    const targetLabel = getCommentTargetName(model, selectedCommentTarget);

    return {
      detail: formatCommentTargetType(selectedCommentTarget.targetType),
      label: targetLabel ?? selectedCommentTarget.targetId ?? model.metadata.name,
      targetId: selectedCommentTarget.targetId,
      targetType: selectedCommentTarget.targetType,
    };
  }

  const selectedTable = selectedTableId ? (model.tables[selectedTableId] ?? null) : null;

  if (selectedTable) {
    return {
      detail: 'Selected table',
      label: selectedTable.name,
      targetId: selectedTable.id,
      targetType: 'table',
    };
  }

  return {
    detail: 'Diagram',
    label: model.metadata.name,
    targetId: null,
    targetType: 'diagram',
  };
}

export function getCommentTargetName(
  model: DiagramModel,
  target: Pick<CommentThreadListItemDto, 'targetId' | 'targetType'>,
): string | null {
  if (target.targetType === 'diagram') {
    return model.metadata.name;
  }

  if (!target.targetId) {
    return null;
  }

  if (target.targetType === 'table') {
    return model.tables[target.targetId]?.name ?? null;
  }

  if (target.targetType === 'column') {
    const column = model.columns[target.targetId];
    const table = column ? model.tables[column.tableId] : null;

    return column ? `${table?.name ?? 'table'}.${column.name}` : null;
  }

  if (target.targetType === 'relationship') {
    return model.relationships[target.targetId]?.name ?? null;
  }

  if (target.targetType === 'index') {
    return model.indexes[target.targetId]?.name ?? null;
  }

  if (target.targetType === 'check') {
    return model.checks[target.targetId]?.name ?? null;
  }

  if (target.targetType === 'enum') {
    return model.enums[target.targetId]?.name ?? null;
  }

  if (target.targetType === 'note') {
    return model.notes[target.targetId]?.text.slice(0, 32) ?? null;
  }

  if (target.targetType === 'group') {
    return model.groups[target.targetId]?.name ?? null;
  }

  return null;
}

export function getCommentThreadTargetLabel(model: DiagramModel, thread: CommentThreadListItemDto): string {
  if (thread.targetType === 'diagram') {
    return `Diagram: ${model.metadata.name}`;
  }

  if (!thread.targetId) {
    return formatCommentTargetType(thread.targetType);
  }

  const targetName = getCommentTargetName(model, thread);

  return `${formatCommentTargetType(thread.targetType)}: ${targetName ?? thread.targetId}`;
}

export function findCommentThreadForTarget(
  model: DiagramModel,
  threads: CommentThreadListItemDto[],
  target: CommentTargetReference,
): CommentThreadListItemDto | null {
  const openExactThread = threads.find((thread) => thread.status === 'open' && isExactCommentTarget(thread, target));

  if (openExactThread) {
    return openExactThread;
  }

  const exactThread = threads.find((thread) => isExactCommentTarget(thread, target));

  if (exactThread) {
    return exactThread;
  }

  // Canvas marker count is intentionally aggregated, so table/column badges can represent related index/check/relationship threads.
  return (
    threads.find((thread) => thread.status === 'open' && isCommentThreadRelatedToTarget(model, thread, target)) ??
    threads.find((thread) => isCommentThreadRelatedToTarget(model, thread, target)) ??
    null
  );
}

export function focusCommentTarget(
  model: DiagramModel,
  thread: CommentThreadListItemDto,
  onFocusTable: (tableId: string | null) => void,
) {
  const tableId = getCommentTargetTableId(model, thread);

  if (tableId) {
    onFocusTable(tableId);
  }
}

export function isCommentTargetAvailable(
  model: DiagramModel,
  target: Pick<CommentThreadListItemDto, 'targetId' | 'targetType'>,
) {
  if (target.targetType === 'diagram') {
    return true;
  }

  if (!target.targetId) {
    return false;
  }

  // Availability memakai map normalized dari schema-core agar komentar detail ikut gugur saat entity dihapus/import ulang.
  switch (target.targetType) {
    case 'check':
      return Boolean(model.checks[target.targetId]);
    case 'column':
      return Boolean(model.columns[target.targetId]);
    case 'enum':
      return Boolean(model.enums[target.targetId]);
    case 'group':
      return Boolean(model.groups[target.targetId]);
    case 'index':
      return Boolean(model.indexes[target.targetId]);
    case 'note':
      return Boolean(model.notes[target.targetId]);
    case 'relationship':
      return Boolean(model.relationships[target.targetId]);
    case 'table':
      return Boolean(model.tables[target.targetId]);
    default:
      return false;
  }
}

function isExactCommentTarget(thread: CommentThreadListItemDto, target: CommentTargetReference): boolean {
  return thread.targetType === target.targetType && (thread.targetId ?? null) === (target.targetId ?? null);
}

function isCommentThreadRelatedToTarget(
  model: DiagramModel,
  thread: CommentThreadListItemDto,
  target: CommentTargetReference,
): boolean {
  if (isExactCommentTarget(thread, target)) {
    return true;
  }

  if (!target.targetId || !thread.targetId) {
    return false;
  }

  if (target.targetType === 'table') {
    return getCommentTargetTableId(model, thread) === target.targetId;
  }

  if (target.targetType === 'column') {
    return isCommentThreadRelatedToColumn(model, thread, target.targetId);
  }

  return false;
}

function isCommentThreadRelatedToColumn(
  model: DiagramModel,
  thread: CommentThreadListItemDto,
  columnId: string,
): boolean {
  if (!thread.targetId) {
    return false;
  }

  if (thread.targetType === 'column') {
    return thread.targetId === columnId;
  }

  if (thread.targetType === 'index') {
    return model.indexes[thread.targetId]?.columns.some((column) => column.columnId === columnId) ?? false;
  }

  if (thread.targetType === 'check') {
    return model.checks[thread.targetId]?.columnId === columnId;
  }

  if (thread.targetType === 'relationship') {
    const relationship = model.relationships[thread.targetId];

    return relationship
      ? getRelationshipColumnPairs(relationship).some(
          (columnPair) => columnPair.sourceColumnId === columnId || columnPair.targetColumnId === columnId,
        )
      : false;
  }

  return false;
}

export function getCommentTargetTableId(model: DiagramModel, target: CommentTargetReference): string | null {
  if (!target.targetId) {
    return null;
  }

  if (target.targetType === 'table') {
    return model.tables[target.targetId] ? target.targetId : null;
  }

  if (target.targetType === 'column') {
    return model.columns[target.targetId]?.tableId ?? null;
  }

  if (target.targetType === 'index') {
    return model.indexes[target.targetId]?.tableId ?? null;
  }

  if (target.targetType === 'check') {
    return model.checks[target.targetId]?.tableId ?? null;
  }

  if (target.targetType === 'relationship') {
    return model.relationships[target.targetId]?.sourceTableId ?? null;
  }

  return null;
}

export function formatCommentTargetType(targetType: CommentTargetType): string {
  return targetType
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
