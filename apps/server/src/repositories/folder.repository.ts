import { Injectable } from '@nestjs/common';
import { AccessRole } from '@tabliodb/shared';
import { Insertable, Kysely, sql } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, FolderTable } from '../schema/index.js';
import { decodeOffsetCursor, encodeOffsetCursor } from '../utils/pagination.js';
import { slugify } from '../utils/slug.js';

export type FolderListOptions = {
  cursor?: string;
  limit: number;
  organizationId?: string;
};

export type FolderAccessListOptions = {
  cursor?: string;
  limit: number;
};

@Injectable()
export class FolderRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  create(dto: Insertable<FolderTable>) {
    return this.db.transaction().execute(async (tx) => {
      const folder = await tx.insertInto('folders').values(dto).returningAll().executeTakeFirstOrThrow();

      // The creator gets folder-level ownership immediately, independent of organization-level role changes later.
      await tx
        .insertInto('folder_access')
        .values({ folderId: folder.id, userId: dto.createdById, role: AccessRole.Owner })
        .execute();

      return tx
        .selectFrom('folders')
        .innerJoin('organizations', 'organizations.id', 'folders.organizationId')
        .innerJoin('folder_access', 'folder_access.folderId', 'folders.id')
        .select([
          'folders.id',
          'folders.organizationId',
          'folders.name',
          'folders.slug',
          'folders.description',
          'folders.createdAt',
          'folders.updatedAt',
          'organizations.name as organizationName',
          'organizations.slug as organizationSlug',
          'folder_access.role as folderRole',
        ])
        .where('folders.id', '=', folder.id)
        .where('folder_access.userId', '=', dto.createdById)
        .executeTakeFirstOrThrow();
    });
  }

  async getVisibleToUser(userId: string, options: FolderListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const organizationFilter = options.organizationId
      ? sql`AND folders.organization_id = ${options.organizationId}`
      : sql``;
    const rows = await sql<FolderVisibleRow>`
      WITH folder_access_sources AS (
        SELECT folder_access.folder_id, folder_access.role
        FROM folder_access
        INNER JOIN folders ON folders.id = folder_access.folder_id
        INNER JOIN organization_members ON organization_members.organization_id = folders.organization_id
        WHERE folder_access.user_id = ${userId}
          AND organization_members.user_id = ${userId}
          AND organization_members.status = 'active'
        UNION ALL
        SELECT folder_team_access.folder_id, folder_team_access.role
        FROM folder_team_access
        INNER JOIN folders ON folders.id = folder_team_access.folder_id
        INNER JOIN team_members ON team_members.team_id = folder_team_access.team_id
        INNER JOIN teams ON teams.id = folder_team_access.team_id
        INNER JOIN organization_members ON organization_members.organization_id = teams.organization_id
        WHERE team_members.user_id = ${userId}
          AND organization_members.user_id = ${userId}
          AND organization_members.status = 'active'
          -- Team folder grants are tenant-scoped defensively so stale cross-workspace rows cannot expose folders.
          AND teams.organization_id = folders.organization_id
          AND teams.archived_at IS NULL
        UNION ALL
        -- Workspace owners/admins can administer every folder in their workspace even if no direct folder_access row exists.
        SELECT folders.id AS folder_id, 'owner' AS role
        FROM folders
        INNER JOIN organizations ON organizations.id = folders.organization_id
        INNER JOIN organization_members ON organization_members.organization_id = organizations.id
        WHERE organization_members.user_id = ${userId}
          AND organization_members.status = 'active'
          AND organization_members.role IN ('owner', 'admin')
          AND organizations.archived_at IS NULL
          AND folders.archived_at IS NULL
        UNION ALL
        -- Workspace default access lets owners expose every folder to members without writing one folder_access row per user.
        SELECT folders.id AS folder_id, organizations.default_folder_role AS role
        FROM folders
        INNER JOIN organizations ON organizations.id = folders.organization_id
        INNER JOIN organization_members ON organization_members.organization_id = organizations.id
        WHERE organization_members.user_id = ${userId}
          AND organization_members.status = 'active'
          AND organization_members.role IN ('owner', 'admin', 'member')
          AND organizations.archived_at IS NULL
          AND folders.archived_at IS NULL
          AND organizations.default_folder_role IN ('editor', 'commenter', 'viewer')
      ),
      effective_access AS (
        SELECT
          folder_id,
          min(
            CASE role
              WHEN 'owner' THEN 1
              WHEN 'editor' THEN 2
              WHEN 'commenter' THEN 3
              WHEN 'viewer' THEN 4
              ELSE 99
            END
          ) AS role_priority
        FROM folder_access_sources
        GROUP BY folder_id
      )
      SELECT
        folders.id,
        folders.organization_id AS "organizationId",
        folders.name,
        folders.slug,
        folders.description,
        folders.created_at AS "createdAt",
        folders.updated_at AS "updatedAt",
        organizations.name AS "organizationName",
        organizations.slug AS "organizationSlug",
        CASE effective_access.role_priority
          WHEN 1 THEN 'owner'
          WHEN 2 THEN 'editor'
          WHEN 3 THEN 'commenter'
          ELSE 'viewer'
        END AS "folderRole"
      FROM folders
      INNER JOIN organizations ON organizations.id = folders.organization_id
      INNER JOIN effective_access ON effective_access.folder_id = folders.id
      WHERE folders.archived_at IS NULL
        ${organizationFilter}
      ORDER BY folders.updated_at DESC
      LIMIT ${options.limit + 1}
      OFFSET ${offset}
    `.execute(this.db);
    const totalRow = await sql<{ count: number }>`
      WITH folder_access_sources AS (
        SELECT folder_access.folder_id, folder_access.role
        FROM folder_access
        INNER JOIN folders ON folders.id = folder_access.folder_id
        INNER JOIN organization_members ON organization_members.organization_id = folders.organization_id
        WHERE folder_access.user_id = ${userId}
          AND organization_members.user_id = ${userId}
          AND organization_members.status = 'active'
        UNION ALL
        SELECT folder_team_access.folder_id, folder_team_access.role
        FROM folder_team_access
        INNER JOIN folders ON folders.id = folder_team_access.folder_id
        INNER JOIN team_members ON team_members.team_id = folder_team_access.team_id
        INNER JOIN teams ON teams.id = folder_team_access.team_id
        INNER JOIN organization_members ON organization_members.organization_id = teams.organization_id
        WHERE team_members.user_id = ${userId}
          AND organization_members.user_id = ${userId}
          AND organization_members.status = 'active'
          -- Count query mirrors the list query's tenant guard for team-derived folder access.
          AND teams.organization_id = folders.organization_id
          AND teams.archived_at IS NULL
        UNION ALL
        -- Workspace owners/admins are counted with effective access for the same reason they are listed above.
        SELECT folders.id AS folder_id, 'owner' AS role
        FROM folders
        INNER JOIN organizations ON organizations.id = folders.organization_id
        INNER JOIN organization_members ON organization_members.organization_id = organizations.id
        WHERE organization_members.user_id = ${userId}
          AND organization_members.status = 'active'
          AND organization_members.role IN ('owner', 'admin')
          AND organizations.archived_at IS NULL
          AND folders.archived_at IS NULL
        UNION ALL
        -- The count query mirrors the list query so pagination totals include organization-wide default access consistently.
        SELECT folders.id AS folder_id, organizations.default_folder_role AS role
        FROM folders
        INNER JOIN organizations ON organizations.id = folders.organization_id
        INNER JOIN organization_members ON organization_members.organization_id = organizations.id
        WHERE organization_members.user_id = ${userId}
          AND organization_members.status = 'active'
          AND organization_members.role IN ('owner', 'admin', 'member')
          AND organizations.archived_at IS NULL
          AND folders.archived_at IS NULL
          AND organizations.default_folder_role IN ('editor', 'commenter', 'viewer')
      ),
      effective_access AS (
        SELECT folder_id
        FROM folder_access_sources
        GROUP BY folder_id
      )
      SELECT count(*)::int AS count
      FROM folders
      INNER JOIN effective_access ON effective_access.folder_id = folders.id
      WHERE folders.archived_at IS NULL
        ${organizationFilter}
    `.execute(this.db);

    return {
      // List folder dipaginasi walau editor saat ini hanya memakai page pertama untuk starter workspace.
      items: rows.rows.slice(0, options.limit),
      nextCursor: rows.rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.rows[0]?.count ?? 0),
    };
  }

  async getByIdForUser(userId: string, folderId: string) {
    const folder = await this.db
      .selectFrom('folders')
      .innerJoin('organizations', 'organizations.id', 'folders.organizationId')
      .select([
        'folders.id',
        'folders.organizationId',
        'folders.name',
        'folders.slug',
        'folders.description',
        'folders.createdAt',
        'folders.updatedAt',
        'organizations.name as organizationName',
        'organizations.slug as organizationSlug',
      ])
      .where('folders.id', '=', folderId)
      .where('folders.archivedAt', 'is', null)
      .executeTakeFirst();
    const role = folder ? await this.getAccessRole(userId, folder.id) : undefined;

    return folder && role ? { ...folder, folderRole: role.role } : undefined;
  }

  async getActiveBySlugInOrganization(organizationId: string, slug: string) {
    return this.db
      .selectFrom('folders')
      .select(['id', 'organizationId', 'name', 'slug'])
      .where('organizationId', '=', organizationId)
      .where('slug', '=', slug)
      .where('archivedAt', 'is', null)
      .executeTakeFirst();
  }

  async getBySlugForUser(userId: string, organizationId: string, slug: string) {
    const folder = await this.getActiveBySlugInOrganization(organizationId, slug);

    // Reuse the canonical access resolver so folder lookup and route lookup cannot drift in permission behavior.
    return folder ? this.getByIdForUser(userId, folder.id) : undefined;
  }

  async getAccessRole(userId: string, folderId: string) {
    const roles = await sql<{ role: AccessRole }>`
      SELECT folder_access.role
      FROM folder_access
      INNER JOIN folders ON folders.id = folder_access.folder_id
      INNER JOIN organization_members ON organization_members.organization_id = folders.organization_id
      WHERE folder_access.user_id = ${userId}
        AND folder_access.folder_id = ${folderId}
        AND organization_members.user_id = ${userId}
        AND organization_members.status = 'active'
        AND folders.archived_at IS NULL
      UNION ALL
      SELECT folder_team_access.role
      FROM folder_team_access
      INNER JOIN folders ON folders.id = folder_team_access.folder_id
      INNER JOIN team_members ON team_members.team_id = folder_team_access.team_id
      INNER JOIN teams ON teams.id = folder_team_access.team_id
      INNER JOIN organization_members ON organization_members.organization_id = teams.organization_id
      WHERE team_members.user_id = ${userId}
        AND organization_members.user_id = ${userId}
        AND organization_members.status = 'active'
        AND folder_team_access.folder_id = ${folderId}
        AND folders.archived_at IS NULL
        AND teams.archived_at IS NULL
        AND teams.organization_id = folders.organization_id
      UNION ALL
      -- Workspace managers get effective owner access so admin UI and recovery flows never depend on per-folder grants.
      SELECT 'owner' AS role
      FROM folders
      INNER JOIN organizations ON organizations.id = folders.organization_id
      INNER JOIN organization_members ON organization_members.organization_id = organizations.id
      WHERE organization_members.user_id = ${userId}
        AND folders.id = ${folderId}
        AND organization_members.status = 'active'
        AND organization_members.role IN ('owner', 'admin')
        AND organizations.archived_at IS NULL
        AND folders.archived_at IS NULL
      UNION ALL
      -- Direct permission checks must include the same organization default role used by folder listing.
      SELECT organizations.default_folder_role AS role
      FROM folders
      INNER JOIN organizations ON organizations.id = folders.organization_id
      INNER JOIN organization_members ON organization_members.organization_id = organizations.id
        WHERE organization_members.user_id = ${userId}
          AND folders.id = ${folderId}
          AND organization_members.status = 'active'
          AND organization_members.role IN ('owner', 'admin', 'member')
          AND organizations.archived_at IS NULL
          AND folders.archived_at IS NULL
          AND organizations.default_folder_role IN ('editor', 'commenter', 'viewer')
    `.execute(this.db);
    const role = resolveHighestAccessRole(roles.rows.map((row) => row.role));

    return role ? { role } : undefined;
  }

  async getDiagramRole(userId: string, diagramId: string) {
    const roles = await sql<{ role: AccessRole }>`
      WITH diagram_scope AS (
        SELECT diagrams.id, diagrams.organization_id, diagrams.folder_id
        FROM diagrams
        LEFT JOIN folders ON folders.id = diagrams.folder_id
        INNER JOIN organizations ON organizations.id = diagrams.organization_id
        WHERE diagrams.id = ${diagramId}
          AND diagrams.archived_at IS NULL
          AND organizations.archived_at IS NULL
          AND (diagrams.folder_id IS NULL OR folders.archived_at IS NULL)
      )
      SELECT diagram_members.role
      FROM diagram_members
      INNER JOIN diagram_scope ON diagram_scope.id = diagram_members.diagram_id
      INNER JOIN organization_members ON organization_members.organization_id = diagram_scope.organization_id
      WHERE diagram_members.user_id = ${userId}
        AND organization_members.user_id = ${userId}
        AND organization_members.status = 'active'
      UNION ALL
      SELECT diagram_team_access.role
      FROM diagram_team_access
      INNER JOIN diagram_scope ON diagram_scope.id = diagram_team_access.diagram_id
      INNER JOIN team_members ON team_members.team_id = diagram_team_access.team_id
      INNER JOIN teams ON teams.id = diagram_team_access.team_id
      INNER JOIN organization_members ON organization_members.organization_id = teams.organization_id
      WHERE team_members.user_id = ${userId}
        AND organization_members.user_id = ${userId}
        AND organization_members.status = 'active'
        AND teams.archived_at IS NULL
        AND teams.organization_id = diagram_scope.organization_id
      UNION ALL
      SELECT folder_access.role
      FROM folder_access
      INNER JOIN diagram_scope ON diagram_scope.folder_id = folder_access.folder_id
      INNER JOIN organization_members ON organization_members.organization_id = diagram_scope.organization_id
      WHERE folder_access.user_id = ${userId}
        AND organization_members.user_id = ${userId}
        AND organization_members.status = 'active'
      UNION ALL
      SELECT folder_team_access.role
      FROM folder_team_access
      INNER JOIN diagram_scope ON diagram_scope.folder_id = folder_team_access.folder_id
      INNER JOIN team_members ON team_members.team_id = folder_team_access.team_id
      INNER JOIN teams ON teams.id = folder_team_access.team_id
      INNER JOIN organization_members ON organization_members.organization_id = teams.organization_id
      WHERE team_members.user_id = ${userId}
        AND organization_members.user_id = ${userId}
        AND organization_members.status = 'active'
        AND teams.archived_at IS NULL
        AND teams.organization_id = diagram_scope.organization_id
      UNION ALL
      -- Workspace managers retain owner-level recovery access to every diagram in their workspace.
      SELECT 'owner' AS role
      FROM organization_members
      INNER JOIN diagram_scope ON diagram_scope.organization_id = organization_members.organization_id
      WHERE organization_members.user_id = ${userId}
        AND organization_members.status = 'active'
        AND organization_members.role IN ('owner', 'admin')
      UNION ALL
      -- Root diagrams are first-class workspace documents; workspace members can edit them without a folder grant.
      SELECT 'editor' AS role
      FROM organization_members
      INNER JOIN diagram_scope ON diagram_scope.organization_id = organization_members.organization_id
      WHERE diagram_scope.folder_id IS NULL
        AND organization_members.user_id = ${userId}
        AND organization_members.status = 'active'
        AND organization_members.role = 'member'
      UNION ALL
      -- Folder default access intentionally excludes guests so diagram-only invites do not leak every folder diagram.
      SELECT organizations.default_folder_role AS role
      FROM organization_members
      INNER JOIN diagram_scope ON diagram_scope.organization_id = organization_members.organization_id
      INNER JOIN organizations ON organizations.id = diagram_scope.organization_id
      WHERE diagram_scope.folder_id IS NOT NULL
        AND organization_members.user_id = ${userId}
        AND organization_members.status = 'active'
        AND organization_members.role IN ('owner', 'admin', 'member')
        AND organizations.default_folder_role IN ('editor', 'commenter', 'viewer')
    `.execute(this.db);
    const role = resolveHighestAccessRole(roles.rows.map((row) => row.role));

    return role ? { role } : undefined;
  }

  async update(userId: string, folderId: string, dto: { description?: string | null; name?: string }) {
    const values: { description?: string | null; name?: string; slug?: string; updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if (dto.name !== undefined) {
      values.name = dto.name;
      values.slug = slugify(dto.name);
    }

    if (dto.description !== undefined) {
      values.description = dto.description;
    }

    const folder = await this.db
      .updateTable('folders')
      .set(values)
      .where('id', '=', folderId)
      .where('archivedAt', 'is', null)
      .returning('id')
      .executeTakeFirst();

    return folder ? this.getByIdForUser(userId, folder.id) : undefined;
  }

  async archive(folderId: string): Promise<boolean> {
    const result = await this.db
      .updateTable('folders')
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where('id', '=', folderId)
      .where('archivedAt', 'is', null)
      .executeTakeFirst();

    return Number(result.numUpdatedRows) > 0;
  }

  async getAccessList(folderId: string, options: FolderAccessListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await this.db
      .selectFrom('folder_access')
      .innerJoin('users', 'users.id', 'folder_access.userId')
      .select([
        'folder_access.userId',
        'users.email',
        'users.name',
        sql<string | null>`case
          when users.avatar_file_id is null then null
          else concat('/api/files/', users.avatar_file_id::text)
        end`.as('avatarUrl'),
        'users.cursorColor',
        'folder_access.role',
        'folder_access.createdAt',
        'folder_access.updatedAt',
      ])
      .where('folder_access.folderId', '=', folderId)
      .where('users.deletedAt', 'is', null)
      .orderBy('folder_access.createdAt', 'asc')
      .orderBy('folder_access.userId', 'asc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('folder_access')
      .innerJoin('users', 'users.id', 'folder_access.userId')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('folder_access.folderId', '=', folderId)
      .where('users.deletedAt', 'is', null)
      .executeTakeFirstOrThrow();

    return {
      // Folder access list is paginated from the first implementation so large internal teams do not force a later API break.
      items: rows.slice(0, options.limit),
      nextCursor: rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.count),
    };
  }

  getAccess(folderId: string, userId: string) {
    return this.db
      .selectFrom('folder_access')
      .innerJoin('users', 'users.id', 'folder_access.userId')
      .select([
        'folder_access.userId',
        'users.email',
        'users.name',
        sql<string | null>`case
          when users.avatar_file_id is null then null
          else concat('/api/files/', users.avatar_file_id::text)
        end`.as('avatarUrl'),
        'users.cursorColor',
        'folder_access.role',
        'folder_access.createdAt',
        'folder_access.updatedAt',
      ])
      .where('folder_access.folderId', '=', folderId)
      .where('folder_access.userId', '=', userId)
      .where('users.deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async upsertAccess(folderId: string, options: { createdById: string; role: AccessRole; userId: string }) {
    await this.db
      .insertInto('folder_access')
      .values({
        createdById: options.createdById,
        folderId,
        role: options.role,
        userId: options.userId,
      })
      .onConflict((oc) =>
        oc.columns(['folderId', 'userId']).doUpdateSet({
          role: options.role,
          updatedAt: new Date(),
        }),
      )
      .execute();

    return this.getAccess(folderId, options.userId);
  }

  async updateAccess(folderId: string, userId: string, role: AccessRole) {
    const member = await this.db
      .updateTable('folder_access')
      .set({ role, updatedAt: new Date() })
      .where('folderId', '=', folderId)
      .where('userId', '=', userId)
      .returning('userId')
      .executeTakeFirst();

    return member ? this.getAccess(folderId, member.userId) : undefined;
  }

  async transferOwnership(folderId: string, options: { createdById: string; userId: string }) {
    await this.db.transaction().execute(async (tx) => {
      const now = new Date();

      await tx
        .updateTable('folder_access')
        .set({ role: AccessRole.Editor, updatedAt: now })
        .where('folderId', '=', folderId)
        .where('role', '=', AccessRole.Owner)
        .execute();

      // Transfer ownership is allowed only through this explicit transaction so generic role edits cannot create extra owners.
      await tx
        .insertInto('folder_access')
        .values({
          createdById: options.createdById,
          folderId,
          role: AccessRole.Owner,
          updatedAt: now,
          userId: options.userId,
        })
        .onConflict((oc) =>
          oc.columns(['folderId', 'userId']).doUpdateSet({
            role: AccessRole.Owner,
            updatedAt: now,
          }),
        )
        .execute();
    });

    return this.getAccess(folderId, options.userId);
  }

  async removeAccess(folderId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('folder_access')
      .where('folderId', '=', folderId)
      .where('userId', '=', userId)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }

  async getFolderOwnerCount(folderId: string): Promise<number> {
    const row = await this.db
      .selectFrom('folder_access')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('folderId', '=', folderId)
      .where('role', '=', AccessRole.Owner)
      .executeTakeFirstOrThrow();

    return Number(row.count);
  }
}

type FolderVisibleRow = {
  createdAt: Date;
  description: string | null;
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  folderRole: AccessRole;
  slug: string;
  updatedAt: Date;
};

function resolveHighestAccessRole(roles: AccessRole[]): AccessRole | null {
  const sortedRoles = roles
    .map((role) => ({ priority: getAccessRolePriority(role), role }))
    .filter((entry) => entry.priority < Number.POSITIVE_INFINITY)
    .sort((left, right) => left.priority - right.priority);

  return sortedRoles[0]?.role ?? null;
}

function getAccessRolePriority(role: AccessRole): number {
  const rolePriority: Record<AccessRole, number> = {
    [AccessRole.Owner]: 1,
    [AccessRole.Editor]: 2,
    [AccessRole.Commenter]: 3,
    [AccessRole.Viewer]: 4,
  };

  return rolePriority[role] ?? Number.POSITIVE_INFINITY;
}
