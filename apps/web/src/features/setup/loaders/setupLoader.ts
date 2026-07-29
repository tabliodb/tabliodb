import { redirect } from 'react-router';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { setupQueries } from '@/resources/setup';

export async function setupLoader() {
  const setupStatus = await queryClient.ensureQueryData(setupQueries.status());

  if (setupStatus.isSetupComplete) {
    throw redirect(routes.home.to());
  }

  return setupStatus;
}
