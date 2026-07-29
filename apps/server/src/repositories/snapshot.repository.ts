import { Injectable } from '@nestjs/common';
import type { DiagramModel } from '@tabliodb/schema-core';
import { Kysely, sql } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, JsonValue } from '../schema/index.js';
import { decodeOffsetCursor, encodeOffsetCursor } from '../utils/pagination.js';

export type SnapshotListOptions = {
  cursor?: string;
  limit: number;
};

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

  async getByDiagram(diagramId: string, options: SnapshotListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await this.db
      .selectFrom('diagram_snapshots')
      .select(['id', 'diagramId', 'version', 'message', 'snapshot', 'createdAt'])
      .where('diagramId', '=', diagramId)
      .orderBy('version', 'desc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('diagram_snapshots')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('diagramId', '=', diagramId)
      .executeTakeFirstOrThrow();

    return {
      // Snapshot history cenderung panjang, jadi page pertama cukup untuk editor mengambil snapshot terbaru.
      items: rows.slice(0, options.limit).map((row) => ({
        ...row,
        // Snapshot ditulis dari DiagramModelSchema, sementara kolom database bertipe JSON generik.
        snapshot: row.snapshot as DiagramModel,
      })),
      nextCursor: rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.count),
    };
  }
}
