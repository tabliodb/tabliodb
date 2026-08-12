import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { LoadingState } from '@/features/app/RouteStates';
import { DocumentTitle } from '@/features/app/document-title';

export function SystemLayout() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DocumentTitle />
      <Outlet />
    </Suspense>
  );
}
