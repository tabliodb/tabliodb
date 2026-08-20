import { Injectable } from '@nestjs/common';
import {
  encodeDiagramModelAsYjsUpdate,
  normalizeDiagramModel,
  serializeDiagramModel,
  type DatabaseDialect,
  type DiagramModel,
} from '@tabliodb/schema-core';
import { ProjectRole } from '@tabliodb/shared';
import { Insertable, Kysely, sql } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, DiagramTable, JsonValue } from '../schema/index.js';
import { decodeOffsetCursor, encodeOffsetCursor } from '../utils/pagination.js';
import { acquireDiagramOperationLock } from './diagram-operation-lock.js';

export type DiagramListOptions = {
  cursor?: string;
  limit: number;
};

export type DiagramMemberListOptions = {
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

      // Direct diagram ownership makes root diagrams shareable without forcing a synthetic project/folder row.
      await tx
        .insertInto('diagram_members')
        .values({
          createdById: dto.createdById,
          diagramId: diagram.id,
          role: ProjectRole.Owner,
          userId: dto.createdById,
        })
        .onConflict((conflict) => conflict.columns(['diagramId', 'userId']).doNothing())
        .execute();

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

  async getByOrganization(
    organizationId: string,
    options: DiagramListOptions & { projectId?: string | null; userId: string },
  ) {
    const offset = decodeOffsetCursor(options.cursor);
    const projectFilter =
      options.projectId === undefined
        ? sql``
        : options.projectId === null
          ? sql`AND diagrams.project_id IS NULL`
          : sql`AND diagrams.project_id = ${options.projectId}`;
    const rows = await sql<DiagramListRow>`
      WITH diagram_access AS (
        ${this.createDiagramAccessSql(options.userId)}
      ),
      effective_access AS (
        SELECT diagram_id
        FROM diagram_access
        GROUP BY diagram_id
      )
      SELECT
        diagrams.id,
        diagrams.organization_id AS "organizationId",
        diagrams.project_id AS "projectId",
        diagrams.name,
        diagrams.dialect,
        diagrams.status,
        diagrams.created_at AS "createdAt",
        diagrams.updated_at AS "updatedAt"
      FROM diagrams
      INNER JOIN effective_access ON effective_access.diagram_id = diagrams.id
      WHERE diagrams.organization_id = ${organizationId}
        AND diagrams.archived_at IS NULL
        ${projectFilter}
      ORDER BY diagrams.updated_at DESC, diagrams.id DESC
      LIMIT ${options.limit + 1}
      OFFSET ${offset}
    `.execute(this.db);
    const totalRow = await sql<{ count: number }>`
      WITH diagram_access AS (
        ${this.createDiagramAccessSql(options.userId)}
      ),
      effective_access AS (
        SELECT diagram_id
        FROM diagram_access
        GROUP BY diagram_id
      )
      SELECT count(*)::int AS count
      FROM diagrams
      INNER JOIN effective_access ON effective_access.diagram_id = diagrams.id
      WHERE diagrams.organization_id = ${organizationId}
        AND diagrams.archived_at IS NULL
        ${projectFilter}
    `.execute(this.db);

    return {
      // Workspace-level listing is the primary diagram browser; pagination keeps large self-hosted instances predictable.
      items: rows.rows.slice(0, options.limit).map((row) => ({
        ...row,
        dialect: row.dialect as DatabaseDialect,
      })),
      nextCursor: rows.rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.rows[0]?.count ?? 0),
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

  async getMembers(diagramId: string, options: DiagramMemberListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await this.createMemberQuery(diagramId)
      .orderBy('diagram_members.createdAt', 'asc')
      .orderBy('diagram_members.userId', 'asc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('diagram_members')
      .innerJoin('users', 'users.id', 'diagram_members.userId')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('diagram_members.diagramId', '=', diagramId)
      .where('users.deletedAt', 'is', null)
      .executeTakeFirstOrThrow();

    return {
      // Diagram member list is paginated so direct sharing stays stable on larger internal teams.
      items: rows.slice(0, options.limit),
      nextCursor: rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.count),
    };
  }

  getMember(diagramId: string, userId: string) {
    return this.createMemberQuery(diagramId).where('diagram_members.userId', '=', userId).executeTakeFirst();
  }

  async upsertMember(diagramId: string, options: { createdById: string; role: ProjectRole; userId: string }) {
    await this.db
      .insertInto('diagram_members')
      .values({
        createdById: options.createdById,
        diagramId,
        role: options.role,
        userId: options.userId,
      })
      .onConflict((conflict) =>
        conflict.columns(['diagramId', 'userId']).doUpdateSet({
          role: options.role,
          updatedAt: new Date(),
        }),
      )
      .execute();

    return this.getMember(diagramId, options.userId);
  }

  async updateMember(diagramId: string, userId: string, role: ProjectRole) {
    const member = await this.db
      .updateTable('diagram_members')
      .set({ role, updatedAt: new Date() })
      .where('diagramId', '=', diagramId)
      .where('userId', '=', userId)
      .returning('userId')
      .executeTakeFirst();

    return member ? this.getMember(diagramId, member.userId) : undefined;
  }

  async removeMember(diagramId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('diagram_members')
      .where('diagramId', '=', diagramId)
      .where('userId', '=', userId)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }

  async getDiagramOwnerCount(diagramId: string): Promise<number> {
    const row = await this.db
      .selectFrom('diagram_members')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('diagramId', '=', diagramId)
      .where('role', '=', ProjectRole.Owner)
      .executeTakeFirstOrThrow();

    return Number(row.count);
  }

  private createMemberQuery(diagramId: string) {
    return this.db
      .selectFrom('diagram_members')
      .innerJoin('users', 'users.id', 'diagram_members.userId')
      .select([
        'diagram_members.userId',
        'users.email',
        'users.name',
        sql<string | null>`case
          when users.avatar_file_id is null then null
          else concat('/api/files/', users.avatar_file_id::text)
        end`.as('avatarUrl'),
        'users.cursorColor',
        'diagram_members.role',
        'diagram_members.createdAt',
        'diagram_members.updatedAt',
      ])
      .where('diagram_members.diagramId', '=', diagramId)
      .where('users.deletedAt', 'is', null);
  }

  private createDiagramAccessSql(userId: string) {
    return sql<{ diagram_id: string; role: ProjectRole }>`
      SELECT diagram_members.diagram_id, diagram_members.role
      FROM diagram_members
      INNER JOIN diagrams ON diagrams.id = diagram_members.diagram_id
      WHERE diagram_members.user_id = ${userId}
        AND diagrams.archived_at IS NULL
      UNION ALL
      SELECT diagram_team_access.diagram_id, diagram_team_access.role
      FROM diagram_team_access
      INNER JOIN diagrams ON diagrams.id = diagram_team_access.diagram_id
      INNER JOIN team_members ON team_members.team_id = diagram_team_access.team_id
      INNER JOIN teams ON teams.id = diagram_team_access.team_id
      WHERE team_members.user_id = ${userId}
        AND diagrams.archived_at IS NULL
        AND teams.archived_at IS NULL
      UNION ALL
      SELECT diagrams.id AS diagram_id, project_members.role
      FROM diagrams
      INNER JOIN projects ON projects.id = diagrams.project_id
      INNER JOIN project_members ON project_members.project_id = projects.id
      WHERE project_members.user_id = ${userId}
        AND diagrams.archived_at IS NULL
        AND projects.archived_at IS NULL
      UNION ALL
      SELECT diagrams.id AS diagram_id, project_team_access.role
      FROM diagrams
      INNER JOIN projects ON projects.id = diagrams.project_id
      INNER JOIN project_team_access ON project_team_access.project_id = projects.id
      INNER JOIN team_members ON team_members.team_id = project_team_access.team_id
      INNER JOIN teams ON teams.id = project_team_access.team_id
      WHERE team_members.user_id = ${userId}
        AND diagrams.archived_at IS NULL
        AND projects.archived_at IS NULL
        AND teams.archived_at IS NULL
      UNION ALL
      SELECT diagrams.id AS diagram_id, 'owner' AS role
      FROM diagrams
      INNER JOIN organizations ON organizations.id = diagrams.organization_id
      INNER JOIN organization_members ON organization_members.organization_id = organizations.id
      WHERE organization_members.user_id = ${userId}
        AND organization_members.status = 'active'
        AND organization_members.role IN ('owner', 'admin')
        AND diagrams.archived_at IS NULL
        AND organizations.archived_at IS NULL
      UNION ALL
      SELECT diagrams.id AS diagram_id, 'editor' AS role
      FROM diagrams
      INNER JOIN organizations ON organizations.id = diagrams.organization_id
      INNER JOIN organization_members ON organization_members.organization_id = organizations.id
      WHERE diagrams.project_id IS NULL
        AND organization_members.user_id = ${userId}
        AND organization_members.status = 'active'
        AND organization_members.role = 'member'
        AND diagrams.archived_at IS NULL
        AND organizations.archived_at IS NULL
      UNION ALL
      SELECT diagrams.id AS diagram_id, organizations.default_project_role AS role
      FROM diagrams
      INNER JOIN projects ON projects.id = diagrams.project_id
      INNER JOIN organizations ON organizations.id = diagrams.organization_id
      INNER JOIN organization_members ON organization_members.organization_id = organizations.id
      WHERE organization_members.user_id = ${userId}
        AND organization_members.status = 'active'
        AND organization_members.role IN ('owner', 'admin', 'member')
        AND organizations.default_project_role IN ('editor', 'commenter', 'viewer')
        AND diagrams.archived_at IS NULL
        AND projects.archived_at IS NULL
        AND organizations.archived_at IS NULL
    `;
  }
}

type DiagramListRow = {
  createdAt: Date;
  dialect: string;
  id: string;
  name: string;
  organizationId: string;
  projectId: string | null;
  status: 'draft' | 'reviewed' | 'approved' | 'changes_requested';
  updatedAt: Date;
};
