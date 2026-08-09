import {
  exportDiagram,
  getDiagramReviewEvents,
  getDiagramReviewSummary,
  getProjectDiagrams,
  type DiagramExportResponseDtoOutput,
  type DiagramListResponseDtoOutput,
  type DiagramReviewEventListResponseDtoOutput,
  type DiagramReviewSummaryDtoOutput,
  type DiagramResponseDtoOutput,
  type ProjectResponseDtoOutput,
} from '@tabliodb/sdk';
import type { PaginationQuery } from '@tabliodb/shared';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { diagramsKeys, type DiagramExportQuery } from './diagram.keys';

export const defaultDiagramName = 'Main schema';

type DiagramsQueries = {
  exportByDiagram: (
    diagramId: string,
    query?: DiagramExportQuery,
  ) => AppQueryOptions<DiagramExportResponseDtoOutput, ReturnType<typeof diagramsKeys.exportByDiagram>>;
  listByProject: (
    projectId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<DiagramListResponseDtoOutput, ReturnType<typeof diagramsKeys.listByProject>>;
  listForProject: (
    project: ProjectResponseDtoOutput | null,
  ) => AppQueryOptions<DiagramResponseDtoOutput[], ReturnType<typeof diagramsKeys.listItemsByProject>>;
  reviewEvents: (
    diagramId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<DiagramReviewEventListResponseDtoOutput, ReturnType<typeof diagramsKeys.reviewEventsByDiagram>>;
  reviewSummary: (
    diagramId: string,
  ) => AppQueryOptions<DiagramReviewSummaryDtoOutput, ReturnType<typeof diagramsKeys.reviewSummary>>;
};

export const diagramsQueries: DiagramsQueries = {
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

  listForProject: (project: ProjectResponseDtoOutput | null) =>
    appQueryOptions({
      enabled: Boolean(project?.id),
      queryFn: () => listDiagramsForProject(project),
      queryKey: diagramsKeys.listItemsByProject(project?.id ?? 'missing-project'),
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
