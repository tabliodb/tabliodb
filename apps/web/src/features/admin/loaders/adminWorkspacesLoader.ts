import { redirect } from 'react-router';
import { TabliodbApiError } from '@tabliodb/sdk';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { organizationsQueries } from '@/resources/organizations';

const adminWorkspacePageQuery = { limit: 20 } as const;

export async function adminWorkspacesLoader() {
  try {
    await queryClient.ensureQueryData(organizationsQueries.adminWorkspaces(adminWorkspacePageQuery));
  } catch (error) {
    if (error instanceof TabliodbApiError && error.status === 401) {
      throw redirect(routes.login.to());
    }

    throw error;
  }

  return null;
}
