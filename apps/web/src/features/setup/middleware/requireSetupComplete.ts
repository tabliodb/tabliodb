import { redirect, type MiddlewareFunction } from 'react-router';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { setupQueries } from '@/resources/setup';

export const requireSetupComplete: MiddlewareFunction = async (_, next) => {
  const setupStatus = await queryClient.fetchQuery(setupQueries.status());

  if (!setupStatus.isSetupComplete) {
    throw redirect(routes.setup.to());
  }

  return next();
};
