import { Injectable } from '@nestjs/common';
import { ProjectRole } from '@tabliodb/shared';
import { Insertable, Kysely, sql } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, ProjectTable } from '../schema/index.js';
import { decodeOffsetCursor, encodeOffsetCursor } from '../utils/pagination.js';
import { slugify } from '../utils/slug.js';

export type ProjectListOptions = {
  cursor?: string;
  limit: number;
  organizationId?: string;
};

export type ProjectMemberListOptions = {
  cursor?: string;
  limit: number;
};

@Injectable()
export class ProjectRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  create(dto: Insertable<ProjectTable>) {
    return this.db.transaction().execute(async (tx) => {
      const project = await tx.insertInto('projects').values(dto).returningAll().executeTakeFirstOrThrow();

      // The creator gets project-level ownership immediately, independent of organization-level role changes later.
      await tx
        .insertInto('project_members')
        .values({ projectId: project.id, userId: dto.createdById, role: ProjectRole.Owner })
        .execute();

      return tx
        .selectFrom('projects')
        .innerJoin('organizations', 'organizations.id', 'projects.organizationId')
        .innerJoin('project_members', 'project_members.projectId', 'projects.id')
        .select([
          'projects.id',
          'projects.organizationId',
          'projects.name',
          'projects.slug',
          'projects.description',
          'projects.createdAt',
          'projects.updatedAt',
          'organizations.name as organizationName',
          'organizations.slug as organizationSlug',
          'project_members.role as projectRole',
        ])
        .where('projects.id', '=', project.id)
        .where('project_members.userId', '=', dto.createdById)
        .executeTakeFirstOrThrow();
    });
  }

  async getVisibleToUser(userId: string, options: ProjectListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const organizationFilter = options.organizationId
      ? sql`AND projects.organization_id = ${options.organizationId}`
      : sql``;
    const rows = await sql<ProjectVisibleRow>`
      WITH project_access AS (
        SELECT project_id, role
        FROM project_members
        WHERE user_id = ${userId}
        UNION ALL
        SELECT project_team_access.project_id, project_team_access.role
        FROM project_team_access
        INNER JOIN team_members ON team_members.team_id = project_team_access.team_id
        INNER JOIN teams ON teams.id = project_team_access.team_id
        WHERE team_members.user_id = ${userId}
          AND teams.archived_at IS NULL
        UNION ALL
        -- Workspace owners/admins can administer every project in their workspace even if no direct project_members row exists.
        SELECT projects.id AS project_id, 'owner' AS role
        FROM projects
        INNER JOIN organizations ON organizations.id = projects.organization_id
        INNER JOIN organization_members ON organization_members.organization_id = organizations.id
        WHERE organization_members.user_id = ${userId}
          AND organization_members.status = 'active'
          AND organization_members.role IN ('owner', 'admin')
          AND organizations.archived_at IS NULL
          AND projects.archived_at IS NULL
        UNION ALL
        -- Workspace default access lets owners expose every project to members without writing one project_members row per user.
        SELECT projects.id AS project_id, organizations.default_project_role AS role
        FROM projects
        INNER JOIN organizations ON organizations.id = projects.organization_id
        INNER JOIN organization_members ON organization_members.organization_id = organizations.id
        WHERE organization_members.user_id = ${userId}
          AND organization_members.status = 'active'
          AND organization_members.role IN ('owner', 'admin', 'member')
          AND organizations.archived_at IS NULL
          AND projects.archived_at IS NULL
          AND organizations.default_project_role IN ('editor', 'commenter', 'viewer')
      ),
      effective_access AS (
        SELECT
          project_id,
          min(
            CASE role
              WHEN 'owner' THEN 1
              WHEN 'editor' THEN 2
              WHEN 'commenter' THEN 3
              WHEN 'viewer' THEN 4
              ELSE 99
            END
          ) AS role_priority
        FROM project_access
        GROUP BY project_id
      )
      SELECT
        projects.id,
        projects.organization_id AS "organizationId",
        projects.name,
        projects.slug,
        projects.description,
        projects.created_at AS "createdAt",
        projects.updated_at AS "updatedAt",
        organizations.name AS "organizationName",
        organizations.slug AS "organizationSlug",
        CASE effective_access.role_priority
          WHEN 1 THEN 'owner'
          WHEN 2 THEN 'editor'
          WHEN 3 THEN 'commenter'
          ELSE 'viewer'
        END AS "projectRole"
      FROM projects
      INNER JOIN organizations ON organizations.id = projects.organization_id
      INNER JOIN effective_access ON effective_access.project_id = projects.id
      WHERE projects.archived_at IS NULL
        ${organizationFilter}
      ORDER BY projects.updated_at DESC
      LIMIT ${options.limit + 1}
      OFFSET ${offset}
    `.execute(this.db);
    const totalRow = await sql<{ count: number }>`
      WITH project_access AS (
        SELECT project_id, role
        FROM project_members
        WHERE user_id = ${userId}
        UNION ALL
        SELECT project_team_access.project_id, project_team_access.role
        FROM project_team_access
        INNER JOIN team_members ON team_members.team_id = project_team_access.team_id
        INNER JOIN teams ON teams.id = project_team_access.team_id
        WHERE team_members.user_id = ${userId}
          AND teams.archived_at IS NULL
        UNION ALL
        -- Workspace owners/admins are counted with effective access for the same reason they are listed above.
        SELECT projects.id AS project_id, 'owner' AS role
        FROM projects
        INNER JOIN organizations ON organizations.id = projects.organization_id
        INNER JOIN organization_members ON organization_members.organization_id = organizations.id
        WHERE organization_members.user_id = ${userId}
          AND organization_members.status = 'active'
          AND organization_members.role IN ('owner', 'admin')
          AND organizations.archived_at IS NULL
          AND projects.archived_at IS NULL
        UNION ALL
        -- The count query mirrors the list query so pagination totals include organization-wide default access consistently.
        SELECT projects.id AS project_id, organizations.default_project_role AS role
        FROM projects
        INNER JOIN organizations ON organizations.id = projects.organization_id
        INNER JOIN organization_members ON organization_members.organization_id = organizations.id
        WHERE organization_members.user_id = ${userId}
          AND organization_members.status = 'active'
          AND organization_members.role IN ('owner', 'admin', 'member')
          AND organizations.archived_at IS NULL
          AND projects.archived_at IS NULL
          AND organizations.default_project_role IN ('editor', 'commenter', 'viewer')
      ),
      effective_access AS (
        SELECT project_id
        FROM project_access
        GROUP BY project_id
      )
      SELECT count(*)::int AS count
      FROM projects
      INNER JOIN effective_access ON effective_access.project_id = projects.id
      WHERE projects.archived_at IS NULL
        ${organizationFilter}
    `.execute(this.db);

    return {
      // List project dipaginasi walau editor saat ini hanya memakai page pertama untuk starter workspace.
      items: rows.rows.slice(0, options.limit),
      nextCursor: rows.rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.rows[0]?.count ?? 0),
    };
  }

  async getByIdForUser(userId: string, projectId: string) {
    const project = await this.db
      .selectFrom('projects')
      .innerJoin('organizations', 'organizations.id', 'projects.organizationId')
      .select([
        'projects.id',
        'projects.organizationId',
        'projects.name',
        'projects.slug',
        'projects.description',
        'projects.createdAt',
        'projects.updatedAt',
        'organizations.name as organizationName',
        'organizations.slug as organizationSlug',
      ])
      .where('projects.id', '=', projectId)
      .where('projects.archivedAt', 'is', null)
      .executeTakeFirst();
    const role = project ? await this.getProjectRole(userId, project.id) : undefined;

    return project && role ? { ...project, projectRole: role.role } : undefined;
  }

  async getActiveBySlugInOrganization(organizationId: string, slug: string) {
    return this.db
      .selectFrom('projects')
      .select(['id', 'organizationId', 'name', 'slug'])
      .where('organizationId', '=', organizationId)
      .where('slug', '=', slug)
      .where('archivedAt', 'is', null)
      .executeTakeFirst();
  }

  async getBySlugForUser(userId: string, organizationId: string, slug: string) {
    const project = await this.getActiveBySlugInOrganization(organizationId, slug);

    // Reuse the canonical access resolver so folder lookup and route lookup cannot drift in permission behavior.
    return project ? this.getByIdForUser(userId, project.id) : undefined;
  }

  async getProjectRole(userId: string, projectId: string) {
    const roles = await sql<{ role: ProjectRole }>`
      SELECT project_members.role
      FROM project_members
      INNER JOIN projects ON projects.id = project_members.project_id
      WHERE project_members.user_id = ${userId}
        AND project_members.project_id = ${projectId}
        AND projects.archived_at IS NULL
      UNION ALL
      SELECT project_team_access.role
      FROM project_team_access
      INNER JOIN projects ON projects.id = project_team_access.project_id
      INNER JOIN team_members ON team_members.team_id = project_team_access.team_id
      INNER JOIN teams ON teams.id = project_team_access.team_id
      WHERE team_members.user_id = ${userId}
        AND project_team_access.project_id = ${projectId}
        AND projects.archived_at IS NULL
        AND teams.archived_at IS NULL
      UNION ALL
      -- Workspace managers get effective owner access so admin UI and recovery flows never depend on per-project grants.
      SELECT 'owner' AS role
      FROM projects
      INNER JOIN organizations ON organizations.id = projects.organization_id
      INNER JOIN organization_members ON organization_members.organization_id = organizations.id
      WHERE organization_members.user_id = ${userId}
        AND projects.id = ${projectId}
        AND organization_members.status = 'active'
        AND organization_members.role IN ('owner', 'admin')
        AND organizations.archived_at IS NULL
        AND projects.archived_at IS NULL
      UNION ALL
      -- Direct permission checks must include the same organization default role used by project listing.
      SELECT organizations.default_project_role AS role
      FROM projects
      INNER JOIN organizations ON organizations.id = projects.organization_id
      INNER JOIN organization_members ON organization_members.organization_id = organizations.id
        WHERE organization_members.user_id = ${userId}
          AND projects.id = ${projectId}
          AND organization_members.status = 'active'
          AND organization_members.role IN ('owner', 'admin', 'member')
          AND organizations.archived_at IS NULL
          AND projects.archived_at IS NULL
          AND organizations.default_project_role IN ('editor', 'commenter', 'viewer')
    `.execute(this.db);
    const role = resolveHighestProjectRole(roles.rows.map((row) => row.role));

    return role ? { role } : undefined;
  }

  async getDiagramRole(userId: string, diagramId: string) {
    const roles = await sql<{ role: ProjectRole }>`
      WITH diagram_scope AS (
        SELECT diagrams.id, diagrams.organization_id, diagrams.project_id
        FROM diagrams
        LEFT JOIN projects ON projects.id = diagrams.project_id
        INNER JOIN organizations ON organizations.id = diagrams.organization_id
        WHERE diagrams.id = ${diagramId}
          AND diagrams.archived_at IS NULL
          AND organizations.archived_at IS NULL
          AND (diagrams.project_id IS NULL OR projects.archived_at IS NULL)
      )
      SELECT diagram_members.role
      FROM diagram_members
      INNER JOIN diagram_scope ON diagram_scope.id = diagram_members.diagram_id
      WHERE diagram_members.user_id = ${userId}
      UNION ALL
      SELECT diagram_team_access.role
      FROM diagram_team_access
      INNER JOIN diagram_scope ON diagram_scope.id = diagram_team_access.diagram_id
      INNER JOIN team_members ON team_members.team_id = diagram_team_access.team_id
      INNER JOIN teams ON teams.id = diagram_team_access.team_id
      WHERE team_members.user_id = ${userId}
        AND teams.archived_at IS NULL
      UNION ALL
      SELECT project_members.role
      FROM project_members
      INNER JOIN diagram_scope ON diagram_scope.project_id = project_members.project_id
      WHERE project_members.user_id = ${userId}
      UNION ALL
      SELECT project_team_access.role
      FROM project_team_access
      INNER JOIN diagram_scope ON diagram_scope.project_id = project_team_access.project_id
      INNER JOIN team_members ON team_members.team_id = project_team_access.team_id
      INNER JOIN teams ON teams.id = project_team_access.team_id
      WHERE team_members.user_id = ${userId}
        AND teams.archived_at IS NULL
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
      WHERE diagram_scope.project_id IS NULL
        AND organization_members.user_id = ${userId}
        AND organization_members.status = 'active'
        AND organization_members.role = 'member'
      UNION ALL
      -- Project default access intentionally excludes guests so diagram-only invites do not leak every folder diagram.
      SELECT organizations.default_project_role AS role
      FROM organization_members
      INNER JOIN diagram_scope ON diagram_scope.organization_id = organization_members.organization_id
      INNER JOIN organizations ON organizations.id = diagram_scope.organization_id
      WHERE diagram_scope.project_id IS NOT NULL
        AND organization_members.user_id = ${userId}
        AND organization_members.status = 'active'
        AND organization_members.role IN ('owner', 'admin', 'member')
        AND organizations.default_project_role IN ('editor', 'commenter', 'viewer')
    `.execute(this.db);
    const role = resolveHighestProjectRole(roles.rows.map((row) => row.role));

    return role ? { role } : undefined;
  }

  async update(userId: string, projectId: string, dto: { description?: string | null; name?: string }) {
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

    const project = await this.db
      .updateTable('projects')
      .set(values)
      .where('id', '=', projectId)
      .where('archivedAt', 'is', null)
      .returning('id')
      .executeTakeFirst();

    return project ? this.getByIdForUser(userId, project.id) : undefined;
  }

  async archive(projectId: string): Promise<boolean> {
    const result = await this.db
      .updateTable('projects')
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where('id', '=', projectId)
      .where('archivedAt', 'is', null)
      .executeTakeFirst();

    return Number(result.numUpdatedRows) > 0;
  }

  async getMembers(projectId: string, options: ProjectMemberListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await this.db
      .selectFrom('project_members')
      .innerJoin('users', 'users.id', 'project_members.userId')
      .select([
        'project_members.userId',
        'users.email',
        'users.name',
        sql<string | null>`case
          when users.avatar_file_id is null then null
          else concat('/api/files/', users.avatar_file_id::text)
        end`.as('avatarUrl'),
        'users.cursorColor',
        'project_members.role',
        'project_members.createdAt',
        'project_members.updatedAt',
      ])
      .where('project_members.projectId', '=', projectId)
      .where('users.deletedAt', 'is', null)
      .orderBy('project_members.createdAt', 'asc')
      .orderBy('project_members.userId', 'asc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('project_members')
      .innerJoin('users', 'users.id', 'project_members.userId')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('project_members.projectId', '=', projectId)
      .where('users.deletedAt', 'is', null)
      .executeTakeFirstOrThrow();

    return {
      // Project member list is paginated from the first implementation so large internal teams do not force a later API break.
      items: rows.slice(0, options.limit),
      nextCursor: rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.count),
    };
  }

  getMember(projectId: string, userId: string) {
    return this.db
      .selectFrom('project_members')
      .innerJoin('users', 'users.id', 'project_members.userId')
      .select([
        'project_members.userId',
        'users.email',
        'users.name',
        sql<string | null>`case
          when users.avatar_file_id is null then null
          else concat('/api/files/', users.avatar_file_id::text)
        end`.as('avatarUrl'),
        'users.cursorColor',
        'project_members.role',
        'project_members.createdAt',
        'project_members.updatedAt',
      ])
      .where('project_members.projectId', '=', projectId)
      .where('project_members.userId', '=', userId)
      .where('users.deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async upsertMember(projectId: string, options: { createdById: string; role: ProjectRole; userId: string }) {
    await this.db
      .insertInto('project_members')
      .values({
        createdById: options.createdById,
        projectId,
        role: options.role,
        userId: options.userId,
      })
      .onConflict((oc) =>
        oc.columns(['projectId', 'userId']).doUpdateSet({
          role: options.role,
          updatedAt: new Date(),
        }),
      )
      .execute();

    return this.getMember(projectId, options.userId);
  }

  async updateMember(projectId: string, userId: string, role: ProjectRole) {
    const member = await this.db
      .updateTable('project_members')
      .set({ role, updatedAt: new Date() })
      .where('projectId', '=', projectId)
      .where('userId', '=', userId)
      .returning('userId')
      .executeTakeFirst();

    return member ? this.getMember(projectId, member.userId) : undefined;
  }

  async removeMember(projectId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('project_members')
      .where('projectId', '=', projectId)
      .where('userId', '=', userId)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }

  async getProjectOwnerCount(projectId: string): Promise<number> {
    const row = await this.db
      .selectFrom('project_members')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('projectId', '=', projectId)
      .where('role', '=', ProjectRole.Owner)
      .executeTakeFirstOrThrow();

    return Number(row.count);
  }
}

type ProjectVisibleRow = {
  createdAt: Date;
  description: string | null;
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  projectRole: ProjectRole;
  slug: string;
  updatedAt: Date;
};

function resolveHighestProjectRole(roles: ProjectRole[]): ProjectRole | null {
  const sortedRoles = roles
    .map((role) => ({ priority: getProjectRolePriority(role), role }))
    .filter((entry) => entry.priority < Number.POSITIVE_INFINITY)
    .sort((left, right) => left.priority - right.priority);

  return sortedRoles[0]?.role ?? null;
}

function getProjectRolePriority(role: ProjectRole): number {
  const rolePriority: Record<ProjectRole, number> = {
    [ProjectRole.Owner]: 1,
    [ProjectRole.Editor]: 2,
    [ProjectRole.Commenter]: 3,
    [ProjectRole.Viewer]: 4,
  };

  return rolePriority[role] ?? Number.POSITIVE_INFINITY;
}
