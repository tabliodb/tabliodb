import type { DiagramModel } from '@tabliodb/schema-core';
import { describe, expect, it } from 'vitest';
import { generateCreateSchemaSql } from './index.js';

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
