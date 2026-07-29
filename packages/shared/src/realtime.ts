export const REALTIME_DOCUMENT_PREFIX = 'diagram';

export type RealtimeDocumentName = `${typeof REALTIME_DOCUMENT_PREFIX}:${string}`;

export type AwarenessState = {
  userId: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selectedEntityId?: string;
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
