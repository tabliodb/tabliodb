import { Permission, isGranted, permissionsForProjectRole, type PaginationQuery } from '@tabliodb/shared';
import type {
  DiagramExportQuery,
  DiagramExportResponseDto,
  DiagramListResponseDto,
  DiagramReviewEventListResponseDto,
  DiagramReviewSummaryDto,
  DiagramResponseDto,
  ProjectResponseDto,
} from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { diagramsKeys } from './diagram.keys';

export const defaultDiagramName = 'Main schema';

type DiagramsQueries = {
  exportByDiagram: (
    diagramId: string,
    query?: DiagramExportQuery,
  ) => AppQueryOptions<DiagramExportResponseDto, ReturnType<typeof diagramsKeys.exportByDiagram>>;
  listByProject: (
    projectId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<DiagramListResponseDto, ReturnType<typeof diagramsKeys.listByProject>>;
  listOrCreateStarter: (
    project: ProjectResponseDto | null,
  ) => AppQueryOptions<DiagramResponseDto[], ReturnType<typeof diagramsKeys.listByProject>>;
  reviewEvents: (
    diagramId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<DiagramReviewEventListResponseDto, ReturnType<typeof diagramsKeys.reviewEventsByDiagram>>;
  reviewSummary: (diagramId: string) => AppQueryOptions<DiagramReviewSummaryDto, ReturnType<typeof diagramsKeys.reviewSummary>>;
};

export const diagramsQueries: DiagramsQueries = {
  exportByDiagram: (diagramId: string, query: DiagramExportQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(diagramId),
      queryFn: () => sdk.diagrams.export(diagramId, query),
      queryKey: diagramsKeys.exportByDiagram(diagramId, query),
    }),

  listByProject: (projectId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(projectId),
      queryFn: () => sdk.projects.listDiagrams(projectId, query),
      queryKey: diagramsKeys.listByProject(projectId, query),
    }),

  listOrCreateStarter: (project: ProjectResponseDto | null) =>
    appQueryOptions({
      enabled: Boolean(project?.id),
      queryFn: () => listOrCreateStarterDiagrams(project),
      queryKey: diagramsKeys.listByProject(project?.id ?? 'missing-project', { limit: 50 }),
    }),

  reviewEvents: (diagramId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(diagramId),
      queryFn: () => sdk.diagrams.listReviewEvents(diagramId, query),
      queryKey: diagramsKeys.reviewEventsByDiagram(diagramId, query),
    }),

  reviewSummary: (diagramId: string) =>
    appQueryOptions({
      enabled: Boolean(diagramId),
      queryFn: () => sdk.diagrams.getReviewSummary(diagramId),
      queryKey: diagramsKeys.reviewSummary(diagramId),
    }),
};

async function listOrCreateStarterDiagrams(project: ProjectResponseDto | null): Promise<DiagramResponseDto[]> {
  if (!project) {
    return [];
  }

  const diagrams = await sdk.projects.listDiagrams(project.id, { limit: 50 });

  if (diagrams.items.length > 0) {
    return diagrams.items;
  }

  if (!isGranted({ current: permissionsForProjectRole(project.projectRole), requested: [Permission.DiagramCreate] })) {
    // Read-only project members should see an empty state instead of triggering a forbidden starter-write.
    return [];
  }

  const diagram = await sdk.diagrams.create({
    dialect: 'postgresql',
    name: defaultDiagramName,
    projectId: project.id,
  });

  return [diagram];
}
