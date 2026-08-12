import { applyDiagramCommand, getTableColumns } from '@tabliodb/schema-core';
import { describe, expect, it } from 'vitest';
import {
  addTableToDiagramModel,
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
});
