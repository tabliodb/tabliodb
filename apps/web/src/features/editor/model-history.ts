import { stringifyDiagramModel, type DiagramModel } from '@tabliodb/schema-core';

export const defaultEditorModelHistoryLimit = 80;

export type EditorModelHistory = {
  future: DiagramModel[];
  past: DiagramModel[];
};

export type EditorModelHistoryResult = {
  history: EditorModelHistory;
  model: DiagramModel;
};

export function createEmptyEditorModelHistory(): EditorModelHistory {
  return {
    future: [],
    past: [],
  };
}

export function createDiagramModelSignature(model: DiagramModel): string {
  // Signature memakai serializer canonical schema-core, sehingga urutan key dan bentuk JSON konsisten antar render dan test.
  return stringifyDiagramModel(model);
}

export function recordLocalModelChange(
  history: EditorModelHistory,
  currentModel: DiagramModel | null,
  nextModel: DiagramModel,
  limit = defaultEditorModelHistoryLimit,
): { changed: boolean; history: EditorModelHistory } {
  if (!currentModel || createDiagramModelSignature(currentModel) === createDiagramModelSignature(nextModel)) {
    return {
      changed: false,
      history,
    };
  }

  return {
    changed: true,
    // Hanya perubahan lokal yang memanggil helper ini; remote Yjs update harus memakai reset supaya undo user tidak menarik perubahan orang lain.
    history: {
      future: [],
      past: [...history.past, currentModel].slice(-limit),
    },
  };
}

export function undoLocalModelChange(
  history: EditorModelHistory,
  currentModel: DiagramModel | null,
  limit = defaultEditorModelHistoryLimit,
): EditorModelHistoryResult | null {
  const previousModel = history.past[history.past.length - 1];

  if (!currentModel || !previousModel) {
    return null;
  }

  return {
    history: {
      future: [currentModel, ...history.future].slice(0, limit),
      past: history.past.slice(0, -1),
    },
    model: previousModel,
  };
}

export function redoLocalModelChange(
  history: EditorModelHistory,
  currentModel: DiagramModel | null,
  limit = defaultEditorModelHistoryLimit,
): EditorModelHistoryResult | null {
  const nextModel = history.future[0];

  if (!currentModel || !nextModel) {
    return null;
  }

  return {
    history: {
      future: history.future.slice(1),
      past: [...history.past, currentModel].slice(-limit),
    },
    model: nextModel,
  };
}
