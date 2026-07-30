import {
  applyDiagramCommand,
  createStarterDiagramModel,
  type ColumnTypeSpec,
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

export function addTableToDiagramModel(model: DiagramModel, tableName?: string): DiagramModel {
  const nextIndex = Object.keys(model.tables).length + 1;
  const normalizedName = normalizeTableName(tableName) || `new_table_${nextIndex}`;

  return applyDiagramCommand(model, {
    type: 'table.create',
    name: normalizedName,
    position: { x: 160 + nextIndex * 36, y: 120 + nextIndex * 28 },
    width: 288,
    color: '#1cb0f6',
  });
}

function normalizeTableName(tableName?: string): string {
  return (tableName ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
