import { Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, JsonValue } from '../schema/index.js';
import { decodeOffsetCursor, encodeOffsetCursor } from '../utils/pagination.js';

export type NotificationInboxItemKind = 'mention' | 'reply';

export type NotificationInboxOptions = {
  cursor?: string;
  limit: number;
  userId: string;
};

export type NotificationInboxRow = {
  authorAvatarUrl: string | null;
  authorCursorColor: string;
  authorEmail: string;
  authorId: string;
  authorName: string;
  commentBodyFormat: 'lexical';
  commentBodyJson: JsonValue;
  commentBodyText: string;
  commentCreatedAt: Date;
  commentCreatedById: string;
  commentDeletedAt: Date | null;
  commentEditedAt: Date | null;
  commentId: string;
  commentMentionedUserIds: string[];
  commentParentCommentId: string | null;
  commentReplyCount: number;
  commentThreadId: string;
  commentUpdatedAt: Date;
  createdAt: Date;
  diagramDialect: string;
  diagramId: string;
  diagramName: string;
  id: string;
  isUnread: boolean;
  parentAuthorAvatarUrl: string | null;
  parentAuthorCursorColor: string | null;
  parentAuthorEmail: string | null;
  parentAuthorId: string | null;
  parentAuthorName: string | null;
  parentCommentBodyText: string | null;
  parentCommentId: string | null;
  projectId: string;
  projectName: string;
  projectSlug: string;
  threadId: string;
  threadStatus: 'open' | 'resolved';
  threadTargetId: string | null;
  threadTargetType: string;
  threadUpdatedAt: Date;
  type: NotificationInboxItemKind;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
};

export type NotificationSummaryRow = {
  totalCount: number;
  unreadCount: number;
  updatedAt: Date | null;
};

