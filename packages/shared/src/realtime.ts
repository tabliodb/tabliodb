export const REALTIME_DOCUMENT_PREFIX = 'diagram';
export const REALTIME_PERSISTED_ACK_TYPE = 'tabliodb-realtime-persisted-ack-v1';
export const REALTIME_SESSION_PROOF_TOKEN_TYPE = 'tabliodb-realtime-session-proof-v1';

export type RealtimeDocumentName = `${typeof REALTIME_DOCUMENT_PREFIX}:${string}`;

export type RealtimePersistedAckMessage = {
  diagramId: string;
  modelUpdatedAt?: string;
  persistedAt: string;
  persistenceTokens: Record<string, string>;
  type: typeof REALTIME_PERSISTED_ACK_TYPE;
  version: number;
};

export type AwarenessUser = {
  avatarUrl: string | null;
  cursorColor: string;
  id: string;
  name: string;
};

export type AwarenessSelection = {
  targetId: string | null;
  targetType: 'check' | 'column' | 'diagram' | 'enum' | 'group' | 'index' | 'note' | 'relationship' | 'table';
};

export type AwarenessCommentTyping = {
  parentCommentId: string | null;
  threadId: string;
  updatedAt: number;
};

export type AwarenessState = {
  user: AwarenessUser;
  commentTyping?: AwarenessCommentTyping;
  cursor?: { x: number; y: number };
  selection?: AwarenessSelection;
  viewport?: { x: number; y: number; zoom: number };
};

export function diagramDocumentName(diagramId: string): RealtimeDocumentName {
  return `${REALTIME_DOCUMENT_PREFIX}:${diagramId}`;
}

export function parseDiagramDocumentName(documentName: string): { diagramId: string } | null {
  const [prefix, diagramId] = documentName.split(':', 2);
  if (prefix !== REALTIME_DOCUMENT_PREFIX || !diagramId) {
    return null;
  }

  return { diagramId };
}

export function realtimeSessionProofPath(documentName: string): string {
  // WebSocket handshakes cannot carry browser-defined headers, so realtime signs this synthetic path in the auth token.
  return `/_tabliodb/realtime-session-proof/${encodeURIComponent(documentName)}`;
}

export function parseRealtimePersistedAckPayload(payload: string): RealtimePersistedAckMessage | null {
  try {
    const parsed = JSON.parse(payload) as Partial<RealtimePersistedAckMessage>;

    if (
      parsed.type !== REALTIME_PERSISTED_ACK_TYPE ||
      typeof parsed.diagramId !== 'string' ||
      typeof parsed.persistedAt !== 'string' ||
      typeof parsed.version !== 'number' ||
      !Number.isFinite(parsed.version)
    ) {
      return null;
    }

    return {
      diagramId: parsed.diagramId,
      modelUpdatedAt: typeof parsed.modelUpdatedAt === 'string' ? parsed.modelUpdatedAt : undefined,
      persistedAt: parsed.persistedAt,
      // Persistence tokens are client-owned correlation markers; malformed values are ignored instead of poisoning status state.
      persistenceTokens: readStringRecord(parsed.persistenceTokens),
      type: REALTIME_PERSISTED_ACK_TYPE,
      version: parsed.version,
    };
  } catch {
    return null;
  }
}

function readStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const record: Record<string, string> = {};

  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string') {
      record[key] = item;
    }
  }

  return record;
}
