import { Injectable } from '@nestjs/common';
import { Insertable, Kysely, sql } from 'kysely';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, ApiKeyTable } from '../schema/index.js';

@Injectable()
export class ApiKeyRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  create(dto: Insertable<ApiKeyTable>) {
    return this.db
      .insertInto('api_keys')
      .values(dto)
      .returning(['id', 'name', 'createdAt', 'updatedAt', 'permissions'])
      .executeTakeFirstOrThrow();
  }

  getByToken(token: Buffer) {
    return this.db
      .selectFrom('api_keys')
      .select((eb) => [
        'api_keys.id',
        'api_keys.permissions',
        jsonObjectFrom(
          eb
            .selectFrom('users')
            .select([
              'users.id',
              'users.email',
              'users.name',
              'users.cursorColor',
              sql<string | null>`case
                when users.avatar_file_id is null then null
                else concat('/api/files/', users.avatar_file_id::text)
              end`.as('avatarUrl'),
            ])
            .whereRef('users.id', '=', 'api_keys.userId')
            .where('users.isDisabled', '=', false)
            .where('users.deletedAt', 'is', null),
        ).as('user'),
      ])
      .where('api_keys.keyHash', '=', token)
      .where('api_keys.revokedAt', 'is', null)
      .where((eb) => eb.or([eb('api_keys.expiresAt', 'is', null), eb('api_keys.expiresAt', '>', new Date())]))
      .executeTakeFirst();
  }
}
