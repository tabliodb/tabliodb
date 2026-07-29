import type { UserListQuery } from '@tabliodb/sdk';

export const usersKeys = {
  all: ['users'] as const,
  lists: () => [...usersKeys.all, 'list'] as const,
  list: (query: UserListQuery = {}) => [...usersKeys.lists(), query] as const,
};
