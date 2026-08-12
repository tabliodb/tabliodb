import {
  applyDiagramCommand,
  createDiagramEntityId,
  createStarterDiagramModel,
  getTableColumns,
  normalizeDiagramModel,
  type ColumnTypeSpec,
  type CreateTableColumnInput,
  type DatabaseColumn,
  type DatabaseIndex,
  type DatabaseRelationship,
  type DatabaseTable,
  type DiagramModel,
  type DiagramNote,
} from '@tabliodb/schema-core';

export type RealtimeColumnPatch = {
  changes: Partial<DatabaseColumn>;
  clearedKeys: Array<keyof DatabaseColumn>;
  columnId: string;
  metadataUpdatedAt?: string;
};

export type RealtimeColumnStructuralPatch = {
  action: 'create' | 'delete' | 'reorder';
  checksToDelete: string[];
  column?: DatabaseColumn;
  columnId: string;
  indexesToDelete: string[];
  indexesToUpsert: DatabaseIndex[];
  metadataUpdatedAt?: string;
  relationshipsToDelete: string[];
  tableId: string;
  tablePatch: Pick<DatabaseTable, 'columnIds' | 'indexIds'>;
};

export type RealtimeTablePatch = {
  clearColor?: boolean;
  color?: string;
  tableId: string;
  metadataUpdatedAt?: string;
  name?: string;
  position?: { x: number; y: number };
  width?: number;
};

export type RealtimeRelationshipPatch =
  | {
      action: 'create';
      metadataUpdatedAt?: string;
      relationship: DatabaseRelationship;
      relationshipId: string;
    }
  | {
      action: 'delete';
      metadataUpdatedAt?: string;
      relationshipId: string;
    }
  | {
      action: 'update';
      changes: Partial<DatabaseRelationship>;
      clearedKeys: Array<keyof DatabaseRelationship>;
      metadataUpdatedAt?: string;
      relationshipId: string;
    };

export type RealtimeNotePatch =
  | {
      action: 'create';
      metadataUpdatedAt?: string;
      note: DiagramNote;
      noteId: string;
    }
  | {
      action: 'delete';
      metadataUpdatedAt?: string;
      noteId: string;
    }
  | {
      action: 'update';
      changes: Partial<DiagramNote>;
      clearedKeys: Array<keyof DiagramNote>;
      metadataUpdatedAt?: string;
      noteId: string;
    };

export function formatColumnType(type: ColumnTypeSpec): string {
  if (type.raw) {
    return type.raw;
  }

  if (type.length) {
    return `${type.family}(${type.length})`;
  }

  if (type.precision && type.scale !== undefined) {
    return `${type.family}(${type.precision}, ${type.scale})`;
  }

  return type.family;
}

export function createSeedDiagramModel(name = 'Library System'): DiagramModel {
  // Frontend initial snapshots and server dev seed now share the same canonical starter diagram from schema-core.
  return createStarterDiagramModel(name);
}

export function addTableToDiagramModel(
  model: DiagramModel,
  tableName?: string,
  position?: { x: number; y: number },
): DiagramModel {
  const nextIndex = Object.keys(model.tables).length + 1;
  const normalizedName = normalizeTableName(tableName) || `new_table_${nextIndex}`;

  return applyDiagramCommand(model, {
    type: 'table.create',
    name: normalizedName,
    // Canvas actions can pass the current viewport center; fallback keeps non-canvas callers deterministic.
    position: position ?? { x: 160 + nextIndex * 36, y: 120 + nextIndex * 28 },
    width: 288,
    color: '#1cb0f6',
    columns: createEditorDefaultTableColumns(),
  });
}

export function createSnapshotSaveModel(
  requestedModel: DiagramModel | null,
  latestModel: DiagramModel | null,
  recoveryModel: DiagramModel | null = null,
): DiagramModel | null {
  const requestedSafeModel = requestedModel ? normalizeEditorDiagramModel(requestedModel) : null;
  const latestSafeModel = latestModel ? normalizeEditorDiagramModel(latestModel) : null;
  const recoverySafeModel = recoveryModel ? normalizeEditorDiagramModel(recoveryModel) : null;
  let modelToSave = latestSafeModel ?? requestedSafeModel ?? recoverySafeModel;

  if (!modelToSave) {
    return null;
  }

  if (requestedSafeModel) {
    modelToSave = preserveRequestedDraftColumns(requestedSafeModel, modelToSave);
  }

  if (recoverySafeModel) {
    // The recovery model is the last local draft the user actually produced, so it protects snapshot payloads from stale realtime echoes that erase a new table's columnIds.
    modelToSave = preserveRequestedDraftColumns(recoverySafeModel, modelToSave);
  }

  return modelToSave;
}

