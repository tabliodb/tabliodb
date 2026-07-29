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
  updatedAt: z.iso.datetime({ offset: true }).optional(),
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

export const defaultTableWidth = 288;
export const defaultTableMinWidth = 240;

export const DiagramEntityKindSchema = z.enum([
  'table',
  'column',
  'relationship',
  'index',
  'enum',
  'check',
  'note',
  'group',
]);
export type DiagramEntityKind = z.infer<typeof DiagramEntityKindSchema>;
export type DiagramIdFactory = (kind: DiagramEntityKind) => string;

export class DiagramCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiagramCommandError';
  }
}

export function createDiagramEntityId(kind: DiagramEntityKind): string {
  const cryptoLike = globalThis as typeof globalThis & {
    crypto?: {
      randomUUID?: () => string;
    };
  };
  const token =
    cryptoLike.crypto?.randomUUID?.().replaceAll('-', '') ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

  // ID tidak diturunkan dari nama entity supaya rename table/column tidak mematahkan relationship, comment, dan snapshot.
  return `${kind}_${token}`;
}

export function createSequentialDiagramIdFactory(prefix = 'entity'): DiagramIdFactory {
  const counters = new Map<DiagramEntityKind, number>();

  return (kind) => {
    const nextValue = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, nextValue);
    return `${prefix}_${kind}_${nextValue}`;
  };
}

export type DiagramCommandOptions = {
  idFactory?: DiagramIdFactory;
  now?: () => string;
};

export type CreateTableColumnInput = {
  id?: string;
  name: string;
  type: ColumnTypeSpec;
  primaryKey?: boolean;
  nullable?: boolean;
  unique?: boolean;
  autoIncrement?: boolean;
  unsigned?: boolean;
  defaultValue?: string;
  generatedExpression?: string;
  collation?: string;
  comment?: string;
};

export type CreateTableCommand = {
  type: 'table.create';
  tableId?: string;
  name: string;
  schema?: string;
  position?: { x: number; y: number };
  width?: number;
  color?: string;
  columns?: CreateTableColumnInput[];
};

export type RenameTableCommand = {
  type: 'table.rename';
  tableId: string;
  name: string;
};

export type MoveTableCommand = {
  type: 'table.move';
  tableId: string;
  position: { x: number; y: number };
};

export type ResizeTableCommand = {
  type: 'table.resize';
  tableId: string;
  width: number;
};

export type ChangeTableColorCommand = {
  type: 'table.changeColor';
  tableId: string;
  color?: string;
};

export type DeleteTableCommand = {
  type: 'table.delete';
  tableId: string;
};

export type CreateColumnCommand = {
  type: 'column.create';
  tableId: string;
  columnId?: string;
  name: string;
  columnType: ColumnTypeSpec;
  atIndex?: number;
  afterColumnId?: string;
  primaryKey?: boolean;
  nullable?: boolean;
  unique?: boolean;
  autoIncrement?: boolean;
  unsigned?: boolean;
  defaultValue?: string;
  generatedExpression?: string;
  collation?: string;
  comment?: string;
};

export type UpdateColumnCommand = {
  type: 'column.update';
  columnId: string;
  changes: Partial<Omit<DatabaseColumn, 'id' | 'tableId'>>;
};

export type ReorderColumnCommand = {
  type: 'column.reorder';
  tableId: string;
  columnId: string;
  atIndex: number;
};

export type DeleteColumnCommand = {
  type: 'column.delete';
  columnId: string;
};

export type CreateRelationshipCommand = {
  type: 'relationship.create';
  relationshipId?: string;
  sourceTableId: string;
  sourceColumnIds: string[];
  targetTableId: string;
  targetColumnIds: string[];
  cardinality: DatabaseRelationship['cardinality'];
  onDelete?: ReferentialAction;
  onUpdate?: ReferentialAction;
  name?: string;
  deferrable?: boolean;
  matchType?: DatabaseRelationship['matchType'];
  comment?: string;
};

export type UpdateRelationshipCommand = {
  type: 'relationship.update';
  relationshipId: string;
  changes: Partial<Omit<DatabaseRelationship, 'id'>>;
};

export type DeleteRelationshipCommand = {
  type: 'relationship.delete';
  relationshipId: string;
};

export type CreateIndexCommand = {
  type: 'index.create';
  indexId?: string;
  tableId: string;
  name: string;
  columns: DatabaseIndexColumn[];
  unique?: boolean;
  method?: DatabaseIndex['method'];
  where?: string;
  includeColumnIds?: string[];
  comment?: string;
};

