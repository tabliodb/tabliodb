import type { PaginationQuery } from '@tabliodb/shared';

export const projectsKeys = {
  all: ['projects'] as const,
  lists: () => [...projectsKeys.all, 'list'] as const,
  list: (query: PaginationQuery = {}) => [...projectsKeys.lists(), query] as const,
};
