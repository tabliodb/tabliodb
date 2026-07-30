import { Injectable } from '@nestjs/common';
import { Insertable, Kysely, sql } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, FileTable, FileVariantTable } from '../schema/index.js';

export const AVATAR_SERVE_VARIANT = 'avatar_128';

export type AvatarFileCreateOptions = Insertable<FileTable> & {
  id: string;
  kind: 'avatar';
  ownerId: string;
  status: 'ready';
};

export type AvatarFileVariantCreateOptions = Insertable<FileVariantTable> & {
  fileId: string;
  variant: typeof AVATAR_SERVE_VARIANT;
};

export type AvatarFileReplaceOptions = {
  file: AvatarFileCreateOptions;
  variants: AvatarFileVariantCreateOptions[];
};

type AvatarCleanupTarget = {
  id: string;
  storageKey: string;
  variantStorageKeys: string[];
};

@Injectable()
export class FileRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  async replaceUserAvatar(options: AvatarFileReplaceOptions) {
    return this.db.transaction().execute(async (tx) => {
      const now = new Date();
      // The user row is read inside the same transaction that inserts the new
      // file so the old avatar can be soft-deleted consistently.
      const currentUser = await tx
        .selectFrom('users')
        .select('avatarFileId')
        .where('id', '=', options.file.ownerId)
        .where('deletedAt', 'is', null)
        .executeTakeFirstOrThrow();

      const file = await tx.insertInto('files').values(options.file).returningAll().executeTakeFirstOrThrow();

      if (options.variants.length > 0) {
        await tx
          .insertInto('file_variants')
          .values(
            options.variants.map((variant) => ({
              ...variant,
              fileId: file.id,
            })),
          )
          .execute();
      }

      await tx
        .updateTable('users')
        .set({
          avatarFileId: file.id,
          updatedAt: now,
        })
        .where('id', '=', options.file.ownerId)
        .where('deletedAt', 'is', null)
        .execute();

      let oldFile: AvatarCleanupTarget | null = null;

      if (currentUser.avatarFileId) {
        const oldFileRow = await tx
          .updateTable('files')
          .set({
            deletedAt: now,
            updatedAt: now,
          })
          .where('id', '=', currentUser.avatarFileId)
          .where('kind', '=', 'avatar')
          .where('deletedAt', 'is', null)
          .returning(['id', 'storageKey'])
          .executeTakeFirst();

        if (oldFileRow) {
          const oldVariants = await tx
            .selectFrom('file_variants')
            .select('storageKey')
            .where('fileId', '=', oldFileRow.id)
            .execute();

          oldFile = {
            ...oldFileRow,
            variantStorageKeys: oldVariants.map((variant) => variant.storageKey),
          };
        }
      }

      return { file, oldFile };
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

      const oldFileRow = await tx
        .updateTable('files')
        .set({
          deletedAt: now,
          updatedAt: now,
        })
        .where('id', '=', currentUser.avatarFileId)
        .where('kind', '=', 'avatar')
        .where('deletedAt', 'is', null)
        .returning(['id', 'storageKey'])
        .executeTakeFirst();

      if (!oldFileRow) {
        return null;
      }

      const oldVariants = await tx
        .selectFrom('file_variants')
        .select('storageKey')
        .where('fileId', '=', oldFileRow.id)
        .execute();

      return {
        ...oldFileRow,
        variantStorageKeys: oldVariants.map((variant) => variant.storageKey),
      };
    });
  }

  getReadyAvatarById(fileId: string) {
    return this.db
      .selectFrom('files')
      .leftJoin('file_variants as avatar_variant', (join) =>
        join.onRef('avatar_variant.fileId', '=', 'files.id').on('avatar_variant.variant', '=', AVATAR_SERVE_VARIANT),
      )
      .select([
        'files.id',
        sql<string>`coalesce(avatar_variant.mime_type, files.mime_type)`.as('mimeType'),
        sql<string>`coalesce(avatar_variant.byte_size, files.byte_size)`.as('byteSize'),
        sql<string | null>`coalesce(avatar_variant.metadata ->> 'checksumSha256', files.checksum_sha256)`.as(
          'checksumSha256',
        ),
        sql<string>`coalesce(avatar_variant.storage_key, files.storage_key)`.as('storageKey'),
      ])
      .where('files.id', '=', fileId)
      .where('files.kind', '=', 'avatar')
      .where('files.status', '=', 'ready')
      .where('files.deletedAt', 'is', null)
      .executeTakeFirst();
  }
}
