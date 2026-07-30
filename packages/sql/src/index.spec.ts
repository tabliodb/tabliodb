import { createStarterDiagramModel, type DiagramModel } from '@tabliodb/schema-core';
import { describe, expect, it } from 'vitest';
import { generateCreateSchemaSql, generateCreateSchemaSqlWithWarnings, parseCreateSchemaSql } from './index.js';

describe('generateCreateSchemaSql', () => {
  it('renders PostgreSQL enum types before dependent tables', () => {
    const model = createEnumSqlTestModel({
      enumValues: ['draft', 'published'],
    });

    expect(generateCreateSchemaSql(model, { dialect: 'postgresql' })).toContain(
      `CREATE TYPE "order_status" AS ENUM ('draft', 'published');`,
    );
    expect(generateCreateSchemaSql(model, { dialect: 'postgresql' })).toContain(`"status" "order_status" NOT NULL`);
  });

  it('renders MySQL enum columns inline', () => {
    const model = createEnumSqlTestModel({
      enumValues: ['draft', "needs'review"],
    });

    // MySQL has inline ENUM columns, and string labels still need SQL literal escaping.
    expect(generateCreateSchemaSql(model, { dialect: 'mysql' })).toContain(
      "`status` ENUM('draft', 'needs''review') NOT NULL",
    );
  });

  it('renders table check constraints', () => {
    const model = createEnumSqlTestModel({
      enumValues: ['draft', 'published'],
    });
    model.checks = {
      'orders-status-check': {
        columnId: 'orders-status',
        expression: "status IN ('draft', 'published')",
        id: 'orders-status-check',
        name: 'orders_status_check',
        tableId: 'orders',
      },
    };

    expect(generateCreateSchemaSql(model, { dialect: 'postgresql' })).toContain(
      `CONSTRAINT "orders_status_check" CHECK (status IN ('draft', 'published'))`,
    );
  });

  it('renders foreign keys and named indexes from the starter diagram', () => {
    const sql = generateCreateSchemaSql(createStarterDiagramModel(), { dialect: 'postgresql' });

    // Relationships target the FK-side table and preserve stable column IDs as quoted SQL identifiers.
    expect(sql).toContain(
      `CONSTRAINT "borrowings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE`,
    );
    expect(sql).toContain(`CREATE UNIQUE INDEX "users_email_key" ON "users" ("email");`);
    expect(sql).toContain(`CREATE INDEX "borrowings_user_book_idx" ON "borrowings" ("user_id", "book_id");`);
  });

  it('renders PostgreSQL comments as separate COMMENT statements', () => {
    const model = createStarterDiagramModel('Comment test');
    model.tables.users.comment = 'Application users';
    model.columns['users-email']!.comment = 'Login email address';
    model.indexes['users-email-unique']!.comment = 'Guarantees one account per email';

    const sql = generateCreateSchemaSql(model, { dialect: 'postgresql' });

    expect(sql).toContain(`COMMENT ON TABLE "users" IS 'Application users';`);
    expect(sql).toContain(`COMMENT ON COLUMN "users"."email" IS 'Login email address';`);
    expect(sql).toContain(`COMMENT ON INDEX "users_email_key" IS 'Guarantees one account per email';`);
  });

  it('renders MySQL type map and inline comments', () => {
    const model = createStarterDiagramModel('MySQL test', 'mysql');
    model.tables.users.comment = 'Application users';
    model.columns['users-id']!.autoIncrement = false;
    model.columns['users-email']!.comment = 'Login email address';

    const sql = generateCreateSchemaSql(model, { dialect: 'mysql' });

    expect(sql).toContain('`id` CHAR(36) PRIMARY KEY NOT NULL');
    expect(sql).toContain("`email` VARCHAR(190) NOT NULL COMMENT 'Login email address'");
    expect(sql).toContain(") COMMENT='Application users';");
  });

  it('returns warnings for features a dialect cannot faithfully emit', () => {
    const model = createEnumSqlTestModel({
      enumValues: ['draft', 'published'],
    });
    model.tables.orders.schema = 'public';
    model.indexes['orders-status-idx'] = {
      columns: [{ columnId: 'orders-status' }],
      id: 'orders-status-idx',
      includeColumnIds: ['orders-id'],
      name: 'orders_status_idx',
      tableId: 'orders',
      unique: false,
      where: 'status <> draft',
    };

    const result = generateCreateSchemaSqlWithWarnings(model, { dialect: 'sqlite' });

    expect(result.sql).toContain('"status" TEXT NOT NULL');
    expect(result.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(['schema_not_supported', 'enum_fallback_to_text', 'index_include_not_supported']),
    );
  });
});

