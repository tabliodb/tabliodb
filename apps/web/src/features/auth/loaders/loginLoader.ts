import { redirect } from 'react-router';
import { TabliodbApiError } from '@tabliodb/sdk';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { authQueries } from '@/resources/auth';
import { setupQueries } from '@/resources/setup';

export async function loginLoader() {
  const setupStatus = await queryClient.ensureQueryData(setupQueries.status());

  if (!setupStatus.isSetupComplete) {
    throw redirect(routes.setup.to());
  }

  try {
    // Guest login route tidak perlu render form kalau session cookie masih valid.
    await queryClient.ensureQueryData(authQueries.me());
    throw redirect(routes.home.to());
  } catch (error) {
    if (error instanceof TabliodbApiError && error.status === 401) {
      return null;
    }

    throw error;
  }

  return null;
}
