import type { ColumnTypeSpec, DatabaseColumn, DiagramModel } from '@tabliodb/schema-core';

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
  const now = new Date().toISOString();

  return {
    dialect: 'postgresql',
    tables: {
      users: {
        id: 'users',
        name: 'users',
        position: { x: 80, y: 96 },
        columnIds: ['users-id', 'users-name', 'users-email'],
        indexIds: ['users-email-unique'],
        color: '#58cc02',
      },
      books: {
        id: 'books',
        name: 'books',
        position: { x: 520, y: 72 },
        columnIds: ['books-id', 'books-title', 'books-isbn'],
        indexIds: ['books-isbn-unique'],
        color: '#1cb0f6',
      },
      borrowings: {
        id: 'borrowings',
        name: 'borrowings',
        position: { x: 320, y: 348 },
        columnIds: ['borrowings-id', 'borrowings-user-id', 'borrowings-book-id', 'borrowings-due-at'],
        indexIds: ['borrowings-user-book-index'],
        color: '#ffc800',
      },
    },
    columns: {
      'users-id': createColumn('users-id', 'users', 'id', { family: 'uuid' }, { nullable: false, primaryKey: true }),
      'users-name': createColumn(
        'users-name',
        'users',
        'name',
        { family: 'varchar', length: 120 },
        { nullable: false },
      ),
      'users-email': createColumn(
        'users-email',
        'users',
        'email',
        { family: 'varchar', length: 190 },
        { nullable: false, unique: true },
      ),
      'books-id': createColumn('books-id', 'books', 'id', { family: 'uuid' }, { nullable: false, primaryKey: true }),
      'books-title': createColumn(
        'books-title',
        'books',
        'title',
        { family: 'varchar', length: 220 },
        { nullable: false },
      ),
      'books-isbn': createColumn(
        'books-isbn',
        'books',
        'isbn',
        { family: 'varchar', length: 32 },
        { nullable: false, unique: true },
      ),
      'borrowings-id': createColumn(
        'borrowings-id',
        'borrowings',
        'id',
        { family: 'uuid' },
        { nullable: false, primaryKey: true },
      ),
      'borrowings-user-id': createColumn(
        'borrowings-user-id',
        'borrowings',
        'user_id',
        { family: 'uuid' },
        { nullable: false },
      ),
      'borrowings-book-id': createColumn(
        'borrowings-book-id',
        'borrowings',
        'book_id',
        { family: 'uuid' },
        { nullable: false },
      ),
      'borrowings-due-at': createColumn(
        'borrowings-due-at',
        'borrowings',
        'due_at',
        { family: 'timestamp' },
        { nullable: false },
      ),
    },
    indexes: {
      'users-email-unique': {
        id: 'users-email-unique',
        tableId: 'users',
        name: 'users_email_key',
        columnIds: ['users-email'],
        unique: true,
      },
      'books-isbn-unique': {
        id: 'books-isbn-unique',
        tableId: 'books',
        name: 'books_isbn_key',
        columnIds: ['books-isbn'],
        unique: true,
      },
      'borrowings-user-book-index': {
        id: 'borrowings-user-book-index',
        tableId: 'borrowings',
        name: 'borrowings_user_book_idx',
        columnIds: ['borrowings-user-id', 'borrowings-book-id'],
        unique: false,
      },
    },
    relationships: {
      'users-borrowings': {
        id: 'users-borrowings',
        sourceTableId: 'users',
        sourceColumnId: 'users-id',
        targetTableId: 'borrowings',
        targetColumnId: 'borrowings-user-id',
        cardinality: 'one-to-many',
        onDelete: 'cascade',
        name: 'borrowings_user_id_fkey',
      },
      'books-borrowings': {
        id: 'books-borrowings',
        sourceTableId: 'books',
        sourceColumnId: 'books-id',
        targetTableId: 'borrowings',
        targetColumnId: 'borrowings-book-id',
        cardinality: 'one-to-many',
        onDelete: 'restrict',
        name: 'borrowings_book_id_fkey',
      },
    },
    enums: {},
    notes: {},
    metadata: {
      name,
      updatedAt: now,
    },
  };
}

export function addTableToDiagramModel(model: DiagramModel, tableName?: string): DiagramModel {
  const nextIndex = Object.keys(model.tables).length + 1;
  const tableId = `table-${Date.now()}`;
  const idColumnId = `${tableId}-id`;
  const nameColumnId = `${tableId}-name`;
  const normalizedName = normalizeTableName(tableName) || `new_table_${nextIndex}`;

  return {
    ...model,
    tables: {
      ...model.tables,
      [tableId]: {
        id: tableId,
        name: normalizedName,
        position: { x: 160 + nextIndex * 36, y: 120 + nextIndex * 28 },
        columnIds: [idColumnId, nameColumnId],
        indexIds: [],
        color: '#1cb0f6',
      },
    },
    columns: {
      ...model.columns,
      [idColumnId]: createColumn(idColumnId, tableId, 'id', { family: 'uuid' }, { nullable: false, primaryKey: true }),
      [nameColumnId]: createColumn(
        nameColumnId,
        tableId,
        'name',
        { family: 'varchar', length: 160 },
        { nullable: false },
      ),
    },
    metadata: {
      ...model.metadata,
      updatedAt: new Date().toISOString(),
    },
  };
}

function normalizeTableName(tableName?: string): string {
  return (tableName ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function createColumn(
  id: string,
  tableId: string,
  name: string,
  type: ColumnTypeSpec,
  options: Partial<Pick<DatabaseColumn, 'autoIncrement' | 'nullable' | 'primaryKey' | 'unique'>> = {},
): DatabaseColumn {
  return {
    id,
    tableId,
    name,
    type,
    autoIncrement: options.autoIncrement ?? false,
    nullable: options.nullable ?? true,
    primaryKey: options.primaryKey ?? false,
    unique: options.unique ?? false,
  };
}
