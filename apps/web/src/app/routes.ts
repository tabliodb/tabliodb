type WorkspaceParams = {
  workspaceSlug: string;
};

type ProjectParams = WorkspaceParams & {
  projectId: string;
};

type DiagramParams = ProjectParams & {
  diagramId: string;
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
