import { Injectable } from '@nestjs/common';
import {
  encodeDiagramModelAsYjsUpdate,
  normalizeDiagramModel,
  serializeDiagramModel,
  type DatabaseDialect,
  type DiagramModel,
} from '@tabliodb/schema-core';
import { AccessRole } from '@tabliodb/shared';
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

const diagramEffectiveAccessSourceTypes = new Set([
  'direct',
  'diagram_team',
  'folder',
  'folder_team',
  'workspace_admin',
  'workspace_default',
  'workspace_member',
]);

@Injectable()
export class DiagramRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  create(dto: Insertable<DiagramTable>) {
    return this.db.transaction().execute(async (tx) => {
      const diagram = await tx.insertInto('diagrams').values(dto).returningAll().executeTakeFirstOrThrow();

      // Every diagram gets a row for Yjs persistence on creation, even before the first realtime update arrives.
      await tx.insertInto('diagram_documents').values({ diagramId: diagram.id, yjsState: null }).execute();

      // Direct diagram ownership makes root diagrams shareable without forcing a synthetic folder/folder row.
      await tx
        .insertInto('diagram_members')
        .values({
          createdById: dto.createdById,
          diagramId: diagram.id,
          role: AccessRole.Owner,
          userId: dto.createdById,
        })
        .onConflict((conflict) => conflict.columns(['diagramId', 'userId']).doNothing())
        .execute();

      return diagram;
    });
  }

  async getByFolder(folderId: string, options: DiagramListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await this.db
      .selectFrom('diagrams')
      .select(['id', 'organizationId', 'folderId', 'name', 'dialect', 'status', 'createdAt', 'updatedAt'])
      .where('folderId', '=', folderId)
      .where('archivedAt', 'is', null)
      .orderBy('updatedAt', 'desc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('diagrams')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('folderId', '=', folderId)
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
    options: DiagramListOptions & { folderId?: string | null; userId: string },
  ) {
    const offset = decodeOffsetCursor(options.cursor);
    const folderFilter =
      options.folderId === undefined
        ? sql``
        : options.folderId === null
          ? sql`AND diagrams.folder_id IS NULL`
          : sql`AND diagrams.folder_id = ${options.folderId}`;
    const rows = await sql<DiagramListRow>`
      WITH diagram_access AS (
        ${this.createDiagramAccessSql(options.userId)}
      ),
      effective_access AS (
        SELECT
          diagram_id,
          CASE max(
            CASE role
              WHEN 'owner' THEN 4
              WHEN 'editor' THEN 3
              WHEN 'commenter' THEN 2
              WHEN 'viewer' THEN 1
              ELSE 0
            END
          )
            WHEN 4 THEN 'owner'
            WHEN 3 THEN 'editor'
            WHEN 2 THEN 'commenter'
            ELSE 'viewer'
          END AS role
        FROM diagram_access
        GROUP BY diagram_id
      )
      SELECT
        diagrams.id,
        diagrams.organization_id AS "organizationId",
        diagrams.folder_id AS "folderId",
        diagrams.name,
        diagrams.dialect,
        diagrams.status,
        effective_access.role,
        diagrams.created_at AS "createdAt",
        diagrams.updated_at AS "updatedAt"
      FROM diagrams
      INNER JOIN effective_access ON effective_access.diagram_id = diagrams.id
      WHERE diagrams.organization_id = ${organizationId}
        AND diagrams.archived_at IS NULL
        ${folderFilter}
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
        ${folderFilter}
    `.execute(this.db);

    return {
      // Workspace-level listing is the primary diagram browser; pagination keeps large self-hosted instances predictable.
      items: rows.rows.slice(0, options.limit).map((row) => ({
        ...row,
        dialect: row.dialect as DatabaseDialect,
        // Workspace diagram listing carries the caller's effective role so the UI does not infer access from workspace/folder role alone.
        role: row.role as AccessRole,
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

  async update(diagramId: string, dto: { dialect?: DatabaseDialect; name?: string; folderId?: string | null }) {
    const values: { dialect?: DatabaseDialect; name?: string; folderId?: string | null; updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if (dto.name !== undefined) {
      values.name = dto.name;
    }

    if (dto.dialect !== undefined) {
      values.dialect = dto.dialect;
    }

    if (dto.folderId !== undefined) {
      // Moving a diagram is a metadata update on the diagram row; permission checks stay in the service layer.
      values.folderId = dto.folderId;
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

  async getEffectiveAccess(diagramId: string, options: DiagramMemberListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await sql<DiagramEffectiveAccessRow>`
      WITH diagram_scope AS (
        SELECT
          diagrams.id,
          diagrams.name,
          diagrams.organization_id,
          diagrams.folder_id,
          organizations.name AS organization_name,
          organizations.default_folder_role,
          folders.name AS folder_name
        FROM diagrams
        INNER JOIN organizations ON organizations.id = diagrams.organization_id
        LEFT JOIN folders ON folders.id = diagrams.folder_id AND folders.archived_at IS NULL
        WHERE diagrams.id = ${diagramId}
          AND diagrams.archived_at IS NULL
          AND organizations.archived_at IS NULL
      ),
      access_sources AS (
        SELECT
          diagram_members.user_id,
          diagram_members.role::text AS role,
          'direct'::text AS source_type,
          diagram_scope.id AS source_id,
          diagram_scope.name AS source_name,
          'Direct access'::text AS source_label,
          true AS is_direct,
          10 AS source_priority
        FROM diagram_members
        INNER JOIN diagram_scope ON diagram_scope.id = diagram_members.diagram_id
        INNER JOIN organization_members ON organization_members.organization_id = diagram_scope.organization_id
        WHERE organization_members.user_id = diagram_members.user_id
          AND organization_members.status = 'active'

        UNION ALL

        SELECT
          team_members.user_id,
          diagram_team_access.role::text AS role,
          'diagram_team'::text AS source_type,
          teams.id AS source_id,
          teams.name AS source_name,
          concat('Team: ', teams.name)::text AS source_label,
          false AS is_direct,
          20 AS source_priority
        FROM diagram_team_access
        INNER JOIN diagram_scope ON diagram_scope.id = diagram_team_access.diagram_id
        INNER JOIN teams ON teams.id = diagram_team_access.team_id
        INNER JOIN team_members ON team_members.team_id = teams.id
        INNER JOIN organization_members ON organization_members.organization_id = teams.organization_id
        WHERE teams.archived_at IS NULL
          -- Direct team-to-diagram grants are valid only inside the same workspace as the diagram.
          AND teams.organization_id = diagram_scope.organization_id
          AND organization_members.user_id = team_members.user_id
          AND organization_members.status = 'active'

        UNION ALL

        SELECT
          folder_access.user_id,
          folder_access.role::text AS role,
          'folder'::text AS source_type,
          diagram_scope.folder_id AS source_id,
          diagram_scope.folder_name AS source_name,
          concat('Folder: ', diagram_scope.folder_name)::text AS source_label,
          false AS is_direct,
          30 AS source_priority
        FROM diagram_scope
        INNER JOIN folder_access ON folder_access.folder_id = diagram_scope.folder_id
        INNER JOIN organization_members ON organization_members.organization_id = diagram_scope.organization_id
        WHERE diagram_scope.folder_id IS NOT NULL
          AND organization_members.user_id = folder_access.user_id
          AND organization_members.status = 'active'

        UNION ALL

        SELECT
          team_members.user_id,
          folder_team_access.role::text AS role,
          'folder_team'::text AS source_type,
          teams.id AS source_id,
          teams.name AS source_name,
          concat('Team via folder: ', teams.name)::text AS source_label,
          false AS is_direct,
          40 AS source_priority
        FROM diagram_scope
        INNER JOIN folder_team_access ON folder_team_access.folder_id = diagram_scope.folder_id
        INNER JOIN teams ON teams.id = folder_team_access.team_id
        INNER JOIN team_members ON team_members.team_id = teams.id
        INNER JOIN organization_members ON organization_members.organization_id = teams.organization_id
        WHERE diagram_scope.folder_id IS NOT NULL
          AND teams.archived_at IS NULL
          -- Folder team inheritance must not cross tenant boundaries even if a stale row exists.
          AND teams.organization_id = diagram_scope.organization_id
          AND organization_members.user_id = team_members.user_id
          AND organization_members.status = 'active'

        UNION ALL

        SELECT
          organization_members.user_id,
          'owner'::text AS role,
          'workspace_admin'::text AS source_type,
          diagram_scope.organization_id AS source_id,
          diagram_scope.organization_name AS source_name,
          'Workspace admin'::text AS source_label,
          false AS is_direct,
          50 AS source_priority
        FROM diagram_scope
        INNER JOIN organization_members ON organization_members.organization_id = diagram_scope.organization_id
        WHERE organization_members.status = 'active'
          AND organization_members.role IN ('owner', 'admin')

        UNION ALL

        SELECT
          organization_members.user_id,
          'editor'::text AS role,
          'workspace_member'::text AS source_type,
          diagram_scope.organization_id AS source_id,
          diagram_scope.organization_name AS source_name,
          'Workspace member'::text AS source_label,
          false AS is_direct,
          60 AS source_priority
        FROM diagram_scope
        INNER JOIN organization_members ON organization_members.organization_id = diagram_scope.organization_id
        WHERE diagram_scope.folder_id IS NULL
          AND organization_members.status = 'active'
          AND organization_members.role = 'member'

        UNION ALL

        SELECT
          organization_members.user_id,
          diagram_scope.default_folder_role::text AS role,
          'workspace_default'::text AS source_type,
          diagram_scope.organization_id AS source_id,
          diagram_scope.organization_name AS source_name,
          'Workspace default folder role'::text AS source_label,
          false AS is_direct,
          70 AS source_priority
        FROM diagram_scope
        INNER JOIN organization_members ON organization_members.organization_id = diagram_scope.organization_id
        WHERE diagram_scope.folder_id IS NOT NULL
          AND organization_members.status = 'active'
          AND organization_members.role = 'member'
          AND diagram_scope.default_folder_role IN ('editor', 'commenter', 'viewer')
      ),
      access_with_users AS (
        SELECT
          access_sources.*,
          users.email,
          users.name,
          CASE
            WHEN users.avatar_file_id IS NULL THEN NULL
            ELSE concat('/api/files/', users.avatar_file_id::text)
          END AS avatar_url,
          users.cursor_color,
          CASE access_sources.role
            WHEN 'owner' THEN 4
            WHEN 'editor' THEN 3
            WHEN 'commenter' THEN 2
            WHEN 'viewer' THEN 1
            ELSE 0
          END AS role_rank
        FROM access_sources
        INNER JOIN users ON users.id = access_sources.user_id
        WHERE users.deleted_at IS NULL
      ),
      grouped_access AS (
        SELECT
          user_id,
          email,
          name,
          avatar_url,
          cursor_color,
          CASE max(role_rank)
            WHEN 4 THEN 'owner'
            WHEN 3 THEN 'editor'
            WHEN 2 THEN 'commenter'
            ELSE 'viewer'
          END AS role,
          min(role) FILTER (WHERE is_direct) AS direct_role,
          CASE
            WHEN bool_or(is_direct) AND bool_or(NOT is_direct) THEN 'mixed'
            WHEN bool_or(is_direct) THEN 'direct'
            ELSE 'inherited'
          END AS access_type,
          jsonb_agg(
            jsonb_build_object(
              'inherited', NOT is_direct,
              'role', role,
              'sourceId', source_id,
              'sourceLabel', source_label,
              'sourceName', source_name,
              'sourceType', source_type
            )
            ORDER BY source_priority ASC, role_rank DESC, source_name ASC
          ) AS sources
        FROM access_with_users
        GROUP BY user_id, email, name, avatar_url, cursor_color
      )
      SELECT
        user_id AS "userId",
        email,
        name,
        avatar_url AS "avatarUrl",
        cursor_color AS "cursorColor",
        role,
        direct_role AS "directRole",
        access_type AS "accessType",
        sources
      FROM grouped_access
      ORDER BY lower(name) ASC, email ASC, user_id ASC
      LIMIT ${options.limit + 1}
      OFFSET ${offset}
    `.execute(this.db);
    const totalRow = await sql<{ count: number }>`
      WITH diagram_scope AS (
        SELECT diagrams.id, diagrams.organization_id, diagrams.folder_id, organizations.default_folder_role
        FROM diagrams
        INNER JOIN organizations ON organizations.id = diagrams.organization_id
        LEFT JOIN folders ON folders.id = diagrams.folder_id AND folders.archived_at IS NULL
        WHERE diagrams.id = ${diagramId}
          AND diagrams.archived_at IS NULL
          AND organizations.archived_at IS NULL
      ),
      access_user_ids AS (
        SELECT diagram_members.user_id
        FROM diagram_members
        INNER JOIN diagram_scope ON diagram_scope.id = diagram_members.diagram_id
        INNER JOIN organization_members ON organization_members.organization_id = diagram_scope.organization_id
        WHERE organization_members.user_id = diagram_members.user_id
          AND organization_members.status = 'active'

        UNION

        SELECT team_members.user_id
        FROM diagram_team_access
        INNER JOIN diagram_scope ON diagram_scope.id = diagram_team_access.diagram_id
        INNER JOIN teams ON teams.id = diagram_team_access.team_id
        INNER JOIN team_members ON team_members.team_id = teams.id
        INNER JOIN organization_members ON organization_members.organization_id = teams.organization_id
        WHERE teams.archived_at IS NULL
          AND teams.organization_id = diagram_scope.organization_id
          AND organization_members.user_id = team_members.user_id
          AND organization_members.status = 'active'

        UNION

        SELECT folder_access.user_id
        FROM diagram_scope
        INNER JOIN folder_access ON folder_access.folder_id = diagram_scope.folder_id
        INNER JOIN organization_members ON organization_members.organization_id = diagram_scope.organization_id
        WHERE diagram_scope.folder_id IS NOT NULL
          AND organization_members.user_id = folder_access.user_id
          AND organization_members.status = 'active'

        UNION

        SELECT team_members.user_id
        FROM diagram_scope
        INNER JOIN folder_team_access ON folder_team_access.folder_id = diagram_scope.folder_id
        INNER JOIN teams ON teams.id = folder_team_access.team_id
        INNER JOIN team_members ON team_members.team_id = teams.id
        INNER JOIN organization_members ON organization_members.organization_id = teams.organization_id
        WHERE diagram_scope.folder_id IS NOT NULL
          AND teams.archived_at IS NULL
          AND teams.organization_id = diagram_scope.organization_id
          AND organization_members.user_id = team_members.user_id
          AND organization_members.status = 'active'

        UNION

        SELECT organization_members.user_id
        FROM diagram_scope
        INNER JOIN organization_members ON organization_members.organization_id = diagram_scope.organization_id
        WHERE organization_members.status = 'active'
          AND organization_members.role IN ('owner', 'admin')

        UNION

        SELECT organization_members.user_id
        FROM diagram_scope
        INNER JOIN organization_members ON organization_members.organization_id = diagram_scope.organization_id
        WHERE diagram_scope.folder_id IS NULL
          AND organization_members.status = 'active'
          AND organization_members.role = 'member'

        UNION

        SELECT organization_members.user_id
        FROM diagram_scope
        INNER JOIN organization_members ON organization_members.organization_id = diagram_scope.organization_id
        WHERE diagram_scope.folder_id IS NOT NULL
          AND organization_members.status = 'active'
          AND organization_members.role = 'member'
          AND diagram_scope.default_folder_role IN ('editor', 'commenter', 'viewer')
      )
      SELECT count(*)::int AS count
      FROM access_user_ids
      INNER JOIN users ON users.id = access_user_ids.user_id
      WHERE users.deleted_at IS NULL
    `.execute(this.db);

    return {
      items: rows.rows.slice(0, options.limit).map((row) => ({
        ...row,
        accessType: row.accessType as DiagramEffectiveAccessType,
        directRole: row.directRole ? (row.directRole as AccessRole) : null,
        role: row.role as AccessRole,
        sources: normalizeEffectiveAccessSources(row.sources),
      })),
      nextCursor: rows.rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.rows[0]?.count ?? 0),
    };
  }

  getMember(diagramId: string, userId: string) {
    return this.createMemberQuery(diagramId).where('diagram_members.userId', '=', userId).executeTakeFirst();
  }

  async upsertMember(diagramId: string, options: { createdById: string; role: AccessRole; userId: string }) {
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

  async updateMember(diagramId: string, userId: string, role: AccessRole) {
    const member = await this.db
      .updateTable('diagram_members')
      .set({ role, updatedAt: new Date() })
      .where('diagramId', '=', diagramId)
      .where('userId', '=', userId)
      .returning('userId')
      .executeTakeFirst();

    return member ? this.getMember(diagramId, member.userId) : undefined;
  }

  async transferOwnership(diagramId: string, options: { createdById: string; userId: string }) {
    const now = new Date();

    await this.db.transaction().execute(async (tx) => {
      await tx
        .updateTable('diagram_members')
        .set({ role: AccessRole.Editor, updatedAt: now })
        .where('diagramId', '=', diagramId)
        .where('role', '=', AccessRole.Owner)
        .where('userId', '!=', options.userId)
        .execute();

      await tx
        .insertInto('diagram_members')
        .values({
          createdById: options.createdById,
          diagramId,
          role: AccessRole.Owner,
          userId: options.userId,
        })
        .onConflict((conflict) =>
          conflict.columns(['diagramId', 'userId']).doUpdateSet({
            role: AccessRole.Owner,
            updatedAt: now,
          }),
        )
        .execute();
    });

    // The returned member is loaded after the transaction so callers receive the same enriched DTO shape as normal member updates.
    return this.getMember(diagramId, options.userId);
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
      .where('role', '=', AccessRole.Owner)
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
    return sql<{ diagram_id: string; role: AccessRole }>`
      SELECT diagram_members.diagram_id, diagram_members.role
      FROM diagram_members
      INNER JOIN diagrams ON diagrams.id = diagram_members.diagram_id
      INNER JOIN organization_members ON organization_members.organization_id = diagrams.organization_id
      WHERE diagram_members.user_id = ${userId}
        AND organization_members.user_id = ${userId}
        AND organization_members.status = 'active'
        AND diagrams.archived_at IS NULL
      UNION ALL
      SELECT diagram_team_access.diagram_id, diagram_team_access.role
      FROM diagram_team_access
      INNER JOIN diagrams ON diagrams.id = diagram_team_access.diagram_id
      INNER JOIN team_members ON team_members.team_id = diagram_team_access.team_id
      INNER JOIN teams ON teams.id = diagram_team_access.team_id
      INNER JOIN organization_members ON organization_members.organization_id = teams.organization_id
      WHERE team_members.user_id = ${userId}
        AND organization_members.user_id = ${userId}
        AND organization_members.status = 'active'
        AND diagrams.archived_at IS NULL
        AND teams.archived_at IS NULL
        AND teams.organization_id = diagrams.organization_id
      UNION ALL
      SELECT diagrams.id AS diagram_id, folder_access.role
      FROM diagrams
      INNER JOIN folders ON folders.id = diagrams.folder_id
      INNER JOIN folder_access ON folder_access.folder_id = folders.id
      INNER JOIN organization_members ON organization_members.organization_id = diagrams.organization_id
      WHERE folder_access.user_id = ${userId}
        AND organization_members.user_id = ${userId}
        AND organization_members.status = 'active'
        AND diagrams.archived_at IS NULL
        AND folders.archived_at IS NULL
      UNION ALL
      SELECT diagrams.id AS diagram_id, folder_team_access.role
      FROM diagrams
      INNER JOIN folders ON folders.id = diagrams.folder_id
      INNER JOIN folder_team_access ON folder_team_access.folder_id = folders.id
      INNER JOIN team_members ON team_members.team_id = folder_team_access.team_id
      INNER JOIN teams ON teams.id = folder_team_access.team_id
      INNER JOIN organization_members ON organization_members.organization_id = teams.organization_id
      WHERE team_members.user_id = ${userId}
        AND organization_members.user_id = ${userId}
        AND organization_members.status = 'active'
        AND diagrams.archived_at IS NULL
        AND folders.archived_at IS NULL
        AND teams.archived_at IS NULL
        AND teams.organization_id = diagrams.organization_id
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
      WHERE diagrams.folder_id IS NULL
        AND organization_members.user_id = ${userId}
        AND organization_members.status = 'active'
        AND organization_members.role = 'member'
        AND diagrams.archived_at IS NULL
        AND organizations.archived_at IS NULL
      UNION ALL
      SELECT diagrams.id AS diagram_id, organizations.default_folder_role AS role
      FROM diagrams
      INNER JOIN folders ON folders.id = diagrams.folder_id
      INNER JOIN organizations ON organizations.id = diagrams.organization_id
      INNER JOIN organization_members ON organization_members.organization_id = organizations.id
      WHERE organization_members.user_id = ${userId}
        AND organization_members.status = 'active'
        AND organization_members.role IN ('owner', 'admin', 'member')
        AND organizations.default_folder_role IN ('editor', 'commenter', 'viewer')
        AND diagrams.archived_at IS NULL
        AND folders.archived_at IS NULL
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
  folderId: string | null;
  role: AccessRole;
  status: 'draft' | 'reviewed' | 'approved' | 'changes_requested';
  updatedAt: Date;
};

type DiagramEffectiveAccessType = 'direct' | 'inherited' | 'mixed';

type DiagramEffectiveAccessSource = {
  inherited: boolean;
  role: AccessRole;
  sourceId: string | null;
  sourceLabel: string;
  sourceName: string | null;
  sourceType:
    'direct' | 'diagram_team' | 'folder' | 'folder_team' | 'workspace_admin' | 'workspace_default' | 'workspace_member';
};

type DiagramEffectiveAccessRow = {
  accessType: string;
  avatarUrl: string | null;
  cursorColor: string;
  directRole: string | null;
  email: string;
  name: string;
  role: string;
  sources: unknown;
  userId: string;
};

function normalizeEffectiveAccessSources(value: unknown): DiagramEffectiveAccessSource[] {
  const rawSources = typeof value === 'string' ? (JSON.parse(value) as unknown) : value;

  if (!Array.isArray(rawSources)) {
    return [];
  }

  return rawSources.flatMap((source) => {
    if (!isEffectiveAccessSourceObject(source)) {
      return [];
    }

    return [
      {
        inherited: Boolean(source.inherited),
        role: normalizeAccessRole(source.role),
        sourceId: typeof source.sourceId === 'string' ? source.sourceId : null,
        sourceLabel: typeof source.sourceLabel === 'string' ? source.sourceLabel : 'Inherited access',
        sourceName: typeof source.sourceName === 'string' ? source.sourceName : null,
        sourceType: normalizeEffectiveAccessSourceType(source.sourceType),
      },
    ];
  });
}

function isEffectiveAccessSourceObject(source: unknown): source is Record<string, unknown> {
  return Boolean(source && typeof source === 'object');
}

function normalizeAccessRole(role: unknown): AccessRole {
  if (
    role === AccessRole.Owner ||
    role === AccessRole.Editor ||
    role === AccessRole.Commenter ||
    role === AccessRole.Viewer
  ) {
    return role;
  }

  return AccessRole.Viewer;
}

function normalizeEffectiveAccessSourceType(sourceType: unknown): DiagramEffectiveAccessSource['sourceType'] {
  if (typeof sourceType === 'string' && diagramEffectiveAccessSourceTypes.has(sourceType)) {
    return sourceType as DiagramEffectiveAccessSource['sourceType'];
  }

  return 'workspace_member';
}
