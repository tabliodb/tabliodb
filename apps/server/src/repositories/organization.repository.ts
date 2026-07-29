import { Injectable } from '@nestjs/common';
import { OrganizationRole } from '@tabliodb/shared';
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
}
