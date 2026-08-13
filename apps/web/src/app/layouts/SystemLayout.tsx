import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { DocumentTitle } from '@/app/document-title';
import { LoadingState } from '@/features/app/RouteStates';

export function SystemLayout() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DocumentTitle />
      <Outlet />
    </Suspense>
  );
}
