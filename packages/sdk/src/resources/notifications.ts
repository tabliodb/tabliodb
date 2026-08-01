import type { Paginated, PaginationQuery } from '@tabliodb/shared';
import type { DatabaseDialect } from '@tabliodb/schema-core';
import type { RequestOpts } from '@oazapfts/runtime';
import type { CommentAuthorDto, CommentResponseDto, CommentTargetType } from './comments.js';
import { getNotificationInbox, getNotificationSummary } from '../fetch-client.js';

export type NotificationInboxItemType = 'mention' | 'reply';

export type NotificationProjectDto = {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  slug: string;
};

export type NotificationDiagramDto = {
  dialect: DatabaseDialect;
  id: string;
  name: string;
};

export type NotificationThreadDto = {
  id: string;
  status: 'open' | 'resolved';
  targetId: string | null;
  targetType: CommentTargetType;
  updatedAt: string;
};

export type NotificationParentCommentDto = {
  author: CommentAuthorDto;
  bodyText: string;
  id: string;
} | null;

export type NotificationInboxItemDto = {
  comment: CommentResponseDto;
  createdAt: string;
  diagram: NotificationDiagramDto;
  id: string;
  isUnread: boolean;
  parentComment: NotificationParentCommentDto;
  project: NotificationProjectDto;
  thread: NotificationThreadDto;
  type: NotificationInboxItemType;
};

export type NotificationInboxListResponseDto = Paginated<NotificationInboxItemDto>;

export type NotificationSummaryDto = {
  totalCount: number;
  unreadCount: number;
  updatedAt: string | null;
};

export type NotificationsResource = {
  getInbox: (query?: PaginationQuery) => Promise<NotificationInboxListResponseDto>;
  getSummary: () => Promise<NotificationSummaryDto>;
};

export function createNotificationsResource(opts?: RequestOpts): NotificationsResource {
  return {
    getInbox: (query: PaginationQuery = {}) =>
      // Generated client tetap privat; public SDK mempertahankan query pagination yang sama dengan resource lain.
      getNotificationInbox(query, opts) as unknown as Promise<NotificationInboxListResponseDto>,
    getSummary: () => getNotificationSummary(opts) as unknown as Promise<NotificationSummaryDto>,
  };
}
