import {
  TabliodbApiError,
  getServerMetrics,
  getServerReadiness,
  type ServerHealthResponseDtoOutput,
  type ServerMetricsResponseDtoOutput,
} from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { serverKeys } from './server.keys';

type ServerQueries = {
  metrics: () => AppQueryOptions<ServerMetricsResponseDtoOutput, ReturnType<typeof serverKeys.metrics>>;
  readiness: () => AppQueryOptions<ServerHealthResponseDtoOutput, ReturnType<typeof serverKeys.readiness>>;
};

export const serverQueries: ServerQueries = {
  metrics: () =>
    appQueryOptions({
      // Metrics berubah cepat saat operator sedang membuka admin overview, jadi interval pendek memberi sinyal realtime tanpa websocket khusus.
      queryFn: () => getServerMetrics(),
      queryKey: serverKeys.metrics(),
      refetchInterval: 15_000,
    }),
  readiness: () =>
    appQueryOptions({
      // Readiness endpoint bisa mengembalikan 503 dengan body health yang valid; wrapper ini menjaga UI tetap mendapat detail dependency.
      queryFn: () => getServerReadinessReport(),
      queryKey: serverKeys.readiness(),
      refetchInterval: 30_000,
      retry: false,
    }),
};

async function getServerReadinessReport(): Promise<ServerHealthResponseDtoOutput> {
  try {
    return await getServerReadiness();
  } catch (error) {
    const health = readHealthBodyFromHttpError(error);

    if (health) {
      return health;
    }

    throw error;
  }
}

function readHealthBodyFromHttpError(error: unknown): ServerHealthResponseDtoOutput | null {
  if (!(error instanceof TabliodbApiError) || !error.data || typeof error.data !== 'object') {
    return null;
  }

  const data = error.data as Partial<ServerHealthResponseDtoOutput>;

  // A failing readiness check still returns the same DTO shape; checking these stable fields avoids rendering arbitrary error envelopes as health data.
  if (typeof data.ok !== 'boolean' || typeof data.name !== 'string' || !data.dependencies) {
    return null;
  }

  return data as ServerHealthResponseDtoOutput;
}
