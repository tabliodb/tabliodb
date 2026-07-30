import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { LoadingState } from '@/features/app/RouteStates';

export function SystemLayout() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Outlet />
    </Suspense>
  );
}
