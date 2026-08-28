import { Injectable } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import type { DatabaseDialect } from '@tabliodb/schema-core';
import type { Observable } from 'rxjs';
import type { AuthContext } from '../database.js';
import { NotificationInboxListQueryDto } from '../dtos/notification.dto.js';
import {
  NotificationInboxRow,
  NotificationRepository,
  type NotificationInboxItemKind,
} from '../repositories/notification.repository.js';
import type { JsonValue } from '../schema/index.js';
import { createPlainTextCommentLexicalDocument, type CommentLexicalDocument } from '../utils/comment-body.js';
import { toIsoDateTime, toNullableIsoDateTime } from '../utils/date-time.js';
import { clampPaginationLimit } from '../utils/pagination.js';
import { NotificationRealtimeService } from './notification-realtime.service.js';

type CommentTargetType =
  'check' | 'column' | 'diagram' | 'enum' | 'group' | 'index' | 'note' | 'relationship' | 'table';

@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationRealtimeService: NotificationRealtimeService,
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async getInbox(auth: AuthContext, query: NotificationInboxListQueryDto) {
    const inbox = await this.notificationRepository.getInbox({
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
      userId: auth.user.id,
    });

    return {
      ...inbox,
      // Inbox item diserialisasi di service agar repository tetap fokus pada query data mentah dan filtering akses.
      items: inbox.items.map((item) => this.serializeInboxItem(item)),
    };
  }

  async getSummary(auth: AuthContext) {
    const summary = await this.notificationRepository.getSummary(auth.user.id);

    return {
      totalCount: summary.totalCount,
      unreadCount: summary.unreadCount,
      updatedAt: toNullableIsoDateTime(summary.updatedAt),
    };
  }

  stream(auth: AuthContext): Observable<MessageEvent> {
    return this.notificationRealtimeService.streamForUser(auth.user.id);
  }

  async emitCommentInboxChanged(options: { actorId: string; commentId: string; threadId: string }): Promise<void> {
    const recipients = await this.notificationRepository.getCommentDeliveryRecipients({
      actorId: options.actorId,
      commentId: options.commentId,
    });
    const recipientIds = new Set([
      ...recipients.mentionUserIds,
      ...(recipients.replyUserId ? [recipients.replyUserId] : []),
    ]);

    await Promise.all(
      [...recipientIds].map((userId) =>
        this.notificationRealtimeService.emitUserChanged(userId, {
          commentId: options.commentId,
          reason: 'comment_changed',
          threadId: options.threadId,
        }),
      ),
    );
  }

  async emitThreadRead(auth: AuthContext, threadId: string): Promise<void> {
    await this.notificationRealtimeService.emitUserChanged(auth.user.id, {
      reason: 'thread_read',
      threadId,
    });
  }

  private serializeInboxItem(item: NotificationInboxRow) {
    const parentComment =
      item.parentCommentId &&
      item.parentAuthorId &&
      item.parentAuthorEmail &&
      item.parentAuthorName &&
      item.parentAuthorCursorColor
        ? {
            author: {
              avatarUrl: item.parentAuthorAvatarUrl,
              cursorColor: item.parentAuthorCursorColor,
              email: item.parentAuthorEmail,
              id: item.parentAuthorId,
              name: item.parentAuthorName,
            },
            bodyText: item.parentCommentBodyText ?? '',
            id: item.parentCommentId,
          }
        : null;

    return {
      comment: {
        author: {
          avatarUrl: item.authorAvatarUrl,
          cursorColor: item.authorCursorColor,
          email: item.authorEmail,
          id: item.authorId,
          name: item.authorName,
        },
        body: item.commentBodyText,
        bodyFormat: item.commentBodyFormat,
        bodyJson: this.serializeCommentBodyJson(item.commentBodyJson),
        bodyText: item.commentBodyText,
        createdAt: toIsoDateTime(item.commentCreatedAt),
        createdById: item.commentCreatedById,
        deletedAt: toNullableIsoDateTime(item.commentDeletedAt),
        editedAt: toNullableIsoDateTime(item.commentEditedAt),
        id: item.commentId,
        mentionedUserIds: item.commentMentionedUserIds ?? [],
        parentCommentId: item.commentParentCommentId,
        replyCount: Number(item.commentReplyCount),
        threadId: item.commentThreadId,
        updatedAt: toIsoDateTime(item.commentUpdatedAt),
      },
      createdAt: toIsoDateTime(item.createdAt),
      diagram: {
        dialect: item.diagramDialect as DatabaseDialect,
        id: item.diagramId,
        name: item.diagramName,
      },
      id: item.id,
      isUnread: item.isUnread,
      parentComment,
      folder:
        item.folderId && item.folderName && item.folderSlug
          ? {
              id: item.folderId,
              name: item.folderName,
              organizationId: item.organizationId,
              organizationName: item.organizationName,
              organizationSlug: item.organizationSlug,
              slug: item.folderSlug,
            }
          : null,
      thread: {
        id: item.threadId,
        status: item.threadStatus,
        targetId: item.threadTargetId,
        targetType: item.threadTargetType as CommentTargetType,
        updatedAt: toIsoDateTime(item.threadUpdatedAt),
      },
      type: item.type as NotificationInboxItemKind,
      workspace: {
        id: item.organizationId,
        name: item.organizationName,
        slug: item.organizationSlug,
      },
    };
  }

  private serializeCommentBodyJson(bodyJson: JsonValue): CommentLexicalDocument {
    // Notification rows only select non-deleted comments, but this fallback keeps the DTO stable if legacy data is imperfect.
    return (bodyJson ?? createPlainTextCommentLexicalDocument('')) as CommentLexicalDocument;
  }
}
