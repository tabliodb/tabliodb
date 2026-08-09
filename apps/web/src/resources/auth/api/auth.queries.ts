import {
  getCurrentUser,
  getOidcLoginProvider,
  type CurrentUserResponseDtoOutput,
  type OidcLoginProviderDtoOutput,
} from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { authKeys } from './auth.keys';

type AuthQueries = {
  me: () => AppQueryOptions<CurrentUserResponseDtoOutput, ReturnType<typeof authKeys.me>>;
  oidcProvider: () => AppQueryOptions<OidcLoginProviderDtoOutput, ReturnType<typeof authKeys.oidcProvider>>;
};

export const authQueries: AuthQueries = {
  me: () =>
    appQueryOptions({
      queryFn: () => getCurrentUser(),
      queryKey: authKeys.me(),
      retry: false,
    }),
  oidcProvider: () =>
    appQueryOptions({
      queryFn: () => getOidcLoginProvider(),
      queryKey: authKeys.oidcProvider(),
      retry: false,
    }),
};
