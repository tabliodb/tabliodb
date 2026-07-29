import { describe, expect, it } from 'vitest';
import {
  DiagramCommandError,
  applyDiagramCommand,
  createEmptyDiagramModel,
  createSequentialDiagramIdFactory,
  getTableColumns,
} from './index.js';

const fixedNow = () => '2026-07-29T00:00:00.000Z';

describe('schema-core diagram commands', () => {
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
