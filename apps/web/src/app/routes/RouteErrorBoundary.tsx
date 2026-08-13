import { Button } from '@tabliodb/ui';
import { Home, RotateCw } from 'lucide-react';
import { Link, useRevalidator, useRouteError } from 'react-router';
import { routes } from '../routes';
import { ErrorState } from '@/features/app/RouteStates';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const revalidator = useRevalidator();

  return (
    <ErrorState
      actions={
        <>
          <Button asChild className="gap-2" variant="soft">
            <Link to={routes.home.to()}>
              <Home className="size-4" />
              Back to workspace
            </Link>
          </Button>
          <Button className="gap-2" onClick={() => window.location.reload()} variant="ghost">
            <RotateCw className="size-4" />
            Reload app
          </Button>
        </>
      }
      error={error}
      onRetry={() => revalidator.revalidate()}
    />
  );
}
