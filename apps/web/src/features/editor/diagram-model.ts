import {
  applyDiagramCommand,
  createDiagramEntityId,
  createStarterDiagramModel,
  type ColumnTypeSpec,
  type CreateTableColumnInput,
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
  const modelToSave = latestModel ?? requestedModel;

  if (!requestedModel || !modelToSave) {
    return modelToSave;
  }

  return preserveRequestedDraftColumns(requestedModel, modelToSave);
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

function normalizeTableName(tableName?: string): string {
  return (tableName ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
