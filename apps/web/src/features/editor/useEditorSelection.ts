import type { DiagramModel } from '@tabliodb/schema-core';
import { useCallback, useRef, useState, type SetStateAction } from 'react';
import { isCommentTargetAvailable } from './comments/comment-targets';
import type { CommentThreadOpenRequest, EditorCommentTarget } from './comments/types';

type EditorSelectionFallbackTarget = Pick<EditorCommentTarget, 'targetId' | 'targetType'> | null | undefined;

export function useEditorSelection() {
  const [selectedTableId, setSelectedTableIdState] = useState<string | null>(null);
  const [selectedCommentTarget, setSelectedCommentTargetState] = useState<EditorCommentTarget | null>(null);
  const selectedTableIdRef = useRef<string | null>(null);
  const selectedCommentTargetRef = useRef<EditorCommentTarget | null>(null);
  const [commentThreadOpenRequest, setCommentThreadOpenRequest] = useState<CommentThreadOpenRequest | null>(null);
  const commentThreadOpenRequestIdRef = useRef(0);

  const setSelectedTableId = useCallback((nextValue: SetStateAction<string | null>) => {
    const resolvedValue = resolveSetStateAction(nextValue, selectedTableIdRef.current);

    // Realtime subscription callbacks read this ref outside React render, so every public setter updates it before React schedules the next paint.
    selectedTableIdRef.current = resolvedValue;
    setSelectedTableIdState(resolvedValue);
  }, []);

  const setSelectedCommentTarget = useCallback((nextValue: SetStateAction<EditorCommentTarget | null>) => {
    const resolvedValue = resolveSetStateAction(nextValue, selectedCommentTargetRef.current);

    // Awareness publishing and remote conflict checks must see the newest target even before the next render completes.
    selectedCommentTargetRef.current = resolvedValue;
    setSelectedCommentTargetState(resolvedValue);
  }, []);

  const clearSelection = useCallback(() => {
    selectedTableIdRef.current = null;
    selectedCommentTargetRef.current = null;
    setSelectedTableIdState(null);
    setSelectedCommentTargetState(null);
  }, []);

  const selectTable = useCallback(
    (tableId: string | null) => {
      setSelectedTableId(tableId);
      setSelectedCommentTarget(tableId ? { targetId: tableId, targetType: 'table' } : null);
    },
    [setSelectedCommentTarget, setSelectedTableId],
  );

  const requestCommentThreadOpen = useCallback((target: EditorCommentTarget) => {
    commentThreadOpenRequestIdRef.current += 1;
    setCommentThreadOpenRequest({
      requestId: commentThreadOpenRequestIdRef.current,
      target,
    });
  }, []);

  const reconcileModelSelection = useCallback(
    (nextModel: DiagramModel) => {
      setSelectedTableId((currentTableId) => {
        return currentTableId && nextModel.tables[currentTableId] ? currentTableId : null;
      });
      setSelectedCommentTarget((currentTarget) => {
        return currentTarget && isCommentTargetAvailable(nextModel, currentTarget) ? currentTarget : null;
      });
    },
    [setSelectedCommentTarget, setSelectedTableId],
  );

  const repairInvalidCommentTarget = useCallback(
    (nextModel: DiagramModel) => {
      const currentTarget = selectedCommentTargetRef.current;

      if (!currentTarget || isCommentTargetAvailable(nextModel, currentTarget)) {
        return;
      }

      const currentTableId = selectedTableIdRef.current;

      // Jika detail target hilang tetapi table masih ada, komentar kembali ke table agar user tidak kehilangan konteks diskusi.
      setSelectedCommentTarget(
        currentTableId && nextModel.tables[currentTableId] ? { targetId: currentTableId, targetType: 'table' } : null,
      );
    },
    [setSelectedCommentTarget],
  );

  const applyRemoteSelectionFallback = useCallback(
    (fallbackTarget: EditorSelectionFallbackTarget) => {
      if (fallbackTarget?.targetType === 'table' && fallbackTarget.targetId) {
        selectTable(fallbackTarget.targetId);
        return;
      }

      clearSelection();
    },
    [clearSelection, selectTable],
  );

  return {
    applyRemoteSelectionFallback,
    clearSelection,
    commentThreadOpenRequest,
    reconcileModelSelection,
    repairInvalidCommentTarget,
    requestCommentThreadOpen,
    selectedCommentTarget,
    selectedCommentTargetRef,
    selectedTableId,
    selectedTableIdRef,
    selectTable,
    setSelectedCommentTarget,
    setSelectedTableId,
  };
}

function resolveSetStateAction<T>(nextValue: SetStateAction<T>, currentValue: T): T {
  return typeof nextValue === 'function' ? (nextValue as (value: T) => T)(currentValue) : nextValue;
}
