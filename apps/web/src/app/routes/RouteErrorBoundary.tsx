import { useRevalidator, useRouteError } from 'react-router';
import { ErrorState } from '@/features/app/RouteStates';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const revalidator = useRevalidator();

  return <ErrorState error={error} onRetry={() => revalidator.revalidate()} />;
}
