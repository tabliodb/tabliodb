import { queryOptions } from '@tanstack/react-query';
import type { ProjectResponseDto } from '@tabliodb/sdk';
import { sdk } from '@/services/sdk';
import { projectsKeys } from './project.keys';

export const defaultProjectName = 'Library System';

export const projectsQueries = {
  list: () =>
    queryOptions({
      queryFn: () => sdk.projects.list(),
      queryKey: projectsKeys.list(),
    }),

  listOrCreateStarter: () =>
    queryOptions({
      queryFn: listOrCreateStarterProjects,
      queryKey: projectsKeys.list(),
    }),
};

async function listOrCreateStarterProjects(): Promise<ProjectResponseDto[]> {
  const projects = await sdk.projects.list();

  if (projects.length > 0) {
    return projects;
  }

  // Presentable build tetap membuat starter workspace agar instalasi kosong langsung punya diagram yang bisa dipakai demo.
  const project = await sdk.projects.create({
    description: 'Starter schema workspace',
    name: defaultProjectName,
  });

  return [project];
}
