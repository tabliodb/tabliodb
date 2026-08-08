import type { PaginationQuery } from '@tabliodb/shared';
import {
  getNotificationInbox,
  getNotificationSummary,
  type NotificationInboxListResponseDtoOutput,
  type NotificationSummaryDtoOutput,
} from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { notificationKeys } from './notification.keys';

type NotificationQueries = {
  inbox: (
    query?: PaginationQuery,
  ) => AppQueryOptions<NotificationInboxListResponseDtoOutput, ReturnType<typeof notificationKeys.inbox>>;
  summary: () => AppQueryOptions<NotificationSummaryDtoOutput, ReturnType<typeof notificationKeys.summary>>;
};

export const notificationQueries: NotificationQueries = {
  inbox: (query: PaginationQuery = {}) =>
    appQueryOptions({
      // Inbox adalah data current-user global, jadi tidak butuh id eksternal untuk aman dieksekusi.
      queryFn: () => getNotificationInbox(query),
      queryKey: notificationKeys.inbox(query),
    }),
  summary: () =>
    appQueryOptions({
      queryFn: () => getNotificationSummary(),
      queryKey: notificationKeys.summary(),
    }),
};