export type UpdateIndexCommand = {
  type: 'index.update';
  indexId: string;
  changes: Partial<Omit<DatabaseIndex, 'id' | 'tableId'>>;
};

export type DeleteIndexCommand = {
  type: 'index.delete';
  indexId: string;
};

export type DiagramCommand =
  | CreateTableCommand
  | RenameTableCommand
  | MoveTableCommand
  | ResizeTableCommand
  | ChangeTableColorCommand
  | DeleteTableCommand
  | CreateColumnCommand
  | UpdateColumnCommand
  | ReorderColumnCommand
  | DeleteColumnCommand
  | CreateRelationshipCommand
  | UpdateRelationshipCommand
  | DeleteRelationshipCommand
  | CreateIndexCommand
  | UpdateIndexCommand
  | DeleteIndexCommand;

export function applyDiagramCommands(
  model: DiagramModel,
  commands: DiagramCommand[],
  options: DiagramCommandOptions = {},
): DiagramModel {
  return commands.reduce((currentModel, command) => applyDiagramCommand(currentModel, command, options), model);
}

export function applyDiagramCommand(
  model: DiagramModel,
  command: DiagramCommand,
  options: DiagramCommandOptions = {},
): DiagramModel {
  const idFactory = options.idFactory ?? createDiagramEntityId;

  switch (command.type) {
    case 'table.create':
      return finalizeDiagramModel(createTable(model, command, idFactory), options);
    case 'table.rename':
      return finalizeDiagramModel(patchTable(model, command.tableId, { name: command.name }), options);
    case 'table.move':
      return finalizeDiagramModel(patchTable(model, command.tableId, { position: command.position }), options);
    case 'table.resize':
      return finalizeDiagramModel(resizeTable(model, command), options);
    case 'table.changeColor':
      return finalizeDiagramModel(patchTable(model, command.tableId, { color: command.color }), options);
    case 'table.delete':
      return finalizeDiagramModel(deleteTable(model, command.tableId), options);
    case 'column.create':
      return finalizeDiagramModel(createColumnFromCommand(model, command, idFactory), options);
    case 'column.update':
      return finalizeDiagramModel(updateColumn(model, command), options);
    case 'column.reorder':
      return finalizeDiagramModel(reorderColumn(model, command), options);
    case 'column.delete':
      return finalizeDiagramModel(deleteColumn(model, command.columnId), options);
    case 'relationship.create':
      return finalizeDiagramModel(createRelationship(model, command, idFactory), options);
    case 'relationship.update':
      return finalizeDiagramModel(updateRelationship(model, command), options);
    case 'relationship.delete':
      return finalizeDiagramModel(deleteRelationship(model, command.relationshipId), options);
    case 'index.create':
      return finalizeDiagramModel(createIndex(model, command, idFactory), options);
    case 'index.update':
      return finalizeDiagramModel(updateIndex(model, command), options);
    case 'index.delete':
      return finalizeDiagramModel(deleteIndex(model, command.indexId), options);
  }
}

export function parseDiagramModel(value: unknown): DiagramModel {
  return DiagramModelSchema.parse(value);
}

export function serializeDiagramModel(model: DiagramModel): DiagramModel {
  return DiagramModelSchema.parse(model);
}

export function stringifyDiagramModel(model: DiagramModel, space = 2): string {
  return JSON.stringify(serializeDiagramModel(model), null, space);
}

function createTable(model: DiagramModel, command: CreateTableCommand, idFactory: DiagramIdFactory): DiagramModel {
  const tableId = command.tableId ?? idFactory('table');
  assertMissingEntity(model.tables[tableId], `Table "${tableId}" already exists`);

  const tableColumns = (command.columns ?? getDefaultTableColumns()).map((columnInput) =>
    createColumnEntity(tableId, columnInput, idFactory),
  );
  const table = DatabaseTableSchema.parse({
    id: tableId,
    name: command.name,
    schema: command.schema,
    position: command.position ?? { x: 0, y: 0 },
    width: clampTableWidth(model, command.width ?? defaultTableWidth),
    color: command.color,
    columnIds: tableColumns.map((column) => column.id),
    indexIds: [],
  });

  return {
    ...model,
    tables: {
      ...model.tables,
      [table.id]: table,
    },
    columns: {
      ...model.columns,
      ...Object.fromEntries(tableColumns.map((column) => [column.id, column])),
    },
  };
}

