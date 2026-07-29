import { queryOptions } from '@tanstack/react-query';
import { sdk } from '@/services/sdk';
import { authKeys } from './auth.keys';

export const authQueries = {
  me: () =>
    queryOptions({
      queryFn: () => sdk.auth.me(),
      queryKey: authKeys.me(),
      retry: false,
    }),
};
