import { Injectable } from '@nestjs/common';
import type { DatabaseDialect } from '@tabliodb/schema-core';
import { Insertable, Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, DiagramTable } from '../schema/index.js';
import { decodeOffsetCursor, encodeOffsetCursor } from '../utils/pagination.js';

export type DiagramListOptions = {
  cursor?: string;
  limit: number;
};

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

  async getByProject(projectId: string, options: DiagramListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await this.db
      .selectFrom('diagrams')
      .select(['id', 'projectId', 'name', 'dialect', 'createdAt', 'updatedAt'])
      .where('projectId', '=', projectId)
      .orderBy('updatedAt', 'desc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('diagrams')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('projectId', '=', projectId)
      .executeTakeFirstOrThrow();

    return {
      // Diagram list bisa membesar di workspace aktif, jadi response sejak awal memakai pagination envelope.
      items: rows.slice(0, options.limit).map((row) => ({
        ...row,
        // Database menyimpan dialect sebagai text; DTO/SDK mengeksposnya sebagai union dialect canonical.
        dialect: row.dialect as DatabaseDialect,
      })),
      nextCursor: rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.count),
    };
  }

  getById(id: string) {
    return this.db.selectFrom('diagrams').selectAll().where('id', '=', id).executeTakeFirst();
  }
}
