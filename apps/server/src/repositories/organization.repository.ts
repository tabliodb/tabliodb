import { Injectable } from '@nestjs/common';
import { OrganizationRole, type ProjectRole } from '@tabliodb/shared';
import { Kysely, sql } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
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
      .orderBy('organizations.createdAt', 'asc')
      .executeTakeFirst();
  }

  getByIdForUser(userId: string, organizationId: string) {
    return this.db
      .selectFrom('organizations')
      .innerJoin('organization_members', 'organization_members.organizationId', 'organizations.id')
      .selectAll('organizations')
      .where('organization_members.userId', '=', userId)
      .where('organizations.id', '=', organizationId)
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

  async removeMember(organizationId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('organization_members')
      .where('organizationId', '=', organizationId)
      .where('userId', '=', userId)
      .executeTakeFirst();

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
    role: OrganizationRole.Member | OrganizationRole.Guest;
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
    const slug = slugify(options.name);

    return this.db.transaction().execute(async (tx) => {
      const organization = await tx
        .insertInto('organizations')
        .values({
          name: options.name,
          slug,
          createdById: options.userId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await tx
        .insertInto('organization_members')
        .values({
          organizationId: organization.id,
          userId: options.userId,
          role: OrganizationRole.Owner,
        })
        .execute();

      return organization;
    });
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
