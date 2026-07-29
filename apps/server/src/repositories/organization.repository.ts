import { Injectable } from '@nestjs/common';
import { OrganizationRole, type ProjectRole } from '@tabliodb/shared';
import { Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB } from '../schema/index.js';
import { slugify } from '../utils/slug.js';

@Injectable()
export class OrganizationRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

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
