import { Injectable } from '@nestjs/common';
import { Insertable, Kysely } from 'kysely';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, SessionTable } from '../schema/index.js';

@Injectable()
export class SessionRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  create(dto: Insertable<SessionTable>) {
    return this.db.insertInto('sessions').values(dto).returningAll().executeTakeFirstOrThrow();
  }

  getByToken(token: Buffer) {
    return this.db
      .selectFrom('sessions')
      .select((eb) => [
        'sessions.id',
        'sessions.updatedAt',
        jsonObjectFrom(
          eb
            .selectFrom('users')
            .select(['users.id', 'users.email', 'users.name', 'users.cursorColor'])
            .whereRef('users.id', '=', 'sessions.userId')
            .where('users.isDisabled', '=', false)
            .where('users.deletedAt', 'is', null),
        ).as('user'),
      ])
      .where('sessions.tokenHash', '=', token)
      .where('sessions.revokedAt', 'is', null)
      .where((eb) => eb.or([eb('sessions.expiresAt', 'is', null), eb('sessions.expiresAt', '>', new Date())]))
      .executeTakeFirst();
  }

  async delete(id: string): Promise<void> {
    await this.db.deleteFrom('sessions').where('id', '=', id).execute();
  }

  async revokeAllForUser(userId: string, options: { exceptSessionId?: string } = {}): Promise<number> {
    const now = new Date();
    const result = await this.db
      .updateTable('sessions')
      .set({
        revokedAt: now,
        updatedAt: now,
      })
      .where('userId', '=', userId)
      .where('revokedAt', 'is', null)
      .$if(Boolean(options.exceptSessionId), (query) => query.where('id', '!=', options.exceptSessionId!))
      .executeTakeFirst();

    // Kysely exposes affected rows as bigint for PostgreSQL, but the API contract should stay JSON-number friendly.
    return Number(result.numUpdatedRows);
  }
}
