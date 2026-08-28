import {
  applyDiagramCommand,
  createDiagramEntityId,
  getTableColumns,
  type DatabaseColumn,
  type DatabaseIndex,
  type DatabaseIndexColumn,
  type DatabaseTable,
  type DiagramModel,
} from '@tabliodb/schema-core';

export async function copyTableToClipboard(model: DiagramModel, table: DatabaseTable): Promise<void> {
  const payload = {
    columns: getTableColumns(model, table.id),
    indexes: getTableIndexes(model, table),
    kind: 'tabliodb.table.copy.v1',
    table,
  };

  // Clipboard payload tetap JSON terstruktur agar fitur paste/import table nanti bisa membaca data yang sama tanpa scraping text.
  await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
}

export function duplicateTableInModel(model: DiagramModel, tableId: string): { model: DiagramModel; tableId: string } | null {
  const sourceTable = model.tables[tableId];

  if (!sourceTable) {
    return null;
  }

  const sourceColumns = getTableColumns(model, sourceTable.id);
  const nextTableId = createDiagramEntityId('table');
  const nextColumnIdBySourceId = new Map<string, string>();
  const duplicateColumns = sourceColumns.map((column) => {
    const nextColumnId = createDiagramEntityId('column');

    nextColumnIdBySourceId.set(column.id, nextColumnId);

    return {
      autoIncrement: column.autoIncrement,
      collation: column.collation,
      comment: column.comment,
      defaultValue: column.defaultValue,
      generatedExpression: column.generatedExpression,
      id: nextColumnId,
      name: column.name,
      nullable: column.nullable,
      primaryKey: column.primaryKey,
      type: { ...column.type },
      unique: column.unique,
      unsigned: column.unsigned,
    };
  });
  let nextModel = applyDiagramCommand(model, {
    color: sourceTable.color,
    columns: duplicateColumns,
    name: createUniqueTableName(Object.values(model.tables), `${sourceTable.name}_copy`, sourceTable.schema),
    position: {
      x: sourceTable.position.x + 36,
      y: sourceTable.position.y + 36,
    },
    schema: sourceTable.schema,
    tableId: nextTableId,
    type: 'table.create',
    width: sourceTable.width,
  });

  for (const index of getTableIndexes(model, sourceTable)) {
    const remappedColumns = remapIndexColumns(index.columns, nextColumnIdBySourceId);

    if (remappedColumns.length === 0) {
      continue;
    }

    nextModel = applyDiagramCommand(nextModel, {
      columns: remappedColumns,
      comment: index.comment,
      includeColumnIds: remapColumnIds(index.includeColumnIds ?? [], nextColumnIdBySourceId),
      method: index.method,
      name: createUniqueIndexName(nextModel, nextModel.tables[nextTableId] ?? sourceTable, index.name),
      tableId: nextTableId,
      type: 'index.create',
      unique: index.unique,
      where: index.where,
    });
  }

  return { model: nextModel, tableId: nextTableId };
}

export function duplicateTablesInModel(model: DiagramModel, tableIds: string[]): { model: DiagramModel; tableIds: string[] } {
  let nextModel = model;
  const nextTableIds: string[] = [];

  for (const tableId of tableIds) {
    const result = duplicateTableInModel(nextModel, tableId);

    if (!result) {
      continue;
    }

    nextModel = result.model;
    nextTableIds.push(result.tableId);
  }

  return { model: nextModel, tableIds: nextTableIds };
}

export function createUniqueColumnName(columns: DatabaseColumn[], baseName: string): string {
  return createUniqueName(
    new Set(columns.map((column) => column.name.toLowerCase())),
    normalizeDiagramIdentifier(baseName),
  );
}

export function createUniqueTableName(tables: DatabaseTable[], baseName: string, schema: string | undefined): string {
  const usedNames = new Set(tables.map((table) => `${table.schema ?? ''}.${table.name}`.toLowerCase()));
  const normalizedBaseName = normalizeDiagramIdentifier(baseName);
  const schemaPrefix = schema ?? '';

  if (!usedNames.has(`${schemaPrefix}.${normalizedBaseName}`)) {
    return normalizedBaseName;
  }

  let suffix = 2;
  let nextName = `${normalizedBaseName}_${suffix}`;

  while (usedNames.has(`${schemaPrefix}.${nextName}`)) {
    suffix += 1;
    nextName = `${normalizedBaseName}_${suffix}`;
  }

  return nextName;
}

export function createUniqueIndexName(model: DiagramModel, table: DatabaseTable, baseName: string): string {
  const usedNames = new Set(Object.values(model.indexes).map((index) => index.name.toLowerCase()));
  const normalizedBaseName = normalizeDiagramIdentifier(`${table.name}_${baseName}_idx`);

  return createUniqueName(usedNames, normalizedBaseName);
}

export function createUniqueName(usedNames: Set<string>, baseName: string): string {
  if (!usedNames.has(baseName.toLowerCase())) {
    return baseName;
  }

  let suffix = 2;
  let nextName = `${baseName}_${suffix}`;

  while (usedNames.has(nextName.toLowerCase())) {
    suffix += 1;
    nextName = `${baseName}_${suffix}`;
  }

  return nextName;
}

export function normalizeDiagramIdentifier(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || 'item';
}

function getTableIndexes(model: DiagramModel, table: DatabaseTable): DatabaseIndex[] {
  return table.indexIds.flatMap((indexId) => {
    const index = model.indexes[indexId];

    return index ? [index] : [];
  });
}

function remapIndexColumns(
  columns: DatabaseIndexColumn[],
  columnIdBySourceId: Map<string, string>,
): DatabaseIndexColumn[] {
  return columns.flatMap((column) => {
    const columnId = columnIdBySourceId.get(column.columnId);

    return columnId ? [{ ...column, columnId }] : [];
  });
}

function remapColumnIds(columnIds: string[], columnIdBySourceId: Map<string, string>): string[] {
  return columnIds.flatMap((columnId) => {
    const nextColumnId = columnIdBySourceId.get(columnId);

    return nextColumnId ? [nextColumnId] : [];
  });
}
