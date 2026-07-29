import {
  DiagramModel,
  getTableColumns,
  type ColumnTypeSpec,
  type DatabaseColumn,
  type DatabaseDialect,
} from '@tabliodb/schema-core';

export type SqlDialect = DatabaseDialect;

export type GenerateSqlOptions = {
  dialect: SqlDialect;
  includeComments?: boolean;
};

export function generateCreateSchemaSql(model: DiagramModel, options: GenerateSqlOptions): string {
  const statements = Object.values(model.tables).map((table) => {
    const columns = getTableColumns(model, table.id);
    const body = columns.map((column) => `  ${renderColumn(column, options.dialect)}`).join(',\n');
    const tableName = table.schema
      ? `${quoteIdentifier(table.schema, options.dialect)}.${quoteIdentifier(table.name, options.dialect)}`
      : quoteIdentifier(table.name, options.dialect);

    return `CREATE TABLE ${tableName} (\n${body}\n);`;
  });

  return statements.join('\n\n');
}

function renderColumn(column: DatabaseColumn, dialect: SqlDialect): string {
  const parts = [
    quoteIdentifier(column.name, dialect),
    renderType(column.type, dialect),
    column.primaryKey ? 'PRIMARY KEY' : undefined,
    column.nullable ? undefined : 'NOT NULL',
    column.unique ? 'UNIQUE' : undefined,
    column.defaultValue ? `DEFAULT ${column.defaultValue}` : undefined,
  ];

  // Undefined fragments are filtered so new constraints can be appended without rewriting this renderer.
  return parts.filter(Boolean).join(' ');
}

function renderType(type: ColumnTypeSpec, dialect: SqlDialect): string {
  if (type.raw) {
    return type.raw;
  }

  if (type.family === 'varchar') {
    return `VARCHAR(${type.length ?? 255})`;
  }

  if (type.family === 'decimal') {
    return `DECIMAL(${type.precision ?? 10}, ${type.scale ?? 2})`;
  }

  if (type.family === 'json') {
    return dialect === 'postgresql' ? 'JSONB' : 'JSON';
  }

  if (type.family === 'timestamp') {
    return dialect === 'postgresql' ? 'TIMESTAMPTZ' : 'DATETIME';
  }

  return type.family.toUpperCase();
}

function quoteIdentifier(value: string, dialect: SqlDialect): string {
  const quote = dialect === 'mysql' ? '`' : '"';
  return `${quote}${value.replaceAll(quote, `${quote}${quote}`)}${quote}`;
}
