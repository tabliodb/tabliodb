import { z } from 'zod';

export const DatabaseDialectSchema = z.enum(['postgresql', 'mysql']);
export type DatabaseDialect = z.infer<typeof DatabaseDialectSchema>;

export const ReferentialActionSchema = z.enum(['cascade', 'restrict', 'set-null', 'set-default', 'no-action']);
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
  defaultValue: z.string().optional(),
  comment: z.string().optional(),
});
export type DatabaseColumn = z.infer<typeof DatabaseColumnSchema>;

export const DatabaseIndexSchema = z.object({
  id: z.string(),
  tableId: z.string(),
  name: z.string(),
  columnIds: z.array(z.string()),
  unique: z.boolean().default(false),
});
export type DatabaseIndex = z.infer<typeof DatabaseIndexSchema>;

export const DatabaseTableSchema = z.object({
  id: z.string(),
  name: z.string(),
  schema: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }),
  columnIds: z.array(z.string()),
  indexIds: z.array(z.string()).default([]),
  color: z.string().optional(),
  comment: z.string().optional(),
});
export type DatabaseTable = z.infer<typeof DatabaseTableSchema>;

export const DatabaseRelationshipSchema = z.object({
  id: z.string(),
  sourceTableId: z.string(),
  sourceColumnId: z.string(),
  targetTableId: z.string(),
  targetColumnId: z.string(),
  cardinality: z.enum(['one-to-one', 'one-to-many', 'many-to-many']),
  onDelete: ReferentialActionSchema.optional(),
  onUpdate: ReferentialActionSchema.optional(),
  name: z.string().optional(),
});
export type DatabaseRelationship = z.infer<typeof DatabaseRelationshipSchema>;

export const DatabaseEnumSchema = z.object({
  id: z.string(),
  name: z.string(),
  values: z.array(z.string()),
});
export type DatabaseEnum = z.infer<typeof DatabaseEnumSchema>;

export const DiagramNoteSchema = z.object({
  id: z.string(),
  text: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
});
export type DiagramNote = z.infer<typeof DiagramNoteSchema>;

export const DiagramModelSchema = z.object({
  dialect: DatabaseDialectSchema,
  tables: z.record(z.string(), DatabaseTableSchema),
  columns: z.record(z.string(), DatabaseColumnSchema),
  indexes: z.record(z.string(), DatabaseIndexSchema),
  relationships: z.record(z.string(), DatabaseRelationshipSchema),
  enums: z.record(z.string(), DatabaseEnumSchema),
  notes: z.record(z.string(), DiagramNoteSchema),
  metadata: z.object({
    name: z.string(),
    updatedAt: z.string().datetime().optional(),
  }),
});
export type DiagramModel = z.infer<typeof DiagramModelSchema>;

export const yjsCollections = {
  tables: 'tables',
  columns: 'columns',
  indexes: 'indexes',
  relationships: 'relationships',
  enums: 'enums',
  notes: 'notes',
  metadata: 'metadata',
} as const;

export function createEmptyDiagramModel(
  name = 'Untitled diagram',
  dialect: DatabaseDialect = 'postgresql',
): DiagramModel {
  return {
    dialect,
    tables: {},
    columns: {},
    indexes: {},
    relationships: {},
    enums: {},
    notes: {},
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
