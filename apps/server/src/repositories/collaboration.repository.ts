import { Injectable } from '@nestjs/common';
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

    return row?.yjsState ? new Uint8Array(row.yjsState) : null;
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
}