export function normalizeEditorDiagramModel(model: DiagramModel): DiagramModel {
  // Editor-specific name is kept for call-site readability, but the canonical repair rules live in schema-core so server, realtime, and web persist the same shape.
  return normalizeDiagramModel(model);
}

export function shouldKeepLocalDiagramModelOverRealtime(
  localModel: DiagramModel | null,
  realtimeModel: DiagramModel,
): boolean {
  if (!localModel) {
    return false;
  }

  const localUpdatedAt = getDiagramModelUpdatedAtTime(localModel);
  const realtimeUpdatedAt = getDiagramModelUpdatedAtTime(realtimeModel);

  if (localUpdatedAt !== null && realtimeUpdatedAt !== null) {
    if (localUpdatedAt > realtimeUpdatedAt) {
      return true;
    }

    if (realtimeUpdatedAt > localUpdatedAt) {
      return false;
    }
  }

  // Development Yjs documents can lag behind a repaired local draft; never downgrade a real table into an empty shell or remove a table the user just created.
  return hasRealtimeModelLostLocalTables(localModel, realtimeModel) || hasRealtimeModelLostLocalColumns(localModel, realtimeModel);
}

export function createRealtimeTablePatch(
  previousModel: DiagramModel | null,
  nextModel: DiagramModel,
): RealtimeTablePatch | null {
  if (!previousModel) {
    return null;
  }

  if (
    previousModel.schemaVersion !== nextModel.schemaVersion ||
    previousModel.dialect !== nextModel.dialect ||
    !areJsonValuesEqual(previousModel.columns, nextModel.columns) ||
    !areJsonValuesEqual(previousModel.indexes, nextModel.indexes) ||
    !areJsonValuesEqual(previousModel.relationships, nextModel.relationships) ||
    !areJsonValuesEqual(previousModel.enums, nextModel.enums) ||
    !areJsonValuesEqual(previousModel.checks, nextModel.checks) ||
    !areJsonValuesEqual(previousModel.notes, nextModel.notes) ||
    !areJsonValuesEqual(previousModel.groups, nextModel.groups) ||
    !areMetadataEqualExceptUpdatedAt(previousModel.metadata, nextModel.metadata)
  ) {
    return null;
  }

  const changedTableIds = Array.from(new Set([...Object.keys(previousModel.tables), ...Object.keys(nextModel.tables)]))
    .filter((tableId) => !areJsonValuesEqual(previousModel.tables[tableId], nextModel.tables[tableId]));

  if (changedTableIds.length !== 1) {
    return null;
  }

  const tableId = changedTableIds[0];
  const previousTable = previousModel.tables[tableId];
  const nextTable = nextModel.tables[tableId];

  if (!previousTable || !nextTable) {
    return null;
  }

  const {
    color: previousColor,
    name: previousName,
    position: previousPosition,
    width: previousWidth,
    ...previousStableTable
  } = previousTable;
  const { color: nextColor, name: nextName, position: nextPosition, width: nextWidth, ...nextStableTable } = nextTable;

  if (!areJsonValuesEqual(previousStableTable, nextStableTable)) {
    return null;
  }

  const patch: RealtimeTablePatch = {
    tableId,
  };

  if (previousName !== nextName) {
    patch.name = nextName;
  }

  if (previousColor !== nextColor) {
    if (nextColor) {
      patch.color = nextColor;
    } else {
      patch.clearColor = true;
    }
  }

  if (!areJsonValuesEqual(previousPosition, nextPosition)) {
    patch.position = nextPosition;
  }

  if (previousWidth !== nextWidth) {
    patch.width = nextWidth;
  }

  if (!patch.clearColor && patch.color === undefined && patch.name === undefined && !patch.position && patch.width === undefined) {
    return null;
  }

  if (previousModel.metadata.updatedAt !== nextModel.metadata.updatedAt && nextModel.metadata.updatedAt) {
    patch.metadataUpdatedAt = nextModel.metadata.updatedAt;
  }

  return patch;
}

