import { redirect } from 'react-router';
import { TabliodbApiError } from '@tabliodb/sdk';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { usersQueries } from '@/resources/users';

export async function adminUsersLoader() {
  try {
    // Directory adalah data utama halaman admin; loader membuat cache siap sebelum page render.
    await queryClient.ensureQueryData(usersQueries.list({ limit: 20 }));
  } catch (error) {
    if (error instanceof TabliodbApiError && error.status === 401) {
      throw redirect(routes.login.to());
    }

    throw error;
  }

  return null;
}
