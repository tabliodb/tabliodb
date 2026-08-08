import type { PaginationQuery } from '@tabliodb/shared';
import type { getTeams } from '@tabliodb/sdk';

export type TeamListQuery = Parameters<typeof getTeams>[0];

export const teamsKeys = {
  all: ['teams'] as const,
  lists: () => [...teamsKeys.all, 'list'] as const,
  list: (query: TeamListQuery) => [...teamsKeys.lists(), query] as const,
  membersRoot: (teamId: string) => [...teamsKeys.all, 'members', teamId] as const,
  members: (teamId: string, query: PaginationQuery = {}) => [...teamsKeys.membersRoot(teamId), query] as const,
  projectAccessesRoot: (teamId: string) => [...teamsKeys.all, 'project-accesses', teamId] as const,
  projectAccesses: (teamId: string, query: PaginationQuery = {}) =>
    [...teamsKeys.projectAccessesRoot(teamId), query] as const,
};
