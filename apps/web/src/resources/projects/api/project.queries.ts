import type { PaginationQuery } from '@tabliodb/shared';
import type { ProjectListResponseDto, ProjectMemberListResponseDto, ProjectResponseDto } from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { projectsKeys } from './project.keys';

export const defaultProjectName = 'Library System';

type ProjectsQueries = {
  list: (query?: PaginationQuery) => AppQueryOptions<ProjectListResponseDto, ReturnType<typeof projectsKeys.list>>;
  listOrCreateStarter: () => AppQueryOptions<ProjectResponseDto[], ReturnType<typeof projectsKeys.list>>;
  members: (
    projectId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<ProjectMemberListResponseDto, ReturnType<typeof projectsKeys.members>>;
};

export const projectsQueries: ProjectsQueries = {
  list: (query: PaginationQuery = {}) =>
    appQueryOptions({
      queryFn: () => sdk.projects.list(query),
      queryKey: projectsKeys.list(query),
    }),

  listOrCreateStarter: () =>
    appQueryOptions({
      queryFn: listOrCreateStarterProjects,
      queryKey: projectsKeys.list({ limit: 50 }),
    }),

  members: (projectId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(projectId),
      queryFn: () => sdk.projects.listMembers(projectId, query),
      queryKey: projectsKeys.members(projectId, query),
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
