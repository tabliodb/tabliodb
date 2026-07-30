import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB } from '../schema/index.js';

export type PasswordResetTokenCreateOptions = {
  expiresAt: Date;
  tokenHash: Buffer;
  userId: string;
};

export type ConsumedPasswordResetToken = {
  email: string;
  id: string;
  name: string;
  userId: string;
};

@Injectable()
export class PasswordResetRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  async createForUser(options: PasswordResetTokenCreateOptions) {
    const now = new Date();

    return this.db.transaction().execute(async (tx) => {
      await tx
        .updateTable('password_reset_tokens')
        .set({ revokedAt: now })
        .where('userId', '=', options.userId)
        .where('consumedAt', 'is', null)
        .where('revokedAt', 'is', null)
        .execute();

      return tx
        .insertInto('password_reset_tokens')
        .values({
          expiresAt: options.expiresAt,
          tokenHash: options.tokenHash,
          userId: options.userId,
        })
        .returning(['id', 'expiresAt'])
        .executeTakeFirstOrThrow();
    });
  }

  async consumeValidToken(tokenHash: Buffer): Promise<ConsumedPasswordResetToken | undefined> {
    const now = new Date();

    return this.db.transaction().execute(async (tx) => {
      const token = await tx
        .selectFrom('password_reset_tokens')
        .innerJoin('users', 'users.id', 'password_reset_tokens.userId')
        .select(['password_reset_tokens.id', 'password_reset_tokens.userId', 'users.email', 'users.name'])
        .where('password_reset_tokens.tokenHash', '=', tokenHash)
        .where('password_reset_tokens.consumedAt', 'is', null)
        .where('password_reset_tokens.revokedAt', 'is', null)
        .where('password_reset_tokens.expiresAt', '>', now)
        .where('users.isDisabled', '=', false)
        .where('users.deletedAt', 'is', null)
        .forUpdate()
        .executeTakeFirst();

      if (!token) {
        return undefined;
      }

      await tx
        .updateTable('password_reset_tokens')
        .set({ consumedAt: now })
        .where('id', '=', token.id)
        .where('consumedAt', 'is', null)
        .execute();

      return token;
    });
  }
}
