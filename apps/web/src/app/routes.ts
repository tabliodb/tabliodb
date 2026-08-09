type WorkspaceParams = {
  workspaceSlug: string;
};

type ProjectParams = WorkspaceParams & {
  projectId: string;
};

type DiagramParams = ProjectParams & {
  diagramId: string;
};

type InvitationParams = {
  token: string;
};

type PasswordResetParams = {
  token: string;
};

type ShareParams = {
  token: string;
};

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

export const routes = {
  home: {
    path: '/',
    to: () => '/',
  },
  setup: {
    path: '/setup',
    to: () => '/setup',
  },
  login: {
    path: '/login',
    to: () => '/login',
  },
  oidcComplete: {
    path: '/auth/oidc/complete',
    to: ({ returnTo }: { returnTo?: string } = {}) => {
      const url = new URLSearchParams();

      if (returnTo) {
        url.set('returnTo', returnTo);
      }

      const search = url.toString();

      return search ? `/auth/oidc/complete?${search}` : '/auth/oidc/complete';
    },
  },
  forgotPassword: {
    path: '/forgot-password',
    to: () => '/forgot-password',
  },
  resetPassword: {
    path: '/reset-password/:token',
    to: ({ token }: PasswordResetParams) => `/reset-password/${encodePathSegment(token)}`,
  },
  invitation: {
    path: '/invite/:token',
    to: ({ token }: InvitationParams) => `/invite/${encodePathSegment(token)}`,
  },
  share: {
    path: '/share/:token',
    to: ({ token }: ShareParams) => `/share/${encodePathSegment(token)}`,
  },
  admin: {
    path: '/admin',
    to: () => '/admin',
  },
  adminUsers: {
    path: '/admin/users',
    to: () => '/admin/users',
  },
  adminSettings: {
    path: '/admin/settings',
    to: () => '/admin/settings',
  },
  profile: {
    path: '/profile',
    to: () => '/profile',
  },
  workspace: {
    path: '/workspaces/:workspaceSlug',
    to: ({ workspaceSlug }: WorkspaceParams) => `/workspaces/${encodePathSegment(workspaceSlug)}`,
  },
  project: {
    path: '/workspaces/:workspaceSlug/projects/:projectId',
    to: ({ projectId, workspaceSlug }: ProjectParams) =>
      `/workspaces/${encodePathSegment(workspaceSlug)}/projects/${encodePathSegment(projectId)}`,
  },
  diagram: {
    path: '/workspaces/:workspaceSlug/projects/:projectId/diagrams/:diagramId',
    to: ({ diagramId, projectId, workspaceSlug }: DiagramParams) =>
      `/workspaces/${encodePathSegment(workspaceSlug)}/projects/${encodePathSegment(projectId)}/diagrams/${encodePathSegment(diagramId)}`,
  },
} as const;
