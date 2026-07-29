import { queryOptions } from '@tanstack/react-query';
import type { DiagramResponseDto, ProjectResponseDto } from '@tabliodb/sdk';
import { sdk } from '@/services/sdk';
import { diagramsKeys } from './diagram.keys';

export const defaultDiagramName = 'Main schema';

export const diagramsQueries = {
  listByProject: (projectId: string) =>
    queryOptions({
      enabled: Boolean(projectId),
      queryFn: () => sdk.projects.listDiagrams(projectId),
      queryKey: diagramsKeys.listByProject(projectId),
    }),

  listOrCreateStarter: (project: ProjectResponseDto | null) =>
    queryOptions({
      enabled: Boolean(project?.id),
      queryFn: () => listOrCreateStarterDiagrams(project),
      queryKey: diagramsKeys.listByProject(project?.id ?? 'missing-project'),
    }),
};

async function listOrCreateStarterDiagrams(project: ProjectResponseDto | null): Promise<DiagramResponseDto[]> {
  if (!project) {
    return [];
  }

  const diagrams = await sdk.projects.listDiagrams(project.id);

  if (diagrams.length > 0) {
    return diagrams;
  }

  const diagram = await sdk.diagrams.create({
    dialect: 'postgresql',
    name: defaultDiagramName,
    projectId: project.id,
  });

  return [diagram];
}
