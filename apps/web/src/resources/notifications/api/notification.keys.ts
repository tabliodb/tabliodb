import type { PaginationQuery } from '@tabliodb/shared';

export const notificationKeys = {
  all: ['notifications'] as const,
  inbox: (query: PaginationQuery = {}) => [...notificationKeys.inboxes(), query] as const,
  inboxes: () => [...notificationKeys.all, 'inbox'] as const,
  summary: () => [...notificationKeys.all, 'summary'] as const,
};
