import { Injectable } from '@nestjs/common';
import { OrganizationRole, type ProjectRole } from '@tabliodb/shared';
import { Kysely, sql } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import { randomUUID } from 'node:crypto';
import type { DB } from '../schema/index.js';
import { decodeOffsetCursor, encodeOffsetCursor } from '../utils/pagination.js';
import { slugify } from '../utils/slug.js';

export type OrganizationListOptions = {
  cursor?: string;
  limit: number;
};

export type OrganizationMemberListOptions = {
  cursor?: string;
  limit: number;
};

@Injectable()
export class OrganizationRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  async listForUser(userId: string, options: OrganizationListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await this.db
      .selectFrom('organizations')
      .innerJoin('organization_members', 'organization_members.organizationId', 'organizations.id')
      .select([
        'organizations.id',
        'organizations.name',
        'organizations.slug',
        'organizations.defaultProjectRole',
        'organizations.allowMemberProjectCreate',
        'organizations.createdAt',
        'organizations.updatedAt',
        'organization_members.role',
        'organization_members.status',
      ])
      .where('organization_members.userId', '=', userId)
      .where('organization_members.status', '=', 'active')
      .where('organizations.archivedAt', 'is', null)
      .orderBy('organizations.createdAt', 'asc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('organizations')
      .innerJoin('organization_members', 'organization_members.organizationId', 'organizations.id')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('organization_members.userId', '=', userId)
      .where('organization_members.status', '=', 'active')
      .where('organizations.archivedAt', 'is', null)
      .executeTakeFirstOrThrow();

    return {
      // Workspace switcher uses the same paginated contract as user/project lists, even if the first UI loads 50.
      items: rows.slice(0, options.limit),
      nextCursor: rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.count),
    };
  }

  getFirstForUser(userId: string) {
    return this.db
      .selectFrom('organizations')
      .innerJoin('organization_members', 'organization_members.organizationId', 'organizations.id')
      .selectAll('organizations')
      .where('organization_members.userId', '=', userId)
      .where('organization_members.status', '=', 'active')
      .where('organizations.archivedAt', 'is', null)
      .orderBy('organizations.createdAt', 'asc')
      .executeTakeFirst();
  }

  getByIdForUser(userId: string, organizationId: string) {
    return this.db
      .selectFrom('organizations')
      .innerJoin('organization_members', 'organization_members.organizationId', 'organizations.id')
      .selectAll('organizations')
      .where('organization_members.userId', '=', userId)
      .where('organization_members.status', '=', 'active')
      .where('organizations.id', '=', organizationId)
      .where('organizations.archivedAt', 'is', null)
      .executeTakeFirst();
  }

  getRole(userId: string, organizationId: string) {
    return this.db
      .selectFrom('organization_members')
      .innerJoin('organizations', 'organizations.id', 'organization_members.organizationId')
      .select('organization_members.role')
      .where('organization_members.userId', '=', userId)
      .where('organization_members.organizationId', '=', organizationId)
      .where('organization_members.status', '=', 'active')
      .where('organizations.archivedAt', 'is', null)
      .executeTakeFirst();
  }

  getSettingsForUser(userId: string, organizationId: string) {
    return this.db
      .selectFrom('organizations')
      .innerJoin('organization_members', 'organization_members.organizationId', 'organizations.id')
      .select([
        'organizations.id',
        'organizations.name',
        'organizations.slug',
        'organizations.defaultProjectRole',
        'organizations.allowMemberProjectCreate',
        'organizations.createdAt',
        'organizations.updatedAt',
      ])
      .where('organization_members.userId', '=', userId)
      .where('organization_members.status', '=', 'active')
      .where('organizations.id', '=', organizationId)
      .where('organizations.archivedAt', 'is', null)
      .executeTakeFirst();
  }

  getActiveById(organizationId: string) {
    return this.db
      .selectFrom('organizations')
      .select(['id', 'name', 'slug'])
      .where('id', '=', organizationId)
      .where('archivedAt', 'is', null)
      .executeTakeFirst();
  }

  async updateSettings(
    organizationId: string,
    dto: {
      allowMemberProjectCreate?: boolean;
      defaultProjectRole?: ProjectRole.Editor | ProjectRole.Commenter | ProjectRole.Viewer | null;
      name?: string;
    },
  ) {
    const values: {
      allowMemberProjectCreate?: boolean;
      defaultProjectRole?: ProjectRole.Editor | ProjectRole.Commenter | ProjectRole.Viewer | null;
      name?: string;
      slug?: string;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (dto.name !== undefined) {
      values.name = dto.name;
      values.slug = slugify(dto.name);
    }

    if (dto.defaultProjectRole !== undefined) {
      values.defaultProjectRole = dto.defaultProjectRole;
    }

    if (dto.allowMemberProjectCreate !== undefined) {
      values.allowMemberProjectCreate = dto.allowMemberProjectCreate;
    }

    const organization = await this.db
      .updateTable('organizations')
      .set(values)
      .where('id', '=', organizationId)
      .where('archivedAt', 'is', null)
      .returning('id')
      .executeTakeFirst();

    return organization ? this.getSettingsById(organization.id) : undefined;
  }

  async getMembers(organizationId: string, options: OrganizationMemberListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await this.db
      .selectFrom('organization_members')
      .innerJoin('users', 'users.id', 'organization_members.userId')
      .select([
        'organization_members.userId',
        'users.email',
        'users.name',
        sql<string | null>`case
          when users.avatar_file_id is null then null
          else concat('/api/files/', users.avatar_file_id::text)
        end`.as('avatarUrl'),
        'users.cursorColor',
        'organization_members.role',
        'organization_members.status',
        'organization_members.joinedAt',
        'organization_members.createdAt',
        'organization_members.updatedAt',
      ])
      .where('organization_members.organizationId', '=', organizationId)
      .where('users.deletedAt', 'is', null)
      .orderBy('organization_members.createdAt', 'asc')
      .orderBy('organization_members.userId', 'asc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('organization_members')
      .innerJoin('users', 'users.id', 'organization_members.userId')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('organization_members.organizationId', '=', organizationId)
      .where('users.deletedAt', 'is', null)
      .executeTakeFirstOrThrow();

    return {
      // Workspace member list is paginated from day one so internal company workspaces can grow without an API break.
      items: rows.slice(0, options.limit),
      nextCursor: rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.count),
    };
  }

  getMember(organizationId: string, userId: string) {
    return this.db
      .selectFrom('organization_members')
      .innerJoin('users', 'users.id', 'organization_members.userId')
      .select([
        'organization_members.userId',
        'users.email',
        'users.name',
        sql<string | null>`case
          when users.avatar_file_id is null then null
          else concat('/api/files/', users.avatar_file_id::text)
        end`.as('avatarUrl'),
        'users.cursorColor',
        'organization_members.role',
        'organization_members.status',
        'organization_members.joinedAt',
        'organization_members.createdAt',
        'organization_members.updatedAt',
      ])
      .where('organization_members.organizationId', '=', organizationId)
      .where('organization_members.userId', '=', userId)
      .where('users.deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async updateMemberRole(organizationId: string, userId: string, role: OrganizationRole) {
    const member = await this.db
      .updateTable('organization_members')
      .set({ role, updatedAt: new Date() })
      .where('organizationId', '=', organizationId)
      .where('userId', '=', userId)
      .returning('userId')
      .executeTakeFirst();

    return member ? this.getMember(organizationId, member.userId) : undefined;
  }

  async transferOwnership(organizationId: string, userId: string) {
    await this.db.transaction().execute(async (tx) => {
      const now = new Date();

      await tx
        .updateTable('organization_members')
        .set({ role: OrganizationRole.Admin, updatedAt: now })
        .where('organizationId', '=', organizationId)
        .where('role', '=', OrganizationRole.Owner)
        .where('status', '=', 'active')
        .execute();

      // Workspace ownership is a single explicit handoff; generic role edits cannot create extra workspace owners.
      await tx
        .updateTable('organization_members')
        .set({ role: OrganizationRole.Owner, updatedAt: now })
        .where('organizationId', '=', organizationId)
        .where('userId', '=', userId)
        .where('status', '=', 'active')
        .execute();
    });

    return this.getMember(organizationId, userId);
  }

  async removeMember(organizationId: string, userId: string): Promise<boolean> {
    const result = await this.db.transaction().execute(async (tx) => {
      await sql`
        DELETE FROM diagram_members
        USING diagrams
        WHERE diagram_members.diagram_id = diagrams.id
          AND diagrams.organization_id = ${organizationId}
          AND diagram_members.user_id = ${userId}
      `.execute(tx);

      await sql`
        DELETE FROM project_members
        USING projects
        WHERE project_members.project_id = projects.id
          AND projects.organization_id = ${organizationId}
          AND project_members.user_id = ${userId}
      `.execute(tx);

      await sql`
        DELETE FROM team_members
        USING teams
        WHERE team_members.team_id = teams.id
          AND teams.organization_id = ${organizationId}
          AND team_members.user_id = ${userId}
      `.execute(tx);

      // Workspace membership is the tenant boundary; direct lower-scope grants are removed before the membership row.
      return tx
        .deleteFrom('organization_members')
        .where('organizationId', '=', organizationId)
        .where('userId', '=', userId)
        .executeTakeFirst();
    });

    return Number(result.numDeletedRows) > 0;
  }

  async getOrganizationOwnerCount(organizationId: string): Promise<number> {
    const row = await this.db
      .selectFrom('organization_members')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('organizationId', '=', organizationId)
      .where('role', '=', OrganizationRole.Owner)
      .where('status', '=', 'active')
      .executeTakeFirstOrThrow();

    return Number(row.count);
  }

  async addMemberIfAbsent(options: {
    createdById?: string | null;
    organizationId: string;
    role: OrganizationRole.Admin | OrganizationRole.Member | OrganizationRole.Guest;
    userId: string;
  }) {
    const organization = await this.getActiveById(options.organizationId);

    if (!organization) {
      return undefined;
    }

    const existingMember = await this.getMember(options.organizationId, options.userId);

    if (existingMember) {
      // OIDC auto-join must never silently promote, demote, or reactivate an existing workspace membership.
      return existingMember;
    }

    const now = new Date();

    await this.db
      .insertInto('organization_members')
      .values({
        createdById: options.createdById ?? null,
        joinedAt: now,
        organizationId: options.organizationId,
        role: options.role,
        status: 'active',
        userId: options.userId,
      })
      .execute();

    return this.getMember(options.organizationId, options.userId);
  }

  createPersonalOrganization(options: { userId: string; name: string }) {
    return this.createOwnedOrganization(options);
  }

  createOwnedOrganization(options: { userId: string; name: string }) {
    return this.db.transaction().execute(async (tx) => {
      const organization = await this.insertOrganizationWithUniqueSlug(tx, options);

      await tx
        .insertInto('organization_members')
        .values({
          organizationId: organization.id,
          userId: options.userId,
          role: OrganizationRole.Owner,
        })
        .execute();

      return {
        allowMemberProjectCreate: organization.allowMemberProjectCreate,
        createdAt: organization.createdAt,
        defaultProjectRole: organization.defaultProjectRole,
        id: organization.id,
        name: organization.name,
        role: OrganizationRole.Owner,
        slug: organization.slug,
        status: 'active',
        updatedAt: organization.updatedAt,
      };
    });
  }

  private async insertOrganizationWithUniqueSlug(tx: Kysely<DB>, options: { userId: string; name: string }) {
    const baseSlug = slugify(options.name);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;

      try {
        return await tx
          .insertInto('organizations')
          .values({
            createdById: options.userId,
            name: options.name,
            slug,
          })
          .returning(['allowMemberProjectCreate', 'createdAt', 'defaultProjectRole', 'id', 'name', 'slug', 'updatedAt'])
          .executeTakeFirstOrThrow();
      } catch (error) {
        if (!isOrganizationSlugConflict(error)) {
          throw error;
        }
      }
    }

    // Rare concurrent-create collisions still resolve to a URL-safe deterministic prefix plus a short random suffix.
    return tx
      .insertInto('organizations')
      .values({
        createdById: options.userId,
        name: options.name,
        slug: `${baseSlug}-${randomUUID().slice(0, 8)}`,
      })
      .returning(['allowMemberProjectCreate', 'createdAt', 'defaultProjectRole', 'id', 'name', 'slug', 'updatedAt'])
      .executeTakeFirstOrThrow();
  }

  private getSettingsById(organizationId: string) {
    return this.db
      .selectFrom('organizations')
      .select(['id', 'name', 'slug', 'defaultProjectRole', 'allowMemberProjectCreate', 'createdAt', 'updatedAt'])
      .where('id', '=', organizationId)
      .where('archivedAt', 'is', null)
      .executeTakeFirst();
  }
}

function isOrganizationSlugConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as { code?: unknown; constraint?: unknown };

  return record.code === '23505' && record.constraint === 'organizations_slug_key';
}
