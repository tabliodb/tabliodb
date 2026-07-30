import {
  DiagramModel,
  getTableColumns,
  type ColumnTypeSpec,
  type DatabaseColumn,
  type DatabaseCheck,
  type DatabaseDialect,
} from '@tabliodb/schema-core';

export type SqlDialect = DatabaseDialect;

export type GenerateSqlOptions = {
  dialect: SqlDialect;
  includeComments?: boolean;
};

export function generateCreateSchemaSql(model: DiagramModel, options: GenerateSqlOptions): string {
  const enumStatements = renderEnumStatements(model, options.dialect);
  const tableStatements = Object.values(model.tables).map((table) => {
    const columns = getTableColumns(model, table.id);
    const checks = Object.values(model.checks).filter((check) => check.tableId === table.id);
    const body = [
      ...columns.map((column) => renderColumn(column, model, options.dialect)),
      ...checks.map((check) => renderCheckConstraint(check, options.dialect)),
    ]
      .map((line) => `  ${line}`)
      .join(',\n');
    const tableName = table.schema
      ? `${quoteIdentifier(table.schema, options.dialect)}.${quoteIdentifier(table.name, options.dialect)}`
      : quoteIdentifier(table.name, options.dialect);

    return `CREATE TABLE ${tableName} (\n${body}\n);`;
  });

  return [...enumStatements, ...tableStatements].join('\n\n');
}

function renderColumn(column: DatabaseColumn, model: DiagramModel, dialect: SqlDialect): string {
  const parts = [
    quoteIdentifier(column.name, dialect),
    renderType(column.type, model, dialect),
    column.primaryKey ? 'PRIMARY KEY' : undefined,
    column.nullable ? undefined : 'NOT NULL',
    column.unique ? 'UNIQUE' : undefined,
    column.defaultValue ? `DEFAULT ${column.defaultValue}` : undefined,
  ];

  // Undefined fragments are filtered so new constraints can be appended without rewriting this renderer.
  return parts.filter(Boolean).join(' ');
}

function renderCheckConstraint(check: DatabaseCheck, dialect: SqlDialect): string {
  // Checks are table constraints so a later expression can reference multiple columns without changing the model shape.
  return `CONSTRAINT ${quoteIdentifier(check.name, dialect)} CHECK (${check.expression})`;
}

function renderType(type: ColumnTypeSpec, model: DiagramModel, dialect: SqlDialect): string {
  if (type.raw) {
    return type.raw;
  }

  if (type.family === 'enum') {
    return renderEnumType(type, model, dialect);
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

function renderEnumStatements(model: DiagramModel, dialect: SqlDialect): string[] {
  if (dialect !== 'postgresql') {
    return [];
  }

  return Object.values(model.enums).map((databaseEnum) => {
    const enumName = renderQualifiedName(databaseEnum.schema, databaseEnum.name, dialect);
    const values = databaseEnum.values.map(quoteStringLiteral).join(', ');

    // PostgreSQL enum types must be declared before tables can reference them.
    return `CREATE TYPE ${enumName} AS ENUM (${values});`;
  });
}

function renderEnumType(type: ColumnTypeSpec, model: DiagramModel, dialect: SqlDialect): string {
  const databaseEnum = type.enumId ? model.enums[type.enumId] : undefined;

  if (!databaseEnum) {
    return 'TEXT';
  }

  if (dialect === 'postgresql') {
    return renderQualifiedName(databaseEnum.schema, databaseEnum.name, dialect);
  }

  if (dialect === 'mysql' || dialect === 'mariadb') {
    return `ENUM(${databaseEnum.values.map(quoteStringLiteral).join(', ')})`;
  }

  return 'TEXT';
}

function renderQualifiedName(schema: string | undefined, name: string, dialect: SqlDialect): string {
  return schema
    ? `${quoteIdentifier(schema, dialect)}.${quoteIdentifier(name, dialect)}`
    : quoteIdentifier(name, dialect);
}

function quoteIdentifier(value: string, dialect: SqlDialect): string {
  const quote = dialect === 'mysql' ? '`' : '"';
  return `${quote}${value.replaceAll(quote, `${quote}${quote}`)}${quote}`;
}

function quoteStringLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