function patchTable(model: DiagramModel, tableId: string, changes: Partial<DatabaseTable>): DiagramModel {
  const table = requireTable(model, tableId);

  return {
    ...model,
    tables: {
      ...model.tables,
      [tableId]: DatabaseTableSchema.parse({
        ...table,
        ...changes,
        id: table.id,
        columnIds: table.columnIds,
        indexIds: table.indexIds,
      }),
    },
  };
}

function resizeTable(model: DiagramModel, command: ResizeTableCommand): DiagramModel {
  return patchTable(model, command.tableId, {
    width: clampTableWidth(model, command.width),
  });
}

function deleteTable(model: DiagramModel, tableId: string): DiagramModel {
  const table = requireTable(model, tableId);
  const removedColumnIds = new Set(table.columnIds);
  const removedIndexIds = new Set(table.indexIds);

  return {
    ...model,
    tables: omitKey(model.tables, tableId),
    columns: omitKeys(model.columns, removedColumnIds),
    indexes: omitKeys(model.indexes, removedIndexIds),
    relationships: Object.fromEntries(
      Object.entries(model.relationships).filter(
        ([, relationship]) => relationship.sourceTableId !== tableId && relationship.targetTableId !== tableId,
      ),
    ),
    checks: Object.fromEntries(
      Object.entries(model.checks).filter(
        ([, check]) => check.tableId !== tableId && !removedColumnIds.has(check.columnId ?? ''),
      ),
    ),
    groups: Object.fromEntries(
      Object.entries(model.groups).map(([groupId, group]) => [
        groupId,
        {
          ...group,
          // Group tetap dipertahankan, tetapi daftar table-nya dibersihkan agar selection tidak mengarah ke entity kosong.
          tableIds: group.tableIds.filter((currentTableId) => currentTableId !== tableId),
        },
      ]),
    ),
  };
}

function createColumnFromCommand(
  model: DiagramModel,
  command: CreateColumnCommand,
  idFactory: DiagramIdFactory,
): DiagramModel {
  const table = requireTable(model, command.tableId);
  const columnId = command.columnId ?? idFactory('column');
  assertMissingEntity(model.columns[columnId], `Column "${columnId}" already exists`);
  const column = createColumnEntity(
    command.tableId,
    {
      id: columnId,
      name: command.name,
      type: command.columnType,
      primaryKey: command.primaryKey,
      nullable: command.nullable,
      unique: command.unique,
      autoIncrement: command.autoIncrement,
      unsigned: command.unsigned,
      defaultValue: command.defaultValue,
      generatedExpression: command.generatedExpression,
      collation: command.collation,
      comment: command.comment,
    },
    idFactory,
  );

  return {
    ...model,
    tables: {
      ...model.tables,
      [table.id]: {
        ...table,
        columnIds: insertColumnId(table.columnIds, column.id, command),
      },
    },
    columns: {
      ...model.columns,
      [column.id]: column,
    },
  };
}

function updateColumn(model: DiagramModel, command: UpdateColumnCommand): DiagramModel {
  const column = requireColumn(model, command.columnId);

  return {
    ...model,
    columns: {
      ...model.columns,
      [column.id]: DatabaseColumnSchema.parse({
        ...column,
        ...command.changes,
        id: column.id,
        tableId: column.tableId,
      }),
    },
  };
}

function reorderColumn(model: DiagramModel, command: ReorderColumnCommand): DiagramModel {
  const table = requireTable(model, command.tableId);
  assertTableOwnsColumn(table, command.columnId);

  return {
    ...model,
    tables: {
      ...model.tables,
      [table.id]: {
        ...table,
        columnIds: insertAtIndex(
          table.columnIds.filter((columnId) => columnId !== command.columnId),
          command.columnId,
          command.atIndex,
        ),
      },
    },
  };
}

function deleteColumn(model: DiagramModel, columnId: string): DiagramModel {
  const column = requireColumn(model, columnId);
  const table = requireTable(model, column.tableId);
  const nextIndexes: Record<string, DatabaseIndex> = {};

  for (const [indexId, index] of Object.entries(model.indexes)) {
    const nextIndex = DatabaseIndexSchema.parse({
      ...index,
      columns: index.columns.filter((indexColumn) => indexColumn.columnId !== columnId),
      includeColumnIds: index.includeColumnIds?.filter((includeColumnId) => includeColumnId !== columnId),
    });

    if (nextIndex.columns.length > 0) {
      // Index tanpa kolom tidak lagi valid sebagai artifact database, jadi ikut dibuang saat kolom terakhirnya hilang.
      nextIndexes[indexId] = nextIndex;
    }
  }

  return {
    ...model,
    tables: {
      ...model.tables,
      [table.id]: {
        ...table,
        columnIds: table.columnIds.filter((currentColumnId) => currentColumnId !== columnId),
        indexIds: table.indexIds.filter((indexId) => nextIndexes[indexId]),
      },
    },
    columns: omitKey(model.columns, columnId),
    indexes: nextIndexes,
    relationships: Object.fromEntries(
      Object.entries(model.relationships).filter(
        ([, relationship]) =>
          !relationship.sourceColumnIds.includes(columnId) && !relationship.targetColumnIds.includes(columnId),
      ),
    ),
    checks: Object.fromEntries(Object.entries(model.checks).filter(([, check]) => check.columnId !== columnId)),
  };
}

