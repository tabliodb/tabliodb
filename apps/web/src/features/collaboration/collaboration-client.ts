import { HocuspocusProvider } from '@hocuspocus/provider';
import {
  hasDiagramModelInYjsDocument,
  readDiagramModelFromYjsDocument,
  writeDiagramModelToYjsDocument,
  type DiagramModel,
} from '@tabliodb/schema-core';
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
export type DiagramModelSubscriber = (model: DiagramModel) => void;

export type DiagramCollaborationConnection =
  | 'authentication_failed'
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'idle';

export type DiagramCollaborationStatus = {
  connection: DiagramCollaborationConnection;
  message?: string;
  synced: boolean;
  unsyncedChanges: number;
};

export type DiagramCollaborationStatusSubscriber = (status: DiagramCollaborationStatus) => void;

export function createDiagramCollaboration(options: DiagramCollaborationOptions) {
  const document = new Y.Doc();
  const localModelWriteOrigin = Symbol(`tabliodb:${options.diagramId}:local-model-write`);
  const provider = new HocuspocusProvider({
    document,
    name: diagramDocumentName(options.diagramId),
    // Browser UI relies on the httpOnly session cookie in the WebSocket handshake; explicit tokens remain useful for non-browser clients.
    token: options.token ?? null,
    url: options.url ?? getDefaultRealtimeUrl(),
  });
  const statusSubscribers = new Set<DiagramCollaborationStatusSubscriber>();
  let currentStatus = readProviderStatus(provider);

  function emitStatus(nextStatus: DiagramCollaborationStatus) {
    currentStatus = nextStatus;
    statusSubscribers.forEach((subscriber) => subscriber(currentStatus));
  }

  const handleProviderStatus = (event: { status?: unknown }) => {
    // Hocuspocus exposes raw websocket strings; the app wrapper maps them once so UI components stay library-agnostic.
    emitStatus({
      ...currentStatus,
      connection: parseConnectionStatus(event.status),
      message: undefined,
      synced: provider.synced,
      unsyncedChanges: provider.unsyncedChanges,
    });
  };

  const handleProviderSynced = (event: { state?: unknown }) => {
    emitStatus({
      ...currentStatus,
      message: undefined,
      synced: event.state === true,
      unsyncedChanges: provider.unsyncedChanges,
    });
  };

  const handleUnsyncedChanges = (event: { number?: unknown }) => {
    emitStatus({
      ...currentStatus,
      synced: provider.synced,
      unsyncedChanges: typeof event.number === 'number' ? event.number : provider.unsyncedChanges,
    });
  };

  const handleAuthenticationFailed = (event: { reason?: unknown }) => {
    emitStatus({
      ...currentStatus,
      connection: 'authentication_failed',
      message: typeof event.reason === 'string' ? event.reason : 'Realtime authentication failed.',
      synced: false,
    });
  };

  provider.on('status', handleProviderStatus);
  provider.on('synced', handleProviderSynced);
  provider.on('unsyncedChanges', handleUnsyncedChanges);
  provider.on('authenticationFailed', handleAuthenticationFailed);

  return {
    document,
    localClientId: document.clientID,
    provider,
    subscribeModel(subscriber: DiagramModelSubscriber) {
      const emit = () => {
        if (!hasDiagramModelInYjsDocument(document)) {
          return;
        }

        subscriber(readDiagramModelFromYjsDocument(document));
      };
      const handleUpdate = (_update: Uint8Array, origin: unknown) => {
        if (origin === localModelWriteOrigin) {
          return;
        }

        emit();
      };
      const handleSynced = (event: { state?: unknown }) => {
        if (event.state === true) {
          emit();
        }
      };

      // Document updates carry remote schema edits, while synced covers the initial server hydration payload.
      document.on('update', handleUpdate);
      provider.on('synced', handleSynced);
      emit();

      return () => {
        document.off('update', handleUpdate);
        provider.off('synced', handleSynced);
      };
    },
    setAwareness(state: AwarenessState) {
      provider.awareness?.setLocalState(state);
    },
    writeModel(model: DiagramModel) {
      writeDiagramModelToYjsDocument(document, model, localModelWriteOrigin);
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
    subscribeStatus(subscriber: DiagramCollaborationStatusSubscriber) {
      statusSubscribers.add(subscriber);
      subscriber(currentStatus);

      return () => {
        statusSubscribers.delete(subscriber);
      };
    },
    destroy() {
      provider.off('status', handleProviderStatus);
      provider.off('synced', handleProviderSynced);
      provider.off('unsyncedChanges', handleUnsyncedChanges);
      provider.off('authenticationFailed', handleAuthenticationFailed);
      statusSubscribers.clear();
      provider.destroy();
      document.destroy();
    },
  };
}

export type DiagramCollaboration = ReturnType<typeof createDiagramCollaboration>;

function getDefaultRealtimeUrl(): string {
  if (typeof window === 'undefined') {
    return 'ws://localhost:1234';
  }

  const realtimeUrl = new URL(window.location.origin);
  realtimeUrl.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  realtimeUrl.port = '1234';

  // Production compose exposes realtime on 1234; deriving the host keeps custom domains usable without rebuilding web.
  return realtimeUrl.toString().replace(/\/$/, '');
}

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
    commentTyping: readCommentTyping(state.commentTyping),
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

function readCommentTyping(value: unknown): AwarenessState['commentTyping'] {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const typing = value as Partial<NonNullable<AwarenessState['commentTyping']>>;

  if (
    typeof typing.threadId !== 'string' ||
    !(typing.parentCommentId === null || typeof typing.parentCommentId === 'string') ||
    typeof typing.updatedAt !== 'number' ||
    !Number.isFinite(typing.updatedAt)
  ) {
    return undefined;
  }

  return {
    parentCommentId: typing.parentCommentId,
    threadId: typing.threadId,
    updatedAt: typing.updatedAt,
  };
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

function readProviderStatus(provider: HocuspocusProvider): DiagramCollaborationStatus {
  return {
    connection: parseConnectionStatus(provider.configuration.websocketProvider.status),
    synced: provider.synced,
    unsyncedChanges: provider.unsyncedChanges,
  };
}

function parseConnectionStatus(value: unknown): DiagramCollaborationConnection {
  if (value === 'connected' || value === 'connecting' || value === 'disconnected') {
    return value;
  }

  return 'idle';
}
