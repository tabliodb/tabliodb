import { Injectable } from '@nestjs/common';
import {
  encodeDiagramModelAsYjsUpdate,
  normalizeDiagramModel,
  serializeDiagramModel,
  type DatabaseDialect,
  type DiagramModel,
} from '@tabliodb/schema-core';
import { Insertable, Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, DiagramTable, JsonValue } from '../schema/index.js';
import { decodeOffsetCursor, encodeOffsetCursor } from '../utils/pagination.js';
import { acquireDiagramOperationLock } from './diagram-operation-lock.js';

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
      .select(['id', 'organizationId', 'projectId', 'name', 'dialect', 'status', 'createdAt', 'updatedAt'])
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

  async getByOrganization(organizationId: string, options: DiagramListOptions & { projectId?: string | null }) {
    const offset = decodeOffsetCursor(options.cursor);
    let query = this.db
      .selectFrom('diagrams')
      .select(['id', 'organizationId', 'projectId', 'name', 'dialect', 'status', 'createdAt', 'updatedAt'])
      .where('organizationId', '=', organizationId)
      .where('archivedAt', 'is', null)
      .orderBy('updatedAt', 'desc')
      .limit(options.limit + 1)
      .offset(offset);
    let countQuery = this.db
      .selectFrom('diagrams')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('organizationId', '=', organizationId)
      .where('archivedAt', 'is', null);

    if (options.projectId !== undefined) {
      // A null projectId means "root diagrams"; an omitted projectId means "all diagrams in this workspace".
      query = options.projectId === null ? query.where('projectId', 'is', null) : query.where('projectId', '=', options.projectId);
      countQuery =
        options.projectId === null
          ? countQuery.where('projectId', 'is', null)
          : countQuery.where('projectId', '=', options.projectId);
    }

    const rows = await query.execute();
    const totalRow = await countQuery.executeTakeFirstOrThrow();

    return {
      // Workspace-level listing is the primary diagram browser; pagination keeps large self-hosted instances predictable.
      items: rows.slice(0, options.limit).map((row) => ({
        ...row,
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
    const normalizedModel = serializeDiagramModel(normalizeDiagramModel(model));
    const now = new Date();
    const yjsState = Buffer.from(encodeDiagramModelAsYjsUpdate(normalizedModel));

    await this.db.transaction().execute(async (tx) => {
      await acquireDiagramOperationLock(tx, diagramId, 'diagram_import_replace');

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