export function createRealtimeColumnPatch(
  previousModel: DiagramModel | null,
  nextModel: DiagramModel,
): RealtimeColumnPatch | null {
  if (!previousModel) {
    return null;
  }

  if (
    previousModel.schemaVersion !== nextModel.schemaVersion ||
    previousModel.dialect !== nextModel.dialect ||
    !areJsonValuesEqual(previousModel.tables, nextModel.tables) ||
    !areJsonValuesEqual(previousModel.indexes, nextModel.indexes) ||
    !areJsonValuesEqual(previousModel.relationships, nextModel.relationships) ||
    !areJsonValuesEqual(previousModel.enums, nextModel.enums) ||
    !areJsonValuesEqual(previousModel.checks, nextModel.checks) ||
    !areJsonValuesEqual(previousModel.notes, nextModel.notes) ||
    !areJsonValuesEqual(previousModel.groups, nextModel.groups) ||
    !areMetadataEqualExceptUpdatedAt(previousModel.metadata, nextModel.metadata)
  ) {
    return null;
  }

  const changedColumnIds = Array.from(new Set([...Object.keys(previousModel.columns), ...Object.keys(nextModel.columns)]))
    .filter((columnId) => !areJsonValuesEqual(previousModel.columns[columnId], nextModel.columns[columnId]));

  if (changedColumnIds.length !== 1) {
    return null;
  }

  const columnId = changedColumnIds[0];
  const previousColumn = previousModel.columns[columnId];
  const nextColumn = nextModel.columns[columnId];

  if (!previousColumn || !nextColumn) {
    return null;
  }

  const changes: Partial<DatabaseColumn> = {};
  const clearedKeys: Array<keyof DatabaseColumn> = [];
  const columnKeys = Array.from(
    new Set([...Object.keys(previousColumn), ...Object.keys(nextColumn)]),
  ) as Array<keyof DatabaseColumn>;

  for (const key of columnKeys) {
    const previousValue = previousColumn[key];
    const nextValue = nextColumn[key];

    if (areJsonValuesEqual(previousValue, nextValue)) {
      continue;
    }

    if (key === 'id' || key === 'tableId') {
      return null;
    }

    if (nextValue === undefined) {
      clearedKeys.push(key);
      continue;
    }

    // Column patch sengaja hanya membawa field yang berubah agar concurrent edit pada field lain tidak ikut tertimpa.
    (changes as Record<string, unknown>)[key] = nextValue;
  }

  if (Object.keys(changes).length === 0 && clearedKeys.length === 0) {
    return null;
  }

  return {
    changes,
    clearedKeys,
    columnId,
    metadataUpdatedAt:
      previousModel.metadata.updatedAt !== nextModel.metadata.updatedAt ? nextModel.metadata.updatedAt : undefined,
  };
}

