import { queryOptions } from '@tanstack/react-query';
import type { PaginationQuery } from '@tabliodb/shared';
import type { DiagramResponseDto, ProjectResponseDto } from '@tabliodb/sdk';
import { sdk } from '@/services/sdk';
import { diagramsKeys } from './diagram.keys';

export const defaultDiagramName = 'Main schema';

export const diagramsQueries = {
  listByProject: (projectId: string, query: PaginationQuery = {}) =>
    queryOptions({
      enabled: Boolean(projectId),
      queryFn: () => sdk.projects.listDiagrams(projectId, query),
      queryKey: diagramsKeys.listByProject(projectId, query),
    }),

  listOrCreateStarter: (project: ProjectResponseDto | null) =>
    queryOptions({
      enabled: Boolean(project?.id),
      queryFn: () => listOrCreateStarterDiagrams(project),
      queryKey: diagramsKeys.listByProject(project?.id ?? 'missing-project', { limit: 50 }),
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

  const diagram = await sdk.diagrams.create({
    dialect: 'postgresql',
    name: defaultDiagramName,
    projectId: project.id,
  });

  return [diagram];
}
