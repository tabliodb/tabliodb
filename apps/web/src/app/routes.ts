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
