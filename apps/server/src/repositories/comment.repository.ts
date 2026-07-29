import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB } from '../schema/index.js';
import { decodeOffsetCursor, encodeOffsetCursor } from '../utils/pagination.js';

export type CommentThreadListOptions = {
  cursor?: string;
  limit: number;
};

@Injectable()
export class CommentRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  createThreadWithComment(options: {
    diagramId: string;
    targetType: string;
    targetId: string | null;
    body: string;
    createdById: string;
  }) {
    return this.db.transaction().execute(async (tx) => {
      const thread = await tx
        .insertInto('comment_threads')
        .values({
          diagramId: options.diagramId,
          targetType: options.targetType,
          targetId: options.targetId,
          createdById: options.createdById,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const comment = await tx
        .insertInto('comments')
        .values({
          threadId: thread.id,
          body: options.body,
          createdById: options.createdById,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return { thread, comment };
    });
  }

  async getThreads(diagramId: string, options: CommentThreadListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await this.db
      .selectFrom('comment_threads')
      .select(['id', 'diagramId', 'targetType', 'targetId', 'status', 'resolvedAt', 'createdAt', 'updatedAt'])
      .where('diagramId', '=', diagramId)
      .orderBy('updatedAt', 'desc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('comment_threads')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('diagramId', '=', diagramId)
      .executeTakeFirstOrThrow();

    return {
      // Thread komentar bisa panjang pada review besar, jadi API-nya sudah disiapkan paginated.
      items: rows.slice(0, options.limit),
      nextCursor: rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.count),
    };
  }
}
