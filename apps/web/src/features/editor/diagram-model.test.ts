import { applyDiagramCommand, getTableColumns } from '@tabliodb/schema-core';
import { describe, expect, it } from 'vitest';
import {
  addTableToDiagramModel,
  createRealtimeColumnPatch,
  createRealtimeColumnStructuralPatch,
  createRealtimeNotePatch,
  createRealtimeRelationshipPatch,
  createRealtimeTablePatch,
  createSeedDiagramModel,
  createSnapshotSaveModel,
  normalizeEditorDiagramModel,
  shouldKeepLocalDiagramModelOverRealtime,
} from './diagram-model';

describe('editor diagram model helpers', () => {
  it('adds a new table with persisted default columns', () => {
    const baseModel = createSeedDiagramModel('Default columns test');
    const nextModel = addTableToDiagramModel(baseModel, undefined, { x: 120, y: 144 });
    const newTableId = Object.keys(nextModel.tables).find((tableId) => !baseModel.tables[tableId]);

    expect(newTableId).toBeTruthy();

    const columns = getTableColumns(nextModel, newTableId ?? '');

    expect(columns.map((column) => column.name)).toEqual(['id', 'new_column']);
    expect(columns[0]).toMatchObject({
      name: 'id',
      nullable: false,
      primaryKey: true,
      type: { family: 'uuid' },
    });
    expect(columns[1]).toMatchObject({
      name: 'new_column',
      nullable: false,
      type: { family: 'varchar', length: 160 },
    });
  });

  it('keeps draft columns when a save request races with a stale model', () => {
    const baseModel = createSeedDiagramModel('Save race test');
    const requestedModel = addTableToDiagramModel(baseModel, undefined, { x: 120, y: 144 });
    const newTableId = Object.keys(requestedModel.tables).find((tableId) => !baseModel.tables[tableId]) ?? '';
    const staleLatestModel = {
      ...requestedModel,
      columns: Object.fromEntries(
        Object.entries(requestedModel.columns).filter(([, column]) => column.tableId !== newTableId),
      ),
      tables: {
        ...requestedModel.tables,
        [newTableId]: {
          ...requestedModel.tables[newTableId],
          columnIds: [],
        },
      },
    };

    const modelToSave = createSnapshotSaveModel(requestedModel, staleLatestModel);

    expect(modelToSave).not.toBeNull();
    expect(getTableColumns(modelToSave!, newTableId).map((column) => column.name)).toEqual(['id', 'new_column']);
  });

  it('repairs table column order that references missing column entities', () => {
    const baseModel = createSeedDiagramModel('Repair missing columns test');
    const requestedModel = addTableToDiagramModel(baseModel, 'invoice_items', { x: 120, y: 144 });
    const newTableId = Object.keys(requestedModel.tables).find((tableId) => !baseModel.tables[tableId]) ?? '';
    const damagedModel = {
      ...requestedModel,
      columns: Object.fromEntries(
        Object.entries(requestedModel.columns).filter(([, column]) => column.tableId !== newTableId),
      ),
    };

    const repairedModel = normalizeEditorDiagramModel(damagedModel);

    expect(getTableColumns(repairedModel, newTableId).map((column) => column.name)).toEqual(['id', 'new_column']);
    expect(getTableColumns(repairedModel, newTableId)[0]).toMatchObject({
      nullable: false,
      primaryKey: true,
      type: { family: 'uuid' },
    });
  });

  it('repairs save payloads even when both requested and latest drafts are already missing column entities', () => {
    const baseModel = createSeedDiagramModel('Damaged save test');
    const requestedModel = addTableToDiagramModel(baseModel, 'events', { x: 120, y: 144 });
    const newTableId = Object.keys(requestedModel.tables).find((tableId) => !baseModel.tables[tableId]) ?? '';
    const damagedModel = {
      ...requestedModel,
      columns: Object.fromEntries(
        Object.entries(requestedModel.columns).filter(([, column]) => column.tableId !== newTableId),
      ),
    };

    const modelToSave = createSnapshotSaveModel(damagedModel, damagedModel);

    expect(modelToSave).not.toBeNull();
    expect(getTableColumns(modelToSave!, newTableId).map((column) => column.name)).toEqual(['id', 'new_column']);
  });

  it('uses the last healthy local draft when realtime has already erased a new table column order', () => {
    const baseModel = createSeedDiagramModel('Recovery save test');
    const healthyDraftModel = addTableToDiagramModel(baseModel, 'audit_events', { x: 120, y: 144 });
    const newTableId = Object.keys(healthyDraftModel.tables).find((tableId) => !baseModel.tables[tableId]) ?? '';
    const staleEmptyModel = {
      ...healthyDraftModel,
      columns: Object.fromEntries(
        Object.entries(healthyDraftModel.columns).filter(([, column]) => column.tableId !== newTableId),
      ),
      tables: {
        ...healthyDraftModel.tables,
        [newTableId]: {
          ...healthyDraftModel.tables[newTableId],
          columnIds: [],
        },
      },
    };

    const modelToSave = createSnapshotSaveModel(staleEmptyModel, staleEmptyModel, healthyDraftModel);

    expect(modelToSave).not.toBeNull();
    expect(getTableColumns(modelToSave!, newTableId).map((column) => column.name)).toEqual(['id', 'new_column']);
  });

  it('uses the last healthy local draft when realtime has not hydrated a new table yet', () => {
    const baseModel = createSeedDiagramModel('Missing table recovery save test');
    const healthyDraftModel = addTableToDiagramModel(baseModel, 'sessions', { x: 120, y: 144 });
    const newTableId = Object.keys(healthyDraftModel.tables).find((tableId) => !baseModel.tables[tableId]) ?? '';
    const staleModelWithoutNewTable = {
      ...baseModel,
      metadata: healthyDraftModel.metadata,
    };

    const modelToSave = createSnapshotSaveModel(staleModelWithoutNewTable, staleModelWithoutNewTable, healthyDraftModel);

    expect(modelToSave).not.toBeNull();
    expect(modelToSave!.tables[newTableId]?.name).toBe('sessions');
    expect(getTableColumns(modelToSave!, newTableId).map((column) => column.name)).toEqual(['id', 'new_column']);
  });

  it('preserves legitimate latest edits while restoring missing draft columns', () => {
    const baseModel = createSeedDiagramModel('Latest edits test');
    const requestedModel = addTableToDiagramModel(baseModel, undefined, { x: 120, y: 144 });
    const newTableId = Object.keys(requestedModel.tables).find((tableId) => !baseModel.tables[tableId]) ?? '';
    const renamedLatestModel = applyDiagramCommand(
      {
        ...requestedModel,
        columns: Object.fromEntries(
          Object.entries(requestedModel.columns).filter(([, column]) => column.tableId !== newTableId),
        ),
        tables: {
          ...requestedModel.tables,
          [newTableId]: {
            ...requestedModel.tables[newTableId],
            columnIds: [],
          },
        },
      },
      {
        name: 'renamed_table',
        tableId: newTableId,
        type: 'table.rename',
      },
    );

    const modelToSave = createSnapshotSaveModel(requestedModel, renamedLatestModel);

    expect(modelToSave?.tables[newTableId]?.name).toBe('renamed_table');
    expect(getTableColumns(modelToSave!, newTableId).map((column) => column.name)).toEqual(['id', 'new_column']);
  });

  it('keeps a fresher local draft over a stale realtime model with empty table columns', () => {
    const baseModel = createSeedDiagramModel('Realtime stale model test');
    const localModel = {
      ...addTableToDiagramModel(baseModel, 'draft_table', { x: 120, y: 144 }),
      metadata: {
        ...baseModel.metadata,
        updatedAt: '2026-07-31T12:00:00.000Z',
      },
    };
    const newTableId = Object.keys(localModel.tables).find((tableId) => !baseModel.tables[tableId]) ?? '';
    const staleRealtimeModel = {
      ...localModel,
      columns: Object.fromEntries(
        Object.entries(localModel.columns).filter(([, column]) => column.tableId !== newTableId),
      ),
      metadata: {
        ...localModel.metadata,
        updatedAt: '2026-07-31T11:59:00.000Z',
      },
      tables: {
        ...localModel.tables,
        [newTableId]: {
          ...localModel.tables[newTableId],
          columnIds: [],
        },
      },
    };

    expect(shouldKeepLocalDiagramModelOverRealtime(localModel, staleRealtimeModel)).toBe(true);
  });

  it('keeps a local draft when a stale realtime model is missing a newly created table', () => {
    const baseModel = createSeedDiagramModel('Realtime missing table test');
    const localModel = addTableToDiagramModel(baseModel, 'draft_table', { x: 120, y: 144 });
    const staleRealtimeModel = {
      ...baseModel,
      metadata: localModel.metadata,
    };

    expect(shouldKeepLocalDiagramModelOverRealtime(localModel, staleRealtimeModel)).toBe(true);
  });

  it('accepts a newer realtime model so collaboration can move forward', () => {
    const baseModel = createSeedDiagramModel('Realtime newer model test');
    const localModel = {
      ...addTableToDiagramModel(baseModel, 'draft_table', { x: 120, y: 144 }),
      metadata: {
        ...baseModel.metadata,
        updatedAt: '2026-07-31T12:00:00.000Z',
      },
    };
    const realtimeModel = {
      ...localModel,
      metadata: {
        ...localModel.metadata,
        updatedAt: '2026-07-31T12:01:00.000Z',
      },
    };

    expect(shouldKeepLocalDiagramModelOverRealtime(localModel, realtimeModel)).toBe(false);
  });

  it('creates a small realtime patch for table move and resize only', () => {
    const baseModel = createSeedDiagramModel('Realtime table patch test');
    const tableId = 'users';
    const movedModel = applyDiagramCommand(baseModel, {
      position: { x: 240, y: 288 },
      tableId,
      type: 'table.move',
    });
    const resizedModel = applyDiagramCommand(movedModel, {
      tableId,
      type: 'table.resize',
      width: 336,
    });

    const patch = createRealtimeTablePatch(baseModel, resizedModel);

    expect(patch).toMatchObject({
      position: { x: 240, y: 288 },
      tableId,
      width: 336,
    });
    expect(patch?.metadataUpdatedAt).toBe(resizedModel.metadata.updatedAt);
  });

  it('creates a small realtime patch for table rename and color edits', () => {
    const baseModel = createSeedDiagramModel('Realtime table rename patch test');
    const tableId = 'users';
    const renamedModel = applyDiagramCommand(baseModel, {
      name: 'members',
      tableId,
      type: 'table.rename',
    });
    const coloredModel = applyDiagramCommand(renamedModel, {
      color: '#ffc800',
      tableId,
      type: 'table.changeColor',
    });

    const patch = createRealtimeTablePatch(baseModel, coloredModel);

    expect(patch).toMatchObject({
      color: '#ffc800',
      name: 'members',
      tableId,
    });
  });

  it('creates a field-level realtime patch for column updates', () => {
    const baseModel = createSeedDiagramModel('Realtime column patch test');
    const columnModel = applyDiagramCommand(baseModel, {
      columnId: 'users-name',
      changes: {
        comment: 'Public display name',
        name: 'display_name',
        nullable: true,
        type: { family: 'varchar', length: 180 },
      },
      type: 'column.update',
    });

    const patch = createRealtimeColumnPatch(baseModel, columnModel);

    expect(createRealtimeTablePatch(baseModel, columnModel)).toBeNull();
    expect(patch).toMatchObject({
      changes: {
        comment: 'Public display name',
        name: 'display_name',
        nullable: true,
        type: { family: 'varchar', length: 180 },
      },
      clearedKeys: [],
      columnId: 'users-name',
    });
    expect(patch?.metadataUpdatedAt).toBe(columnModel.metadata.updatedAt);
  });

  it('creates a structural realtime patch for column create edits', () => {
    const baseModel = createSeedDiagramModel('Realtime column create patch test');
    const addedColumnModel = applyDiagramCommand(
      baseModel,
      {
        columnId: 'users-nickname',
        columnType: { family: 'varchar', length: 80 },
        name: 'nickname',
        nullable: true,
        tableId: 'users',
        type: 'column.create',
      },
      { now: () => '2026-08-12T03:00:00.000Z' },
    );

    const patch = createRealtimeColumnStructuralPatch(baseModel, addedColumnModel);

    expect(createRealtimeColumnPatch(baseModel, addedColumnModel)).toBeNull();
    expect(patch).toMatchObject({
      action: 'create',
      column: {
        id: 'users-nickname',
        name: 'nickname',
        nullable: true,
        tableId: 'users',
        type: { family: 'varchar', length: 80 },
      },
      columnId: 'users-nickname',
      metadataUpdatedAt: '2026-08-12T03:00:00.000Z',
      tableId: 'users',
      tablePatch: {
        columnIds: ['users-id', 'users-name', 'users-email', 'users-nickname'],
        indexIds: ['users-email-unique'],
      },
    });
  });

  it('creates a structural realtime patch for column reorder edits', () => {
    const baseModel = createSeedDiagramModel('Realtime column reorder patch test');
    const reorderedColumnModel = applyDiagramCommand(
      baseModel,
      {
        atIndex: 0,
        columnId: 'users-email',
        tableId: 'users',
        type: 'column.reorder',
      },
      { now: () => '2026-08-12T03:01:00.000Z' },
    );

    const patch = createRealtimeColumnStructuralPatch(baseModel, reorderedColumnModel);

    expect(createRealtimeColumnPatch(baseModel, reorderedColumnModel)).toBeNull();
    expect(patch).toEqual({
      action: 'reorder',
      checksToDelete: [],
      columnId: 'users-email',
      indexesToDelete: [],
      indexesToUpsert: [],
      metadataUpdatedAt: '2026-08-12T03:01:00.000Z',
      relationshipsToDelete: [],
      tableId: 'users',
      tablePatch: {
        columnIds: ['users-email', 'users-id', 'users-name'],
        indexIds: ['users-email-unique'],
      },
    });
  });

  it('creates a structural realtime patch for column delete cascade edits', () => {
    const baseModel = createSeedDiagramModel('Realtime column delete patch test');
    const deletedColumnModel = applyDiagramCommand(
      baseModel,
      {
        columnId: 'borrowings-user-id',
        type: 'column.delete',
      },
      { now: () => '2026-08-12T03:02:00.000Z' },
    );

    const patch = createRealtimeColumnStructuralPatch(baseModel, deletedColumnModel);

    expect(createRealtimeColumnPatch(baseModel, deletedColumnModel)).toBeNull();
    expect(patch).toMatchObject({
      action: 'delete',
      checksToDelete: [],
      columnId: 'borrowings-user-id',
      indexesToDelete: [],
      metadataUpdatedAt: '2026-08-12T03:02:00.000Z',
      relationshipsToDelete: ['users-borrowings'],
      tableId: 'borrowings',
      tablePatch: {
        columnIds: ['borrowings-id', 'borrowings-book-id', 'borrowings-due-at'],
        indexIds: ['borrowings-user-book-index'],
      },
    });
    expect(patch?.indexesToUpsert).toEqual([
      {
        columns: [{ columnId: 'borrowings-book-id' }],
        id: 'borrowings-user-book-index',
        name: 'borrowings_user_book_idx',
        tableId: 'borrowings',
        unique: false,
      },
    ]);
  });

  it('creates a realtime patch for relationship create edits', () => {
    const baseModel = createSeedDiagramModel('Realtime relationship create patch test');
    const relationshipModel = applyDiagramCommand(
      baseModel,
      {
        cardinality: 'one_to_one',
        relationshipId: 'users_books_test_fkey',
        sourceColumnIds: ['users-id'],
        sourceTableId: 'users',
        targetColumnIds: ['books-id'],
        targetTableId: 'books',
        type: 'relationship.create',
      },
      { now: () => '2026-08-12T02:00:00.000Z' },
    );

    const patch = createRealtimeRelationshipPatch(baseModel, relationshipModel);

    expect(patch).toMatchObject({
      action: 'create',
      metadataUpdatedAt: '2026-08-12T02:00:00.000Z',
      relationship: {
        cardinality: 'one_to_one',
        id: 'users_books_test_fkey',
        sourceColumnIds: ['users-id'],
        sourceTableId: 'users',
        targetColumnIds: ['books-id'],
        targetTableId: 'books',
      },
      relationshipId: 'users_books_test_fkey',
    });
  });

  it('creates a realtime patch for relationship delete edits', () => {
    const baseModel = createSeedDiagramModel('Realtime relationship delete patch test');
    const deletedRelationshipModel = applyDiagramCommand(
      baseModel,
      {
        relationshipId: 'users-borrowings',
        type: 'relationship.delete',
      },
      { now: () => '2026-08-12T02:01:00.000Z' },
    );

    const patch = createRealtimeRelationshipPatch(baseModel, deletedRelationshipModel);

    expect(patch).toEqual({
      action: 'delete',
      metadataUpdatedAt: '2026-08-12T02:01:00.000Z',
      relationshipId: 'users-borrowings',
    });
  });

  it('creates a field-level realtime patch for relationship update edits', () => {
    const baseModel = createSeedDiagramModel('Realtime relationship update patch test');
    const updatedRelationshipModel = applyDiagramCommand(
      baseModel,
      {
        changes: {
          cardinality: 'many_to_many',
          comment: 'Temporary library copy relationship',
          deferrable: true,
          onDelete: 'cascade',
        },
        relationshipId: 'books-borrowings',
        type: 'relationship.update',
      },
      { now: () => '2026-08-12T02:02:00.000Z' },
    );

    const patch = createRealtimeRelationshipPatch(baseModel, updatedRelationshipModel);

    expect(patch).toMatchObject({
      action: 'update',
      changes: {
        cardinality: 'many_to_many',
        comment: 'Temporary library copy relationship',
        deferrable: true,
        onDelete: 'cascade',
      },
      clearedKeys: [],
      metadataUpdatedAt: '2026-08-12T02:02:00.000Z',
      relationshipId: 'books-borrowings',
    });
  });

  it('creates a field-level realtime patch for note update and move edits', () => {
    const baseModel = createSeedDiagramModel('Realtime note patch test');
    const withNote = applyDiagramCommand(
      baseModel,
      {
        color: '#ffc800',
        noteId: 'note-review',
        position: { x: 80, y: 120 },
        text: 'Review nullable columns',
        type: 'note.create',
        width: 260,
      },
      { now: () => '2026-08-12T01:00:00.000Z' },
    );
    const movedNoteModel = applyDiagramCommand(
      withNote,
      {
        noteId: 'note-review',
        position: { x: 240, y: 360 },
        type: 'note.move',
      },
      { now: () => '2026-08-12T01:01:00.000Z' },
    );
    const updatedNoteModel = applyDiagramCommand(
      movedNoteModel,
      {
        changes: {
          color: '#1cb0f6',
          text: 'Review nullable and unique columns',
        },
        noteId: 'note-review',
        type: 'note.update',
      },
      { now: () => '2026-08-12T01:02:00.000Z' },
    );

    const patch = createRealtimeNotePatch(withNote, updatedNoteModel);

    expect(patch).toMatchObject({
      action: 'update',
      changes: {
        color: '#1cb0f6',
        position: { x: 240, y: 360 },
        text: 'Review nullable and unique columns',
      },
      clearedKeys: [],
      noteId: 'note-review',
    });
    expect(patch?.metadataUpdatedAt).toBe('2026-08-12T01:02:00.000Z');
  });

  it('creates a realtime patch for note create edits', () => {
    const baseModel = createSeedDiagramModel('Realtime note create patch test');
    const withNote = applyDiagramCommand(
      baseModel,
      {
        color: '#ffc800',
        noteId: 'note-design',
        position: { x: 80, y: 120 },
        text: 'Document import decisions',
        type: 'note.create',
        width: 280,
      },
      { now: () => '2026-08-12T04:00:00.000Z' },
    );

    const patch = createRealtimeNotePatch(baseModel, withNote);

    expect(patch).toMatchObject({
      action: 'create',
      metadataUpdatedAt: '2026-08-12T04:00:00.000Z',
      note: {
        color: '#ffc800',
        id: 'note-design',
        position: { x: 80, y: 120 },
        text: 'Document import decisions',
        width: 280,
      },
      noteId: 'note-design',
    });
  });

  it('creates a realtime patch for note delete edits', () => {
    const baseModel = createSeedDiagramModel('Realtime note delete patch test');
    const withNote = applyDiagramCommand(
      baseModel,
      {
        noteId: 'note-design',
        position: { x: 80, y: 120 },
        text: 'Document import decisions',
        type: 'note.create',
      },
      { now: () => '2026-08-12T04:01:00.000Z' },
    );
    const deletedNoteModel = applyDiagramCommand(
      withNote,
      {
        noteId: 'note-design',
        type: 'note.delete',
      },
      { now: () => '2026-08-12T04:02:00.000Z' },
    );

    expect(createRealtimeNotePatch(withNote, deletedNoteModel)).toEqual({
      action: 'delete',
      metadataUpdatedAt: '2026-08-12T04:02:00.000Z',
      noteId: 'note-design',
    });
  });
});
