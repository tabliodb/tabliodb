import { QueryCache, QueryClient, type QueryKey, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query';
import { TabliodbApiError } from '@tabliodb/sdk';

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof TabliodbApiError && error.status === 401) {
        return;
      }

      console.warn('Tabliodb query failed:', error);
    },
  }),
  defaultOptions: {
    queries: {
      gcTime: 10 * 60_000,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof TabliodbApiError && error.status >= 400 && error.status < 500) {
          return false;
        }

        return failureCount < 2;
      },
      staleTime: 30_000,
    },
  },
});

export type ApiFnReturnType<FnType extends (...args: any) => Promise<any>> = Awaited<ReturnType<FnType>>;

export type AppQueryOptions<TData, TQueryKey extends QueryKey = QueryKey> = Omit<
  UseQueryOptions<TData, Error, TData, TQueryKey>,
  'queryFn' | 'queryKey'
> & {
  queryFn: () => Promise<TData>;
  queryKey: TQueryKey;
};

export function appQueryOptions<TData, TQueryKey extends QueryKey>(
  options: AppQueryOptions<TData, TQueryKey>,
): AppQueryOptions<TData, TQueryKey> {
  // Wrapper ini menjaga public resource query tetap portable tanpa membawa inferred type dari generated SDK client.
  return options;
}

export type QueryConfig<T extends (...args: any[]) => AppQueryOptions<any, any>> = Omit<
  ReturnType<T>,
  'queryKey' | 'queryFn'
>;

export type MutationConfig<MutationFnType extends (...args: any) => Promise<any>> = UseMutationOptions<
  ApiFnReturnType<MutationFnType>,
  Error,
  Parameters<MutationFnType>[0]
>;
