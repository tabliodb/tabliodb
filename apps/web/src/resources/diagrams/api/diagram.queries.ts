import { Permission, ProjectRole, isGranted, permissionsForProjectRole, type PaginationQuery } from '@tabliodb/shared';
import {
  Dialect,
  createDiagram,
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
  listOrCreateStarter: (
    project: ProjectResponseDtoOutput | null,
  ) => AppQueryOptions<DiagramResponseDtoOutput[], ReturnType<typeof diagramsKeys.listByProject>>;
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

  listOrCreateStarter: (project: ProjectResponseDtoOutput | null) =>
    appQueryOptions({
      enabled: Boolean(project?.id),
      queryFn: () => listOrCreateStarterDiagrams(project),
      queryKey: diagramsKeys.listByProject(project?.id ?? 'missing-project', { limit: 50 }),
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

async function listOrCreateStarterDiagrams(project: ProjectResponseDtoOutput | null): Promise<DiagramResponseDtoOutput[]> {
  if (!project) {
    return [];
  }

  const diagrams = await getProjectDiagrams({ limit: 50, projectId: project.id });

  if (diagrams.items.length > 0) {
    return diagrams.items;
  }

  if (
    !isGranted({
      current: permissionsForProjectRole(project.projectRole as unknown as ProjectRole),
      requested: [Permission.DiagramCreate],
    })
  ) {
    // Read-only project members should see an empty state instead of triggering a forbidden starter-write.
    return [];
  }

  const diagram = await createDiagram({
    diagramCreateDto: {
      dialect: Dialect.Postgresql,
      name: defaultDiagramName,
      projectId: project.id,
    },
  });

  return [diagram];
}
