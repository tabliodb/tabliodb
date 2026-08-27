import { applyDiagramCommand, createStarterDiagramModel } from '@tabliodb/schema-core';
import { describe, expect, it } from 'vitest';
import {
  createDiagramModelSignature,
  createEmptyEditorModelHistory,
  redoLocalModelChange,
  recordLocalModelChange,
  undoLocalModelChange,
} from './model-history';

const createSeedDiagramModel = createStarterDiagramModel;

describe('editor model history', () => {
  it('records only changed local models and clears redo after a new local edit', () => {
    const baseModel = createSeedDiagramModel('History test');
    const movedModel = applyDiagramCommand(baseModel, {
      position: { x: 160, y: 180 },
      tableId: 'users',
      type: 'table.move',
    });
    const renamedModel = applyDiagramCommand(movedModel, {
      name: 'app_users',
      tableId: 'users',
      type: 'table.rename',
    });
    const unchangedResult = recordLocalModelChange(createEmptyEditorModelHistory(), baseModel, baseModel);
    const firstResult = recordLocalModelChange(unchangedResult.history, baseModel, movedModel);
    const undoResult = undoLocalModelChange(firstResult.history, movedModel);
    const secondResult = recordLocalModelChange(undoResult?.history ?? firstResult.history, baseModel, renamedModel);

    expect(unchangedResult.changed).toBe(false);
    expect(firstResult.changed).toBe(true);
    expect(undoResult?.history.future).toHaveLength(1);
    // New local edits intentionally clear redo so Ctrl+Y cannot reapply an obsolete branch after the user continues editing.
    expect(secondResult.history.future).toHaveLength(0);
    expect(secondResult.history.past).toHaveLength(1);
  });

  it('keeps undo and redo scoped to the local user model stack', () => {
    const baseModel = createSeedDiagramModel('Local stack test');
    const localModel = applyDiagramCommand(baseModel, {
      position: { x: 220, y: 260 },
      tableId: 'books',
      type: 'table.move',
    });
    const remoteModel = applyDiagramCommand(localModel, {
      name: 'catalog_books',
      tableId: 'books',
      type: 'table.rename',
    });
    const localHistory = recordLocalModelChange(createEmptyEditorModelHistory(), baseModel, localModel).history;
    const remoteResetHistory = createEmptyEditorModelHistory();

    expect(undoLocalModelChange(localHistory, localModel)?.model).toEqual(baseModel);
    // Remote Yjs updates must reset the user's local stack instead of becoming undoable local work.
    expect(undoLocalModelChange(remoteResetHistory, remoteModel)).toBeNull();
    expect(redoLocalModelChange(remoteResetHistory, remoteModel)).toBeNull();
    expect(createDiagramModelSignature(remoteModel)).not.toBe(createDiagramModelSignature(localModel));
  });

  it('enforces the local history limit', () => {
    const baseModel = createSeedDiagramModel('Limited history test');
    let history = createEmptyEditorModelHistory();
    let currentModel = baseModel;

    for (let index = 0; index < 5; index += 1) {
      const nextModel = applyDiagramCommand(currentModel, {
        position: { x: 80 + index, y: 100 + index },
        tableId: 'users',
        type: 'table.move',
      });
      history = recordLocalModelChange(history, currentModel, nextModel, 3).history;
      currentModel = nextModel;
    }

    expect(history.past).toHaveLength(3);
  });
});
