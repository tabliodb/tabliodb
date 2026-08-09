import { redirect } from 'react-router';
import { TabliodbApiError, type CurrentUserResponseDtoOutput } from '@tabliodb/sdk';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { authQueries } from '@/resources/auth';
import { setupQueries } from '@/resources/setup';

export type LoginLoaderData = {
  temporaryUser: CurrentUserResponseDtoOutput | null;
};

export async function loginLoader() {
  const setupStatus = await queryClient.fetchQuery(setupQueries.status());

  if (!setupStatus.isSetupComplete) {
    throw redirect(routes.setup.to());
  }

  try {
    // Guest login route tidak perlu render form kalau session cookie masih valid.
    const user = await queryClient.fetchQuery(authQueries.me());
    if (user.passwordChangeRequired) {
      return { temporaryUser: user } satisfies LoginLoaderData;
    }

    throw redirect(routes.home.to());
  } catch (error) {
    if (error instanceof TabliodbApiError && error.status === 401) {
      return { temporaryUser: null } satisfies LoginLoaderData;
    }

    throw error;
  }

  return { temporaryUser: null } satisfies LoginLoaderData;
}
