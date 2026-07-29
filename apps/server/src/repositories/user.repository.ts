import { Injectable } from '@nestjs/common';
import { Insertable, Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, UserTable } from '../schema/index.js';

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

  getAuthUserById(id: string) {
    return this.db
      .selectFrom('users')
      .select(['id', 'email', 'name', 'avatarColor'])
      .where('id', '=', id)
      .where('isDisabled', '=', false)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  create(dto: Insertable<UserTable>) {
    return this.db.insertInto('users').values(dto).returningAll().executeTakeFirstOrThrow();
  }
}
