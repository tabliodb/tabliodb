import { HocuspocusProvider } from '@hocuspocus/provider';
import {
  hasDiagramModelInYjsDocument,
  readDiagramModelFromYjsDocument,
  writeDiagramModelToYjsDocument,
  yjsCollections,
  type DatabaseColumn,
  type DatabaseIndex,
  type DatabaseRelationship,
  type DatabaseTable,
  type DiagramModel,
  type DiagramNote,
  yjsRuntimeCollections,
} from '@tabliodb/schema-core';
import {
  REALTIME_SESSION_PROOF_TOKEN_TYPE,
  diagramDocumentName,
  parseRealtimePersistedAckPayload,
  realtimeSessionProofPath,
  type AwarenessState,
} from '@tabliodb/shared';
import { createSessionProofHeaders } from '@tabliodb/sdk';
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
  'authentication_failed' | 'connected' | 'connecting' | 'disconnected' | 'idle';

export type DiagramCollaborationStatus = {
  connection: DiagramCollaborationConnection;
  message?: string;
  pendingPersistence: boolean;
  persistedAt?: string;
  persistedVersion?: number;
  synced: boolean;
  unsyncedChanges: number;
};

export type DiagramCollaborationStatusSubscriber = (status: DiagramCollaborationStatus) => void;
export type DiagramCollaborationColumnPatch = {
  changes: Partial<DatabaseColumn>;
  clearedKeys: Array<keyof DatabaseColumn>;
  columnId: string;
  metadataUpdatedAt?: string;
};
export type DiagramCollaborationColumnStructuralPatch = {
  action: 'create' | 'delete' | 'reorder';
  checksToDelete: string[];
  column?: DatabaseColumn;
  columnId: string;
  indexesToDelete: string[];
  indexesToUpsert: DatabaseIndex[];
  metadataUpdatedAt?: string;
  relationshipsToDelete: string[];
  tableId: string;
  tablePatch: Pick<DatabaseTable, 'columnIds' | 'indexIds'>;
};
export type DiagramCollaborationTablePatch = {
  clearColor?: boolean;
  color?: string;
  tableId: string;
  metadataUpdatedAt?: string;
  name?: string;
  position?: { x: number; y: number };
  width?: number;
};
export type DiagramCollaborationRelationshipPatch =
  | {
      action: 'create';
      metadataUpdatedAt?: string;
      relationship: DatabaseRelationship;
      relationshipId: string;
    }
  | {
      action: 'delete';
      metadataUpdatedAt?: string;
      relationshipId: string;
    }
  | {
      action: 'update';
      changes: Partial<DatabaseRelationship>;
      clearedKeys: Array<keyof DatabaseRelationship>;
      metadataUpdatedAt?: string;
      relationshipId: string;
    };
export type DiagramCollaborationNotePatch =
  | {
      action: 'create';
      metadataUpdatedAt?: string;
      note: DiagramNote;
      noteId: string;
    }
  | {
      action: 'delete';
      metadataUpdatedAt?: string;
      noteId: string;
    }
  | {
      action: 'update';
      changes: Partial<DiagramNote>;
      clearedKeys: Array<keyof DiagramNote>;
      metadataUpdatedAt?: string;
      noteId: string;
    };