@Injectable()
export class NotificationRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  async getInbox(options: NotificationInboxOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await sql<NotificationInboxRow>`
      WITH inbox AS (
        ${this.createMentionInboxSql(options.userId)}
        UNION ALL
        ${this.createReplyInboxSql(options.userId)}
      )
      SELECT *
      FROM inbox
      ORDER BY "createdAt" DESC, "commentId" DESC, "type" ASC
      LIMIT ${options.limit + 1}
      OFFSET ${offset}
    `.execute(this.db);
    const totalRow = await this.getSummary(options.userId);

    return {
      items: rows.rows.slice(0, options.limit),
      nextCursor: rows.rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: totalRow.totalCount,
    };
  }

  async getSummary(userId: string): Promise<NotificationSummaryRow> {
    const result = await sql<NotificationSummaryRow>`
      WITH inbox AS (
        ${this.createMentionInboxSql(userId)}
        UNION ALL
        ${this.createReplyInboxSql(userId)}
      )
      SELECT
        count(*)::int AS "totalCount",
        count(*) FILTER (WHERE "isUnread")::int AS "unreadCount",
        max("createdAt") AS "updatedAt"
      FROM inbox
    `.execute(this.db);

    return result.rows[0] ?? { totalCount: 0, unreadCount: 0, updatedAt: null };
  }

  private createMentionInboxSql(userId: string) {
    return sql<NotificationInboxRow>`
      SELECT
        concat('mention:', comments.id::text, ':', comment_mentions.mentioned_user_id::text) AS "id",
        'mention'::text AS "type",
        comment_mentions.created_at AS "createdAt",
        (
          comments.created_at > coalesce(comment_thread_reads.last_read_at, '-infinity'::timestamptz)
        ) AS "isUnread",
        ${this.createCommonInboxSelectSql()}
      FROM comment_mentions
      INNER JOIN comments ON comments.id = comment_mentions.comment_id
      ${this.createCommonInboxJoinSql(userId)}
      WHERE comment_mentions.mentioned_user_id = ${userId}
        AND comments.created_by_id <> ${userId}
        AND comments.deleted_at IS NULL
        AND diagrams.archived_at IS NULL
        AND projects.archived_at IS NULL
    `;
  }

  private createReplyInboxSql(userId: string) {
    return sql<NotificationInboxRow>`
      SELECT
        concat('reply:', comments.id::text, ':', ${userId}::uuid::text) AS "id",
        'reply'::text AS "type",
        comments.created_at AS "createdAt",
        (
          comments.created_at > coalesce(comment_thread_reads.last_read_at, '-infinity'::timestamptz)
        ) AS "isUnread",
        ${this.createCommonInboxSelectSql()}
      FROM comments
      ${this.createCommonInboxJoinSql(userId)}
      WHERE comments.parent_comment_id IS NOT NULL
        AND parent_comments.created_by_id = ${userId}
        AND comments.created_by_id <> ${userId}
        AND comments.deleted_at IS NULL
        AND parent_comments.deleted_at IS NULL
        AND diagrams.archived_at IS NULL
        AND projects.archived_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM comment_mentions mention_dedupe
          WHERE mention_dedupe.comment_id = comments.id
            AND mention_dedupe.mentioned_user_id = ${userId}
        )
    `;
  }

  private createCommonInboxSelectSql() {
    return sql`
        projects.id AS "projectId",
        projects.name AS "projectName",
        projects.slug AS "projectSlug",
        organizations.id AS "organizationId",
        organizations.name AS "organizationName",
        organizations.slug AS "organizationSlug",
        diagrams.id AS "diagramId",
        diagrams.name AS "diagramName",
        diagrams.dialect AS "diagramDialect",
        comment_threads.id AS "threadId",
        comment_threads.target_type AS "threadTargetType",
        comment_threads.target_id AS "threadTargetId",
        comment_threads.status AS "threadStatus",
        comment_threads.updated_at AS "threadUpdatedAt",
        comments.id AS "commentId",
        comments.thread_id AS "commentThreadId",
        comments.parent_comment_id AS "commentParentCommentId",
        comments.body_json AS "commentBodyJson",
        comments.body_text AS "commentBodyText",
        comments.body_format AS "commentBodyFormat",
        comments.created_by_id AS "commentCreatedById",
        comments.deleted_at AS "commentDeletedAt",
        comments.edited_at AS "commentEditedAt",
        comments.created_at AS "commentCreatedAt",
        comments.updated_at AS "commentUpdatedAt",
        users.id AS "authorId",
        users.email AS "authorEmail",
        users.name AS "authorName",
        CASE
          WHEN users.avatar_file_id IS NULL THEN NULL
          ELSE concat('/api/files/', users.avatar_file_id::text)
        END AS "authorAvatarUrl",
        users.cursor_color AS "authorCursorColor",
        (
          SELECT count(*)::int
          FROM comments replies
          WHERE replies.parent_comment_id = comments.id
            AND replies.deleted_at IS NULL
        ) AS "commentReplyCount",
        coalesce(
          (
            SELECT array_agg(comment_mentions_for_comment.mentioned_user_id ORDER BY comment_mentions_for_comment.created_at ASC)
            FROM comment_mentions comment_mentions_for_comment
            WHERE comment_mentions_for_comment.comment_id = comments.id
          ),
          '{}'::uuid[]
        ) AS "commentMentionedUserIds",
        parent_comments.id AS "parentCommentId",
        parent_comments.body_text AS "parentCommentBodyText",
        parent_users.id AS "parentAuthorId",
        parent_users.email AS "parentAuthorEmail",
        parent_users.name AS "parentAuthorName",
        CASE
          WHEN parent_users.avatar_file_id IS NULL THEN NULL
          ELSE concat('/api/files/', parent_users.avatar_file_id::text)
        END AS "parentAuthorAvatarUrl",
        parent_users.cursor_color AS "parentAuthorCursorColor"
    `;
  }

  private createCommonInboxJoinSql(userId: string) {
    return sql`
      INNER JOIN users ON users.id = comments.created_by_id
      INNER JOIN comment_threads ON comment_threads.id = comments.thread_id
      INNER JOIN diagrams ON diagrams.id = comment_threads.diagram_id
      INNER JOIN projects ON projects.id = diagrams.project_id
      INNER JOIN organizations ON organizations.id = projects.organization_id
      INNER JOIN project_members ON project_members.project_id = projects.id
        AND project_members.user_id = ${userId}
      LEFT JOIN comment_thread_reads ON comment_thread_reads.thread_id = comment_threads.id
        AND comment_thread_reads.user_id = ${userId}
      LEFT JOIN comments parent_comments ON parent_comments.id = comments.parent_comment_id
      LEFT JOIN users parent_users ON parent_users.id = parent_comments.created_by_id
    `;
  }
}
