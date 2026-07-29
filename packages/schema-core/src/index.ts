import { z } from 'zod';

export const currentDiagramSchemaVersion = 1;

export const DatabaseDialectSchema = z.enum(['postgresql', 'mysql', 'sqlite', 'mariadb', 'sqlserver']);
export type DatabaseDialect = z.infer<typeof DatabaseDialectSchema>;

export const ReferentialActionSchema = z.enum(['cascade', 'restrict', 'set_null', 'set_default', 'no_action']);
export type ReferentialAction = z.infer<typeof ReferentialActionSchema>;

export const ColumnTypeFamilySchema = z.enum([
  'bigint',
  'boolean',
  'date',
  'decimal',
  'enum',
  'float',
  'integer',
  'json',
  'text',
  'time',
  'timestamp',
  'uuid',
  'varchar',
]);
export type ColumnTypeFamily = z.infer<typeof ColumnTypeFamilySchema>;

export const ColumnTypeSchema = z.object({
  family: ColumnTypeFamilySchema,
  length: z.number().int().positive().optional(),
  precision: z.number().int().positive().optional(),
  scale: z.number().int().nonnegative().optional(),
  enumId: z.string().optional(),
  raw: z.string().optional(),
});
export type ColumnTypeSpec = z.infer<typeof ColumnTypeSchema>;

export const DatabaseColumnSchema = z.object({
  id: z.string(),
  tableId: z.string(),
  name: z.string(),
  type: ColumnTypeSchema,
  primaryKey: z.boolean().default(false),
  nullable: z.boolean().default(true),
  unique: z.boolean().default(false),
  autoIncrement: z.boolean().default(false),
  unsigned: z.boolean().optional(),
  defaultValue: z.string().optional(),
  generatedExpression: z.string().optional(),
  collation: z.string().optional(),
  comment: z.string().optional(),
});
export type DatabaseColumn = z.infer<typeof DatabaseColumnSchema>;

export const DatabaseIndexColumnSchema = z.object({
  columnId: z.string(),
  order: z.enum(['asc', 'desc']).optional(),
  nulls: z.enum(['first', 'last']).optional(),
});
export type DatabaseIndexColumn = z.infer<typeof DatabaseIndexColumnSchema>;

export const DatabaseIndexSchema = z.object({
  id: z.string(),
  tableId: z.string(),
  name: z.string(),
  columns: z.array(DatabaseIndexColumnSchema),
  unique: z.boolean().default(false),
  method: z.enum(['btree', 'hash', 'gin', 'gist', 'brin']).optional(),
  where: z.string().optional(),
  includeColumnIds: z.array(z.string()).optional(),
  comment: z.string().optional(),
});
export type DatabaseIndex = z.infer<typeof DatabaseIndexSchema>;

export const TableDisplayModeSchema = z.enum(['all_columns', 'pk_fk_only', 'header_only']);
export type TableDisplayMode = z.infer<typeof TableDisplayModeSchema>;

export const DatabaseTableSchema = z.object({
  id: z.string(),
  name: z.string(),
  schema: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }),
  width: z.number().int().positive().default(288),
  color: z.string().optional(),
  collapsed: z.boolean().optional(),
  displayMode: TableDisplayModeSchema.optional(),
  columnIds: z.array(z.string()),
  indexIds: z.array(z.string()).default([]),
  groupId: z.string().optional(),
  comment: z.string().optional(),
});
export type DatabaseTable = z.infer<typeof DatabaseTableSchema>;

export const DatabaseRelationshipSchema = z.object({
  id: z.string(),
  sourceTableId: z.string(),
  sourceColumnIds: z.array(z.string()).min(1),
  targetTableId: z.string(),
  targetColumnIds: z.array(z.string()).min(1),
  cardinality: z.enum(['one_to_one', 'one_to_many', 'many_to_many']),
  onDelete: ReferentialActionSchema.optional(),
  onUpdate: ReferentialActionSchema.optional(),
  name: z.string().optional(),
  deferrable: z.boolean().optional(),
  matchType: z.enum(['simple', 'full', 'partial']).optional(),
  comment: z.string().optional(),
});
export type DatabaseRelationship = z.infer<typeof DatabaseRelationshipSchema>;

