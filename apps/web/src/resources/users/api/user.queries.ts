import { queryOptions } from '@tanstack/react-query';
import type { UserListQuery } from '@tabliodb/sdk';
import { sdk } from '@/services/sdk';
import { usersKeys } from './user.keys';

export const usersQueries = {
  list: (query: UserListQuery = {}) =>
    queryOptions({
      // Resource layer sengaja tipis: SDK menangani HTTP contract, TanStack Query hanya mengatur cache lifecycle.
      queryFn: () => sdk.users.list(query),
      queryKey: usersKeys.list(query),
    }),
};
