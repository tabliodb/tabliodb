import { Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, JsonValue } from '../schema/index.js';

@Injectable()
export class SnapshotRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  create(options: { diagramId: string; createdById: string; message?: string; snapshot: JsonValue }) {
    return this.db.transaction().execute(async (tx) => {
      const versionRow = await tx
        .selectFrom('diagram_snapshots')
        .select((eb) => eb.fn.coalesce(eb.fn.max('version'), sql<number>`0`).as('version'))
        .where('diagramId', '=', options.diagramId)
        .executeTakeFirstOrThrow();

      return tx
        .insertInto('diagram_snapshots')
        .values({
          diagramId: options.diagramId,
          createdById: options.createdById,
          message: options.message ?? null,
          snapshot: options.snapshot,
          version: Number(versionRow.version) + 1,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    });
  }

  getByDiagram(diagramId: string) {
    return this.db
      .selectFrom('diagram_snapshots')
      .selectAll()
      .where('diagramId', '=', diagramId)
      .orderBy('version', 'desc')
      .execute();
  }
}