export function createRealtimeColumnStructuralPatch(
  previousModel: DiagramModel | null,
  nextModel: DiagramModel,
): RealtimeColumnStructuralPatch | null {
  if (!previousModel) {
    return null;
  }

  if (
    previousModel.schemaVersion !== nextModel.schemaVersion ||
    previousModel.dialect !== nextModel.dialect ||
    !areJsonValuesEqual(previousModel.enums, nextModel.enums) ||
    !areJsonValuesEqual(previousModel.notes, nextModel.notes) ||
    !areJsonValuesEqual(previousModel.groups, nextModel.groups) ||
    !areMetadataEqualExceptUpdatedAt(previousModel.metadata, nextModel.metadata)
  ) {
    return null;
  }

  const changedTableIds = findChangedRecordKeys(previousModel.tables, nextModel.tables);

  if (changedTableIds.length !== 1) {
    return null;
  }

  const tableId = changedTableIds[0];
  const previousTable = previousModel.tables[tableId];
  const nextTable = nextModel.tables[tableId];

  if (!previousTable || !nextTable || !isSameTableExceptColumnAndIndexOrder(previousTable, nextTable)) {
    return null;
  }

  const changedColumnIds = findChangedRecordKeys(previousModel.columns, nextModel.columns);
  const addedColumnIds = changedColumnIds.filter((columnId) => !previousModel.columns[columnId] && nextModel.columns[columnId]);
  const deletedColumnIds = changedColumnIds.filter(
    (columnId) => previousModel.columns[columnId] && !nextModel.columns[columnId],
  );
  const changedExistingColumnIds = changedColumnIds.filter(
    (columnId) => previousModel.columns[columnId] && nextModel.columns[columnId],
  );
  const changedIndexIds = findChangedRecordKeys(previousModel.indexes, nextModel.indexes);
  const changedRelationshipIds = findChangedRecordKeys(previousModel.relationships, nextModel.relationships);
  const changedCheckIds = findChangedRecordKeys(previousModel.checks, nextModel.checks);
  const metadataUpdatedAt =
    previousModel.metadata.updatedAt !== nextModel.metadata.updatedAt ? nextModel.metadata.updatedAt : undefined;
  const reorderedColumnId = findReorderedColumnId(previousTable.columnIds, nextTable.columnIds);

  if (
    changedColumnIds.length === 0 &&
    changedIndexIds.length === 0 &&
    changedRelationshipIds.length === 0 &&
    changedCheckIds.length === 0 &&
    areStringArraysEqual(previousTable.indexIds, nextTable.indexIds) &&
    reorderedColumnId &&
    !areStringArraysEqual(previousTable.columnIds, nextTable.columnIds)
  ) {
    return {
      action: 'reorder',
      checksToDelete: [],
      columnId: reorderedColumnId,
      indexesToDelete: [],
      indexesToUpsert: [],
      metadataUpdatedAt,
      relationshipsToDelete: [],
      tableId,
      tablePatch: {
        columnIds: nextTable.columnIds,
        indexIds: nextTable.indexIds,
      },
    };
  }

  if (
    addedColumnIds.length === 1 &&
    deletedColumnIds.length === 0 &&
    changedExistingColumnIds.length === 0 &&
    changedIndexIds.length === 0 &&
    changedRelationshipIds.length === 0 &&
    changedCheckIds.length === 0 &&
    areStringArraysEqual(previousTable.indexIds, nextTable.indexIds)
  ) {
    const columnId = addedColumnIds[0];
    const column = nextModel.columns[columnId];

    if (!column || column.tableId !== tableId || !nextTable.columnIds.includes(columnId)) {
      return null;
    }

    return {
      action: 'create',
      checksToDelete: [],
      column,
      columnId,
      indexesToDelete: [],
      indexesToUpsert: [],
      metadataUpdatedAt,
      relationshipsToDelete: [],
      tableId,
      tablePatch: {
        columnIds: nextTable.columnIds,
        indexIds: nextTable.indexIds,
      },
    };
  }

  if (deletedColumnIds.length !== 1 || addedColumnIds.length > 0 || changedExistingColumnIds.length > 0) {
    return null;
  }

  const columnId = deletedColumnIds[0];
  const previousColumn = previousModel.columns[columnId];

  if (!previousColumn || previousColumn.tableId !== tableId || nextModel.columns[columnId]) {
    return null;
  }

  const indexesToDelete = changedIndexIds.filter((indexId) => previousModel.indexes[indexId] && !nextModel.indexes[indexId]);
  const indexesToUpsert = changedIndexIds.flatMap((indexId) => {
    const nextIndex = nextModel.indexes[indexId];

    return nextIndex ? [nextIndex] : [];
  });
  const relationshipsToDelete = changedRelationshipIds.filter(
    (relationshipId) => previousModel.relationships[relationshipId] && !nextModel.relationships[relationshipId],
  );
  const checksToDelete = changedCheckIds.filter((checkId) => previousModel.checks[checkId] && !nextModel.checks[checkId]);

  if (
    indexesToDelete.length + indexesToUpsert.length !== changedIndexIds.length ||
    relationshipsToDelete.length !== changedRelationshipIds.length ||
    checksToDelete.length !== changedCheckIds.length ||
    !areDeletedColumnIndexChangesValid(columnId, indexesToUpsert) ||
    !areDeletedColumnRelationshipRemovalsValid(columnId, previousModel, relationshipsToDelete) ||
    !areDeletedColumnCheckRemovalsValid(columnId, previousModel, checksToDelete)
  ) {
    return null;
  }

  return {
    action: 'delete',
    checksToDelete,
    columnId,
    indexesToDelete,
    indexesToUpsert,
    metadataUpdatedAt,
    relationshipsToDelete,
    tableId,
    tablePatch: {
      columnIds: nextTable.columnIds,
      indexIds: nextTable.indexIds,
    },
  };
}

