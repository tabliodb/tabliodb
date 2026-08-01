import { Injectable } from '@nestjs/common';
import {
  encodeDiagramModelAsYjsUpdate,
  serializeDiagramModel,
  type DatabaseDialect,
  type DiagramModel,
} from '@tabliodb/schema-core';
import { Insertable, Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, DiagramTable, JsonValue } from '../schema/index.js';
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
      .select(['id', 'projectId', 'name', 'dialect', 'status', 'createdAt', 'updatedAt'])
      .where('projectId', '=', projectId)
      .where('archivedAt', 'is', null)
      .orderBy('updatedAt', 'desc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('diagrams')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('projectId', '=', projectId)
      .where('archivedAt', 'is', null)
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
    return this.db
      .selectFrom('diagrams')
      .selectAll()
      .where('id', '=', id)
      .where('archivedAt', 'is', null)
      .executeTakeFirst();
  }

  async update(diagramId: string, dto: { dialect?: DatabaseDialect; name?: string }) {
    const values: { dialect?: DatabaseDialect; name?: string; updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if (dto.name !== undefined) {
      values.name = dto.name;
    }

    if (dto.dialect !== undefined) {
      values.dialect = dto.dialect;
    }

    const diagram = await this.db
      .updateTable('diagrams')
      .set(values)
      .where('id', '=', diagramId)
      .where('archivedAt', 'is', null)
      .returning('id')
      .executeTakeFirst();

    // Fetch the row through getById so every public repository read keeps one archived-filtering rule.
    return diagram ? this.getById(diagram.id) : undefined;
  }

  async replaceDocumentModel(diagramId: string, model: DiagramModel, updatedById: string) {
    const normalizedModel = serializeDiagramModel(model);
    const now = new Date();
    const yjsState = Buffer.from(encodeDiagramModelAsYjsUpdate(normalizedModel));

    await this.db.transaction().execute(async (tx) => {
      await tx
        .insertInto('diagram_documents')
        .values({
          diagramId,
          schemaCache: normalizedModel as unknown as JsonValue,
          updatedById,
          yjsState,
        })
        .onConflict((oc) =>
          oc.column('diagramId').doUpdateSet((eb) => ({
            schemaCache: normalizedModel as unknown as JsonValue,
            updatedAt: now,
            updatedById,
            version: eb('diagram_documents.version', '+', 1),
            yjsState,
          })),
        )
        .execute();

      await tx
        .updateTable('diagrams')
        .set({
          dialect: normalizedModel.dialect,
          name: normalizedModel.metadata.name,
          updatedAt: now,
        })
        .where('id', '=', diagramId)
        .where('archivedAt', 'is', null)
        .execute();
    });

    return this.getById(diagramId);
  }
}
