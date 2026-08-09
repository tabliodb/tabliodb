export const REALTIME_DOCUMENT_PREFIX = 'diagram';
export const REALTIME_SESSION_PROOF_TOKEN_TYPE = 'tabliodb-realtime-session-proof-v1';

export type RealtimeDocumentName = `${typeof REALTIME_DOCUMENT_PREFIX}:${string}`;

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
