import { queryOptions } from '@tanstack/react-query';
import { sdk } from '@/services/sdk';
import { usersKeys } from './user.keys';

export const usersQueries = {
  list: () =>
    queryOptions({
      // Resource layer sengaja tipis: SDK menangani HTTP contract, TanStack Query hanya mengatur cache lifecycle.
      queryFn: () => sdk.users.list(),
      queryKey: usersKeys.list(),
    }),
};
