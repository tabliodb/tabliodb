import type { PaginationQuery } from '@tabliodb/shared';
import type {
  ProjectListQuery,
  ProjectListResponseDto,
  ProjectMemberListResponseDto,
  ProjectResponseDto,
} from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { projectsKeys } from './project.keys';

export const defaultProjectName = 'Library System';

type ProjectsQueries = {
  list: (query?: ProjectListQuery) => AppQueryOptions<ProjectListResponseDto, ReturnType<typeof projectsKeys.list>>;
  listOrCreateStarter: (
    organizationId: string | null,
  ) => AppQueryOptions<ProjectResponseDto[], ReturnType<typeof projectsKeys.list>>;
  members: (
    projectId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<ProjectMemberListResponseDto, ReturnType<typeof projectsKeys.members>>;
};

export const projectsQueries: ProjectsQueries = {
  list: (query: ProjectListQuery = {}) =>
    appQueryOptions({
      queryFn: () => sdk.projects.list(query),
      queryKey: projectsKeys.list(query),
    }),

  listOrCreateStarter: (organizationId: string | null) =>
    appQueryOptions({
      enabled: Boolean(organizationId),
      queryFn: () => listOrCreateStarterProjects(organizationId),
      queryKey: projectsKeys.list({ limit: 50, organizationId: organizationId ?? undefined }),
    }),

  members: (projectId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(projectId),
      queryFn: () => sdk.projects.listMembers(projectId, query),
      queryKey: projectsKeys.members(projectId, query),
    }),
};

async function listOrCreateStarterProjects(organizationId: string | null): Promise<ProjectResponseDto[]> {
  if (!organizationId) {
    return [];
  }

  const projects = await sdk.projects.list({ limit: 50, organizationId });

  if (projects.items.length > 0) {
    return projects.items;
  }

  // Presentable build tetap membuat starter workspace agar instalasi kosong langsung punya diagram yang bisa dipakai demo.
  const project = await sdk.projects.create({
    description: 'Starter schema workspace',
    name: defaultProjectName,
    organizationId,
  });

  return [project];
}
