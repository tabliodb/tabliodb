import { redirect } from 'react-router';
import { TabliodbApiError } from '@tabliodb/sdk';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { organizationsQueries } from '@/resources/organizations';
import { usersQueries } from '@/resources/users';

export async function adminUsersLoader() {
  try {
    // Directory dan workspace list sama-sama dipakai halaman admin user; prefetch mencegah dialog invite tampil kosong sesaat.
    await Promise.all([
      queryClient.ensureQueryData(usersQueries.list({ limit: 20 })),
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
