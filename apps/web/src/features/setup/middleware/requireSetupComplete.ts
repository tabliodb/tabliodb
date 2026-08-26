import { redirect, type MiddlewareFunction } from 'react-router';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { setupQueries } from '@/resources/setup';

export const requireSetupComplete: MiddlewareFunction = async (_, next) => {
  // Global route middleware runs for nested matches; ensureQueryData shares the same setup probe across that navigation instead of refetching per match.
  const setupStatus = await queryClient.ensureQueryData(setupQueries.status());

  if (!setupStatus.isSetupComplete) {
    throw redirect(routes.setup.to());
  }

  return next();
};