export function createDiagramCollaboration(options: DiagramCollaborationOptions) {
  const document = new Y.Doc();
  const documentName = diagramDocumentName(options.diagramId);
  const localModelWriteOrigin = Symbol(`tabliodb:${options.diagramId}:local-model-write`);
  const localPersistenceKey = String(document.clientID);
  const provider = new HocuspocusProvider({
    document,
    name: documentName,
    // Browser UI keeps auth in an httpOnly cookie, while this async token carries only the per-handshake proof signature.
    token: options.token ?? (() => createRealtimeSessionProofToken(documentName)),
    url: options.url ?? getDefaultRealtimeUrl(),
  });
  const statusSubscribers = new Set<DiagramCollaborationStatusSubscriber>();
  let currentStatus = readProviderStatus(provider);
  let latestLocalPersistenceToken: string | null = null;

  function emitStatus(nextStatus: DiagramCollaborationStatus) {
    currentStatus = nextStatus;
    statusSubscribers.forEach((subscriber) => subscriber(currentStatus));
  }

  function markLocalPersistencePending() {
    latestLocalPersistenceToken = createRealtimePersistenceToken(document.clientID);
    document
      .getMap<unknown>(yjsRuntimeCollections.persistenceTokens)
      .set(localPersistenceKey, latestLocalPersistenceToken);
    emitStatus({
      ...currentStatus,
      // A local Yjs mutation is only fully "saved" after the server persists a state containing this token.
      pendingPersistence: true,
    });
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

  const handleStateless = (event: { payload?: unknown }) => {
    const payload = typeof event.payload === 'string' ? event.payload : '';
    const acknowledgement = parseRealtimePersistedAckPayload(payload);

    if (!acknowledgement || acknowledgement.diagramId !== options.diagramId) {
      return;
    }

    const hasPendingLocalToken = Boolean(latestLocalPersistenceToken);
    const localTokenPersisted =
      latestLocalPersistenceToken === null ||
      acknowledgement.persistenceTokens[localPersistenceKey] === latestLocalPersistenceToken;

    if (localTokenPersisted) {
      latestLocalPersistenceToken = null;
    }

    emitStatus({
      ...currentStatus,
      message: undefined,
      pendingPersistence: hasPendingLocalToken ? !localTokenPersisted : false,
      persistedAt: acknowledgement.persistedAt,
      persistedVersion: acknowledgement.version,
    });
  };

  provider.on('status', handleProviderStatus);
  provider.on('synced', handleProviderSynced);
  provider.on('unsyncedChanges', handleUnsyncedChanges);
  provider.on('authenticationFailed', handleAuthenticationFailed);
  provider.on('stateless', handleStateless);

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
      markLocalPersistencePending();
      writeDiagramModelToYjsDocument(document, model, localModelWriteOrigin);
    },
    writeColumnStructuralPatch(patch: DiagramCollaborationColumnStructuralPatch) {
      const tableMap = document.getMap<Y.Map<unknown>>(yjsCollections.tables).get(patch.tableId);

      if (!(tableMap instanceof Y.Map)) {
        return false;
      }

      markLocalPersistencePending();

      const columnsMap = document.getMap<Y.Map<unknown>>(yjsCollections.columns);
      const indexesMap = document.getMap<Y.Map<unknown>>(yjsCollections.indexes);
      const relationshipsMap = document.getMap<Y.Map<unknown>>(yjsCollections.relationships);
      const checksMap = document.getMap<Y.Map<unknown>>(yjsCollections.checks);

      document.transact(() => {
        if (patch.action === 'create' && patch.column) {
          const existingColumnMap = columnsMap.get(patch.columnId);
          const columnMap = existingColumnMap instanceof Y.Map ? existingColumnMap : new Y.Map<unknown>();

          if (columnMap !== existingColumnMap) {
            columnsMap.set(patch.columnId, columnMap);
          }

          // New columns are inserted as their own Y.Map so later column.update patches can stay field-scoped.
          syncYMapFromRecord(columnMap, patch.column as unknown as Record<string, unknown>);
        }

        if (patch.action === 'delete') {
          columnsMap.delete(patch.columnId);
        }

        for (const indexId of patch.indexesToDelete) {
          indexesMap.delete(indexId);
        }

        for (const index of patch.indexesToUpsert) {
          const existingIndexMap = indexesMap.get(index.id);
          const indexMap = existingIndexMap instanceof Y.Map ? existingIndexMap : new Y.Map<unknown>();

          if (indexMap !== existingIndexMap) {
            indexesMap.set(index.id, indexMap);
          }

          // Column delete can shrink a composite index instead of removing it entirely.
          syncYMapFromRecord(indexMap, index as unknown as Record<string, unknown>);
        }

        for (const relationshipId of patch.relationshipsToDelete) {
          relationshipsMap.delete(relationshipId);
        }

        for (const checkId of patch.checksToDelete) {
          checksMap.delete(checkId);
        }

        if (patch.action === 'create') {
          insertYStringArrayValue(
            tableMap,
            'columnIds',
            patch.columnId,
            patch.tablePatch.columnIds.indexOf(patch.columnId),
          );
        } else if (patch.action === 'reorder') {
          moveYStringArrayValue(
            tableMap,
            'columnIds',
            patch.columnId,
            patch.tablePatch.columnIds.indexOf(patch.columnId),
          );
        } else {
          removeYStringArrayValue(tableMap, 'columnIds', patch.columnId);
        }

        // Index order can change when deleting a column that removes invalid indexes, so it is synced as the table's canonical ordered index list.
        syncYStringArrayField(tableMap, 'indexIds', patch.tablePatch.indexIds);

        if (patch.metadataUpdatedAt) {
          document.getMap<unknown>(yjsCollections.metadata).set('updatedAt', patch.metadataUpdatedAt);
        }
      }, localModelWriteOrigin);

      return true;
    },
    writeRelationshipPatch(patch: DiagramCollaborationRelationshipPatch) {
      const relationshipsMap = document.getMap<Y.Map<unknown>>(yjsCollections.relationships);

      if (patch.action === 'update') {
        const relationshipMap = relationshipsMap.get(patch.relationshipId);

        if (!(relationshipMap instanceof Y.Map)) {
          return false;
        }

        markLocalPersistencePending();

        document.transact(() => {
          for (const key of patch.clearedKeys) {
            relationshipMap.delete(key);
          }

          for (const [key, value] of Object.entries(patch.changes)) {
            // Relationship updates stay scoped to changed fields so separate cardinality/action edits can merge in Yjs.
            relationshipMap.set(key, cloneYjsSerializableValue(value));
          }

          if (patch.metadataUpdatedAt) {
            document.getMap<unknown>(yjsCollections.metadata).set('updatedAt', patch.metadataUpdatedAt);
          }
        }, localModelWriteOrigin);

        return true;
      }

      markLocalPersistencePending();

      document.transact(() => {
        if (patch.action === 'delete') {
          relationshipsMap.delete(patch.relationshipId);
        } else {
          const existingRelationshipMap = relationshipsMap.get(patch.relationshipId);
          const relationshipMap =
            existingRelationshipMap instanceof Y.Map ? existingRelationshipMap : new Y.Map<unknown>();

          if (relationshipMap !== existingRelationshipMap) {
            relationshipsMap.set(patch.relationshipId, relationshipMap);
          }

          // Relationship create writes only the relationship entity, leaving tables and columns untouched in the shared Y.Doc.
          syncYMapFromRecord(relationshipMap, patch.relationship as unknown as Record<string, unknown>);
        }

        if (patch.metadataUpdatedAt) {
          document.getMap<unknown>(yjsCollections.metadata).set('updatedAt', patch.metadataUpdatedAt);
        }
      }, localModelWriteOrigin);

      return true;
    },
    writeNotePatch(patch: DiagramCollaborationNotePatch) {
      const notesMap = document.getMap<Y.Map<unknown>>(yjsCollections.notes);

      if (patch.action === 'delete') {
        markLocalPersistencePending();

        document.transact(() => {
          notesMap.delete(patch.noteId);

          if (patch.metadataUpdatedAt) {
            document.getMap<unknown>(yjsCollections.metadata).set('updatedAt', patch.metadataUpdatedAt);
          }
        }, localModelWriteOrigin);

        return true;
      }

      if (patch.action === 'create') {
        const existingNoteMap = notesMap.get(patch.noteId);
        const noteMap = existingNoteMap instanceof Y.Map ? existingNoteMap : new Y.Map<unknown>();

        markLocalPersistencePending();

        document.transact(() => {
          if (noteMap !== existingNoteMap) {
            notesMap.set(patch.noteId, noteMap);
          }

          // New notes are inserted as entity maps so subsequent note.update patches stay field-scoped.
          syncYMapFromRecord(noteMap, patch.note as unknown as Record<string, unknown>);

          if (patch.metadataUpdatedAt) {
            document.getMap<unknown>(yjsCollections.metadata).set('updatedAt', patch.metadataUpdatedAt);
          }
        }, localModelWriteOrigin);

        return true;
      }

      const noteMap = notesMap.get(patch.noteId);

      if (!(noteMap instanceof Y.Map)) {
        return false;
      }

      markLocalPersistencePending();

      document.transact(() => {
        for (const key of patch.clearedKeys) {
          noteMap.delete(key);
        }

        for (const [key, value] of Object.entries(patch.changes)) {
          // Note updates are patched field-by-field so a text edit and a move from different clients can merge cleanly.
          noteMap.set(key, cloneYjsSerializableValue(value));
        }

        if (patch.metadataUpdatedAt) {
          document.getMap<unknown>(yjsCollections.metadata).set('updatedAt', patch.metadataUpdatedAt);
        }
      }, localModelWriteOrigin);

      return true;
    },
    writeColumnPatch(patch: DiagramCollaborationColumnPatch) {
      const columnMap = document.getMap<Y.Map<unknown>>(yjsCollections.columns).get(patch.columnId);

      if (!(columnMap instanceof Y.Map)) {
        return false;
      }

      markLocalPersistencePending();

      document.transact(() => {
        for (const key of patch.clearedKeys) {
          columnMap.delete(key);
        }

        for (const [key, value] of Object.entries(patch.changes)) {
          // Column updates are patched per changed field, so collaborative edits on unrelated column fields stay independent.
          columnMap.set(key, cloneYjsSerializableValue(value));
        }

        if (patch.metadataUpdatedAt) {
          document.getMap<unknown>(yjsCollections.metadata).set('updatedAt', patch.metadataUpdatedAt);
        }
      }, localModelWriteOrigin);

      return true;
    },
    writeTablePatch(patch: DiagramCollaborationTablePatch) {
      const tableMap = document.getMap<Y.Map<unknown>>(yjsCollections.tables).get(patch.tableId);

      if (!(tableMap instanceof Y.Map)) {
        return false;
      }

      markLocalPersistencePending();

      document.transact(() => {
        if (patch.name !== undefined) {
          tableMap.set('name', patch.name);
        }

        if (patch.clearColor) {
          // Optional fields are deleted from the Y.Map when cleared so remote readers see the same shape as canonical snapshots.
          tableMap.delete('color');
        } else if (patch.color !== undefined) {
          tableMap.set('color', patch.color);
        }

        if (patch.position) {
          // Position is patched at entity scope so table drags do not rewrite columns, relationships, notes, or other users' table edits.
          tableMap.set('position', { ...patch.position });
        }

        if (patch.width !== undefined) {
          tableMap.set('width', patch.width);
        }

        if (patch.metadataUpdatedAt) {
          document.getMap<unknown>(yjsCollections.metadata).set('updatedAt', patch.metadataUpdatedAt);
        }
      }, localModelWriteOrigin);

      return true;
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
      provider.off('stateless', handleStateless);
      statusSubscribers.clear();
      provider.destroy();
      document.destroy();
    },
  };
}

