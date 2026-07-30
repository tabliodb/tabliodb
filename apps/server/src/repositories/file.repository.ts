import { Injectable } from '@nestjs/common';
import { Insertable, Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, FileTable } from '../schema/index.js';

export type AvatarFileCreateOptions = Insertable<FileTable> & {
  id: string;
  kind: 'avatar';
  ownerId: string;
  status: 'ready';
};

@Injectable()
export class FileRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  async replaceUserAvatar(options: AvatarFileCreateOptions) {
    return this.db.transaction().execute(async (tx) => {
      const now = new Date();
      // The user row is read inside the same transaction that inserts the new
      // file so the old avatar can be soft-deleted consistently.
      const currentUser = await tx
        .selectFrom('users')
        .select('avatarFileId')
        .where('id', '=', options.ownerId)
        .where('deletedAt', 'is', null)
        .executeTakeFirstOrThrow();

      const file = await tx.insertInto('files').values(options).returningAll().executeTakeFirstOrThrow();

      await tx
        .updateTable('users')
        .set({
          avatarFileId: file.id,
          updatedAt: now,
        })
        .where('id', '=', options.ownerId)
        .where('deletedAt', 'is', null)
        .execute();

      const oldFile = currentUser.avatarFileId
        ? await tx
            .updateTable('files')
            .set({
              deletedAt: now,
              updatedAt: now,
            })
            .where('id', '=', currentUser.avatarFileId)
            .where('kind', '=', 'avatar')
            .where('deletedAt', 'is', null)
            .returning(['id', 'storageKey'])
            .executeTakeFirst()
        : null;

      return { file, oldFile: oldFile ?? null };
    });
  }

  async clearUserAvatar(userId: string) {
    return this.db.transaction().execute(async (tx) => {
      const now = new Date();
      const currentUser = await tx
        .selectFrom('users')
        .select('avatarFileId')
        .where('id', '=', userId)
        .where('deletedAt', 'is', null)
        .executeTakeFirstOrThrow();

      await tx
        .updateTable('users')
        .set({
          avatarFileId: null,
          updatedAt: now,
        })
        .where('id', '=', userId)
        .where('deletedAt', 'is', null)
        .execute();

      if (!currentUser.avatarFileId) {
        return null;
      }

      return (
        (await tx
          .updateTable('files')
          .set({
            deletedAt: now,
            updatedAt: now,
          })
          .where('id', '=', currentUser.avatarFileId)
          .where('kind', '=', 'avatar')
          .where('deletedAt', 'is', null)
          .returning(['id', 'storageKey'])
          .executeTakeFirst()) ?? null
      );
    });
  }

  getReadyAvatarById(fileId: string) {
    return this.db
      .selectFrom('files')
      .select(['id', 'mimeType', 'byteSize', 'checksumSha256', 'storageKey'])
      .where('id', '=', fileId)
      .where('kind', '=', 'avatar')
      .where('status', '=', 'ready')
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }
}
