import { createBrowserRouter, Navigate } from 'react-router';
import { AdminLayout } from './layouts/AdminLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { EditorLayout } from './layouts/EditorLayout';
import { RootLayout } from './layouts/RootLayout';
import { SystemLayout } from './layouts/SystemLayout';
import { RouteErrorBoundary } from './routes/RouteErrorBoundary';
import { adminUsersLoader } from '@/features/admin/loaders/adminUsersLoader';
import { AdminUsersPage } from '@/features/admin/AdminUsersPage';
import { LoadingState } from '@/features/app/RouteStates';
import { loginLoader } from '@/features/auth/loaders/loginLoader';
import { LoginPage } from '@/features/auth/LoginPage';
import { requireAuthenticated } from '@/features/auth/middleware/requireAuthenticated';
import { editorLoader } from '@/features/editor/loaders/editorLoader';
import { EditorPage } from '@/features/editor/EditorPage';
import { acceptInvitationLoader } from '@/features/invitations/loaders/acceptInvitationLoader';
import { AcceptInvitationPage } from '@/features/invitations/AcceptInvitationPage';
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
              {
                element: <AcceptInvitationPage />,
                loader: acceptInvitationLoader,
                path: routes.invitation.path,
              },
            ],
          },
          {
            element: <AdminLayout />,
            errorElement: <RouteErrorBoundary />,
            middleware: [requireSetupComplete, requireAuthenticated],
            children: [
              {
                element: <Navigate replace to={routes.adminUsers.to()} />,
                path: routes.admin.path,
              },
              {
                element: <AdminUsersPage />,
                loader: adminUsersLoader,
                path: routes.adminUsers.path,
              },
            ],
          },
          {
            element: <EditorLayout />,
            errorElement: <RouteErrorBoundary />,
            loader: editorLoader,
            middleware: [requireSetupComplete, requireAuthenticated],
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