export type DiagramCollaboration = ReturnType<typeof createDiagramCollaboration>;

function cloneYjsSerializableValue(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as unknown;
}

function syncYMapFromRecord(map: Y.Map<unknown>, record: Record<string, unknown>): void {
  const nextKeys = new Set(Object.keys(record));

  for (const existingKey of Array.from(map.keys())) {
    if (!nextKeys.has(existingKey)) {
      map.delete(existingKey);
    }
  }

  for (const [key, value] of Object.entries(record)) {
    map.set(key, cloneYjsSerializableValue(value));
  }
}

function insertYStringArrayValue(map: Y.Map<unknown>, key: string, value: string, targetIndex: number): void {
  const array = getOrCreateYStringArrayField(map, key);
  const currentIndex = array.toArray().indexOf(value);

  if (currentIndex >= 0) {
    moveYStringArrayValue(map, key, value, targetIndex);
    return;
  }

  array.insert(clampArrayIndex(targetIndex, array.length), [value]);
}

function moveYStringArrayValue(map: Y.Map<unknown>, key: string, value: string, targetIndex: number): void {
  const array = getOrCreateYStringArrayField(map, key);
  const currentIndex = array.toArray().indexOf(value);

  if (currentIndex < 0) {
    insertYStringArrayValue(map, key, value, targetIndex);
    return;
  }

  array.delete(currentIndex, 1);
  array.insert(clampArrayIndex(targetIndex, array.length), [value]);
}

