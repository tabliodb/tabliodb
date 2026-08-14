import type { AwarenessState } from '@tabliodb/shared';
import type { DiagramCollaborationStatus, RemoteAwarenessState } from '@/features/collaboration/collaboration-client';
import type { CommentTypingPresence, EditorCommentTarget } from './comments/types';
import type { CollaboratorPresence } from './collaboration-status';
import type { RemoteCanvasCursor } from './components/SchemaCanvas';

export type CurrentAwarenessUser = {
  avatarUrl: string | null;
  cursorColor: string;
  id: string;
  name: string;
};

export const idleCollaborationStatus: DiagramCollaborationStatus = {
  connection: 'idle',
  pendingPersistence: false,
  synced: false,
  unsyncedChanges: 0,
};

export function createEditorAwarenessState({
  commentTyping,
  currentUser,
  cursor,
  diagramId,
  selectedTarget,
}: {
  commentTyping?: AwarenessState['commentTyping'];
  currentUser: CurrentAwarenessUser;
  cursor?: AwarenessState['cursor'];
  diagramId: string;
  selectedTarget: EditorCommentTarget | null;
}): AwarenessState {
  return {
    commentTyping,
    cursor,
    selection: selectedTarget
      ? {
          targetId: selectedTarget.targetId,
          targetType: selectedTarget.targetType,
        }
      : {
          targetId: diagramId,
          targetType: 'diagram',
        },
    user: {
      avatarUrl: currentUser.avatarUrl,
      cursorColor: currentUser.cursorColor,
      id: currentUser.id,
      name: currentUser.name,
    },
  };
}

export function areCommentTypingStatesEqual(
  left: AwarenessState['commentTyping'],
  right: AwarenessState['commentTyping'],
): boolean {
  if (!left || !right) {
    return left === right;
  }

  return (
    left.parentCommentId === right.parentCommentId &&
    left.threadId === right.threadId &&
    left.updatedAt === right.updatedAt
  );
}

export function areRemoteAwarenessStatesEqual(left: RemoteAwarenessState[], right: RemoteAwarenessState[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((leftState, index) => {
    const rightState = right[index];

    if (!rightState || leftState.clientId !== rightState.clientId) {
      return false;
    }

    // Awareness state adalah payload kecil; serial comparison menjaga callback realtime idempotent tanpa cache manual yang rawan stale.
    return JSON.stringify(leftState.state) === JSON.stringify(rightState.state);
  });
}

export function createCollaboratorPresenceList(
  states: RemoteAwarenessState[],
  currentUserId: string | null,
): CollaboratorPresence[] {
  const collaboratorsByUser = new Map<string, CollaboratorPresence>();

  for (const awareness of states) {
    const user = awareness.state.user;

    if (user.id === currentUserId) {
      continue;
    }

    const existing = collaboratorsByUser.get(user.id);

    if (existing) {
      existing.clientIds.push(awareness.clientId);
      existing.cursor = awareness.state.cursor ?? existing.cursor;
      existing.selection = awareness.state.selection ?? existing.selection;
      continue;
    }

    collaboratorsByUser.set(user.id, {
      clientIds: [awareness.clientId],
      cursor: awareness.state.cursor,
      selection: awareness.state.selection,
      user: {
        ...user,
        email: '',
      },
    });
  }

  return Array.from(collaboratorsByUser.values()).sort((left, right) => left.user.name.localeCompare(right.user.name));
}

export function createRemoteCanvasCursorList(
  states: RemoteAwarenessState[],
  currentUserId: string | null,
): RemoteCanvasCursor[] {
  const cursorsByUser = new Map<string, RemoteCanvasCursor>();

  for (const awareness of states) {
    const { cursor, user } = awareness.state;

    if (!cursor || user.id === currentUserId) {
      continue;
    }

    const existing = cursorsByUser.get(user.id);

    if (existing) {
      existing.clientIds.push(awareness.clientId);
      // Satu user bisa membuka beberapa tab; posisi terakhir dipakai supaya overlay tidak menggambar nama yang sama berkali-kali.
      existing.cursor = cursor;
      continue;
    }

    cursorsByUser.set(user.id, {
      clientIds: [awareness.clientId],
      cursor,
      user,
    });
  }

  return Array.from(cursorsByUser.values()).sort((left, right) => left.user.name.localeCompare(right.user.name));
}

export function createRemoteCommentTypingPresenceList(
  states: RemoteAwarenessState[],
  currentUserId: string | null,
): CommentTypingPresence[] {
  const typingByUser = new Map<string, CommentTypingPresence>();

  for (const awareness of states) {
    const { commentTyping, user } = awareness.state;

    if (!commentTyping || user.id === currentUserId) {
      continue;
    }

    const existing = typingByUser.get(user.id);

    if (existing) {
      existing.clientIds.push(awareness.clientId);
      existing.parentCommentId = commentTyping.parentCommentId;
      existing.threadId = commentTyping.threadId;
      existing.updatedAt = Math.max(existing.updatedAt, commentTyping.updatedAt);
      continue;
    }

    typingByUser.set(user.id, {
      clientIds: [awareness.clientId],
      parentCommentId: commentTyping.parentCommentId,
      threadId: commentTyping.threadId,
      updatedAt: commentTyping.updatedAt,
      user,
    });
  }

  return Array.from(typingByUser.values()).sort((left, right) => left.user.name.localeCompare(right.user.name));
}