export function createRealtimeRelationshipPatch(
  previousModel: DiagramModel | null,
  nextModel: DiagramModel,
): RealtimeRelationshipPatch | null {
  if (!previousModel) {
    return null;
  }

  if (
    previousModel.schemaVersion !== nextModel.schemaVersion ||
    previousModel.dialect !== nextModel.dialect ||
    !areJsonValuesEqual(previousModel.tables, nextModel.tables) ||
    !areJsonValuesEqual(previousModel.columns, nextModel.columns) ||
    !areJsonValuesEqual(previousModel.indexes, nextModel.indexes) ||
    !areJsonValuesEqual(previousModel.enums, nextModel.enums) ||
    !areJsonValuesEqual(previousModel.checks, nextModel.checks) ||
    !areJsonValuesEqual(previousModel.notes, nextModel.notes) ||
    !areJsonValuesEqual(previousModel.groups, nextModel.groups) ||
    !areMetadataEqualExceptUpdatedAt(previousModel.metadata, nextModel.metadata)
  ) {
    return null;
  }

  const changedRelationshipIds = Array.from(
    new Set([...Object.keys(previousModel.relationships), ...Object.keys(nextModel.relationships)]),
  ).filter(
    (relationshipId) =>
      !areJsonValuesEqual(previousModel.relationships[relationshipId], nextModel.relationships[relationshipId]),
  );

  if (changedRelationshipIds.length !== 1) {
    return null;
  }

  const relationshipId = changedRelationshipIds[0];
  const previousRelationship = previousModel.relationships[relationshipId];
  const nextRelationship = nextModel.relationships[relationshipId];
  const metadataUpdatedAt =
    previousModel.metadata.updatedAt !== nextModel.metadata.updatedAt ? nextModel.metadata.updatedAt : undefined;

  if (!previousRelationship && nextRelationship) {
    return {
      action: 'create',
      metadataUpdatedAt,
      relationship: nextRelationship,
      relationshipId,
    };
  }

  if (previousRelationship && !nextRelationship) {
    return {
      action: 'delete',
      metadataUpdatedAt,
      relationshipId,
    };
  }

  if (!previousRelationship || !nextRelationship) {
    return null;
  }

  const changes: Partial<DatabaseRelationship> = {};
  const clearedKeys: Array<keyof DatabaseRelationship> = [];
  const relationshipKeys = Array.from(
    new Set([...Object.keys(previousRelationship), ...Object.keys(nextRelationship)]),
  ) as Array<keyof DatabaseRelationship>;

  for (const key of relationshipKeys) {
    const previousValue = previousRelationship[key];
    const nextValue = nextRelationship[key];

    if (areJsonValuesEqual(previousValue, nextValue)) {
      continue;
    }

    if (key === 'id') {
      return null;
    }

    if (nextValue === undefined) {
      clearedKeys.push(key);
      continue;
    }

    // Relationship update juga dipatch per field supaya edit cardinality tidak menimpa perubahan referential action dari user lain.
    (changes as Record<string, unknown>)[key] = nextValue;
  }

  if (Object.keys(changes).length === 0 && clearedKeys.length === 0) {
    return null;
  }

  return {
    action: 'update',
    changes,
    clearedKeys,
    metadataUpdatedAt,
    relationshipId,
  };
}

