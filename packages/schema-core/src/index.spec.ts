import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  DiagramCommandError,
  applyDiagramCommand,
  createEmptyDiagramModel,
  createSequentialDiagramIdFactory,
  createStarterDiagramModel,
  decodeDiagramModelFromYjsUpdate,
  encodeDiagramModelAsYjsUpdate,
  getTableColumns,
  hasDiagramModelInYjsDocument,
  readDiagramModelFromYjsDocument,
  serializeDiagramModel,
  writeDiagramModelToYjsDocument,
  yjsCollections,
} from './index.js';

const fixedNow = () => '2026-07-29T00:00:00.000Z';

describe('schema-core diagram commands', () => {
  it('creates the canonical starter diagram used by dev seed and the frontend', () => {
    const model = createStarterDiagramModel('Library System');

    // The starter diagram is intentionally covered in schema-core so server seed and frontend initial snapshots cannot drift.
    expect(Object.keys(model.tables)).toEqual(['users', 'books', 'borrowings']);
    expect(getTableColumns(model, 'borrowings').map((column) => column.name)).toEqual([
      'id',
      'user_id',
      'book_id',
      'due_at',
    ]);
    expect(model.indexes['borrowings-user-book-index']).toMatchObject({
      columns: [{ columnId: 'borrowings-user-id' }, { columnId: 'borrowings-book-id' }],
      unique: false,
    });
    expect(model.relationships['users-borrowings']).toMatchObject({
      sourceColumnIds: ['users-id'],
      targetColumnIds: ['borrowings-user-id'],
      cardinality: 'one_to_many',
    });
  });

  it('round-trips a diagram model through granular Yjs collections', () => {
    const document = new Y.Doc();
    const model = applyDiagramCommand(
      createEmptyDiagramModel('Realtime adapter test'),
      {
        type: 'table.create',
        columns: [
          { id: 'users-id', name: 'id', nullable: false, primaryKey: true, type: { family: 'uuid' } },
          { id: 'users-email', name: 'email', nullable: false, unique: true, type: { family: 'varchar', length: 190 } },
        ],
        name: 'users',
        position: { x: 40, y: 80 },
        tableId: 'users',
      },
      { now: fixedNow },
    );

    writeDiagramModelToYjsDocument(document, model);

    const tables = document.getMap<Y.Map<unknown>>(yjsCollections.tables);
    expect(hasDiagramModelInYjsDocument(document)).toBe(true);
    expect(tables.get('users')).toBeInstanceOf(Y.Map);
    expect(readDiagramModelFromYjsDocument(document)).toEqual(serializeDiagramModel(model));
  });

  it('encodes and decodes a diagram model as a portable Yjs update', () => {
    const model = applyDiagramCommand(
      createEmptyDiagramModel('Realtime update test'),
      {
        type: 'table.create',
        columns: [{ id: 'sessions-id', name: 'id', nullable: false, primaryKey: true, type: { family: 'uuid' } }],
        name: 'sessions',
        tableId: 'sessions',
      },
      { now: fixedNow },
    );
    const update = encodeDiagramModelAsYjsUpdate(model);

    expect(update.byteLength).toBeGreaterThan(0);
    expect(decodeDiagramModelFromYjsUpdate(update)).toEqual(serializeDiagramModel(model));
  });

  it('removes stale Yjs entities when the canonical model deletes them', () => {
    const document = new Y.Doc();
    const model = applyDiagramCommand(
      createEmptyDiagramModel('Realtime delete test'),
      {
        type: 'table.create',
        columns: [{ id: 'books-id', name: 'id', nullable: false, primaryKey: true, type: { family: 'uuid' } }],
        name: 'books',
        tableId: 'books',
      },
      { now: fixedNow },
    );
    const deletedModel = applyDiagramCommand(model, { tableId: 'books', type: 'table.delete' }, { now: fixedNow });

    writeDiagramModelToYjsDocument(document, model);
    writeDiagramModelToYjsDocument(document, deletedModel);

    // The Yjs adapter mirrors deletes instead of keeping orphaned entities that could reappear after reconnect.
    expect(document.getMap(yjsCollections.tables).has('books')).toBe(false);
    expect(document.getMap(yjsCollections.columns).has('books-id')).toBe(false);
    expect(readDiagramModelFromYjsDocument(document)).toEqual(serializeDiagramModel(deletedModel));
  });

  it('uses an explicit fallback for an empty Yjs document', () => {
    const document = new Y.Doc();
    const fallback = createEmptyDiagramModel('Fallback model');

    expect(hasDiagramModelInYjsDocument(document)).toBe(false);
    expect(readDiagramModelFromYjsDocument(document, fallback)).toEqual(serializeDiagramModel(fallback));
    expect(() => readDiagramModelFromYjsDocument(document)).toThrow(DiagramCommandError);
  });

  it('creates a table with stable generated IDs and default columns', () => {
    const model = createEmptyDiagramModel('Command test');
    const nextModel = applyDiagramCommand(
      model,
      {
        type: 'table.create',
        name: 'users',
        position: { x: 24, y: 48 },
      },
      { idFactory: createSequentialDiagramIdFactory('test'), now: fixedNow },
    );

    const table = nextModel.tables.test_table_1;
    expect(table).toMatchObject({
      id: 'test_table_1',
      name: 'users',
      position: { x: 24, y: 48 },
      width: 288,
    });
    expect(table.columnIds).toEqual(['test_column_1', 'test_column_2']);
    expect(nextModel.columns.test_column_1).toMatchObject({
      name: 'id',
      primaryKey: true,
      nullable: false,
      tableId: table.id,
    });
    expect(nextModel.metadata.updatedAt).toBe(fixedNow());
  });

  it('moves and resizes tables without mutating the previous model', () => {
    const model = applyDiagramCommand(
      createEmptyDiagramModel('Resize test'),
      {
        type: 'table.create',
        name: 'books',
        tableId: 'books',
        width: 300,
      },
      { now: fixedNow },
    );
    const nextModel = applyDiagramCommand(
      model,
      {
        type: 'table.resize',
        tableId: 'books',
        width: 120,
      },
      { now: fixedNow },
    );

    expect(model.tables.books.width).toBe(300);
    expect(nextModel.tables.books.width).toBe(240);
  });

  it('updates a column without mutating the previous model', () => {
    const model = applyDiagramCommand(
      createEmptyDiagramModel('Column update test'),
      {
        type: 'table.create',
        tableId: 'users',
        name: 'users',
        columns: [{ id: 'users-name', name: 'name', type: { family: 'varchar', length: 120 }, nullable: true }],
      },
      { now: fixedNow },
    );
    const nextModel = applyDiagramCommand(
      model,
      {
        type: 'column.update',
        columnId: 'users-name',
        changes: {
          defaultValue: "'anonymous'",
          name: 'display_name',
          nullable: false,
          type: { family: 'varchar', length: 180 },
          unique: true,
        },
      },
      { now: () => '2026-07-29T01:00:00.000Z' },
    );

    // The command API is immutable so optimistic UI, undo, and realtime sync can compare old/new model snapshots safely.
    expect(model.columns['users-name']).toMatchObject({
      name: 'name',
      nullable: true,
      unique: false,
    });
    expect(nextModel.columns['users-name']).toMatchObject({
      defaultValue: "'anonymous'",
      name: 'display_name',
      nullable: false,
      type: { family: 'varchar', length: 180 },
      unique: true,
    });
    expect(nextModel.metadata.updatedAt).toBe('2026-07-29T01:00:00.000Z');
  });

  it('creates and updates an index without mutating the previous model', () => {
    const model = applyDiagramCommand(
      createEmptyDiagramModel('Index builder test'),
      {
        type: 'table.create',
        tableId: 'users',
        name: 'users',
        columns: [
          { id: 'users-id', name: 'id', type: { family: 'uuid' }, primaryKey: true, nullable: false },
          { id: 'users-email', name: 'email', type: { family: 'varchar', length: 190 }, nullable: false },
          { id: 'users-status', name: 'status', type: { family: 'varchar', length: 32 }, nullable: false },
        ],
      },
      { now: fixedNow },
    );
    const indexedModel = applyDiagramCommand(
      model,
      {
        type: 'index.create',
        indexId: 'users-email-idx',
        tableId: 'users',
        name: 'users_email_idx',
        columns: [{ columnId: 'users-email', order: 'asc', nulls: 'last' }],
        includeColumnIds: ['users-status'],
        method: 'btree',
        unique: true,
        where: 'status = active',
      },
      { now: fixedNow },
    );
    const nextModel = applyDiagramCommand(
      indexedModel,
      {
        type: 'index.update',
        indexId: 'users-email-idx',
        changes: {
          comment: 'Lookup active users by status and email',
          columns: [
            { columnId: 'users-status', order: 'desc' },
            { columnId: 'users-email', order: 'asc' },
          ],
          includeColumnIds: ['users-id'],
          name: 'users_status_email_idx',
          unique: false,
          where: 'status <> archived',
        },
      },
      { now: () => '2026-07-29T03:00:00.000Z' },
    );

    // Index commands are immutable so table-level index editing can later support undo and collaboration snapshots.
    expect(model.tables.users.indexIds).toEqual([]);
    expect(indexedModel.tables.users.indexIds).toEqual(['users-email-idx']);
    expect(indexedModel.indexes['users-email-idx']).toMatchObject({
      columns: [{ columnId: 'users-email', order: 'asc', nulls: 'last' }],
      includeColumnIds: ['users-status'],
      method: 'btree',
      unique: true,
    });
    expect(nextModel.indexes['users-email-idx']).toMatchObject({
      columns: [
        { columnId: 'users-status', order: 'desc' },
        { columnId: 'users-email', order: 'asc' },
      ],
      comment: 'Lookup active users by status and email',
      includeColumnIds: ['users-id'],
      name: 'users_status_email_idx',
      unique: false,
      where: 'status <> archived',
    });
    expect(nextModel.metadata.updatedAt).toBe('2026-07-29T03:00:00.000Z');
  });

  it('creates, updates, and deletes check constraints immutably', () => {
    const model = applyDiagramCommand(
      createEmptyDiagramModel('Check constraint test'),
      {
        type: 'table.create',
        tableId: 'orders',
        name: 'orders',
        columns: [
          { id: 'orders-id', name: 'id', type: { family: 'uuid' }, primaryKey: true, nullable: false },
          { id: 'orders-total', name: 'total', type: { family: 'decimal', precision: 12, scale: 2 }, nullable: false },
        ],
      },
      { now: fixedNow },
    );
    const checkedModel = applyDiagramCommand(
      model,
      {
        type: 'check.create',
        checkId: 'orders-total-positive',
        tableId: 'orders',
        columnId: 'orders-total',
        name: 'orders_total_positive',
        expression: 'total >= 0',
      },
      { now: fixedNow },
    );
    const nextModel = applyDiagramCommand(
      checkedModel,
      {
        type: 'check.update',
        checkId: 'orders-total-positive',
        changes: {
          comment: 'Revenue totals cannot be negative',
          expression: 'total >= 0 AND total < 1000000',
          name: 'orders_total_range',
        },
      },
      { now: () => '2026-07-29T05:00:00.000Z' },
    );
    const deletedModel = applyDiagramCommand(
      nextModel,
      { type: 'check.delete', checkId: 'orders-total-positive' },
      { now: fixedNow },
    );

    // Check constraints live in the canonical model so SQL export, snapshots, and realtime sync share one source.
    expect(model.checks['orders-total-positive']).toBeUndefined();
    expect(checkedModel.checks['orders-total-positive']).toMatchObject({
      columnId: 'orders-total',
      expression: 'total >= 0',
      name: 'orders_total_positive',
      tableId: 'orders',
    });
    expect(nextModel.checks['orders-total-positive']).toMatchObject({
      comment: 'Revenue totals cannot be negative',
      expression: 'total >= 0 AND total < 1000000',
      name: 'orders_total_range',
    });
    expect(nextModel.metadata.updatedAt).toBe('2026-07-29T05:00:00.000Z');
    expect(deletedModel.checks['orders-total-positive']).toBeUndefined();
  });

  it('throws a domain error when a check constraint points to another table column', () => {
    const model = applyDiagramCommand(
      applyDiagramCommand(
        createEmptyDiagramModel('Invalid check test'),
        {
          type: 'table.create',
          tableId: 'orders',
          name: 'orders',
          columns: [{ id: 'orders-total', name: 'total', type: { family: 'decimal' }, nullable: false }],
        },
        { now: fixedNow },
      ),
      {
        type: 'table.create',
        tableId: 'users',
        name: 'users',
        columns: [{ id: 'users-age', name: 'age', type: { family: 'integer' }, nullable: false }],
      },
      { now: fixedNow },
    );

    expect(() =>
      applyDiagramCommand(
        model,
        {
          type: 'check.create',
          tableId: 'orders',
          columnId: 'users-age',
          name: 'orders_bad_check',
          expression: 'age > 0',
        },
        { now: fixedNow },
      ),
    ).toThrow(DiagramCommandError);
  });

  it('creates and updates enums while protecting used enum types', () => {
    const model = createEmptyDiagramModel('Enum editor test');
    const modelWithEnum = applyDiagramCommand(
      model,
      {
        type: 'enum.create',
        enumId: 'order-status',
        name: 'order_status',
        values: ['draft', 'published', 'draft'],
      },
      { now: fixedNow },
    );
    const modelWithColumn = applyDiagramCommand(
      modelWithEnum,
      {
        type: 'table.create',
        tableId: 'orders',
        name: 'orders',
        columns: [
          { id: 'orders-id', name: 'id', type: { family: 'uuid' }, primaryKey: true, nullable: false },
          {
            id: 'orders-status',
            name: 'status',
            type: { family: 'enum', enumId: 'order-status' },
            nullable: false,
          },
        ],
      },
      { now: fixedNow },
    );
    const nextModel = applyDiagramCommand(
      modelWithColumn,
      {
        type: 'enum.update',
        enumId: 'order-status',
        changes: {
          comment: 'Public workflow states',
          values: ['draft', 'published', 'archived', 'published'],
        },
      },
      { now: () => '2026-07-29T04:00:00.000Z' },
    );

    // Enum values are deduped at the command boundary so generated SQL never receives duplicate labels.
    expect(model.enums['order-status']).toBeUndefined();
    expect(modelWithEnum.enums['order-status'].values).toEqual(['draft', 'published']);
    expect(nextModel.enums['order-status']).toMatchObject({
      comment: 'Public workflow states',
      values: ['draft', 'published', 'archived'],
    });
    expect(nextModel.metadata.updatedAt).toBe('2026-07-29T04:00:00.000Z');
    expect(() =>
      applyDiagramCommand(nextModel, { type: 'enum.delete', enumId: 'order-status' }, { now: fixedNow }),
    ).toThrow(DiagramCommandError);
  });

  it('throws a domain error when an enum column references a missing enum', () => {
    expect(() =>
      applyDiagramCommand(
        createEmptyDiagramModel('Missing enum test'),
        {
          type: 'table.create',
          tableId: 'orders',
          name: 'orders',
          columns: [{ id: 'orders-status', name: 'status', type: { family: 'enum', enumId: 'missing-enum' } }],
        },
        { now: fixedNow },
      ),
    ).toThrow(DiagramCommandError);
  });

  it('deletes a column and removes dependent relationships and empty indexes', () => {
    const modelWithTables = applyDiagramCommand(
      applyDiagramCommand(
        createEmptyDiagramModel('Cleanup test'),
        {
          type: 'table.create',
          tableId: 'users',
          name: 'users',
          columns: [{ id: 'users-id', name: 'id', type: { family: 'uuid' }, primaryKey: true, nullable: false }],
        },
        { now: fixedNow },
      ),
      {
        type: 'table.create',
        tableId: 'borrowings',
        name: 'borrowings',
        columns: [
          { id: 'borrowings-id', name: 'id', type: { family: 'uuid' }, primaryKey: true, nullable: false },
          { id: 'borrowings-user-id', name: 'user_id', type: { family: 'uuid' }, nullable: false },
        ],
      },
      { now: fixedNow },
    );
    const modelWithRelationship = applyDiagramCommand(
      applyDiagramCommand(
        modelWithTables,
        {
          type: 'relationship.create',
          relationshipId: 'users-borrowings',
          sourceTableId: 'users',
          sourceColumnIds: ['users-id'],
          targetTableId: 'borrowings',
          targetColumnIds: ['borrowings-user-id'],
          cardinality: 'one_to_many',
        },
        { now: fixedNow },
      ),
      {
        type: 'index.create',
        indexId: 'borrowings-user-id-index',
        tableId: 'borrowings',
        name: 'borrowings_user_id_idx',
        columns: [{ columnId: 'borrowings-user-id' }],
      },
      { now: fixedNow },
    );

    const nextModel = applyDiagramCommand(
      modelWithRelationship,
      {
        type: 'column.delete',
        columnId: 'borrowings-user-id',
      },
      { now: fixedNow },
    );

    expect(nextModel.columns['borrowings-user-id']).toBeUndefined();
    expect(nextModel.relationships['users-borrowings']).toBeUndefined();
    expect(nextModel.indexes['borrowings-user-id-index']).toBeUndefined();
    expect(nextModel.tables.borrowings.columnIds).toEqual(['borrowings-id']);
    expect(nextModel.tables.borrowings.indexIds).toEqual([]);
  });

  it('deletes a table and cascades dependent model entities', () => {
    const model = applyDiagramCommand(
      applyDiagramCommand(
        createEmptyDiagramModel('Delete table test'),
        {
          type: 'table.create',
          tableId: 'users',
          name: 'users',
          columns: [{ id: 'users-id', name: 'id', type: { family: 'uuid' }, primaryKey: true, nullable: false }],
        },
        { now: fixedNow },
      ),
      {
        type: 'table.create',
        tableId: 'borrowings',
        name: 'borrowings',
        columns: [{ id: 'borrowings-user-id', name: 'user_id', type: { family: 'uuid' }, nullable: false }],
      },
      { now: fixedNow },
    );
    const relatedModel = applyDiagramCommand(
      model,
      {
        type: 'relationship.create',
        relationshipId: 'users-borrowings',
        sourceTableId: 'users',
        sourceColumnIds: ['users-id'],
        targetTableId: 'borrowings',
        targetColumnIds: ['borrowings-user-id'],
        cardinality: 'one_to_many',
      },
      { now: fixedNow },
    );

    const nextModel = applyDiagramCommand(relatedModel, { type: 'table.delete', tableId: 'users' }, { now: fixedNow });

    expect(nextModel.tables.users).toBeUndefined();
    expect(nextModel.columns['users-id']).toBeUndefined();
    expect(nextModel.relationships['users-borrowings']).toBeUndefined();
    expect(getTableColumns(nextModel, 'borrowings')).toHaveLength(1);
  });

  it('updates a relationship without mutating the previous model', () => {
    const modelWithUsers = applyDiagramCommand(
      createEmptyDiagramModel('Relationship update test'),
      {
        type: 'table.create',
        tableId: 'users',
        name: 'users',
        columns: [{ id: 'users-id', name: 'id', type: { family: 'uuid' }, primaryKey: true, nullable: false }],
      },
      { now: fixedNow },
    );
    const modelWithBorrowings = applyDiagramCommand(
      modelWithUsers,
      {
        type: 'table.create',
        tableId: 'borrowings',
        name: 'borrowings',
        columns: [
          { id: 'borrowings-user-id', name: 'user_id', type: { family: 'uuid' }, nullable: false },
          { id: 'borrowings-owner-id', name: 'owner_id', type: { family: 'uuid' }, nullable: false },
        ],
      },
      { now: fixedNow },
    );
    const model = applyDiagramCommand(
      modelWithBorrowings,
      {
        type: 'relationship.create',
        relationshipId: 'users-borrowings',
        sourceTableId: 'users',
        sourceColumnIds: ['users-id'],
        targetTableId: 'borrowings',
        targetColumnIds: ['borrowings-user-id'],
        cardinality: 'one_to_many',
        onDelete: 'cascade',
      },
      { now: fixedNow },
    );
    const nextModel = applyDiagramCommand(
      model,
      {
        type: 'relationship.update',
        relationshipId: 'users-borrowings',
        changes: {
          cardinality: 'one_to_one',
          comment: 'Primary borrower ownership',
          deferrable: true,
          matchType: 'full',
          name: 'borrowings_owner_id_fkey',
          onDelete: 'restrict',
          onUpdate: 'cascade',
          sourceColumnIds: ['users-id'],
          sourceTableId: 'users',
          targetColumnIds: ['borrowings-owner-id'],
          targetTableId: 'borrowings',
        },
      },
      { now: () => '2026-07-29T02:00:00.000Z' },
    );

    // Relationship updates preserve old snapshots so collaboration and undo can replay diagram changes predictably.
    expect(model.relationships['users-borrowings']).toMatchObject({
      cardinality: 'one_to_many',
      onDelete: 'cascade',
      targetColumnIds: ['borrowings-user-id'],
    });
    expect(nextModel.relationships['users-borrowings']).toMatchObject({
      cardinality: 'one_to_one',
      comment: 'Primary borrower ownership',
      deferrable: true,
      matchType: 'full',
      name: 'borrowings_owner_id_fkey',
      onDelete: 'restrict',
      onUpdate: 'cascade',
      targetColumnIds: ['borrowings-owner-id'],
    });
    expect(nextModel.metadata.updatedAt).toBe('2026-07-29T02:00:00.000Z');
  });

  it('throws a domain error when a relationship points to the wrong table column', () => {
    const model = applyDiagramCommand(
      applyDiagramCommand(
        createEmptyDiagramModel('Invalid relationship test'),
        {
          type: 'table.create',
          tableId: 'users',
          name: 'users',
          columns: [{ id: 'users-id', name: 'id', type: { family: 'uuid' }, primaryKey: true, nullable: false }],
        },
        { now: fixedNow },
      ),
      {
        type: 'table.create',
        tableId: 'books',
        name: 'books',
        columns: [{ id: 'books-id', name: 'id', type: { family: 'uuid' }, primaryKey: true, nullable: false }],
      },
      { now: fixedNow },
    );

    expect(() =>
      applyDiagramCommand(
        model,
        {
          type: 'relationship.create',
          sourceTableId: 'users',
          sourceColumnIds: ['books-id'],
          targetTableId: 'books',
          targetColumnIds: ['books-id'],
          cardinality: 'one_to_one',
        },
        { now: fixedNow },
      ),
    ).toThrow(DiagramCommandError);
  });
});
