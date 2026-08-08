import type { PaginationQuery } from '@tabliodb/shared';
import {
  createProject,
  getProjectMembers,
  getProjects,
  Role as GeneratedOrganizationRole,
  type OrganizationDtoOutput,
  type ProjectListResponseDtoOutput,
  type ProjectMemberListResponseDtoOutput,
  type ProjectResponseDtoOutput,
} from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { projectsKeys, type ProjectListQuery } from './project.keys';

export const defaultProjectName = 'Library System';

type ProjectsQueries = {
  list: (query?: ProjectListQuery) => AppQueryOptions<ProjectListResponseDtoOutput, ReturnType<typeof projectsKeys.list>>;
  listOrCreateStarter: (
    organization: OrganizationDtoOutput | null,
  ) => AppQueryOptions<ProjectResponseDtoOutput[], ReturnType<typeof projectsKeys.list>>;
  members: (
    projectId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<ProjectMemberListResponseDtoOutput, ReturnType<typeof projectsKeys.members>>;
};

export const projectsQueries: ProjectsQueries = {
  list: (query: ProjectListQuery = {}) =>
    appQueryOptions({
      queryFn: () => getProjects(query),
      queryKey: projectsKeys.list(query),
    }),

  listOrCreateStarter: (organization: OrganizationDtoOutput | null) =>
    appQueryOptions({
      enabled: Boolean(organization?.id),
      queryFn: () => listOrCreateStarterProjects(organization),
      queryKey: projectsKeys.list({ limit: 50, organizationId: organization?.id ?? undefined }),
    }),

  members: (projectId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(projectId),
      queryFn: () => getProjectMembers({ projectId, ...query }),
      queryKey: projectsKeys.members(projectId, query),
    }),
};

async function listOrCreateStarterProjects(organization: OrganizationDtoOutput | null): Promise<ProjectResponseDtoOutput[]> {
  if (!organization) {
    return [];
  }

  const projects = await getProjects({ limit: 50, organizationId: organization.id });

  if (projects.items.length > 0) {
    return projects.items;
  }

  if (!canCreateAutomaticStarterProject(organization)) {
    // Workspace members may have no direct project access yet; the app should show an empty state instead of creating a duplicate starter project.
    return [];
  }

  // Presentable build tetap membuat starter workspace agar instalasi kosong langsung punya diagram yang bisa dipakai demo.
  const project = await createProject({
    projectCreateDto: {
      description: 'Starter schema workspace',
      name: defaultProjectName,
      organizationId: organization.id,
    },
  });

  return [project];
}

export function canCreateAutomaticStarterProject(organization: OrganizationDtoOutput): boolean {
  return organization.role === GeneratedOrganizationRole.Owner || organization.role === GeneratedOrganizationRole.Admin;
}
