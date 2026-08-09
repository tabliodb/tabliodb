import type { PaginationQuery } from '@tabliodb/shared';
import {
  getProjectMembers,
  getProjects,
  type OrganizationDtoOutput,
  type ProjectListResponseDtoOutput,
  type ProjectMemberListResponseDtoOutput,
  type ProjectResponseDtoOutput,
} from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { projectsKeys, type ProjectListQuery } from './project.keys';

export const defaultProjectName = 'Library System';

type ProjectsQueries = {
  list: (
    query?: ProjectListQuery,
  ) => AppQueryOptions<ProjectListResponseDtoOutput, ReturnType<typeof projectsKeys.list>>;
  listByOrganization: (
    organization: OrganizationDtoOutput | null,
  ) => AppQueryOptions<ProjectResponseDtoOutput[], ReturnType<typeof projectsKeys.listItemsByOrganization>>;
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

  listByOrganization: (organization: OrganizationDtoOutput | null) =>
    appQueryOptions({
      enabled: Boolean(organization?.id),
      queryFn: () => listProjectsByOrganization(organization),
      queryKey: projectsKeys.listItemsByOrganization(organization?.id ?? 'missing-organization'),
    }),

  members: (projectId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(projectId),
      queryFn: () => getProjectMembers({ projectId, ...query }),
      queryKey: projectsKeys.members(projectId, query),
    }),
};

async function listProjectsByOrganization(
  organization: OrganizationDtoOutput | null,
): Promise<ProjectResponseDtoOutput[]> {
  if (!organization) {
    return [];
  }

  const projects = await getProjects({ limit: 50, organizationId: organization.id });

  // Query layer harus read-only; create project dilakukan lewat intent eksplisit di dialog/empty state.
  return projects.items;
}
