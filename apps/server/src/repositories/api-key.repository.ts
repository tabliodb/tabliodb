import { Injectable } from '@nestjs/common';
import { Insertable, Kysely, sql } from 'kysely';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, ApiKeyTable } from '../schema/index.js';
import { decodeOffsetCursor, encodeOffsetCursor } from '../utils/pagination.js';

export type ApiKeyListOptions = {
  cursor?: string;
  limit: number;
};

@Injectable()
export class ApiKeyRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  create(dto: Insertable<ApiKeyTable>) {
    return this.db
      .insertInto('api_keys')
      .values(dto)
      .returning([
        'id',
        'keyPrefix',
        'name',
        'createdAt',
        'updatedAt',
        'permissions',
        'lastUsedAt',
        'expiresAt',
        'revokedAt',
      ])
      .executeTakeFirstOrThrow();
  }

  async getByUser(userId: string, options: ApiKeyListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await this.db
      .selectFrom('api_keys')
      .select([
        'id',
        'keyPrefix',
        'name',
        'permissions',
        'lastUsedAt',
        'expiresAt',
        'revokedAt',
        'createdAt',
        'updatedAt',
      ])
      .where('userId', '=', userId)
      .where('revokedAt', 'is', null)
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('api_keys')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('userId', '=', userId)
      .where('revokedAt', 'is', null)
      .executeTakeFirstOrThrow();

    return {
      // API key list hanya menampilkan active keys agar revoked credential tidak memenuhi UI awal.
      items: rows.slice(0, options.limit),
      nextCursor: rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.count),
    };
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
              'users.passwordChangeRequired',
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

  async markUsed(apiKeyId: string) {
    const now = new Date();
    const staleBefore = new Date(Date.now() - 60_000);

    await this.db
      .updateTable('api_keys')
      .set({
        lastUsedAt: now,
        updatedAt: now,
      })
      .where('id', '=', apiKeyId)
      .where((eb) => eb.or([eb('lastUsedAt', 'is', null), eb('lastUsedAt', '<', staleBefore)]))
      .execute();
  }

  revokeForUser(apiKeyId: string, userId: string) {
    const now = new Date();

    return this.db
      .updateTable('api_keys')
      .set({
        revokedAt: now,
        updatedAt: now,
      })
      .where('id', '=', apiKeyId)
      .where('userId', '=', userId)
      .where('revokedAt', 'is', null)
      .returning('id')
      .executeTakeFirst();
  }
}
