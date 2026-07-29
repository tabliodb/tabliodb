import type { ProjectListQuery } from '@tabliodb/sdk';
import type { PaginationQuery } from '@tabliodb/shared';

export const projectsKeys = {
  all: ['projects'] as const,
  lists: () => [...projectsKeys.all, 'list'] as const,
  list: (query: ProjectListQuery = {}) => [...projectsKeys.lists(), query] as const,
  membersRoot: (projectId: string) => [...projectsKeys.all, 'members', projectId] as const,
  members: (projectId: string, query: PaginationQuery = {}) => [...projectsKeys.membersRoot(projectId), query] as const,
};
