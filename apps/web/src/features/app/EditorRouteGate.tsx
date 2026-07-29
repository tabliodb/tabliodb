import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router';
import { routes } from '@/app/routes';
import { sdk } from '@/services/sdk';
import { EditorPage } from '@/features/editor/EditorPage';
import { ErrorState, LoadingState } from './RouteStates';

export function EditorRouteGate() {
  const queryClient = useQueryClient();
  const setupQuery = useQuery({
    queryKey: ['setup'],
    queryFn: sdk.setup.getStatus,
    retry: false,
  });

  if (setupQuery.isPending) {
    return <LoadingState />;
  }

  if (setupQuery.error) {
    return (
      <ErrorState error={setupQuery.error} onRetry={() => queryClient.invalidateQueries({ queryKey: ['setup'] })} />
    );
  }

  if (!setupQuery.data.isSetupComplete) {
    return <Navigate replace to={routes.setup.to()} />;
  }

  return <EditorPage />;
}
