import { queryOptions } from '@tanstack/react-query';
import type { PaginationQuery } from '@tabliodb/shared';
import type { ProjectResponseDto } from '@tabliodb/sdk';
import { sdk } from '@/services/sdk';
import { projectsKeys } from './project.keys';

export const defaultProjectName = 'Library System';

export const projectsQueries = {
  list: (query: PaginationQuery = {}) =>
    queryOptions({
      queryFn: () => sdk.projects.list(query),
      queryKey: projectsKeys.list(query),
    }),

  listOrCreateStarter: () =>
    queryOptions({
      queryFn: listOrCreateStarterProjects,
      queryKey: projectsKeys.list({ limit: 50 }),
    }),
};

async function listOrCreateStarterProjects(): Promise<ProjectResponseDto[]> {
  const projects = await sdk.projects.list({ limit: 50 });

  if (projects.items.length > 0) {
    return projects.items;
  }

  // Presentable build tetap membuat starter workspace agar instalasi kosong langsung punya diagram yang bisa dipakai demo.
  const project = await sdk.projects.create({
    description: 'Starter schema workspace',
    name: defaultProjectName,
  });

  return [project];
}
