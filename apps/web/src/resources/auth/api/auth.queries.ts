import {
  getCurrentUserEditorPreference,
  getCurrentUser,
  getOidcLoginProvider,
  type CurrentUserEditorPreferenceDtoOutput,
  type CurrentUserResponseDtoOutput,
  type OidcLoginProviderDtoOutput,
} from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { authKeys } from './auth.keys';

type AuthQueries = {
  editorPreference: () => AppQueryOptions<
    CurrentUserEditorPreferenceDtoOutput,
    ReturnType<typeof authKeys.editorPreference>
  >;
  me: () => AppQueryOptions<CurrentUserResponseDtoOutput, ReturnType<typeof authKeys.me>>;
  oidcProvider: () => AppQueryOptions<OidcLoginProviderDtoOutput, ReturnType<typeof authKeys.oidcProvider>>;
};

export const authQueries: AuthQueries = {
  editorPreference: () =>
    appQueryOptions({
      queryFn: () => getCurrentUserEditorPreference(),
      queryKey: authKeys.editorPreference(),
      retry: false,
    }),
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
