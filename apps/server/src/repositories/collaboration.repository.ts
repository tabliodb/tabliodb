import { Injectable } from '@nestjs/common';
import {
  createEmptyDiagramModel,
  decodeDiagramModelFromYjsUpdate,
  encodeDiagramModelAsYjsUpdate,
  normalizeDiagramModel,
  readYjsStringMapFromUpdate,
  type DatabaseDialect,
  type DiagramModel,
  yjsRuntimeCollections,
} from '@tabliodb/schema-core';
import { Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB } from '../schema/index.js';

@Injectable()
export class CollaborationRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  async loadDocument(diagramId: string): Promise<Uint8Array | null> {
    const row = await this.db
      .selectFrom('diagram_documents')
      .select(['yjsState'])
      .where('diagramId', '=', diagramId)
      .executeTakeFirst();

    if (row?.yjsState) {
      const state = new Uint8Array(row.yjsState);
      const model = normalizeDiagramModel(decodeDiagramModelFromYjsUpdate(state));

      // Realtime fetch always returns a normalized Yjs update so reconnecting clients never hydrate a half-written table collection.
      return encodeDiagramModelAsYjsUpdate(model);
    }

    const hydrationModel = await this.loadHydrationModel(diagramId);

    // Empty realtime documents are bootstrapped from trusted server data so clients never start from a blank Y.Doc by accident.
    return hydrationModel ? encodeDiagramModelAsYjsUpdate(hydrationModel) : null;
  }

  async storeDocument(diagramId: string, state: Uint8Array): Promise<StoredRealtimeDocumentReceipt> {
    const persistenceTokens = readYjsStringMapFromUpdate(state, yjsRuntimeCollections.persistenceTokens);
    const normalizedModel = normalizeDiagramModel(decodeDiagramModelFromYjsUpdate(state));
    const normalizedState = Buffer.from(encodeDiagramModelAsYjsUpdate(normalizedModel));

    const row = await this.db
      .insertInto('diagram_documents')
      .values({ diagramId, yjsState: normalizedState, version: 1 })
      .onConflict((oc) =>
        oc.column('diagramId').doUpdateSet((eb) => ({
          // Stored Yjs state is normalized at the persistence boundary to avoid keeping collection-order races across reloads.
          yjsState: normalizedState,
          version: eb('diagram_documents.version', '+', 1),
          updatedAt: new Date(),
        })),
      )
      .returning(['updatedAt', 'version'])
      .executeTakeFirstOrThrow();

    return {
      modelUpdatedAt: normalizedModel.metadata.updatedAt,
      persistedAt: toIsoDateString(row.updatedAt),
      // The persisted row stores only canonical schema data; runtime tokens are returned solely for websocket acknowledgement.
      persistenceTokens,
      version: row.version,
    };
  }

  private async loadHydrationModel(diagramId: string): Promise<DiagramModel | null> {
    const snapshotRow = await this.db
      .selectFrom('diagram_snapshots')
      .select('snapshot')
      .where('diagramId', '=', diagramId)
      .orderBy('version', 'desc')
      .executeTakeFirst();

    if (snapshotRow) {
      return normalizeDiagramModel(snapshotRow.snapshot as DiagramModel);
    }

    const diagramRow = await this.db
      .selectFrom('diagrams')
      .select(['dialect', 'name'])
      .where('id', '=', diagramId)
      .where('archivedAt', 'is', null)
      .executeTakeFirst();

    if (!diagramRow) {
      return null;
    }

    return createEmptyDiagramModel(diagramRow.name, diagramRow.dialect as DatabaseDialect);
  }
}

export type StoredRealtimeDocumentReceipt = {
  modelUpdatedAt?: string;
  persistedAt: string;
  persistenceTokens: Record<string, string>;
  version: number;
};

function toIsoDateString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
