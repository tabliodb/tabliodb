import { queryOptions } from '@tanstack/react-query';
import { sdk } from '@/services/sdk';
import { setupKeys } from './setup.keys';

export const setupQueries = {
  status: () =>
    queryOptions({
      queryFn: () => sdk.setup.getStatus(),
      queryKey: setupKeys.status(),
      retry: false,
    }),
};