function removeYStringArrayValue(map: Y.Map<unknown>, key: string, value: string): void {
  const array = getOrCreateYStringArrayField(map, key);
  const currentIndex = array.toArray().indexOf(value);

  if (currentIndex >= 0) {
    array.delete(currentIndex, 1);
  }
}

function syncYStringArrayField(map: Y.Map<unknown>, key: string, values: string[]): void {
  const array = getOrCreateYStringArrayField(map, key);

  if (areStringArraysEqual(array.toArray(), values)) {
    return;
  }

  if (array.length > 0) {
    array.delete(0, array.length);
  }

  if (values.length > 0) {
    array.insert(0, values);
  }
}

function getOrCreateYStringArrayField(map: Y.Map<unknown>, key: string): Y.Array<string> {
  const existingValue = map.get(key);

  if (existingValue instanceof Y.Array) {
    return existingValue as Y.Array<string>;
  }

  const array = new Y.Array<string>();
  const existingValues = Array.isArray(existingValue)
    ? existingValue.filter((item): item is string => typeof item === 'string')
    : [];

  if (existingValues.length > 0) {
    array.insert(0, existingValues);
  }

  map.set(key, array);

  return array;
}

function clampArrayIndex(index: number, length: number): number {
  if (!Number.isFinite(index)) {
    return length;
  }

  return Math.max(0, Math.min(index, length));
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function createRealtimePersistenceToken(clientId: number): string {
  const randomToken =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  // Client id plus a timestamp makes the token easy to inspect while the random suffix keeps rapid local writes distinct.
  return `${clientId}:${Date.now()}:${randomToken}`;
}

async function createRealtimeSessionProofToken(documentName: string): Promise<string> {
  const proofHeaders = await createSessionProofHeaders(realtimeSessionProofPath(documentName), {
    method: 'WS',
  });

  return JSON.stringify({
    headers: proofHeaders,
    type: REALTIME_SESSION_PROOF_TOKEN_TYPE,
  });
}

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
    pendingPersistence: false,
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
