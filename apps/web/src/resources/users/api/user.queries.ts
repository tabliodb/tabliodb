import { getUsers, type UserListResponseDtoOutput } from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { usersKeys, type UserListQuery } from './user.keys';

type UsersQueries = {
  list: (query?: UserListQuery) => AppQueryOptions<UserListResponseDtoOutput, ReturnType<typeof usersKeys.list>>;
};

export const usersQueries: UsersQueries = {
  list: (query: UserListQuery = {}) =>
    appQueryOptions({
      // Resource layer sengaja tipis: SDK menangani HTTP contract, TanStack Query hanya mengatur cache lifecycle.
      queryFn: () => getUsers(query),
      queryKey: usersKeys.list(query),
    }),
};
