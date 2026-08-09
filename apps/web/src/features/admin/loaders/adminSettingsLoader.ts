import { redirect } from 'react-router';
import { TabliodbApiError } from '@tabliodb/sdk';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { organizationsQueries } from '@/resources/organizations';
import { setupQueries } from '@/resources/setup';

export async function adminSettingsLoader() {
  try {
    // Instance auth settings adalah data utama halaman ini, jadi loader menyiapkan cache sebelum component render.
    await Promise.all([
      queryClient.ensureQueryData(setupQueries.authSettings()),
      queryClient.ensureQueryData(setupQueries.oidcProvider()),
      queryClient.ensureQueryData(setupQueries.smtpSettings()),
      queryClient.ensureQueryData(organizationsQueries.list({ limit: 100 })),
    ]);
  } catch (error) {
    if (error instanceof TabliodbApiError && error.status === 401) {
      throw redirect(routes.login.to());
    }

    throw error;
  }

  return null;
}
