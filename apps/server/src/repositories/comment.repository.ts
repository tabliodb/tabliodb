import { Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
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
          parentCommentId: null,
          body: options.body,
          createdById: options.createdById,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return { thread, comment };
    });
  }

  async createCommentReply(options: {
    body: string;
    createdById: string;
    parentCommentId: string | null;
    threadId: string;
  }) {
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
          // Parent null keeps the existing flat-thread behavior; a UUID turns this row into a nested reply.
          parentCommentId: options.parentCommentId,
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

  getCommentInThread(commentId: string, threadId: string) {
    return this.db
      .selectFrom('comments')
      .select(['id', 'threadId', 'parentCommentId', 'deletedAt'])
      .where('id', '=', commentId)
      .where('threadId', '=', threadId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async getThreads(diagramId: string, options: CommentThreadListOptions & { userId: string }) {
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
        sql<number>`(
          SELECT count(*)::int
          FROM comments unread_comments
          LEFT JOIN comment_thread_reads read_state
            ON read_state.thread_id = comment_threads.id
            AND read_state.user_id = ${options.userId}
          WHERE unread_comments.thread_id = comment_threads.id
            AND unread_comments.deleted_at IS NULL
            AND unread_comments.created_by_id <> ${options.userId}
            AND unread_comments.created_at > coalesce(read_state.last_read_at, '-infinity'::timestamptz)
        )`.as('unreadCount'),
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
        'comments.parentCommentId',
        'comments.body',
        'comments.bodyFormat',
        'comments.createdById',
        'comments.editedAt',
        'comments.createdAt',
        'comments.updatedAt',
        'users.id as authorId',
        'users.email as authorEmail',
        'users.name as authorName',
        sql<string | null>`case
          when users.avatar_file_id is null then null
          else concat('/api/files/', users.avatar_file_id::text)
        end`.as('authorAvatarUrl'),
        'users.cursorColor as authorCursorColor',
        sql<number>`(
          SELECT count(*)::int
          FROM comments replies
          WHERE replies.parent_comment_id = comments.id
            AND replies.deleted_at IS NULL
        )`.as('replyCount'),
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

  async getThreadReadState(threadId: string, userId: string) {
    const readState = await this.db
      .selectFrom('comment_thread_reads')
      .select(['lastReadAt', 'lastReadCommentId', 'threadId', 'updatedAt', 'userId'])
      .where('threadId', '=', threadId)
      .where('userId', '=', userId)
      .executeTakeFirst();
    const unreadRow = await this.db
      .selectFrom('comment_threads')
      .select(
        sql<number>`(
          SELECT count(*)::int
          FROM comments unread_comments
          LEFT JOIN comment_thread_reads read_state
            ON read_state.thread_id = comment_threads.id
            AND read_state.user_id = ${userId}
          WHERE unread_comments.thread_id = comment_threads.id
            AND unread_comments.deleted_at IS NULL
            AND unread_comments.created_by_id <> ${userId}
            AND unread_comments.created_at > coalesce(read_state.last_read_at, '-infinity'::timestamptz)
        )`.as('count'),
      )
      .where('id', '=', threadId)
      .executeTakeFirstOrThrow();
    const readerRows = await this.db
      .selectFrom('comment_thread_reads')
      .innerJoin('users', 'users.id', 'comment_thread_reads.userId')
      .select([
        'comment_thread_reads.lastReadAt',
        'comment_thread_reads.lastReadCommentId',
        'comment_thread_reads.updatedAt',
        'users.id as userId',
        'users.email as userEmail',
        'users.name as userName',
        sql<string | null>`case
          when users.avatar_file_id is null then null
          else concat('/api/files/', users.avatar_file_id::text)
        end`.as('userAvatarUrl'),
        'users.cursorColor as userCursorColor',
      ])
      .where('comment_thread_reads.threadId', '=', threadId)
      .orderBy('comment_thread_reads.updatedAt', 'desc')
      .limit(8)
      .execute();
    const readerCountRow = await this.db
      .selectFrom('comment_thread_reads')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('threadId', '=', threadId)
      .executeTakeFirstOrThrow();

    return {
      readState,
      readers: readerRows,
      totalReaderCount: Number(readerCountRow.count),
      unreadCount: Number(unreadRow.count),
    };
  }

  async markThreadRead(threadId: string, userId: string) {
    const latestComment = await this.db
      .selectFrom('comments')
      .select(['createdAt', 'id'])
      .where('threadId', '=', threadId)
      .where('deletedAt', 'is', null)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .executeTakeFirst();
    const now = new Date();
    const lastReadAt = latestComment?.createdAt ?? now;
    const lastReadCommentId = latestComment?.id ?? null;

    return this.db
      .insertInto('comment_thread_reads')
      .values({
        lastReadAt,
        lastReadCommentId,
        threadId,
        updatedAt: now,
        userId,
      })
      .onConflict((conflict) =>
        conflict.columns(['threadId', 'userId']).doUpdateSet({
          lastReadAt,
          lastReadCommentId,
          updatedAt: now,
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
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
