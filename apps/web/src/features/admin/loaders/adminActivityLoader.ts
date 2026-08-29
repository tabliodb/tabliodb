import { redirect } from 'react-router';
import { TabliodbApiError } from '@tabliodb/sdk';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { adminQueries } from '@/resources/admin';

const adminActivityPageQuery = { limit: 20 } as const;

export async function adminActivityLoader() {
  try {
    await queryClient.ensureQueryData(adminQueries.auditLogs(adminActivityPageQuery));
  } catch (error) {
    if (error instanceof TabliodbApiError && error.status === 401) {
      throw redirect(routes.login.to());
    }

    throw error;
  }

  return null;
}
