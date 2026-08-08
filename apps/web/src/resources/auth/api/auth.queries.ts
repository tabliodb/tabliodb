import { getCurrentUser, type CurrentUserResponseDtoOutput } from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { authKeys } from './auth.keys';

type AuthQueries = {
  me: () => AppQueryOptions<CurrentUserResponseDtoOutput, ReturnType<typeof authKeys.me>>;
};

export const authQueries: AuthQueries = {
  me: () =>
    appQueryOptions({
      queryFn: () => getCurrentUser(),
      queryKey: authKeys.me(),
      retry: false,
    }),
};
