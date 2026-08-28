import { redirect, type MiddlewareFunction } from 'react-router';
import { TabliodbApiError } from '@tabliodb/sdk';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { authQueries } from '@/resources/auth';

export const requireAuthenticated: MiddlewareFunction = async (_, next) => {
  try {
    // Auth guard memakai /auth/me sebagai source of truth session, bukan localStorage atau query folder sampingan.
    const user = await queryClient.ensureQueryData(authQueries.me());

    if (user.passwordChangeRequired) {
      throw redirect(routes.login.to());
    }
  } catch (error) {
    if (error instanceof TabliodbApiError && error.status === 401) {
      throw redirect(routes.login.to());
    }

    throw error;
  }

  return next();
};