export const DatabaseEnumSchema = z.object({
  id: z.string(),
  name: z.string(),
  schema: z.string().optional(),
  values: z.array(z.string()),
  comment: z.string().optional(),
});
export type DatabaseEnum = z.infer<typeof DatabaseEnumSchema>;

export const DatabaseCheckSchema = z.object({
  id: z.string(),
  tableId: z.string(),
  columnId: z.string().optional(),
  name: z.string(),
  expression: z.string(),
  comment: z.string().optional(),
});
export type DatabaseCheck = z.infer<typeof DatabaseCheckSchema>;

export const DiagramNoteSchema = z.object({
  id: z.string(),
  text: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  width: z.number().int().positive().optional(),
  color: z.string().optional(),
});
export type DiagramNote = z.infer<typeof DiagramNoteSchema>;

export const DiagramGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  color: z.string().optional(),
  tableIds: z.array(z.string()),
});
export type DiagramGroup = z.infer<typeof DiagramGroupSchema>;

export const DiagramMetadataSchema = z.object({
  name: z.string(),
  updatedAt: z.string().datetime().optional(),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).optional(),
  gridSize: z.number().int().positive().optional(),
  tableMinWidth: z.number().int().positive().optional(),
  relationshipRouting: z.enum(['smart_orthogonal', 'straight', 'manual']).optional(),
});
export type DiagramMetadata = z.infer<typeof DiagramMetadataSchema>;

export const DiagramModelSchema = z.object({
  schemaVersion: z.number().int().positive().default(currentDiagramSchemaVersion),
  dialect: DatabaseDialectSchema,
  tables: z.record(z.string(), DatabaseTableSchema),
  columns: z.record(z.string(), DatabaseColumnSchema),
  indexes: z.record(z.string(), DatabaseIndexSchema),
  relationships: z.record(z.string(), DatabaseRelationshipSchema),
  enums: z.record(z.string(), DatabaseEnumSchema),
  checks: z.record(z.string(), DatabaseCheckSchema).default({}),
  notes: z.record(z.string(), DiagramNoteSchema),
  groups: z.record(z.string(), DiagramGroupSchema).default({}),
  metadata: DiagramMetadataSchema,
});
export type DiagramModel = z.infer<typeof DiagramModelSchema>;

export const yjsCollections = {
  tables: 'tables',
  columns: 'columns',
  indexes: 'indexes',
  relationships: 'relationships',
  enums: 'enums',
  checks: 'checks',
  notes: 'notes',
  groups: 'groups',
  metadata: 'metadata',
} as const;

export function createEmptyDiagramModel(
  name = 'Untitled diagram',
  dialect: DatabaseDialect = 'postgresql',
): DiagramModel {
  return {
    schemaVersion: currentDiagramSchemaVersion,
    dialect,
    tables: {},
    columns: {},
    indexes: {},
    relationships: {},
    enums: {},
    checks: {},
    notes: {},
    groups: {},
    metadata: {
      name,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function getTableColumns(model: DiagramModel, tableId: string): DatabaseColumn[] {
  const table = model.tables[tableId];
  if (!table) {
    return [];
  }

  // Relationship integrity depends on stable IDs, so render order follows table.columnIds instead of column names.
  return table.columnIds.flatMap((columnId) => {
    const column = model.columns[columnId];
    return column ? [column] : [];
  });
}

export function getRelationshipColumnPairs(relationship: DatabaseRelationship): Array<{
  sourceColumnId: string;
  targetColumnId: string;
}> {
  // Composite relationships keep column IDs paired by index, which lets the canvas and SQL generator share one ordering rule.
  return relationship.sourceColumnIds.flatMap((sourceColumnId, index) => {
    const targetColumnId = relationship.targetColumnIds[index];
    return targetColumnId ? [{ sourceColumnId, targetColumnId }] : [];
  });
}
