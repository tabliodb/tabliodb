import type { InstanceAuthSettingsDto, SetupStatusResponseDto } from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { setupKeys } from './setup.keys';

type SetupQueries = {
  authSettings: () => AppQueryOptions<InstanceAuthSettingsDto, ReturnType<typeof setupKeys.authSettings>>;
  status: () => AppQueryOptions<SetupStatusResponseDto, ReturnType<typeof setupKeys.status>>;
};

export const setupQueries: SetupQueries = {
  authSettings: () =>
    appQueryOptions({
      // Auth settings hanya dipakai admin console, dan tetap melalui SDK resmi agar kontrak OpenAPI menjadi source of truth.
      queryFn: () => sdk.setup.getAuthSettings(),
      queryKey: setupKeys.authSettings(),
    }),
  status: () =>
    appQueryOptions({
      queryFn: () => sdk.setup.getStatus(),
      queryKey: setupKeys.status(),
      retry: false,
    }),
};
