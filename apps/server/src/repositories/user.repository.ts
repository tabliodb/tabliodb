import { Injectable } from '@nestjs/common';
import { OrganizationRole } from '@tabliodb/shared';
import { Insertable, Kysely, sql } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, UserTable } from '../schema/index.js';
import { decodeOffsetCursor, encodeOffsetCursor } from '../utils/pagination.js';

export type ManagedUserCreateOptions = {
  cursorColor: string;
  createdById: string;
  email: string;
  instanceRole?: 'admin';
  name: string;
  organizationId: string;
  organizationRole: OrganizationRole.Admin | OrganizationRole.Member;
  passwordHash: string;
};

export type ManagedUserRoleFilter = 'owner' | 'instance-admin' | 'org-admin' | 'member';

export type ManagedUserListOptions = {
  cursor?: string;
  limit: number;
  role?: ManagedUserRoleFilter;
  search?: string;
};

@Injectable()
export class UserRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  getByEmail(email: string) {
    return this.db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email.trim().toLowerCase())
      .where('isDisabled', '=', false)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  getAnyByEmail(email: string) {
    return this.db
      .selectFrom('users')
      .select(['id', 'email', 'deletedAt'])
      .where('email', '=', email.trim().toLowerCase())
      .executeTakeFirst();
  }

  getAuthUserById(id: string) {
    return this.db
      .selectFrom('users')
      .select(['id', 'email', 'name', 'cursorColor', sql<string | null>`null`.as('avatarUrl')])
      .where('id', '=', id)
      .where('isDisabled', '=', false)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  getInstanceRole(userId: string) {
    return this.db.selectFrom('instance_members').select('role').where('userId', '=', userId).executeTakeFirst();
  }

  create(dto: Insertable<UserTable>) {
    return this.db.insertInto('users').values(dto).returningAll().executeTakeFirstOrThrow();
  }

  async createManagedUser(options: ManagedUserCreateOptions) {
    const userId = await this.db.transaction().execute(async (tx) => {
      const user = await tx
        .insertInto('users')
        .values({
          cursorColor: options.cursorColor,
          email: options.email,
          name: options.name,
          passwordHash: options.passwordHash,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      await tx
        .insertInto('organization_members')
        .values({
          createdById: options.createdById,
          joinedAt: new Date(),
          organizationId: options.organizationId,
          role: options.organizationRole,
          status: 'active',
          userId: user.id,
        })
        .execute();

      if (options.instanceRole) {
        await tx
          .insertInto('instance_members')
          .values({
            createdById: options.createdById,
            role: options.instanceRole,
            userId: user.id,
          })
          .execute();
      }

      return user.id;
    });

    return this.getManagedUserById(userId);
  }

  async getManagedUserById(userId: string) {
    const users = await this.getManagedUserRows([userId]);
    return users[0];
  }

  async getEnabledInstanceOwnerCount(): Promise<number> {
    const row = await this.db
      .selectFrom('instance_members')
      .innerJoin('users', 'users.id', 'instance_members.userId')
      .select((eb) => eb.fn.count<number>('users.id').as('count'))
      .where('instance_members.role', '=', 'owner')
      .where('users.isDisabled', '=', false)
      .where('users.deletedAt', 'is', null)
      .executeTakeFirstOrThrow();

    return Number(row.count);
  }

  async updateDisabledStatus(userId: string, isDisabled: boolean) {
    const now = new Date();
    const updated = await this.db
      .updateTable('users')
      .set({
        disabledAt: isDisabled ? now : null,
        isDisabled,
        updatedAt: now,
      })
      .where('id', '=', userId)
      .where('deletedAt', 'is', null)
      .returning('id')
      .executeTakeFirst();

    return updated ? this.getManagedUserById(updated.id) : undefined;
  }

  async updatePasswordHash(userId: string, passwordHash: string) {
    const now = new Date();
    const updated = await this.db
      .updateTable('users')
      .set({
        passwordChangedAt: now,
        passwordHash,
        updatedAt: now,
      })
      .where('id', '=', userId)
      .where('deletedAt', 'is', null)
      .returning('id')
      .executeTakeFirst();

    return updated ? this.getManagedUserById(updated.id) : undefined;
  }

  async listManagedUsers(options: ManagedUserListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const baseQuery = this.getManagedUserFilterQuery(options);
    const idRows = await baseQuery
      .select(['users.id', 'users.createdAt'])
      .groupBy(['users.id', 'users.createdAt'])
      .orderBy('users.createdAt', 'desc')
      .orderBy('users.id', 'desc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.getManagedUserFilterQuery(options)
      .select((eb) => eb.fn.count<number>('users.id').distinct().as('count'))
      .executeTakeFirstOrThrow();
    const pageRows = idRows.slice(0, options.limit);
    const users = await this.getManagedUserRows(pageRows.map((row) => row.id));
    const usersById = new Map(users.map((user) => [user.id, user]));

    return {
      // Detail user diambil query kedua supaya join membership tidak menggandakan row user di response.
      items: pageRows.flatMap((row) => {
        const user = usersById.get(row.id);
        return user ? [user] : [];
      }),
      nextCursor: idRows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.count),
    };
  }

  private getManagedUserFilterQuery(options: ManagedUserListOptions) {
    const search = options.search?.trim();

    return this.db
      .selectFrom('users')
      .leftJoin('instance_members', 'instance_members.userId', 'users.id')
      .leftJoin('organization_members', 'organization_members.userId', 'users.id')
      .leftJoin('organizations', 'organizations.id', 'organization_members.organizationId')
      .where('users.deletedAt', 'is', null)
      .$if(Boolean(search), (query) =>
        query.where((eb) =>
          eb.or([
            eb('users.name', 'ilike', `%${search}%`),
            eb('users.email', 'ilike', `%${search}%`),
            eb('organizations.name', 'ilike', `%${search}%`),
          ]),
        ),
      )
      .$if(options.role === 'owner', (query) => query.where('instance_members.role', '=', 'owner'))
      .$if(options.role === 'instance-admin', (query) => query.where('instance_members.role', '=', 'admin'))
      .$if(options.role === 'org-admin', (query) =>
        // Role filter memakai EXISTS agar user dengan banyak membership tidak salah masuk karena row join lain.
        query.where(
          sql<boolean>`exists (
            select 1
            from organization_members role_filter_members
            where role_filter_members.user_id = users.id
              and role_filter_members.role = ${OrganizationRole.Admin}
          )`,
        ),
      )
      .$if(options.role === 'member', (query) =>
        query.where('instance_members.role', 'is', null).where(
          sql<boolean>`not exists (
            select 1
            from organization_members role_filter_members
            where role_filter_members.user_id = users.id
              and role_filter_members.role = ${OrganizationRole.Admin}
          )`,
        ),
      );
  }

  private async getManagedUserRows(targetUserIds?: string[]) {
    if (targetUserIds && targetUserIds.length === 0) {
      return [];
    }

    const users = await this.db
      .selectFrom('users')
      .leftJoin('instance_members', 'instance_members.userId', 'users.id')
      .select([
        'users.id',
        'users.email',
        'users.name',
        sql<string | null>`null`.as('avatarUrl'),
        'users.cursorColor',
        'users.isDisabled',
        'users.createdAt',
        'users.updatedAt',
        'instance_members.role as instanceRole',
      ])
      .where('users.deletedAt', 'is', null)
      .$if(Boolean(targetUserIds), (query) => query.where('users.id', 'in', targetUserIds!))
      .orderBy('users.createdAt', 'desc')
      .execute();

    if (users.length === 0) {
      return [];
    }

    const loadedUserIds = users.map((user) => user.id);
    const memberships = await this.db
      .selectFrom('organization_members')
      .innerJoin('organizations', 'organizations.id', 'organization_members.organizationId')
      .select([
        'organization_members.userId',
        'organizations.id as organizationId',
        'organizations.name as organizationName',
        'organizations.slug as organizationSlug',
        'organization_members.role as organizationRole',
        'organization_members.status as organizationStatus',
      ])
      .where('organization_members.userId', 'in', loadedUserIds)
      .orderBy('organizations.createdAt', 'asc')
      .execute();

    return users.map((user) => ({
      ...user,
      instanceRole: user.instanceRole ?? null,
      organizations: memberships
        .filter((membership) => membership.userId === user.id)
        .map((membership) => ({
          id: membership.organizationId,
          name: membership.organizationName,
          role: membership.organizationRole,
          slug: membership.organizationSlug,
          status: membership.organizationStatus,
        })),
    }));
  }
}
