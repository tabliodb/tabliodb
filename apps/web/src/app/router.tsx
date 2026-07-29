import { createBrowserRouter, Navigate } from 'react-router';
import { AuthLayout } from './layouts/AuthLayout';
import { EditorLayout } from './layouts/EditorLayout';
import { RootLayout } from './layouts/RootLayout';
import { SystemLayout } from './layouts/SystemLayout';
import { RouteErrorBoundary } from './routes/RouteErrorBoundary';
import { LoadingState } from '@/features/app/RouteStates';
import { loginLoader } from '@/features/auth/loaders/loginLoader';
import { LoginPage } from '@/features/auth/LoginPage';
import { editorLoader } from '@/features/editor/loaders/editorLoader';
import { EditorPage } from '@/features/editor/EditorPage';
import { requireSetupComplete } from '@/features/setup/middleware/requireSetupComplete';
import { setupLoader } from '@/features/setup/loaders/setupLoader';
import { SetupPage } from '@/features/setup/SetupPage';
import { routes } from './routes';

export const router = createBrowserRouter([
  {
    element: <SystemLayout />,
    errorElement: <RouteErrorBoundary />,
    hydrateFallbackElement: <LoadingState />,
    id: 'system',
    children: [
      {
        element: <SetupPage />,
        loader: setupLoader,
        path: routes.setup.path,
      },
      {
        element: <RootLayout />,
        errorElement: <RouteErrorBoundary />,
        children: [
          {
            element: <AuthLayout />,
            errorElement: <RouteErrorBoundary />,
            children: [
              {
                element: <LoginPage />,
                loader: loginLoader,
                path: routes.login.path,
              },
            ],
          },
          {
            element: <EditorLayout />,
            errorElement: <RouteErrorBoundary />,
            loader: editorLoader,
            middleware: [requireSetupComplete],
            children: [
              {
                element: <EditorPage />,
                index: true,
              },
              {
                element: <EditorPage />,
                path: routes.workspace.path,
              },
              {
                element: <EditorPage />,
                path: routes.project.path,
              },
              {
                element: <EditorPage />,
                path: routes.diagram.path,
              },
            ],
          },
          {
            element: <Navigate replace to={routes.home.to()} />,
            path: '*',
          },
        ],
      },
    ],
  },
]);
