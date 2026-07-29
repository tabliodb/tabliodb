import { createBrowserRouter, Navigate } from 'react-router';
import { EditorRouteGate } from '@/features/app/EditorRouteGate';
import { LoginPage } from '@/features/auth/LoginPage';
import { SetupPage } from '@/features/setup/SetupPage';
import { routes } from './routes';

export const router = createBrowserRouter([
  {
    path: routes.home.path,
    element: <EditorRouteGate />,
  },
  {
    path: routes.setup.path,
    element: <SetupPage />,
  },
  {
    path: routes.login.path,
    element: <LoginPage />,
  },
  {
    path: routes.workspace.path,
    element: <EditorRouteGate />,
  },
  {
    path: routes.project.path,
    element: <EditorRouteGate />,
  },
  {
    path: routes.diagram.path,
    element: <EditorRouteGate />,
  },
  {
    path: '*',
    element: <Navigate replace to={routes.home.to()} />,
  },
]);
