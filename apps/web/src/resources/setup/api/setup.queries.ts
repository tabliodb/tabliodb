import type { SetupStatusResponseDto } from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { setupKeys } from './setup.keys';

type SetupQueries = {
  status: () => AppQueryOptions<SetupStatusResponseDto, ReturnType<typeof setupKeys.status>>;
};

export const setupQueries: SetupQueries = {
  status: () =>
    appQueryOptions({
      queryFn: () => sdk.setup.getStatus(),
      queryKey: setupKeys.status(),
      retry: false,
    }),
};
