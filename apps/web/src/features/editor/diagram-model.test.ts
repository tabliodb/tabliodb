import { applyDiagramCommand, getTableColumns } from '@tabliodb/schema-core';
import { describe, expect, it } from 'vitest';
import {
  addTableToDiagramModel,
  createSeedDiagramModel,
  createSnapshotSaveModel,
  normalizeEditorDiagramModel,
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
});
