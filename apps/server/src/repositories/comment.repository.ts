import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB } from '../schema/index.js';
import { decodeOffsetCursor, encodeOffsetCursor } from '../utils/pagination.js';

export type CommentThreadListOptions = {
  cursor?: string;
  limit: number;
};

export type CommentListOptions = {
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

  async createCommentReply(options: { body: string; createdById: string; threadId: string }) {
    return this.db.transaction().execute(async (tx) => {
      const now = new Date();
      const thread = await tx
        .updateTable('comment_threads')
        .set({
          resolvedAt: null,
          resolvedById: null,
          status: 'open',
          updatedAt: now,
        })
        .where('id', '=', options.threadId)
        .returningAll()
        .executeTakeFirstOrThrow();

      const comment = await tx
        .insertInto('comments')
        .values({
          body: options.body,
          createdById: options.createdById,
          threadId: options.threadId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return { comment, thread };
    });
  }

  getThreadById(threadId: string) {
    return this.db.selectFrom('comment_threads').selectAll().where('id', '=', threadId).executeTakeFirst();
  }

  async getThreads(diagramId: string, options: CommentThreadListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await this.db
      .selectFrom('comment_threads')
      .select([
        'id',
        'diagramId',
        'targetType',
        'targetId',
        'status',
        'resolvedById',
        'resolvedAt',
        'createdById',
        'createdAt',
        'updatedAt',
      ])
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

  async getComments(threadId: string, options: CommentListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await this.db
      .selectFrom('comments')
      .innerJoin('users', 'users.id', 'comments.createdById')
      .select([
        'comments.id',
        'comments.threadId',
        'comments.body',
        'comments.bodyFormat',
        'comments.createdById',
        'comments.editedAt',
        'comments.createdAt',
        'comments.updatedAt',
        'users.id as authorId',
        'users.email as authorEmail',
        'users.name as authorName',
        'users.cursorColor as authorCursorColor',
      ])
      .where('comments.threadId', '=', threadId)
      .where('comments.deletedAt', 'is', null)
      .orderBy('comments.createdAt', 'asc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('comments')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('threadId', '=', threadId)
      .where('deletedAt', 'is', null)
      .executeTakeFirstOrThrow();

    return {
      // Reply list memakai cursor supaya thread panjang tetap bisa dibuka tanpa menarik seluruh diskusi sekaligus.
      items: rows.slice(0, options.limit),
      nextCursor: rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.count),
    };
  }

  resolveThread(threadId: string, resolvedById: string) {
    return this.db
      .updateTable('comment_threads')
      .set({
        resolvedAt: new Date(),
        resolvedById,
        status: 'resolved',
        updatedAt: new Date(),
      })
      .where('id', '=', threadId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  unresolveThread(threadId: string) {
    return this.db
      .updateTable('comment_threads')
      .set({
        resolvedAt: null,
        resolvedById: null,
        status: 'open',
        updatedAt: new Date(),
      })
      .where('id', '=', threadId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}
