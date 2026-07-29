import { redirect } from 'react-router';
import { TabliodbApiError } from '@tabliodb/sdk';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { projectsQueries } from '@/resources/projects';
import { setupQueries } from '@/resources/setup';

export async function editorLoader() {
  const setupStatus = await queryClient.ensureQueryData(setupQueries.status());

  if (!setupStatus.isSetupComplete) {
    throw redirect(routes.setup.to());
  }

  try {
    // Projects adalah data minimum editor shell; prefetch di loader mencegah page render lalu langsung mental ke login.
    await queryClient.ensureQueryData(projectsQueries.listOrCreateStarter());
  } catch (error) {
    if (error instanceof TabliodbApiError && error.status === 401) {
      throw redirect(routes.login.to());
    }

    throw error;
  }

  return null;
}
