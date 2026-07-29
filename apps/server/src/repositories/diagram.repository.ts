import { Injectable } from '@nestjs/common';
import { Insertable, Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, DiagramTable } from '../schema/index.js';

@Injectable()
export class DiagramRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  create(dto: Insertable<DiagramTable>) {
    return this.db.transaction().execute(async (tx) => {
      const diagram = await tx.insertInto('diagrams').values(dto).returningAll().executeTakeFirstOrThrow();

      // Every diagram gets a row for Yjs persistence on creation, even before the first realtime update arrives.
      await tx.insertInto('diagram_documents').values({ diagramId: diagram.id, yjsState: null }).execute();

      return diagram;
    });
  }

  getByProject(projectId: string) {
    return this.db
      .selectFrom('diagrams')
      .selectAll()
      .where('projectId', '=', projectId)
      .orderBy('updatedAt', 'desc')
      .execute();
  }

  getById(id: string) {
    return this.db.selectFrom('diagrams').selectAll().where('id', '=', id).executeTakeFirst();
  }
}
