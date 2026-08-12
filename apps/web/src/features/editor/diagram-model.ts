import {
  applyDiagramCommand,
  createDiagramEntityId,
  createStarterDiagramModel,
  getTableColumns,
  type ColumnTypeSpec,
  type CreateTableColumnInput,
  type DatabaseColumn,
  type DatabaseTable,
  type DiagramModel,
} from '@tabliodb/schema-core';

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
): DiagramModel | null {
  const requestedSafeModel = requestedModel ? normalizeEditorDiagramModel(requestedModel) : null;
  const latestSafeModel = latestModel ? normalizeEditorDiagramModel(latestModel) : null;
  const modelToSave = latestSafeModel ?? requestedSafeModel;

  if (!requestedSafeModel || !modelToSave) {
    return modelToSave;
  }

  return preserveRequestedDraftColumns(requestedSafeModel, modelToSave);
}

export function normalizeEditorDiagramModel(model: DiagramModel): DiagramModel {
  let columns = model.columns;
  let changed = false;

  for (const table of Object.values(model.tables)) {
    // Table can survive with columnIds while its column entities are missing from older realtime drafts.
    const repairedColumns = createMissingTableColumns(table, columns);

    if (repairedColumns.length === 0) {
      continue;
    }

    columns = {
      ...columns,
      ...Object.fromEntries(repairedColumns.map((column) => [column.id, column])),
    };
    changed = true;
  }

  return changed
    ? {
        ...model,
        columns,
      }
    : model;
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

  // Development Yjs documents can lag behind a repaired local draft; never downgrade a real table into an empty shell.
  return hasRealtimeModelLostLocalColumns(localModel, realtimeModel);
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

function createMissingTableColumns(table: DatabaseTable, columns: DiagramModel['columns']): DatabaseColumn[] {
  const usedNames = new Set(table.columnIds.flatMap((columnId) => (columns[columnId] ? [columns[columnId].name] : [])));
  const repairedColumns: DatabaseColumn[] = [];

  table.columnIds.forEach((columnId, columnIndex) => {
    if (columns[columnId]) {
      return;
    }

    const baseName = columnIndex === 0 ? 'id' : columnIndex === 1 ? 'new_column' : `new_column_${columnIndex}`;
    const name = createUniqueRecoveredColumnName(usedNames, baseName);
    usedNames.add(name);

    // Reconstructed columns keep the original IDs so relationships, comments, and table ordering remain addressable.
    repairedColumns.push({
      id: columnId,
      tableId: table.id,
      name,
      type: columnIndex === 0 ? { family: 'uuid' } : { family: 'varchar', length: 160 },
      primaryKey: columnIndex === 0,
      nullable: false,
      unique: false,
      autoIncrement: false,
    });
  });

  return repairedColumns;
}

function createUniqueRecoveredColumnName(usedNames: Set<string>, baseName: string): string {
  if (!usedNames.has(baseName)) {
    return baseName;
  }

  let suffix = 2;
  let nextName = `${baseName}_${suffix}`;

  while (usedNames.has(nextName)) {
    suffix += 1;
    nextName = `${baseName}_${suffix}`;
  }

  return nextName;
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
