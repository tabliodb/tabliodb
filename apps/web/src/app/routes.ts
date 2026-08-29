type WorkspaceParams = {
  workspaceSlug: string;
};

type FolderParams = WorkspaceParams & {
  folderId: string;
};

type DiagramParams = FolderParams & {
  diagramId: string;
};

type WorkspaceDiagramParams = WorkspaceParams & {
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
  adminOverview: {
    path: '/admin/overview',
    to: () => '/admin/overview',
  },
  adminWorkspaces: {
    path: '/admin/workspaces',
    to: () => '/admin/workspaces',
  },
  adminActivity: {
    path: '/admin/activity',
    to: () => '/admin/activity',
  },
  adminJobs: {
    path: '/admin/jobs',
    to: () => '/admin/jobs',
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
  folder: {
    path: '/workspaces/:workspaceSlug/folders/:folderId',
    to: ({ folderId, workspaceSlug }: FolderParams) =>
      `/workspaces/${encodePathSegment(workspaceSlug)}/folders/${encodePathSegment(folderId)}`,
  },
  diagram: {
    path: '/workspaces/:workspaceSlug/folders/:folderId/diagrams/:diagramId',
    to: ({ diagramId, folderId, workspaceSlug }: DiagramParams) =>
      `/workspaces/${encodePathSegment(workspaceSlug)}/folders/${encodePathSegment(folderId)}/diagrams/${encodePathSegment(diagramId)}`,
  },
  workspaceDiagram: {
    path: '/workspaces/:workspaceSlug/diagrams/:diagramId',
    to: ({ diagramId, workspaceSlug }: WorkspaceDiagramParams) =>
      `/workspaces/${encodePathSegment(workspaceSlug)}/diagrams/${encodePathSegment(diagramId)}`,
  },
} as const;
