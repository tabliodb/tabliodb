import type { UserListQuery, UserListResponseDto } from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { usersKeys } from './user.keys';

type UsersQueries = {
  list: (query?: UserListQuery) => AppQueryOptions<UserListResponseDto, ReturnType<typeof usersKeys.list>>;
};

export const usersQueries: UsersQueries = {
  list: (query: UserListQuery = {}) =>
    appQueryOptions({
      // Resource layer sengaja tipis: SDK menangani HTTP contract, TanStack Query hanya mengatur cache lifecycle.
      queryFn: () => sdk.users.list(query),
      queryKey: usersKeys.list(query),
    }),
};
