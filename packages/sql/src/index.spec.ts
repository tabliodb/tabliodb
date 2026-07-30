import { createStarterDiagramModel, type DiagramModel } from '@tabliodb/schema-core';
import { describe, expect, it } from 'vitest';
import { generateCreateSchemaSql, generateCreateSchemaSqlWithWarnings } from './index.js';

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
