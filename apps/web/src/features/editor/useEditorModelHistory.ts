import type { DiagramModel } from '@tabliodb/schema-core';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  createEmptyEditorModelHistory,
  redoLocalModelChange,
  recordLocalModelChange,
  undoLocalModelChange,
  type EditorModelHistory,
} from './model-history';

export function useEditorModelHistory() {
  const historyRef = useRef<EditorModelHistory>(createEmptyEditorModelHistory());
  const [revision, setRevision] = useState(0);
  const [canUndo, canRedo] = useMemo(
    () => [historyRef.current.past.length > 0, historyRef.current.future.length > 0] as const,
    [revision],
  );

  const reset = useCallback(() => {
    historyRef.current = createEmptyEditorModelHistory();
    // Revision sengaja menjadi render signal kecil; history besar tetap berada di ref agar undo stack tidak memicu render berlebihan.
    setRevision((currentRevision) => currentRevision + 1);
  }, []);

  const record = useCallback((currentModel: DiagramModel | null, nextModel: DiagramModel) => {
    const localHistory = recordLocalModelChange(historyRef.current, currentModel, nextModel);

    if (!localHistory.changed) {
      return false;
    }

    historyRef.current = localHistory.history;
    setRevision((currentRevision) => currentRevision + 1);

    return true;
  }, []);

  const undo = useCallback((currentModel: DiagramModel | null) => {
    const result = undoLocalModelChange(historyRef.current, currentModel);

    if (!result) {
      return null;
    }

    historyRef.current = result.history;
    setRevision((currentRevision) => currentRevision + 1);

    return result.model;
  }, []);

  const redo = useCallback((currentModel: DiagramModel | null) => {
    const result = redoLocalModelChange(historyRef.current, currentModel);

    if (!result) {
      return null;
    }

    historyRef.current = result.history;
    setRevision((currentRevision) => currentRevision + 1);

    return result.model;
  }, []);

  return {
    canRedo,
    canUndo,
    redo,
    record,
    reset,
    undo,
  };
}
