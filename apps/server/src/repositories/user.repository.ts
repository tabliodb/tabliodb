import { Injectable } from '@nestjs/common';
import { OrganizationRole } from '@tabliodb/shared';
import { Insertable, Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, UserTable } from '../schema/index.js';

export type ManagedUserCreateOptions = {
  avatarColor: string | null;
  createdById: string;
  email: string;
  instanceRole?: 'admin';
  name: string;
  organizationId: string;
  organizationRole: OrganizationRole.Admin | OrganizationRole.Member;
  passwordHash: string;
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
      .select(['id', 'email', 'name', 'avatarColor'])
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
          avatarColor: options.avatarColor,
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
    const users = await this.getManagedUserRows(userId);
    return users[0];
  }

  listManagedUsers() {
    return this.getManagedUserRows();
  }

  private async getManagedUserRows(userId?: string) {
    const users = await this.db
      .selectFrom('users')
      .leftJoin('instance_members', 'instance_members.userId', 'users.id')
      .select([
        'users.id',
        'users.email',
        'users.name',
        'users.avatarColor',
        'users.isDisabled',
        'users.createdAt',
        'users.updatedAt',
        'instance_members.role as instanceRole',
      ])
      .where('users.deletedAt', 'is', null)
      .$if(Boolean(userId), (query) => query.where('users.id', '=', userId!))
      .orderBy('users.createdAt', 'desc')
      .execute();

    if (users.length === 0) {
      return [];
    }

    const userIds = users.map((user) => user.id);
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
      .where('organization_members.userId', 'in', userIds)
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
