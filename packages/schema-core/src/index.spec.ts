import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  DiagramCommandError,
  applyDiagramCommand,
  applyDiagramCommands,
  createEmptyDiagramModel,
  createSequentialDiagramIdFactory,
  createStarterDiagramModel,
  currentDiagramSchemaVersion,
  decodeDiagramModelFromYjsUpdate,
  encodeDiagramModelAsYjsUpdate,
  getDiagramModelIntegrityWarnings,
  getDiagramReviewSignals,
  getTableColumns,
  hasDiagramModelInYjsDocument,
  migrateDiagramModelWithReport,
  normalizeDiagramModel,
  parseDiagramModel,
  readDiagramModelFromYjsDocument,
  repairDiagramModelWithReport,
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
    const usersTableMap = tables.get('users');
    expect(hasDiagramModelInYjsDocument(document)).toBe(true);
    expect(usersTableMap).toBeInstanceOf(Y.Map);
    expect(usersTableMap?.get('columnIds')).toBeInstanceOf(Y.Array);
    expect((usersTableMap?.get('columnIds') as Y.Array<string>).toArray()).toEqual(['users-id', 'users-email']);
    expect(readDiagramModelFromYjsDocument(document)).toEqual(serializeDiagramModel(model));
  });

  it('forwards Yjs transaction origin when writing a model', () => {
    const document = new Y.Doc();
    const model = createEmptyDiagramModel('Realtime origin test');
    const origin = Symbol('local-model-write');
    const origins: unknown[] = [];

    document.on('update', (_update, updateOrigin) => {
      origins.push(updateOrigin);
    });

    // The web collaboration bridge uses origin to ignore local Yjs echoes while still accepting remote updates.
    writeDiagramModelToYjsDocument(document, model, origin);

    expect(origins).toEqual([origin]);
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

  it('migrates legacy diagram payloads without schemaVersion to the current model version', () => {
    const model = createEmptyDiagramModel('Legacy import test');
    const legacyPayload = serializeDiagramModel(model) as Partial<ReturnType<typeof serializeDiagramModel>>;
    delete legacyPayload.schemaVersion;

    const migration = migrateDiagramModelWithReport(legacyPayload);

    // Old exports/prototype snapshots can miss schemaVersion; the migration boundary upgrades them before web/server logic touches the model.
    expect(migration.fromVersion).toBeNull();
    expect(migration.migrated).toBe(true);
    expect(migration.repaired).toBe(false);
    expect(migration.toVersion).toBe(currentDiagramSchemaVersion);
    expect(migration.model.schemaVersion).toBe(currentDiagramSchemaVersion);
    expect(parseDiagramModel(legacyPayload).schemaVersion).toBe(currentDiagramSchemaVersion);
  });

  it('repairs damaged legacy payloads through the import and restore boundary helper', () => {
    const model = applyDiagramCommand(
      createEmptyDiagramModel('Legacy repair test'),
      {
        columns: [
          { id: 'legacy-id', name: 'id', nullable: false, primaryKey: true, type: { family: 'uuid' } },
          { id: 'legacy-name', name: 'name', nullable: false, type: { family: 'varchar', length: 120 } },
        ],
        name: 'legacy_users',
        tableId: 'legacy-users',
        type: 'table.create',
      },
      { now: fixedNow },
    );
    const damagedPayload = {
      ...serializeDiagramModel(model),
      columns: {},
      schemaVersion: undefined,
    };

    const repair = repairDiagramModelWithReport(damagedPayload);

    // Repair keeps the table selectable/editable even when the persisted JSON lost column entities.
    expect(repair.migrated).toBe(true);
    expect(repair.repaired).toBe(true);
    expect(getTableColumns(repair.model, 'legacy-users').map((column) => column.name)).toEqual(['id', 'new_column']);
    expect(repair.model.columns['legacy-id']).toMatchObject({
      nullable: false,
      primaryKey: true,
      type: { family: 'uuid' },
    });
  });

  it('rejects future diagram schema versions until an explicit migration exists', () => {
    const futurePayload = {
      ...serializeDiagramModel(createEmptyDiagramModel('Future model test')),
      schemaVersion: currentDiagramSchemaVersion + 1,
    };

    // A self-host instance should fail loudly on unsupported future snapshots instead of silently rewriting data it cannot understand.
    expect(() => migrateDiagramModelWithReport(futurePayload)).toThrow(DiagramCommandError);
  });

  it('normalizes tables whose column order references missing column entities', () => {
    const model = applyDiagramCommand(
      createEmptyDiagramModel('Normalize missing columns test'),
      {
        columns: [
          { id: 'events-id', name: 'id', nullable: false, primaryKey: true, type: { family: 'uuid' } },
          { id: 'events-title', name: 'title', nullable: false, type: { family: 'varchar', length: 120 } },
        ],
        name: 'events',
        tableId: 'events',
        type: 'table.create',
      },
      { now: fixedNow },
    );
    const damagedModel = {
      ...model,
      columns: {},
    };

    const normalizedModel = normalizeDiagramModel(damagedModel);

    // Column IDs are repaired into real column entities so canvas/sidebar/snapshot all agree on the table shape again.
    expect(getTableColumns(normalizedModel, 'events').map((column) => column.name)).toEqual(['id', 'new_column']);
    expect(normalizedModel.columns['events-id']).toMatchObject({
      nullable: false,
      primaryKey: true,
      type: { family: 'uuid' },
    });
  });

  it('normalizes camelized JSONB entity record keys back to entity ids', () => {
    const model = applyDiagramCommand(
      createEmptyDiagramModel('Normalize JSONB key aliases test'),
      {
        columns: [
          { id: 'column_a1', name: 'id', nullable: false, primaryKey: true, type: { family: 'uuid' } },
          { id: 'column_b2', name: 'new_column', nullable: false, type: { family: 'varchar', length: 160 } },
        ],
        name: 'draft_table',
        tableId: 'table_a1',
        type: 'table.create',
      },
      { now: fixedNow },
    );
    const damagedModel = {
      ...model,
      columns: {
        columnA1: model.columns.column_a1,
        columnB2: model.columns.column_b2,
        column_a1: model.columns.column_a1,
      },
      tables: {
        tableA1: model.tables.table_a1,
        table_a1: model.tables.table_a1,
      },
    };

    const normalizedModel = normalizeDiagramModel(damagedModel);

    // Dynamic JSONB entity keys must stay identical to entity.id; otherwise React keys, table selection, and Yjs maps split one entity into aliases.
    expect(Object.keys(normalizedModel.tables)).toEqual(['table_a1']);
    expect(Object.keys(normalizedModel.columns).sort()).toEqual(['column_a1', 'column_b2']);
    expect(getTableColumns(normalizedModel, 'table_a1').map((column) => column.name)).toEqual(['id', 'new_column']);
  });

  it('normalizes tables whose column entities exist but column order is empty', () => {
    const model = applyDiagramCommand(
      createEmptyDiagramModel('Normalize empty order test'),
      {
        columns: [
          { id: 'tasks-id', name: 'id', nullable: false, primaryKey: true, type: { family: 'uuid' } },
          { id: 'tasks-name', name: 'name', nullable: false, type: { family: 'varchar', length: 120 } },
        ],
        name: 'tasks',
        tableId: 'tasks',
        type: 'table.create',
      },
      { now: fixedNow },
    );
    const damagedModel = {
      ...model,
      tables: {
        ...model.tables,
        tasks: {
          ...model.tables.tasks,
          columnIds: [],
        },
      },
    };

    const normalizedModel = normalizeDiagramModel(damagedModel);

    // If Yjs sends column maps before the table order, ownership by tableId gives us a deterministic recovery path.
    expect(normalizedModel.tables.tasks.columnIds).toEqual(['tasks-id', 'tasks-name']);
    expect(getTableColumns(normalizedModel, 'tasks').map((column) => column.name)).toEqual(['id', 'name']);
  });

  it('reports integrity warnings for importable but inconsistent diagrams', () => {
    const model = createStarterDiagramModel('Import warning test');

    model.tables.users.columnIds.push('missing-column');
    model.tables['users-copy'] = {
      ...model.tables.users,
      columnIds: [],
      id: 'users-copy',
      indexIds: [],
      position: { x: 900, y: 120 },
    };
    model.columns['orphan-column'] = {
      autoIncrement: false,
      id: 'orphan-column',
      name: 'orphan_id',
      nullable: false,
      primaryKey: false,
      tableId: 'missing-table',
      type: { family: 'uuid' },
      unique: false,
    };
    model.columns['users-status'] = {
      autoIncrement: false,
      id: 'users-status',
      name: 'status',
      nullable: false,
      primaryKey: false,
      tableId: 'users',
      type: { family: 'enum', enumId: 'missing-enum' },
      unique: false,
    };
    model.indexes['broken-index'] = {
      columns: [{ columnId: 'missing-column' }],
      id: 'broken-index',
      name: 'broken_idx',
      tableId: 'users',
      unique: false,
    };
    model.relationships['broken-relationship'] = {
      cardinality: 'one_to_many',
      id: 'broken-relationship',
      sourceColumnIds: ['users-id'],
      sourceTableId: 'users',
      targetColumnIds: ['missing-column'],
      targetTableId: 'missing-table',
    };

    // Import preview can accept a structurally valid model while still warning about unresolved references.
    expect(getDiagramModelIntegrityWarnings(model).map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        'duplicate_table_name',
        'missing_column',
        'missing_enum',
        'missing_index_column',
        'missing_relationship_column',
        'missing_relationship_table',
        'orphan_column',
      ]),
    );
  });

  it('creates deterministic review signals for schema design risks', () => {
    const modelWithUsers = applyDiagramCommand(
      createEmptyDiagramModel('Review lint test'),
      {
        columns: [
          { id: 'users-id', name: 'id', nullable: false, primaryKey: true, type: { family: 'uuid' } },
          { id: 'users-email', name: 'email', nullable: false, type: { family: 'varchar', length: 190 } },
        ],
        name: 'users',
        tableId: 'users',
        type: 'table.create',
      },
      { now: fixedNow },
    );
    const modelWithOrders = applyDiagramCommand(
      modelWithUsers,
      {
        columns: [
          { id: 'orders-id', name: 'id', nullable: false, primaryKey: true, type: { family: 'integer' } },
          { id: 'orders-user-id', name: 'user_id', nullable: false, type: { family: 'integer' } },
          { id: 'orders-total-amount', name: 'total_amount', nullable: false, type: { family: 'float' } },
        ],
        name: 'orders',
        tableId: 'orders',
        type: 'table.create',
      },
      { now: fixedNow },
    );
    const modelWithAuditLog = applyDiagramCommand(
      modelWithOrders,
      {
        columns: [{ id: 'audit-actor', name: 'actor', nullable: false, type: { family: 'varchar', length: 80 } }],
        name: 'audit_log',
        tableId: 'audit-log',
        type: 'table.create',
      },
      { now: fixedNow },
    );
    const modelWithEnum = applyDiagramCommand(
      modelWithAuditLog,
      { enumId: 'order-status', name: 'order_status', type: 'enum.create', values: ['draft', 'paid'] },
      { now: fixedNow },
    );
    const modelWithRelationship = applyDiagramCommand(
      modelWithEnum,
      {
        cardinality: 'one_to_many',
        relationshipId: 'users-orders',
        sourceColumnIds: ['users-id'],
        sourceTableId: 'users',
        targetColumnIds: ['orders-user-id'],
        targetTableId: 'orders',
        type: 'relationship.create',
      },
      { now: fixedNow },
    );

    const signals = getDiagramReviewSignals(modelWithRelationship);

    // Review signals are deterministic domain output, so the UI can render them and the server can persist them later.
    expect(signals.map((signal) => signal.code)).toEqual(
      expect.arrayContaining([
        'email_column_not_unique',
        'foreign_key_missing_index',
        'money_column_uses_float',
        'relationship_column_type_mismatch',
        'table_missing_primary_key',
        'unused_enum',
      ]),
    );
    expect(signals.find((signal) => signal.code === 'relationship_column_type_mismatch')?.target).toEqual({
      id: 'orders-user-id',
      type: 'column',
    });
  });

  it('does not flag indexed foreign keys or uniquely constrained email columns', () => {
    const baseModel = applyDiagramCommand(
      createEmptyDiagramModel('Positive lint test'),
      {
        columns: [
          { id: 'users-id', name: 'id', nullable: false, primaryKey: true, type: { family: 'uuid' } },
          { id: 'users-email', name: 'email', nullable: false, type: { family: 'varchar', length: 190 } },
        ],
        name: 'users',
        tableId: 'users',
        type: 'table.create',
      },
      { now: fixedNow },
    );
    const modelWithOrders = applyDiagramCommand(
      baseModel,
      {
        columns: [
          { id: 'orders-id', name: 'id', nullable: false, primaryKey: true, type: { family: 'uuid' } },
          { id: 'orders-user-id', name: 'user_id', nullable: false, type: { family: 'uuid' } },
        ],
        name: 'orders',
        tableId: 'orders',
        type: 'table.create',
      },
      { now: fixedNow },
    );
    const indexedModel = applyDiagramCommands(
      modelWithOrders,
      [
        {
          columns: [{ columnId: 'users-email' }],
          indexId: 'users-email-key',
          name: 'users_email_key',
          tableId: 'users',
          type: 'index.create',
          unique: true,
        },
        {
          columns: [{ columnId: 'orders-user-id' }],
          indexId: 'orders-user-id-index',
          name: 'orders_user_id_idx',
          tableId: 'orders',
          type: 'index.create',
        },
        {
          cardinality: 'one_to_many',
          relationshipId: 'users-orders',
          sourceColumnIds: ['users-id'],
          sourceTableId: 'users',
          targetColumnIds: ['orders-user-id'],
          targetTableId: 'orders',
          type: 'relationship.create',
        },
      ],
      { now: fixedNow },
    );

    const signalCodes = getDiagramReviewSignals(indexedModel).map((signal) => signal.code);

    expect(signalCodes).not.toContain('email_column_not_unique');
    expect(signalCodes).not.toContain('foreign_key_missing_index');
    expect(signalCodes).not.toContain('relationship_column_type_mismatch');
  });

  it('respects disabled review rules', () => {
    const model = applyDiagramCommand(
      createEmptyDiagramModel('Disabled lint rule test'),
      {
        columns: [{ id: 'events-name', name: 'name', nullable: false, type: { family: 'varchar', length: 120 } }],
        name: 'events',
        tableId: 'events',
        type: 'table.create',
      },
      { now: fixedNow },
    );

    const signalCodes = getDiagramReviewSignals(model, {
      // Project/diagram settings disable rule keys before persistence, not after UI filtering, so server and frontend fallback agree.
      disabledRuleKeys: ['table_missing_primary_key'],
    }).map((signal) => signal.code);

    expect(signalCodes).not.toContain('table_missing_primary_key');
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

  it('updates table display state without changing schema columns', () => {
    const model = applyDiagramCommand(
      createEmptyDiagramModel('Table display test'),
      {
        columns: [
          { id: 'books-id', name: 'id', nullable: false, primaryKey: true, type: { family: 'uuid' } },
          { id: 'books-title', name: 'title', nullable: false, type: { family: 'varchar', length: 220 } },
        ],
        name: 'books',
        tableId: 'books',
        type: 'table.create',
      },
      { now: fixedNow },
    );
    const nextModel = applyDiagramCommand(
      model,
      {
        changes: {
          collapsed: true,
          displayMode: 'pk_fk_only',
        },
        tableId: 'books',
        type: 'table.updateDisplay',
      },
      { now: fixedNow },
    );

    expect(nextModel.tables.books.collapsed).toBe(true);
    expect(nextModel.tables.books.displayMode).toBe('pk_fk_only');
    expect(nextModel.tables.books.columnIds).toEqual(['books-id', 'books-title']);
    expect(model.tables.books.collapsed).toBeUndefined();
    expect(model.tables.books.displayMode).toBeUndefined();
  });

  it('creates module groups and keeps table membership exclusive', () => {
    const model = applyDiagramCommands(
      createEmptyDiagramModel('Group command test'),
      [
        {
          columns: [{ id: 'users-id', name: 'id', nullable: false, primaryKey: true, type: { family: 'uuid' } }],
          name: 'users',
          tableId: 'users',
          type: 'table.create',
        },
        {
          columns: [{ id: 'orders-id', name: 'id', nullable: false, primaryKey: true, type: { family: 'uuid' } }],
          name: 'orders',
          tableId: 'orders',
          type: 'table.create',
        },
      ],
      { now: fixedNow },
    );
    const groupedModel = applyDiagramCommands(
      model,
      [
        {
          groupId: 'core',
          name: 'Core',
          position: { x: 20, y: 30 },
          tableIds: ['users'],
          type: 'group.create',
        },
        {
          groupId: 'commerce',
          name: 'Commerce',
          tableIds: ['orders'],
          type: 'group.create',
        },
        {
          groupId: 'commerce',
          tableId: 'users',
          type: 'group.assignTable',
        },
      ],
      { now: fixedNow },
    );
    const deletedGroupModel = applyDiagramCommand(
      groupedModel,
      { groupId: 'commerce', type: 'group.delete' },
      { now: fixedNow },
    );

    expect(groupedModel.groups.core).toBeUndefined();
    expect(groupedModel.groups.commerce.tableIds).toEqual(['orders', 'users']);
    expect(groupedModel.tables.users.groupId).toBe('commerce');
    expect(groupedModel.tables.orders.groupId).toBe('commerce');
    expect(model.tables.users.groupId).toBeUndefined();
    expect(deletedGroupModel.groups.commerce).toBeUndefined();
    expect(deletedGroupModel.tables.users).toBeDefined();
    expect(deletedGroupModel.tables.users.groupId).toBeUndefined();
    expect(deletedGroupModel.tables.orders.groupId).toBeUndefined();
  });

  it('repairs stale empty module groups during normalization', () => {
    const modelWithStaleGroup = normalizeDiagramModel({
      ...createEmptyDiagramModel('Stale module repair test'),
      groups: {
        abandoned: {
          color: '#ff8ac7',
          height: 260,
          id: 'abandoned',
          name: 'Abandoned module',
          position: { x: 80, y: 120 },
          tableIds: [],
          width: 420,
        },
      },
    });

    // Empty modules are not selectable in the editor, so normalization prunes them before they can become confusing UI artifacts.
    expect(modelWithStaleGroup.groups.abandoned).toBeUndefined();
  });

  it('creates, edits, moves, and deletes diagram notes immutably', () => {
    const model = createEmptyDiagramModel('Note command test');
    const withNote = applyDiagramCommand(
      model,
      {
        color: '#ffc800',
        noteId: 'note-design',
        position: { x: 80, y: 120 },
        text: 'Normalize user email before import.',
        type: 'note.create',
        width: 260,
      },
      { now: fixedNow },
    );
    const editedNote = applyDiagramCommand(
      withNote,
      {
        changes: {
          text: 'Normalize user email before import and signup.',
        },
        noteId: 'note-design',
        type: 'note.update',
      },
      { now: fixedNow },
    );
    const movedNote = applyDiagramCommand(
      editedNote,
      {
        noteId: 'note-design',
        position: { x: 240, y: 320 },
        type: 'note.move',
      },
      { now: fixedNow },
    );
    const deletedNote = applyDiagramCommand(
      movedNote,
      {
        noteId: 'note-design',
        type: 'note.delete',
      },
      { now: fixedNow },
    );

    expect(model.notes['note-design']).toBeUndefined();
    expect(withNote.notes['note-design']).toMatchObject({
      color: '#ffc800',
      position: { x: 80, y: 120 },
      text: 'Normalize user email before import.',
      width: 260,
    });
    expect(editedNote.notes['note-design'].text).toBe('Normalize user email before import and signup.');
    expect(movedNote.notes['note-design'].position).toEqual({ x: 240, y: 320 });
    expect(deletedNote.notes['note-design']).toBeUndefined();
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
