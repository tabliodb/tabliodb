import {
  getInstanceAuthSettings,
  getOidcProviderSettings,
  getSetupStatus,
  getSmtpSettings,
  type InstanceAuthSettingsDtoOutput,
  type OidcProviderSettingsDtoOutput,
  type SetupStatusResponseDtoOutput,
  type SmtpSettingsDtoOutput,
} from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { setupKeys } from './setup.keys';

type SetupQueries = {
  authSettings: () => AppQueryOptions<InstanceAuthSettingsDtoOutput, ReturnType<typeof setupKeys.authSettings>>;
  oidcProvider: () => AppQueryOptions<OidcProviderSettingsDtoOutput, ReturnType<typeof setupKeys.oidcProvider>>;
  smtpSettings: () => AppQueryOptions<SmtpSettingsDtoOutput, ReturnType<typeof setupKeys.smtpSettings>>;
  status: () => AppQueryOptions<SetupStatusResponseDtoOutput, ReturnType<typeof setupKeys.status>>;
};

export const setupQueries: SetupQueries = {
  authSettings: () =>
    appQueryOptions({
      // Auth settings hanya dipakai admin console, dan tetap melalui SDK resmi agar kontrak OpenAPI menjadi source of truth.
      queryFn: () => getInstanceAuthSettings(),
      queryKey: setupKeys.authSettings(),
    }),
  oidcProvider: () =>
    appQueryOptions({
      // The response deliberately exposes only whether the secret exists; the raw client secret is never hydrated into React state.
      queryFn: () => getOidcProviderSettings(),
      queryKey: setupKeys.oidcProvider(),
    }),
  smtpSettings: () =>
    appQueryOptions({
      // Password SMTP mengikuti boundary secret server; query hanya mendapat status configured dan timestamp rotasi.
      queryFn: () => getSmtpSettings(),
      queryKey: setupKeys.smtpSettings(),
    }),
  status: () =>
    appQueryOptions({
      queryFn: () => getSetupStatus(),
      queryKey: setupKeys.status(),
      retry: false,
      // Setup status mengontrol redirect global; nilai stale setelah db reset bisa membawa user ke route yang salah.
      staleTime: 0,
    }),
};
