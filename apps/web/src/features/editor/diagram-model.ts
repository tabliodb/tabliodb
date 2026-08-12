import {
  applyDiagramCommand,
  createDiagramEntityId,
  createStarterDiagramModel,
  getTableColumns,
  normalizeDiagramModel,
  type ColumnTypeSpec,
  type CreateTableColumnInput,
  type DiagramModel,
} from '@tabliodb/schema-core';

export type RealtimeTablePatch = {
  clearColor?: boolean;
  color?: string;
  tableId: string;
  metadataUpdatedAt?: string;
  name?: string;
  position?: { x: number; y: number };
  width?: number;
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
