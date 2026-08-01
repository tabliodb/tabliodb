import { Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, JsonValue } from '../schema/index.js';
import { decodeOffsetCursor, encodeOffsetCursor } from '../utils/pagination.js';

export type CommentThreadListOptions = {
  cursor?: string;
  limit: number;
};

export type CommentListOptions = {
  cursor?: string;
  limit: number;
  parentCommentId?: string | null;
};

@Injectable()
export class CommentRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  createThreadWithComment(options: {
    bodyJson: JsonValue;
    bodyText: string;
    diagramId: string;
    targetType: string;
    targetId: string | null;
    createdById: string;
    mentionUserIds: string[];
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
          bodyFormat: 'lexical',
          bodyJson: options.bodyJson,
          bodyText: options.bodyText,
          createdById: options.createdById,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      if (options.mentionUserIds.length > 0) {
        await tx
          .insertInto('comment_mentions')
          .values(options.mentionUserIds.map((mentionedUserId) => ({ commentId: comment.id, mentionedUserId })))
          .onConflict((conflict) => conflict.columns(['commentId', 'mentionedUserId']).doNothing())
          .execute();
      }

      return { thread, comment };
    });
  }

  async createCommentReply(options: {
    bodyJson: JsonValue;
    bodyText: string;
    createdById: string;
    mentionUserIds: string[];
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
          bodyFormat: 'lexical',
          bodyJson: options.bodyJson,
          bodyText: options.bodyText,
          createdById: options.createdById,
          // Parent null keeps the existing flat-thread behavior; a UUID turns this row into a nested reply.
          parentCommentId: options.parentCommentId,
          threadId: options.threadId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      if (options.mentionUserIds.length > 0) {
        await tx
          .insertInto('comment_mentions')
          .values(options.mentionUserIds.map((mentionedUserId) => ({ commentId: comment.id, mentionedUserId })))
          .onConflict((conflict) => conflict.columns(['commentId', 'mentionedUserId']).doNothing())
          .execute();
      }

      return { comment, thread };
    });
  }

  getThreadById(threadId: string) {
    return this.db.selectFrom('comment_threads').selectAll().where('id', '=', threadId).executeTakeFirst();
  }

  getThreadWithScope(threadId: string) {
    return this.db
      .selectFrom('comment_threads')
      .innerJoin('diagrams', 'diagrams.id', 'comment_threads.diagramId')
      .innerJoin('projects', 'projects.id', 'diagrams.projectId')
      .select([
        'comment_threads.id',
        'comment_threads.diagramId',
        'comment_threads.targetType',
        'comment_threads.targetId',
        'comment_threads.status',
        'comment_threads.resolvedById',
        'comment_threads.resolvedAt',
        'comment_threads.createdById',
        'comment_threads.createdAt',
        'comment_threads.updatedAt',
        'diagrams.projectId',
        'projects.organizationId',
      ])
      .where('comment_threads.id', '=', threadId)
      .executeTakeFirst();
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

  getCommentWithThread(commentId: string) {
    return this.db
      .selectFrom('comments')
      .innerJoin('comment_threads', 'comment_threads.id', 'comments.threadId')
      .innerJoin('diagrams', 'diagrams.id', 'comment_threads.diagramId')
      .innerJoin('projects', 'projects.id', 'diagrams.projectId')
      .select([
        'comments.id',
        'comments.threadId',
        'comments.parentCommentId',
        'comments.createdById',
        'comments.deletedAt',
        'comment_threads.diagramId',
        'diagrams.projectId',
        'projects.organizationId',
      ])
      .where('comments.id', '=', commentId)
      .where('comments.deletedAt', 'is', null)
      .executeTakeFirst();
  }

  getCommentThreadScope(commentId: string) {
    return this.db
      .selectFrom('comments')
      .innerJoin('comment_threads', 'comment_threads.id', 'comments.threadId')
      .innerJoin('diagrams', 'diagrams.id', 'comment_threads.diagramId')
      .innerJoin('projects', 'projects.id', 'diagrams.projectId')
      .select([
        'comments.id',
        'comments.threadId',
        'comments.deletedAt',
        'comment_threads.diagramId',
        'diagrams.projectId',
        'projects.organizationId',
      ])
      // Replies to deleted tombstones still need to be readable so the nested tree does not collapse.
      .where('comments.id', '=', commentId)
      .executeTakeFirst();
  }

  updateComment(options: {
    bodyJson: JsonValue;
    bodyText: string;
    commentId: string;
    editedById: string;
    mentionUserIds: string[];
  }) {
    return this.db.transaction().execute(async (tx) => {
      const now = new Date();
      const previousComment = await tx
        .selectFrom('comments')
        .select(['id', 'bodyJson', 'bodyText', 'bodyFormat'])
        .where('id', '=', options.commentId)
        .where('deletedAt', 'is', null)
        .executeTakeFirstOrThrow();

      await tx
        .insertInto('comment_edit_history')
        .values({
          bodyFormat: 'lexical',
          commentId: previousComment.id,
          editedById: options.editedById,
          nextBodyJson: options.bodyJson,
          nextBodyText: options.bodyText,
          previousBodyJson: previousComment.bodyJson,
          previousBodyText: previousComment.bodyText,
        })
        .execute();

      const comment = await tx
        .updateTable('comments')
        .set({
          bodyJson: options.bodyJson,
          bodyText: options.bodyText,
          editedAt: now,
          updatedAt: now,
        })
        .where('id', '=', options.commentId)
        .where('deletedAt', 'is', null)
        .returningAll()
        .executeTakeFirstOrThrow();

      // Mentions are derived from the current sanitized body; replacing rows prevents stale notifications/inbox state.
      await tx.deleteFrom('comment_mentions').where('commentId', '=', options.commentId).execute();

      if (options.mentionUserIds.length > 0) {
        await tx
          .insertInto('comment_mentions')
          .values(options.mentionUserIds.map((mentionedUserId) => ({ commentId: comment.id, mentionedUserId })))
          .onConflict((conflict) => conflict.columns(['commentId', 'mentionedUserId']).doNothing())
          .execute();
      }

      const replyCountRow = await tx
        .selectFrom('comments')
        .select((eb) => eb.fn.countAll<number>().as('count'))
        .where('parentCommentId', '=', comment.id)
        .where('deletedAt', 'is', null)
        .executeTakeFirstOrThrow();

      return {
        ...comment,
        replyCount: Number(replyCountRow.count),
      };
    });
  }

  async deleteComment(commentId: string) {
    return this.db.transaction().execute(async (tx) => {
      const now = new Date();
      const comment = await tx
        .updateTable('comments')
        .set({
          deletedAt: now,
          updatedAt: now,
        })
        .where('id', '=', commentId)
        .where('deletedAt', 'is', null)
        .returning(['id', 'threadId'])
        .executeTakeFirstOrThrow();

      // Deleted comments are hidden as tombstones, so mention rows should no longer feed mention inbox/notifications.
      await tx.deleteFrom('comment_mentions').where('commentId', '=', commentId).execute();
      await tx.updateTable('comment_threads').set({ updatedAt: now }).where('id', '=', comment.threadId).execute();
    });
  }

  getMentionableUsersForDiagram(diagramId: string) {
    return this.db
      .selectFrom('diagrams')
      .innerJoin('project_members', 'project_members.projectId', 'diagrams.projectId')
      .innerJoin('users', 'users.id', 'project_members.userId')
      .select(['project_members.userId', 'users.email', 'users.name'])
      .where('diagrams.id', '=', diagramId)
      .where('diagrams.archivedAt', 'is', null)
      .where('users.deletedAt', 'is', null)
      .execute();
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

  async getDiagramSummary(diagramId: string, userId: string) {
    const summaryRow = await this.db
      .selectFrom('comment_threads')
      .select([
        sql<number>`count(*)::int`.as('totalCount'),
        sql<number>`count(*) filter (where status = 'open')::int`.as('openCount'),
        sql<number>`count(*) filter (where status = 'resolved')::int`.as('resolvedCount'),
        sql<Date | null>`max(updated_at)`.as('updatedAt'),
      ])
      .where('diagramId', '=', diagramId)
      .executeTakeFirstOrThrow();
    const targetRows = await this.db
      .selectFrom('comment_threads')
      .select([
        'targetId',
        'targetType',
        sql<number>`count(*)::int`.as('totalCount'),
        sql<number>`count(*) filter (where status = 'open')::int`.as('openCount'),
        sql<number>`count(*) filter (where status = 'resolved')::int`.as('resolvedCount'),
        sql<Date | null>`max(updated_at)`.as('updatedAt'),
      ])
      .where('diagramId', '=', diagramId)
      .groupBy(['targetType', 'targetId'])
      .execute();
    const targetUnreadRows = await this.db
      .selectFrom('comment_threads')
      .innerJoin('comments', 'comments.threadId', 'comment_threads.id')
      .leftJoin('comment_thread_reads', (join) =>
        join
          .onRef('comment_thread_reads.threadId', '=', 'comment_threads.id')
          .on('comment_thread_reads.userId', '=', userId),
      )
      .select([
        'comment_threads.targetId',
        'comment_threads.targetType',
        sql<number>`count(comments.id)::int`.as('unreadCount'),
      ])
      .where('comment_threads.diagramId', '=', diagramId)
      .where('comments.deletedAt', 'is', null)
      .where('comments.createdById', '<>', userId)
      .where(sql<boolean>`comments.created_at > coalesce(comment_thread_reads.last_read_at, '-infinity'::timestamptz)`)
      .groupBy(['comment_threads.targetType', 'comment_threads.targetId'])
      .execute();
    const unreadCountByTarget = new Map(
      targetUnreadRows.map((row) => [
        createCommentTargetSummaryKey(row.targetType, row.targetId),
        Number(row.unreadCount),
      ]),
    );
    const targets = targetRows.map((row) => ({
      ...row,
      openCount: Number(row.openCount),
      resolvedCount: Number(row.resolvedCount),
      totalCount: Number(row.totalCount),
      unreadCount: unreadCountByTarget.get(createCommentTargetSummaryKey(row.targetType, row.targetId)) ?? 0,
    }));

    return {
      openCount: Number(summaryRow.openCount),
      resolvedCount: Number(summaryRow.resolvedCount),
      targets,
      totalCount: Number(summaryRow.totalCount),
      // Summary unread dihitung dari agregasi target agar canvas dan toolbar berbagi satu sumber angka.
      unreadCount: targets.reduce((total, target) => total + target.unreadCount, 0),
      updatedAt: summaryRow.updatedAt,
    };
  }

  async getComments(threadId: string, options: CommentListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const parentFilter = createCommentParentFilter(options.parentCommentId);
    const rows = await this.db
      .selectFrom('comments')
      .innerJoin('users', 'users.id', 'comments.createdById')
      .select([
        'comments.id',
        'comments.threadId',
        'comments.parentCommentId',
        'comments.bodyJson',
        'comments.bodyText',
        'comments.bodyFormat',
        'comments.createdById',
        'comments.deletedAt',
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
        sql<string[]>`coalesce(
          (
            SELECT array_agg(comment_mentions.mentioned_user_id ORDER BY comment_mentions.created_at ASC)
            FROM comment_mentions
            WHERE comment_mentions.comment_id = comments.id
          ),
          '{}'::uuid[]
        )`.as('mentionedUserIds'),
      ])
      .where('comments.threadId', '=', threadId)
      .where(parentFilter)
      .orderBy('comments.createdAt', 'asc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('comments')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('threadId', '=', threadId)
      .where(parentFilter)
      .executeTakeFirstOrThrow();

    return {
      // Reply list memakai cursor dan parent filter supaya UI nested tidak perlu menarik seluruh thread sekaligus.
      items: rows.slice(0, options.limit),
      nextCursor: rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.count),
    };
  }

  getCommentForResponse(commentId: string) {
    return this.createCommentResponseQuery().where('comments.id', '=', commentId).executeTakeFirst();
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

  private createCommentResponseQuery() {
    return this.db
      .selectFrom('comments')
      .innerJoin('users', 'users.id', 'comments.createdById')
      .select([
        'comments.id',
        'comments.threadId',
        'comments.parentCommentId',
        'comments.bodyJson',
        'comments.bodyText',
        'comments.bodyFormat',
        'comments.createdById',
        'comments.deletedAt',
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
        sql<string[]>`coalesce(
          (
            SELECT array_agg(comment_mentions.mentioned_user_id ORDER BY comment_mentions.created_at ASC)
            FROM comment_mentions
            WHERE comment_mentions.comment_id = comments.id
          ),
          '{}'::uuid[]
        )`.as('mentionedUserIds'),
      ]);
  }
}

function createCommentTargetSummaryKey(targetType: string, targetId: string | null): string {
  return `${targetType}:${targetId ?? 'diagram'}`;
}

function createCommentParentFilter(parentCommentId: string | null | undefined) {
  if (parentCommentId === undefined) {
    return sql<boolean>`true`;
  }

  if (parentCommentId === null) {
    return sql<boolean>`comments.parent_comment_id is null`;
  }

  return sql<boolean>`comments.parent_comment_id = ${parentCommentId}`;
}
