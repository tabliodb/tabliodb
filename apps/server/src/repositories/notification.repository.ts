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

export type CommentNotificationDeliveryRecipients = {
  mentionUserIds: string[];
  replyUserId: string | null;
};

export type CommentNotificationDeliveryRecipient = {
  email: string;
  name: string;
  reasons: NotificationInboxItemKind[];
  userId: string;
};

export type CommentNotificationDeliveryContext = {
  actorEmail: string;
  actorName: string;
  commentBodyText: string;
  commentCreatedAt: Date;
  commentId: string;
  diagramId: string;
  diagramName: string;
  organizationName: string;
  organizationSlug: string;
  projectId: string;
  projectName: string;
  threadId: string;
  recipients: CommentNotificationDeliveryRecipient[];
};

type CommentNotificationDeliveryContextRow = Omit<CommentNotificationDeliveryContext, 'recipients'>;

type CommentNotificationDeliveryRecipientRow = {
  email: string;
  name: string;
  reason: NotificationInboxItemKind;
  userId: string;
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

  async getCommentDeliveryRecipients(options: {
    actorId: string;
    commentId: string;
  }): Promise<CommentNotificationDeliveryRecipients> {
    const mentionRows = await sql<{ mentionedUserId: string }>`
      SELECT DISTINCT comment_mentions.mentioned_user_id AS "mentionedUserId"
      FROM comment_mentions
      INNER JOIN comments ON comments.id = comment_mentions.comment_id
      INNER JOIN comment_threads ON comment_threads.id = comments.thread_id
      INNER JOIN diagrams ON diagrams.id = comment_threads.diagram_id
      INNER JOIN projects ON projects.id = diagrams.project_id
      INNER JOIN users ON users.id = comment_mentions.mentioned_user_id
      WHERE comment_mentions.comment_id = ${options.commentId}
        AND comment_mentions.mentioned_user_id <> ${options.actorId}
        AND comments.deleted_at IS NULL
        AND diagrams.archived_at IS NULL
        AND projects.archived_at IS NULL
        AND users.deleted_at IS NULL
        AND ${this.createProjectAccessExistsSql(sql.ref('comment_mentions.mentioned_user_id'))}
    `.execute(this.db);
    const replyRow = await sql<{ replyUserId: string }>`
      SELECT parent_comments.created_by_id AS "replyUserId"
      FROM comments
      INNER JOIN comments parent_comments ON parent_comments.id = comments.parent_comment_id
      INNER JOIN comment_threads ON comment_threads.id = comments.thread_id
      INNER JOIN diagrams ON diagrams.id = comment_threads.diagram_id
      INNER JOIN projects ON projects.id = diagrams.project_id
      INNER JOIN users ON users.id = parent_comments.created_by_id
      WHERE comments.id = ${options.commentId}
        AND comments.created_by_id = ${options.actorId}
        AND parent_comments.created_by_id <> ${options.actorId}
        AND comments.deleted_at IS NULL
        AND parent_comments.deleted_at IS NULL
        AND diagrams.archived_at IS NULL
        AND projects.archived_at IS NULL
        AND users.deleted_at IS NULL
        AND ${this.createProjectAccessExistsSql(sql.ref('parent_comments.created_by_id'))}
    `.execute(this.db);

    return {
      // Mentions and direct-reply recipient are separated so future email/websocket templates can explain why a user was notified.
      mentionUserIds: [...new Set(mentionRows.rows.map((row) => row.mentionedUserId))],
      replyUserId: replyRow.rows[0]?.replyUserId ?? null,
    };
  }

  async getCommentNotificationDelivery(options: {
    actorId: string;
    commentId: string;
  }): Promise<CommentNotificationDeliveryContext | null> {
    const contextResult = await sql<CommentNotificationDeliveryContextRow>`
      SELECT
        comments.id AS "commentId",
        comments.body_text AS "commentBodyText",
        comments.created_at AS "commentCreatedAt",
        comment_threads.id AS "threadId",
        diagrams.id AS "diagramId",
        diagrams.name AS "diagramName",
        projects.id AS "projectId",
        projects.name AS "projectName",
        organizations.name AS "organizationName",
        organizations.slug AS "organizationSlug",
        users.email AS "actorEmail",
        users.name AS "actorName"
      FROM comments
      INNER JOIN users ON users.id = comments.created_by_id
      INNER JOIN comment_threads ON comment_threads.id = comments.thread_id
      INNER JOIN diagrams ON diagrams.id = comment_threads.diagram_id
      INNER JOIN projects ON projects.id = diagrams.project_id
      INNER JOIN organizations ON organizations.id = projects.organization_id
      WHERE comments.id = ${options.commentId}
        AND comments.created_by_id = ${options.actorId}
        AND comments.deleted_at IS NULL
        AND diagrams.archived_at IS NULL
        AND projects.archived_at IS NULL
        AND users.deleted_at IS NULL
    `.execute(this.db);
    const context = contextResult.rows[0] ?? null;

    if (!context) {
      return null;
    }

    const recipientResult = await sql<CommentNotificationDeliveryRecipientRow>`
      SELECT *
      FROM (
        SELECT DISTINCT
          comment_mentions.mentioned_user_id AS "userId",
          recipient_users.email AS "email",
          recipient_users.name AS "name",
          'mention'::text AS "reason"
        FROM comment_mentions
        INNER JOIN comments ON comments.id = comment_mentions.comment_id
        INNER JOIN comment_threads ON comment_threads.id = comments.thread_id
        INNER JOIN diagrams ON diagrams.id = comment_threads.diagram_id
        INNER JOIN projects ON projects.id = diagrams.project_id
        INNER JOIN users recipient_users ON recipient_users.id = comment_mentions.mentioned_user_id
        WHERE comment_mentions.comment_id = ${options.commentId}
          AND comment_mentions.mentioned_user_id <> ${options.actorId}
          AND comments.deleted_at IS NULL
          AND diagrams.archived_at IS NULL
          AND projects.archived_at IS NULL
          AND recipient_users.deleted_at IS NULL
          AND ${this.createProjectAccessExistsSql(sql.ref('comment_mentions.mentioned_user_id'))}
        UNION ALL
        SELECT
          parent_comments.created_by_id AS "userId",
          parent_users.email AS "email",
          parent_users.name AS "name",
          'reply'::text AS "reason"
        FROM comments
        INNER JOIN comments parent_comments ON parent_comments.id = comments.parent_comment_id
        INNER JOIN comment_threads ON comment_threads.id = comments.thread_id
        INNER JOIN diagrams ON diagrams.id = comment_threads.diagram_id
        INNER JOIN projects ON projects.id = diagrams.project_id
        INNER JOIN users parent_users ON parent_users.id = parent_comments.created_by_id
        WHERE comments.id = ${options.commentId}
          AND comments.created_by_id = ${options.actorId}
          AND parent_comments.created_by_id <> ${options.actorId}
          AND comments.deleted_at IS NULL
          AND parent_comments.deleted_at IS NULL
          AND diagrams.archived_at IS NULL
          AND projects.archived_at IS NULL
          AND parent_users.deleted_at IS NULL
          AND ${this.createProjectAccessExistsSql(sql.ref('parent_comments.created_by_id'))}
          AND NOT EXISTS (
            SELECT 1
            FROM comment_mentions mention_dedupe
            WHERE mention_dedupe.comment_id = comments.id
              AND mention_dedupe.mentioned_user_id = parent_comments.created_by_id
          )
      ) recipients
      ORDER BY "email" ASC
    `.execute(this.db);

    return {
      ...context,
      recipients: mergeNotificationRecipients(recipientResult.rows),
    };
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
        AND ${this.createProjectAccessExistsSql(userId)}
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
        AND ${this.createProjectAccessExistsSql(userId)}
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
      LEFT JOIN comment_thread_reads ON comment_thread_reads.thread_id = comment_threads.id
        AND comment_thread_reads.user_id = ${userId}
      LEFT JOIN comments parent_comments ON parent_comments.id = comments.parent_comment_id
      LEFT JOIN users parent_users ON parent_users.id = parent_comments.created_by_id
    `;
  }

  private createProjectAccessExistsSql(userId: string | ReturnType<typeof sql.ref>) {
    return sql`
      (
        EXISTS (
          SELECT 1
          FROM project_members access_project_members
          WHERE access_project_members.project_id = projects.id
            AND access_project_members.user_id = ${userId}
        )
        OR EXISTS (
          SELECT 1
          FROM project_team_access
          INNER JOIN team_members ON team_members.team_id = project_team_access.team_id
          INNER JOIN teams ON teams.id = project_team_access.team_id
          WHERE project_team_access.project_id = projects.id
            AND team_members.user_id = ${userId}
            AND teams.archived_at IS NULL
        )
      )
    `;
  }
}

function mergeNotificationRecipients(
  rows: CommentNotificationDeliveryRecipientRow[],
): CommentNotificationDeliveryRecipient[] {
  const recipients = new Map<string, CommentNotificationDeliveryRecipient>();

  for (const row of rows) {
    const recipient = recipients.get(row.userId);

    if (recipient) {
      if (!recipient.reasons.includes(row.reason)) {
        recipient.reasons.push(row.reason);
      }
      continue;
    }

    recipients.set(row.userId, {
      email: row.email,
      name: row.name,
      reasons: [row.reason],
      userId: row.userId,
    });
  }

  return [...recipients.values()];
}
