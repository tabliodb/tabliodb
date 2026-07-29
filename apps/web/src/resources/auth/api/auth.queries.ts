import type { CurrentUserResponseDto } from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { authKeys } from './auth.keys';

type AuthQueries = {
  me: () => AppQueryOptions<CurrentUserResponseDto, ReturnType<typeof authKeys.me>>;
};

export const authQueries: AuthQueries = {
  me: () =>
    appQueryOptions({
      queryFn: () => sdk.auth.me(),
      queryKey: authKeys.me(),
      retry: false,
    }),
};
