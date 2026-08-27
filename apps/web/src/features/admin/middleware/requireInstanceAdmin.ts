import { redirect, type MiddlewareFunction } from 'react-router';
import { TabliodbApiError } from '@tabliodb/sdk';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { authQueries } from '@/resources/auth';

export const requireInstanceAdmin: MiddlewareFunction = async (_, next) => {
  try {
    const user = await queryClient.ensureQueryData(authQueries.me());

    if (user.instanceRole !== 'owner' && user.instanceRole !== 'admin') {
      throw redirect(routes.home.to());
    }
  } catch (error) {
    if (error instanceof TabliodbApiError && error.status === 401) {
      throw redirect(routes.login.to());
    }

    throw error;
  }

  return next();
};
