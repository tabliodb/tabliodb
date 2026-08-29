import { redirect } from 'react-router';
import { TabliodbApiError } from '@tabliodb/sdk';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { serverQueries } from '@/resources/server';

export async function adminOverviewLoader() {
  try {
    await queryClient.ensureQueryData(serverQueries.readiness());

    try {
      // Metrics bersifat opsional lewat konfigurasi env; admin overview tetap berguna walaupun endpoint metrics dimatikan.
      await queryClient.ensureQueryData(serverQueries.metrics());
    } catch (error) {
      if (error instanceof TabliodbApiError && error.status === 404) {
        return null;
      }

      throw error;
    }
  } catch (error) {
    if (error instanceof TabliodbApiError && error.status === 401) {
      throw redirect(routes.login.to());
    }

    throw error;
  }

  return null;
}
