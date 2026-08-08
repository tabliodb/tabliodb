import type { getUsers } from '@tabliodb/sdk';

export type UserListQuery = Parameters<typeof getUsers>[0];

export const usersKeys = {
  all: ['users'] as const,
  lists: () => [...usersKeys.all, 'list'] as const,
  list: (query: UserListQuery = {}) => [...usersKeys.lists(), query] as const,
};