export function createRealtimeNotePatch(
  previousModel: DiagramModel | null,
  nextModel: DiagramModel,
): RealtimeNotePatch | null {
  if (!previousModel) {
    return null;
  }

  if (
    previousModel.schemaVersion !== nextModel.schemaVersion ||
    previousModel.dialect !== nextModel.dialect ||
    !areJsonValuesEqual(previousModel.tables, nextModel.tables) ||
    !areJsonValuesEqual(previousModel.columns, nextModel.columns) ||
    !areJsonValuesEqual(previousModel.indexes, nextModel.indexes) ||
    !areJsonValuesEqual(previousModel.relationships, nextModel.relationships) ||
    !areJsonValuesEqual(previousModel.enums, nextModel.enums) ||
    !areJsonValuesEqual(previousModel.checks, nextModel.checks) ||
    !areJsonValuesEqual(previousModel.groups, nextModel.groups) ||
    !areMetadataEqualExceptUpdatedAt(previousModel.metadata, nextModel.metadata)
  ) {
    return null;
  }

  const changedNoteIds = Array.from(new Set([...Object.keys(previousModel.notes), ...Object.keys(nextModel.notes)]))
    .filter((noteId) => !areJsonValuesEqual(previousModel.notes[noteId], nextModel.notes[noteId]));

  if (changedNoteIds.length !== 1) {
    return null;
  }

  const noteId = changedNoteIds[0];
  const previousNote = previousModel.notes[noteId];
  const nextNote = nextModel.notes[noteId];
  const metadataUpdatedAt =
    previousModel.metadata.updatedAt !== nextModel.metadata.updatedAt ? nextModel.metadata.updatedAt : undefined;

  if (!previousNote && nextNote) {
    return {
      action: 'create',
      metadataUpdatedAt,
      note: nextNote,
      noteId,
    };
  }

  if (previousNote && !nextNote) {
    return {
      action: 'delete',
      metadataUpdatedAt,
      noteId,
    };
  }

  if (!previousNote || !nextNote) {
    return null;
  }

  const changes: Partial<DiagramNote> = {};
  const clearedKeys: Array<keyof DiagramNote> = [];
  const noteKeys = Array.from(new Set([...Object.keys(previousNote), ...Object.keys(nextNote)])) as Array<
    keyof DiagramNote
  >;

  for (const key of noteKeys) {
    const previousValue = previousNote[key];
    const nextValue = nextNote[key];

    if (areJsonValuesEqual(previousValue, nextValue)) {
      continue;
    }

    if (key === 'id') {
      return null;
    }

    if (nextValue === undefined) {
      clearedKeys.push(key);
      continue;
    }

    // Note move/edit ditulis per field supaya user lain yang sedang mengedit teks tidak mudah tertimpa oleh drag posisi.
    (changes as Record<string, unknown>)[key] = nextValue;
  }

  if (Object.keys(changes).length === 0 && clearedKeys.length === 0) {
    return null;
  }

  return {
    action: 'update',
    changes,
    clearedKeys,
    metadataUpdatedAt,
    noteId,
  };
}

function createEditorDefaultTableColumns(): CreateTableColumnInput[] {
  return [
    {
      id: createDiagramEntityId('column'),
      name: 'id',
      type: { family: 'uuid' },
      primaryKey: true,
      nullable: false,
    },
    {
      id: createDiagramEntityId('column'),
      name: 'new_column',
      type: { family: 'varchar', length: 160 },
      nullable: false,
    },
  ];
}

function preserveRequestedDraftColumns(requestedModel: DiagramModel, latestModel: DiagramModel): DiagramModel {
  let tables = latestModel.tables;
  let columns = latestModel.columns;
  let changed = false;

  for (const requestedTable of Object.values(requestedModel.tables)) {
    const latestTable = tables[requestedTable.id];

    if (!latestTable) {
      tables = {
        ...tables,
        [requestedTable.id]: requestedTable,
      };
      columns = copyRequestedTableColumns(requestedModel, columns, requestedTable.columnIds);
      changed = true;
      continue;
    }

    const restoredColumnIds = mergeRequestedColumnIds(
      latestTable.columnIds,
      requestedTable.columnIds,
      requestedModel.columns,
    );
    const missingColumns = restoredColumnIds.filter(
      (columnId) => !columns[columnId] && requestedModel.columns[columnId],
    );

    if (missingColumns.length > 0) {
      columns = copyRequestedTableColumns(requestedModel, columns, missingColumns);
      changed = true;
    }

    if (!areStringArraysEqual(restoredColumnIds, latestTable.columnIds)) {
      tables = {
        ...tables,
        [latestTable.id]: {
          ...latestTable,
          columnIds: restoredColumnIds,
        },
      };
      changed = true;
    }
  }

  return changed
    ? {
        ...latestModel,
        columns,
        tables,
      }
    : latestModel;
}

function copyRequestedTableColumns(
  requestedModel: DiagramModel,
  currentColumns: DiagramModel['columns'],
  columnIds: string[],
): DiagramModel['columns'] {
  let nextColumns = currentColumns;

  for (const columnId of columnIds) {
    const requestedColumn = requestedModel.columns[columnId];

    if (!requestedColumn || nextColumns[columnId]) {
      continue;
    }

    nextColumns = {
      ...nextColumns,
      [columnId]: requestedColumn,
    };
  }

  return nextColumns;
}

