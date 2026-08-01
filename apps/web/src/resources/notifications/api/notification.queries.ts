import type { PaginationQuery } from '@tabliodb/shared';
import type { NotificationInboxListResponseDto, NotificationSummaryDto } from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { notificationKeys } from './notification.keys';

type NotificationQueries = {
  inbox: (
    query?: PaginationQuery,
  ) => AppQueryOptions<NotificationInboxListResponseDto, ReturnType<typeof notificationKeys.inbox>>;
  summary: () => AppQueryOptions<NotificationSummaryDto, ReturnType<typeof notificationKeys.summary>>;
};

export const notificationQueries: NotificationQueries = {
  inbox: (query: PaginationQuery = {}) =>
    appQueryOptions({
      // Inbox adalah data current-user global, jadi tidak butuh id eksternal untuk aman dieksekusi.
      queryFn: () => sdk.notifications.getInbox(query),
      queryKey: notificationKeys.inbox(query),
    }),
  summary: () =>
    appQueryOptions({
      queryFn: () => sdk.notifications.getSummary(),
      queryKey: notificationKeys.summary(),
    }),
};
