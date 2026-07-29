import { redirect } from 'react-router';
import { TabliodbApiError } from '@tabliodb/sdk';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { projectsQueries } from '@/resources/projects';

export async function editorLoader() {
  try {
    // Loader fokus ke data editor; session/setup sudah menjadi tanggung jawab middleware parent.
    await queryClient.ensureQueryData(projectsQueries.listOrCreateStarter());
  } catch (error) {
    if (error instanceof TabliodbApiError && error.status === 401) {
      throw redirect(routes.login.to());
    }

    throw error;
  }

  return null;
}
