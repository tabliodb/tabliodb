import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { AccountLayout } from './layouts/AccountLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { EditorLayout } from './layouts/EditorLayout';
import { RootLayout } from './layouts/RootLayout';
import { SystemLayout } from './layouts/SystemLayout';
import { RouteErrorBoundary } from './routes/RouteErrorBoundary';
import { adminSettingsLoader } from '@/features/admin/loaders/adminSettingsLoader';
import { adminUsersLoader } from '@/features/admin/loaders/adminUsersLoader';
import { LoadingState } from '@/features/app/RouteStates';
import { loginLoader } from '@/features/auth/loaders/loginLoader';
import { passwordRecoveryLoader } from '@/features/auth/loaders/passwordRecoveryLoader';
import { requireAuthenticated } from '@/features/auth/middleware/requireAuthenticated';
import { editorLoader } from '@/features/editor/loaders/editorLoader';
import { acceptInvitationLoader } from '@/features/invitations/loaders/acceptInvitationLoader';
import { profileLoader } from '@/features/profile/loaders/profileLoader';
import { requireSetupComplete } from '@/features/setup/middleware/requireSetupComplete';
import { setupLoader } from '@/features/setup/loaders/setupLoader';
import { routes } from './routes';

const AdminUsersPage = lazy(() =>
  import('@/features/admin/AdminUsersPage').then((module) => ({ default: module.AdminUsersPage })),
);
const AdminSettingsPage = lazy(() =>
  import('@/features/admin/AdminSettingsPage').then((module) => ({ default: module.AdminSettingsPage })),
);
const LoginPage = lazy(() => import('@/features/auth/LoginPage').then((module) => ({ default: module.LoginPage })));
const ForgotPasswordPage = lazy(() =>
  import('@/features/auth/ForgotPasswordPage').then((module) => ({ default: module.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import('@/features/auth/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })),
);
const EditorPage = lazy(() =>
  // The editor pulls AntV X6, SQL/doc generators, and large form surfaces, so it should only load on editor routes.
  import('@/features/editor/EditorPage').then((module) => ({ default: module.EditorPage })),
);
const AcceptInvitationPage = lazy(() =>
  import('@/features/invitations/AcceptInvitationPage').then((module) => ({ default: module.AcceptInvitationPage })),
);
const SetupPage = lazy(() => import('@/features/setup/SetupPage').then((module) => ({ default: module.SetupPage })));
const ProfilePage = lazy(() =>
  import('@/features/profile/ProfilePage').then((module) => ({ default: module.ProfilePage })),
);
const PublicSharePage = lazy(() =>
  import('@/features/share/PublicSharePage').then((module) => ({ default: module.PublicSharePage })),
);

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
                element: <ForgotPasswordPage />,
                loader: passwordRecoveryLoader,
                path: routes.forgotPassword.path,
              },
              {
                element: <ResetPasswordPage />,
                loader: passwordRecoveryLoader,
                path: routes.resetPassword.path,
              },
              {
                element: <AcceptInvitationPage />,
                loader: acceptInvitationLoader,
                path: routes.invitation.path,
              },
            ],
          },
          {
            element: <PublicSharePage />,
            path: routes.share.path,
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
              {
                element: <AdminSettingsPage />,
                loader: adminSettingsLoader,
                path: routes.adminSettings.path,
              },
            ],
          },
          {
            element: <AccountLayout />,
            errorElement: <RouteErrorBoundary />,
            middleware: [requireSetupComplete, requireAuthenticated],
            children: [
              {
                element: <ProfilePage />,
                loader: profileLoader,
                path: routes.profile.path,
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