function findChangedRecordKeys<T>(left: Record<string, T>, right: Record<string, T>): string[] {
  return Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).filter(
    (key) => !areJsonValuesEqual(left[key], right[key]),
  );
}

function isSameTableExceptColumnAndIndexOrder(left: DatabaseTable, right: DatabaseTable): boolean {
  const { columnIds: _leftColumnIds, indexIds: _leftIndexIds, ...leftRest } = left;
  const { columnIds: _rightColumnIds, indexIds: _rightIndexIds, ...rightRest } = right;

  return areJsonValuesEqual(leftRest, rightRest);
}

function findReorderedColumnId(previousColumnIds: string[], nextColumnIds: string[]): string | null {
  if (
    previousColumnIds.length !== nextColumnIds.length ||
    !previousColumnIds.every((columnId) => nextColumnIds.includes(columnId)) ||
    areStringArraysEqual(previousColumnIds, nextColumnIds)
  ) {
    return null;
  }

  return nextColumnIds.find((columnId, index) => previousColumnIds[index] !== columnId) ?? null;
}

function areDeletedColumnIndexChangesValid(columnId: string, indexesToUpsert: DatabaseIndex[]): boolean {
  return indexesToUpsert.every(
    (index) =>
      index.columns.every((indexColumn) => indexColumn.columnId !== columnId) &&
      !(index.includeColumnIds ?? []).includes(columnId),
  );
}

function areDeletedColumnRelationshipRemovalsValid(
  columnId: string,
  previousModel: DiagramModel,
  relationshipIds: string[],
): boolean {
  return relationshipIds.every((relationshipId) => {
    const relationship = previousModel.relationships[relationshipId];

    return Boolean(
      relationship &&
        (relationship.sourceColumnIds.includes(columnId) || relationship.targetColumnIds.includes(columnId)),
    );
  });
}

function areDeletedColumnCheckRemovalsValid(
  columnId: string,
  previousModel: DiagramModel,
  checkIds: string[],
): boolean {
  return checkIds.every((checkId) => previousModel.checks[checkId]?.columnId === columnId);
}

function mergeRequestedColumnIds(
  latestColumnIds: string[],
  requestedColumnIds: string[],
  requestedColumns: DiagramModel['columns'],
): string[] {
  const mergedColumnIds = [...latestColumnIds];
  let insertionIndex = 0;

  for (const requestedColumnId of requestedColumnIds) {
    if (!requestedColumns[requestedColumnId]) {
      continue;
    }

    const existingIndex = mergedColumnIds.indexOf(requestedColumnId);

    if (existingIndex >= 0) {
      insertionIndex = existingIndex + 1;
      continue;
    }

    mergedColumnIds.splice(insertionIndex, 0, requestedColumnId);
    insertionIndex += 1;
  }

  return mergedColumnIds;
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function areMetadataEqualExceptUpdatedAt(
  left: DiagramModel['metadata'],
  right: DiagramModel['metadata'],
): boolean {
  const { updatedAt: _leftUpdatedAt, ...leftRest } = left;
  const { updatedAt: _rightUpdatedAt, ...rightRest } = right;

  // Command-level realtime patches may carry only updatedAt besides the entity mutation; every other metadata field still requires a full model write.
  return areJsonValuesEqual(leftRest, rightRest);
}

function areJsonValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hasRealtimeModelLostLocalColumns(localModel: DiagramModel, realtimeModel: DiagramModel): boolean {
  return Object.values(localModel.tables).some((localTable) => {
    const realtimeTable = realtimeModel.tables[localTable.id];

    if (!realtimeTable) {
      return false;
    }

    const localColumns = getTableColumns(localModel, localTable.id);
    const realtimeColumns = getTableColumns(realtimeModel, realtimeTable.id);

    return localColumns.length > 0 && realtimeColumns.length === 0;
  });
}

function hasRealtimeModelLostLocalTables(localModel: DiagramModel, realtimeModel: DiagramModel): boolean {
  return Object.values(localModel.tables).some((localTable) => !realtimeModel.tables[localTable.id]);
}

function getDiagramModelUpdatedAtTime(model: DiagramModel): number | null {
  if (!model.metadata.updatedAt) {
    return null;
  }

  const time = Date.parse(model.metadata.updatedAt);

  return Number.isFinite(time) ? time : null;
}

function normalizeTableName(tableName?: string): string {
  return (tableName ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
