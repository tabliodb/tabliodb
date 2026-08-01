import { OrganizationRole, type PaginationQuery } from '@tabliodb/shared';
import type {
  OrganizationDto,
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
    organization: OrganizationDto | null,
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

  listOrCreateStarter: (organization: OrganizationDto | null) =>
    appQueryOptions({
      enabled: Boolean(organization?.id),
      queryFn: () => listOrCreateStarterProjects(organization),
      queryKey: projectsKeys.list({ limit: 50, organizationId: organization?.id ?? undefined }),
    }),

  members: (projectId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(projectId),
      queryFn: () => sdk.projects.listMembers(projectId, query),
      queryKey: projectsKeys.members(projectId, query),
    }),
};

async function listOrCreateStarterProjects(organization: OrganizationDto | null): Promise<ProjectResponseDto[]> {
  if (!organization) {
    return [];
  }

  const projects = await sdk.projects.list({ limit: 50, organizationId: organization.id });

  if (projects.items.length > 0) {
    return projects.items;
  }

  if (!canCreateAutomaticStarterProject(organization)) {
    // Workspace members may have no direct project access yet; the app should show an empty state instead of creating a duplicate starter project.
    return [];
  }

  // Presentable build tetap membuat starter workspace agar instalasi kosong langsung punya diagram yang bisa dipakai demo.
  const project = await sdk.projects.create({
    description: 'Starter schema workspace',
    name: defaultProjectName,
    organizationId: organization.id,
  });

  return [project];
}

export function canCreateAutomaticStarterProject(organization: OrganizationDto): boolean {
  return organization.role === OrganizationRole.Owner || organization.role === OrganizationRole.Admin;
}
