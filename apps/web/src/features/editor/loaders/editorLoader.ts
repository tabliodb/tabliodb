import { redirect, type LoaderFunctionArgs } from 'react-router';
import { TabliodbApiError } from '@tabliodb/sdk';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { organizationsQueries } from '@/resources/organizations';
import { projectsQueries } from '@/resources/projects';

export async function editorLoader({ params }: LoaderFunctionArgs) {
  try {
    // Loader fokus ke hierarchy workspace -> projects; session/setup sudah menjadi tanggung jawab middleware parent.
    const organizations = await queryClient.ensureQueryData(organizationsQueries.list({ limit: 50 }));
    const activeOrganization =
      organizations.items.find(
        (organization) => organization.slug === params.workspaceSlug || organization.id === params.workspaceSlug,
      ) ??
      organizations.items[0] ??
      null;

    if (activeOrganization) {
      await queryClient.ensureQueryData(projectsQueries.listOrCreateStarter(activeOrganization.id));
    }
  } catch (error) {
    if (error instanceof TabliodbApiError && error.status === 401) {
      throw redirect(routes.login.to());
    }

    throw error;
  }

  return null;
}