function createRelationship(
  model: DiagramModel,
  command: CreateRelationshipCommand,
  idFactory: DiagramIdFactory,
): DiagramModel {
  const relationshipId = command.relationshipId ?? idFactory('relationship');
  assertMissingEntity(model.relationships[relationshipId], `Relationship "${relationshipId}" already exists`);
  assertRelationshipColumns(model, command.sourceTableId, command.sourceColumnIds);
  assertRelationshipColumns(model, command.targetTableId, command.targetColumnIds);

  return {
    ...model,
    relationships: {
      ...model.relationships,
      [relationshipId]: DatabaseRelationshipSchema.parse({
        id: relationshipId,
        sourceTableId: command.sourceTableId,
        sourceColumnIds: command.sourceColumnIds,
        targetTableId: command.targetTableId,
        targetColumnIds: command.targetColumnIds,
        cardinality: command.cardinality,
        onDelete: command.onDelete,
        onUpdate: command.onUpdate,
        name: command.name,
        deferrable: command.deferrable,
        matchType: command.matchType,
        comment: command.comment,
      }),
    },
  };
}

function updateRelationship(model: DiagramModel, command: UpdateRelationshipCommand): DiagramModel {
  const relationship = requireRelationship(model, command.relationshipId);
  const nextRelationship = DatabaseRelationshipSchema.parse({
    ...relationship,
    ...command.changes,
    id: relationship.id,
  });
  assertRelationshipColumns(model, nextRelationship.sourceTableId, nextRelationship.sourceColumnIds);
  assertRelationshipColumns(model, nextRelationship.targetTableId, nextRelationship.targetColumnIds);

  return {
    ...model,
    relationships: {
      ...model.relationships,
      [relationship.id]: nextRelationship,
    },
  };
}

function deleteRelationship(model: DiagramModel, relationshipId: string): DiagramModel {
  requireRelationship(model, relationshipId);

  return {
    ...model,
    relationships: omitKey(model.relationships, relationshipId),
  };
}

function createIndex(model: DiagramModel, command: CreateIndexCommand, idFactory: DiagramIdFactory): DiagramModel {
  const table = requireTable(model, command.tableId);
  const indexId = command.indexId ?? idFactory('index');
  assertMissingEntity(model.indexes[indexId], `Index "${indexId}" already exists`);
  command.columns.forEach((column) => assertTableOwnsColumn(table, column.columnId));
  command.includeColumnIds?.forEach((columnId) => assertTableOwnsColumn(table, columnId));

  const index = DatabaseIndexSchema.parse({
    id: indexId,
    tableId: table.id,
    name: command.name,
    columns: command.columns,
    unique: command.unique ?? false,
    method: command.method,
    where: command.where,
    includeColumnIds: command.includeColumnIds,
    comment: command.comment,
  });

  return {
    ...model,
    tables: {
      ...model.tables,
      [table.id]: {
        ...table,
        indexIds: [...table.indexIds, index.id],
      },
    },
    indexes: {
      ...model.indexes,
      [index.id]: index,
    },
  };
}

function updateIndex(model: DiagramModel, command: UpdateIndexCommand): DiagramModel {
  const index = requireIndex(model, command.indexId);
  const table = requireTable(model, index.tableId);
  const nextIndex = DatabaseIndexSchema.parse({
    ...index,
    ...command.changes,
    id: index.id,
    tableId: index.tableId,
  });
  nextIndex.columns.forEach((column) => assertTableOwnsColumn(table, column.columnId));
  nextIndex.includeColumnIds?.forEach((columnId) => assertTableOwnsColumn(table, columnId));

  return {
    ...model,
    indexes: {
      ...model.indexes,
      [index.id]: nextIndex,
    },
  };
}

