import {
  exportDiagram,
  getDiagramEffectiveAccess,
  getDiagramMembers,
  getDiagramReviewEvents,
  getDiagramReviewSummary,
  getProjectDiagrams,
  getWorkspaceDiagrams,
  type DiagramExportResponseDtoOutput,
  type DiagramEffectiveAccessListResponseDtoOutput,
  type DiagramListResponseDtoOutput,
  type DiagramMemberListResponseDtoOutput,
  type DiagramReviewEventListResponseDtoOutput,
  type DiagramReviewSummaryDtoOutput,
  type DiagramResponseDtoOutput,
  type OrganizationDtoOutput,
  type ProjectResponseDtoOutput,
} from '@tabliodb/sdk';
import type { PaginationQuery } from '@tabliodb/shared';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { diagramsKeys, type DiagramExportQuery } from './diagram.keys';

export const defaultDiagramName = 'Main schema';

type DiagramsQueries = {
  effectiveAccess: (
    diagramId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<
    DiagramEffectiveAccessListResponseDtoOutput,
    ReturnType<typeof diagramsKeys.effectiveAccessByDiagram>
  >;
  exportByDiagram: (
    diagramId: string,
    query?: DiagramExportQuery,
  ) => AppQueryOptions<DiagramExportResponseDtoOutput, ReturnType<typeof diagramsKeys.exportByDiagram>>;
  listByProject: (
    projectId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<DiagramListResponseDtoOutput, ReturnType<typeof diagramsKeys.listByProject>>;
  listByWorkspace: (
    organizationId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<DiagramListResponseDtoOutput, ReturnType<typeof diagramsKeys.listByWorkspace>>;
  listForProject: (
    project: ProjectResponseDtoOutput | null,
  ) => AppQueryOptions<DiagramResponseDtoOutput[], ReturnType<typeof diagramsKeys.listItemsByProject>>;
  listForWorkspace: (
    organization: OrganizationDtoOutput | null,
  ) => AppQueryOptions<DiagramResponseDtoOutput[], ReturnType<typeof diagramsKeys.listItemsByWorkspace>>;
  members: (
    diagramId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<DiagramMemberListResponseDtoOutput, ReturnType<typeof diagramsKeys.membersByDiagram>>;
  reviewEvents: (
    diagramId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<DiagramReviewEventListResponseDtoOutput, ReturnType<typeof diagramsKeys.reviewEventsByDiagram>>;
  reviewSummary: (
    diagramId: string,
  ) => AppQueryOptions<DiagramReviewSummaryDtoOutput, ReturnType<typeof diagramsKeys.reviewSummary>>;
};

export const diagramsQueries: DiagramsQueries = {
  effectiveAccess: (diagramId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(diagramId),
      queryFn: () => getDiagramEffectiveAccess({ diagramId, ...query }),
      queryKey: diagramsKeys.effectiveAccessByDiagram(diagramId, query),
    }),

  exportByDiagram: (diagramId: string, query: DiagramExportQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(diagramId),
      queryFn: () => exportDiagram({ diagramId, ...query }),
      queryKey: diagramsKeys.exportByDiagram(diagramId, query),
    }),

  listByProject: (projectId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(projectId),
      queryFn: () => getProjectDiagrams({ projectId, ...query }),
      queryKey: diagramsKeys.listByProject(projectId, query),
    }),

  listByWorkspace: (organizationId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(organizationId),
      queryFn: () => getWorkspaceDiagrams({ organizationId, ...query }),
      queryKey: diagramsKeys.listByWorkspace(organizationId, query),
    }),

  listForProject: (project: ProjectResponseDtoOutput | null) =>
    appQueryOptions({
      enabled: Boolean(project?.id),
      queryFn: () => listDiagramsForProject(project),
      queryKey: diagramsKeys.listItemsByProject(project?.id ?? 'missing-project'),
    }),

  listForWorkspace: (organization: OrganizationDtoOutput | null) =>
    appQueryOptions({
      enabled: Boolean(organization?.id),
      queryFn: () => listDiagramsForWorkspace(organization),
      queryKey: diagramsKeys.listItemsByWorkspace(organization?.id ?? 'missing-workspace'),
    }),

  members: (diagramId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(diagramId),
      queryFn: () => getDiagramMembers({ diagramId, ...query }),
      queryKey: diagramsKeys.membersByDiagram(diagramId, query),
    }),

  reviewEvents: (diagramId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(diagramId),
      queryFn: () => getDiagramReviewEvents({ diagramId, ...query }),
      queryKey: diagramsKeys.reviewEventsByDiagram(diagramId, query),
    }),

  reviewSummary: (diagramId: string) =>
    appQueryOptions({
      enabled: Boolean(diagramId),
      queryFn: () => getDiagramReviewSummary({ diagramId }),
      queryKey: diagramsKeys.reviewSummary(diagramId),
    }),
};

async function listDiagramsForProject(project: ProjectResponseDtoOutput | null): Promise<DiagramResponseDtoOutput[]> {
  if (!project) {
    return [];
  }

  const diagrams = await getProjectDiagrams({ limit: 50, projectId: project.id });

  // Diagram creation is an editor action, not a fetch side effect; empty projects render a CTA instead.
  return diagrams.items;
}

async function listDiagramsForWorkspace(
  organization: OrganizationDtoOutput | null,
): Promise<DiagramResponseDtoOutput[]> {
  if (!organization) {
    return [];
  }

  const diagrams = await getWorkspaceDiagrams({ limit: 50, organizationId: organization.id });

  // Workspace listing is the canonical diagram-first feed; folders are just optional metadata on each item.
  return diagrams.items;
}