describe('parseCreateSchemaSql', () => {
  it('imports PostgreSQL tables, enum columns, foreign keys, and indexes', () => {
    const result = parseCreateSchemaSql(
      `
        CREATE TYPE "order_status" AS ENUM ('draft', 'paid');

        CREATE TABLE "users" (
          "id" UUID PRIMARY KEY NOT NULL,
          "email" VARCHAR(190) NOT NULL UNIQUE
        );

        CREATE TABLE "orders" (
          "id" UUID PRIMARY KEY,
          "user_id" UUID NOT NULL,
          "status" "order_status" NOT NULL DEFAULT 'draft',
          CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
        );

        CREATE INDEX "orders_user_id_idx" ON "orders" ("user_id");
      `,
      { diagramName: 'Imported SQL', dialect: 'postgresql' },
    );

    const users = Object.values(result.model.tables).find((table) => table.name === 'users');
    const orders = Object.values(result.model.tables).find((table) => table.name === 'orders');
    const status = Object.values(result.model.columns).find((column) => column.name === 'status');
    const relationship = Object.values(result.model.relationships)[0];
    const index = Object.values(result.model.indexes).find(
      (databaseIndex) => databaseIndex.name === 'orders_user_id_idx',
    );

    expect(result.warnings).toEqual([]);
    expect(users).toBeDefined();
    expect(orders).toBeDefined();
    expect(status?.type.family).toBe('enum');
    expect(status?.defaultValue).toBe("'draft'");
    expect(relationship?.sourceTableId).toBe(users?.id);
    expect(relationship?.targetTableId).toBe(orders?.id);
    expect(relationship?.onDelete).toBe('cascade');
    expect(index?.columns).toHaveLength(1);
  });

  it('imports MySQL inline enum values and inline foreign keys', () => {
    const result = parseCreateSchemaSql(
      `
        CREATE TABLE \`users\` (
          \`id\` CHAR(36) PRIMARY KEY
        );

        CREATE TABLE \`posts\` (
          \`id\` CHAR(36) PRIMARY KEY,
          \`status\` ENUM('draft', 'published') NOT NULL,
          \`author_id\` CHAR(36) REFERENCES \`users\` (\`id\`),
          KEY \`posts_author_idx\` (\`author_id\`)
        );
      `,
      { dialect: 'mysql' },
    );

    const status = Object.values(result.model.columns).find((column) => column.name === 'status');
    const databaseEnum = status?.type.enumId ? result.model.enums[status.type.enumId] : undefined;

    expect(result.warnings).toEqual([]);
    expect(result.model.dialect).toBe('mysql');
    expect(status?.type.family).toBe('enum');
    expect(databaseEnum?.values).toEqual(['draft', 'published']);
    expect(Object.values(result.model.indexes).find((index) => index.name === 'posts_author_idx')).toBeDefined();
    expect(Object.values(result.model.relationships)).toHaveLength(1);
  });

  it('warns when a SQL statement is outside the basic DDL importer scope', () => {
    const result = parseCreateSchemaSql(
      `
        CREATE TABLE users (
          id UUID PRIMARY KEY
        );

        INSERT INTO users (id) VALUES ('abc');
      `,
      { dialect: 'postgresql' },
    );

    expect(result.model.tables).toMatchObject({
      'table-users': {
        name: 'users',
      },
    });
    expect(result.warnings.map((warning) => warning.code)).toEqual(['unsupported_statement']);
  });
});

function createEnumSqlTestModel({ enumValues }: { enumValues: string[] }): DiagramModel {
  return {
    checks: {},
    columns: {
      'orders-id': {
        autoIncrement: false,
        id: 'orders-id',
        name: 'id',
        nullable: false,
        primaryKey: true,
        tableId: 'orders',
        type: { family: 'uuid' },
        unique: false,
      },
      'orders-status': {
        autoIncrement: false,
        id: 'orders-status',
        name: 'status',
        nullable: false,
        primaryKey: false,
        tableId: 'orders',
        type: { family: 'enum', enumId: 'order-status' },
        unique: false,
      },
    },
    dialect: 'postgresql',
    enums: {
      'order-status': {
        id: 'order-status',
        name: 'order_status',
        values: enumValues,
      },
    },
    groups: {},
    indexes: {},
    metadata: {
      name: 'Enum SQL test',
    },
    notes: {},
    relationships: {},
    schemaVersion: 1,
    tables: {
      orders: {
        id: 'orders',
        indexIds: [],
        name: 'orders',
        columnIds: ['orders-id', 'orders-status'],
        position: { x: 0, y: 0 },
        width: 288,
      },
    },
  };
}