function deleteIndex(model: DiagramModel, indexId: string): DiagramModel {
  const index = requireIndex(model, indexId);
  const table = requireTable(model, index.tableId);

  return {
    ...model,
    tables: {
      ...model.tables,
      [table.id]: {
        ...table,
        indexIds: table.indexIds.filter((currentIndexId) => currentIndexId !== indexId),
      },
    },
    indexes: omitKey(model.indexes, indexId),
  };
}

function createColumnEntity(
  tableId: string,
  input: CreateTableColumnInput & { id?: string },
  idFactory: DiagramIdFactory,
): DatabaseColumn {
  return DatabaseColumnSchema.parse({
    id: input.id ?? idFactory('column'),
    tableId,
    name: input.name,
    type: input.type,
    primaryKey: input.primaryKey ?? false,
    nullable: input.nullable ?? true,
    unique: input.unique ?? false,
    autoIncrement: input.autoIncrement ?? false,
    unsigned: input.unsigned,
    defaultValue: input.defaultValue,
    generatedExpression: input.generatedExpression,
    collation: input.collation,
    comment: input.comment,
  });
}

function getDefaultTableColumns(): CreateTableColumnInput[] {
  return [
    {
      name: 'id',
      type: { family: 'uuid' },
      primaryKey: true,
      nullable: false,
    },
    {
      name: 'name',
      type: { family: 'varchar', length: 160 },
      nullable: false,
    },
  ];
}

function finalizeDiagramModel(model: DiagramModel, options: DiagramCommandOptions): DiagramModel {
  return DiagramModelSchema.parse({
    ...model,
    metadata: {
      ...model.metadata,
      updatedAt: options.now?.() ?? new Date().toISOString(),
    },
  });
}

function clampTableWidth(model: DiagramModel, width: number): number {
  const minWidth = model.metadata.tableMinWidth ?? defaultTableMinWidth;
  return Math.max(minWidth, Math.round(width));
}

function insertColumnId(
  columnIds: string[],
  columnId: string,
  command: Pick<CreateColumnCommand, 'afterColumnId' | 'atIndex'>,
): string[] {
  if (command.afterColumnId) {
    const afterIndex = columnIds.indexOf(command.afterColumnId);
    if (afterIndex === -1) {
      throw new DiagramCommandError(`Column "${command.afterColumnId}" does not exist in the target table`);
    }

    return insertAtIndex(columnIds, columnId, afterIndex + 1);
  }

  return insertAtIndex(columnIds, columnId, command.atIndex ?? columnIds.length);
}

function insertAtIndex(values: string[], value: string, index: number): string[] {
  const nextValues = [...values];
  nextValues.splice(Math.min(Math.max(index, 0), values.length), 0, value);
  return nextValues;
}

function requireTable(model: DiagramModel, tableId: string): DatabaseTable {
  const table = model.tables[tableId];
  if (!table) {
    throw new DiagramCommandError(`Table "${tableId}" does not exist`);
  }

  return table;
}

function requireColumn(model: DiagramModel, columnId: string): DatabaseColumn {
  const column = model.columns[columnId];
  if (!column) {
    throw new DiagramCommandError(`Column "${columnId}" does not exist`);
  }

  return column;
}

function requireRelationship(model: DiagramModel, relationshipId: string): DatabaseRelationship {
  const relationship = model.relationships[relationshipId];
  if (!relationship) {
    throw new DiagramCommandError(`Relationship "${relationshipId}" does not exist`);
  }

  return relationship;
}

function requireIndex(model: DiagramModel, indexId: string): DatabaseIndex {
  const index = model.indexes[indexId];
  if (!index) {
    throw new DiagramCommandError(`Index "${indexId}" does not exist`);
  }

  return index;
}

function assertMissingEntity(entity: unknown, message: string): void {
  if (entity) {
    throw new DiagramCommandError(message);
  }
}

function assertTableOwnsColumn(table: DatabaseTable, columnId: string): void {
  if (!table.columnIds.includes(columnId)) {
    throw new DiagramCommandError(`Column "${columnId}" does not belong to table "${table.id}"`);
  }
}

function assertRelationshipColumns(model: DiagramModel, tableId: string, columnIds: string[]): void {
  const table = requireTable(model, tableId);
  columnIds.forEach((columnId) => {
    const column = requireColumn(model, columnId);
    if (column.tableId !== table.id || !table.columnIds.includes(columnId)) {
      throw new DiagramCommandError(`Column "${columnId}" does not belong to table "${table.id}"`);
    }
  });
}

function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _removed, ...rest } = record;
  return rest;
}

function omitKeys<T>(record: Record<string, T>, keys: Set<string>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !keys.has(key)));
}
