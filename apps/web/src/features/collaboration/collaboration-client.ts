import { HocuspocusProvider } from '@hocuspocus/provider';
import { diagramDocumentName, type AwarenessState } from '@tabliodb/shared';
import * as Y from 'yjs';

export type DiagramCollaborationOptions = {
  diagramId: string;
  token: string;
  url?: string;
};

export function createDiagramCollaboration(options: DiagramCollaborationOptions) {
  const document = new Y.Doc();
  const provider = new HocuspocusProvider({
    document,
    name: diagramDocumentName(options.diagramId),
    token: options.token,
    url: options.url ?? 'ws://localhost:1234',
  });

  return {
    document,
    provider,
    setAwareness(state: AwarenessState) {
      provider.awareness?.setLocalState(state);
    },
    destroy() {
      provider.destroy();
      document.destroy();
    },
  };
}
