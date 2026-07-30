import { redirect } from 'react-router';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { setupQueries } from '@/resources/setup';

export async function passwordRecoveryLoader() {
  const setupStatus = await queryClient.ensureQueryData(setupQueries.status());

  if (!setupStatus.isSetupComplete) {
    throw redirect(routes.setup.to());
  }

  return null;
}
