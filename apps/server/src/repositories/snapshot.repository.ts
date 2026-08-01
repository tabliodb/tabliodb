import { Injectable } from '@nestjs/common';
import { encodeDiagramModelAsYjsUpdate, type DiagramModel } from '@tabliodb/schema-core';
import { Kysely, sql, type Transaction } from 'kysely';
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

  create(options: {
    diagramId: string;
    createdById: string;
    message?: string;
    restoredFromSnapshotId?: string | null;
    snapshot: JsonValue;
  }) {
    return this.db.transaction().execute(async (tx) => {
      return this.insertSnapshot(tx, options);
    });
  }

  async getById(snapshotId: string) {
    return this.db
      .selectFrom('diagram_snapshots')
      .select(['id', 'diagramId', 'version', 'message', 'snapshot', 'restoredFromSnapshotId', 'createdAt'])
      .where('id', '=', snapshotId)
      .executeTakeFirst();
  }

  restore(snapshotId: string, restoredById: string) {
    return this.db.transaction().execute(async (tx) => {
      const source = await tx
        .selectFrom('diagram_snapshots')
        .select(['id', 'diagramId', 'version', 'snapshot'])
        .where('id', '=', snapshotId)
        .executeTakeFirst();

      if (!source) {
        return null;
      }

      return this.insertSnapshot(tx, {
        diagramId: source.diagramId,
        createdById: restoredById,
        message: `Restored snapshot v${source.version}`,
        restoredFromSnapshotId: source.id,
        // Restore memakai snapshot JSON lama sebagai sumber, lalu menulis checkpoint baru supaya audit history tetap append-only.
        snapshot: source.snapshot,
      });
    });
  }

  async getByDiagram(diagramId: string, options: SnapshotListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await this.db
      .selectFrom('diagram_snapshots')
      .select(['id', 'diagramId', 'version', 'message', 'snapshot', 'createdAt'])
      .select(['restoredFromSnapshotId'])
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

  private async insertSnapshot(
    tx: Transaction<DB>,
    options: {
      diagramId: string;
      createdById: string;
      message?: string;
      restoredFromSnapshotId?: string | null;
      snapshot: JsonValue;
    },
  ) {
    const versionRow = await tx
      .selectFrom('diagram_snapshots')
      .select((eb) => eb.fn.coalesce(eb.fn.max('version'), sql<number>`0`).as('version'))
      .where('diagramId', '=', options.diagramId)
      .executeTakeFirstOrThrow();

    const snapshot = await tx
      .insertInto('diagram_snapshots')
      .values({
        diagramId: options.diagramId,
        createdById: options.createdById,
        message: options.message ?? null,
        restoredFromSnapshotId: options.restoredFromSnapshotId ?? null,
        snapshot: options.snapshot,
        version: Number(versionRow.version) + 1,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const now = new Date();
    const snapshotModel = snapshot.snapshot as DiagramModel;

    await tx
      .updateTable('diagrams')
      .set({
        currentSnapshotId: snapshot.id,
        lastSnapshotVersion: snapshot.version,
        updatedAt: now,
      })
      .where('id', '=', options.diagramId)
      .execute();

    await tx
      .insertInto('diagram_documents')
      .values({
        diagramId: options.diagramId,
        schemaCache: snapshot.snapshot,
        updatedById: options.createdById,
        yjsState: Buffer.from(encodeDiagramModelAsYjsUpdate(snapshotModel)),
      })
      .onConflict((oc) =>
        oc.column('diagramId').doUpdateSet((eb) => ({
          schemaCache: snapshot.snapshot,
          updatedAt: now,
          updatedById: options.createdById,
          // Snapshot creation becomes the persisted draft boundary, so realtime hydration sees the same model the user saved.
          version: eb('diagram_documents.version', '+', 1),
          yjsState: Buffer.from(encodeDiagramModelAsYjsUpdate(snapshotModel)),
        })),
      )
      .execute();

    return snapshot;
  }
}
