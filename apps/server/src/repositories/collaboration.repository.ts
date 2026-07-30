import { Injectable } from '@nestjs/common';
import {
  createEmptyDiagramModel,
  encodeDiagramModelAsYjsUpdate,
  type DatabaseDialect,
  type DiagramModel,
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
      return new Uint8Array(row.yjsState);
    }

    const hydrationModel = await this.loadHydrationModel(diagramId);

    // Empty realtime documents are bootstrapped from trusted server data so clients never start from a blank Y.Doc by accident.
    return hydrationModel ? encodeDiagramModelAsYjsUpdate(hydrationModel) : null;
  }

  async storeDocument(diagramId: string, state: Uint8Array): Promise<void> {
    await this.db
      .insertInto('diagram_documents')
      .values({ diagramId, yjsState: Buffer.from(state), version: 1 })
      .onConflict((oc) =>
        oc.column('diagramId').doUpdateSet((eb) => ({
          yjsState: Buffer.from(state),
          version: eb('diagram_documents.version', '+', 1),
          updatedAt: new Date(),
        })),
      )
      .execute();
  }

  private async loadHydrationModel(diagramId: string): Promise<DiagramModel | null> {
    const snapshotRow = await this.db
      .selectFrom('diagram_snapshots')
      .select('snapshot')
      .where('diagramId', '=', diagramId)
      .orderBy('version', 'desc')
      .executeTakeFirst();

    if (snapshotRow) {
      return snapshotRow.snapshot as DiagramModel;
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
