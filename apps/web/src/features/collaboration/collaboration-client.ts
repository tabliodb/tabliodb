import { HocuspocusProvider } from '@hocuspocus/provider';
import { diagramDocumentName, type AwarenessState } from '@tabliodb/shared';
import * as Y from 'yjs';

export type DiagramCollaborationOptions = {
  diagramId: string;
  token?: string | null;
  url?: string;
};

export type RemoteAwarenessState = {
  clientId: number;
  isLocal: boolean;
  state: AwarenessState;
};

export type AwarenessSubscriber = (states: RemoteAwarenessState[]) => void;

export function createDiagramCollaboration(options: DiagramCollaborationOptions) {
  const document = new Y.Doc();
  const provider = new HocuspocusProvider({
    document,
    name: diagramDocumentName(options.diagramId),
    // Browser UI relies on the httpOnly session cookie in the WebSocket handshake; explicit tokens remain useful for non-browser clients.
    token: options.token ?? null,
    url: options.url ?? 'ws://localhost:1234',
  });

  return {
    document,
    localClientId: document.clientID,
    provider,
    setAwareness(state: AwarenessState) {
      provider.awareness?.setLocalState(state);
    },
    subscribeAwareness(subscriber: AwarenessSubscriber) {
      const awareness = provider.awareness;

      if (!awareness) {
        return () => undefined;
      }

      const emit = () => subscriber(readAwarenessStates(provider));

      awareness.on('change', emit);
      awareness.on('update', emit);
      emit();

      return () => {
        awareness.off('change', emit);
        awareness.off('update', emit);
      };
    },
    destroy() {
      provider.destroy();
      document.destroy();
    },
  };
}

export type DiagramCollaboration = ReturnType<typeof createDiagramCollaboration>;

function readAwarenessStates(provider: HocuspocusProvider): RemoteAwarenessState[] {
  const awareness = provider.awareness;

  if (!awareness) {
    return [];
  }

  return Array.from(awareness.getStates().entries()).flatMap(([clientId, rawState]) => {
    const state = parseAwarenessState(rawState);

    return state
      ? [
          {
            clientId,
            isLocal: clientId === awareness.clientID,
            state,
          },
        ]
      : [];
  });
}

function parseAwarenessState(value: unknown): AwarenessState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const state = value as Partial<AwarenessState>;

  if (!state.user || typeof state.user !== 'object') {
    return null;
  }

  const user = state.user as Partial<AwarenessState['user']>;

  if (
    typeof user.id !== 'string' ||
    typeof user.name !== 'string' ||
    typeof user.cursorColor !== 'string' ||
    !(typeof user.avatarUrl === 'string' || user.avatarUrl === null)
  ) {
    return null;
  }

  return {
    cursor: readCursor(state.cursor),
    selection: readSelection(state.selection),
    user: {
      avatarUrl: user.avatarUrl,
      cursorColor: user.cursorColor,
      id: user.id,
      name: user.name,
    },
    viewport: readViewport(state.viewport),
  };
}

function readCursor(value: unknown): AwarenessState['cursor'] {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const cursor = value as Partial<NonNullable<AwarenessState['cursor']>>;

  return typeof cursor.x === 'number' && typeof cursor.y === 'number' ? { x: cursor.x, y: cursor.y } : undefined;
}

function readSelection(value: unknown): AwarenessState['selection'] {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const selection = value as Partial<NonNullable<AwarenessState['selection']>>;
  const targetTypes = [
    'check',
    'column',
    'diagram',
    'enum',
    'group',
    'index',
    'note',
    'relationship',
    'table',
  ] as const;

  if (
    (typeof selection.targetId === 'string' || selection.targetId === null) &&
    selection.targetType &&
    targetTypes.includes(selection.targetType)
  ) {
    return {
      targetId: selection.targetId,
      targetType: selection.targetType,
    };
  }

  return undefined;
}

function readViewport(value: unknown): AwarenessState['viewport'] {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const viewport = value as Partial<NonNullable<AwarenessState['viewport']>>;

  return typeof viewport.x === 'number' && typeof viewport.y === 'number' && typeof viewport.zoom === 'number'
    ? { x: viewport.x, y: viewport.y, zoom: viewport.zoom }
    : undefined;
}
