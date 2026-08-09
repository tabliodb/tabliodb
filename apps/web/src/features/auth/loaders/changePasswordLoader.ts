import { redirect } from 'react-router';
import { TabliodbApiError } from '@tabliodb/sdk';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { authQueries } from '@/resources/auth';
import { setupQueries } from '@/resources/setup';

export async function changePasswordLoader() {
  const setupStatus = await queryClient.fetchQuery(setupQueries.status());

  if (!setupStatus.isSetupComplete) {
    throw redirect(routes.setup.to());
  }

  try {
    const user = await queryClient.fetchQuery(authQueries.me());

    if (!user.passwordChangeRequired) {
      throw redirect(routes.home.to());
    }
  } catch (error) {
    if (error instanceof TabliodbApiError && error.status === 401) {
      throw redirect(routes.login.to());
    }

    throw error;
  }

  return null;
}
