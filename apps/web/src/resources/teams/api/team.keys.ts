import type { PaginationQuery } from '@tabliodb/shared';
import type { getTeams } from '@tabliodb/sdk';

export type TeamListQuery = Parameters<typeof getTeams>[0];

export const teamsKeys = {
  all: ['teams'] as const,
  lists: () => [...teamsKeys.all, 'list'] as const,
  list: (query: TeamListQuery) => [...teamsKeys.lists(), query] as const,
  membersRoot: (teamId: string) => [...teamsKeys.all, 'members', teamId] as const,
  members: (teamId: string, query: PaginationQuery = {}) => [...teamsKeys.membersRoot(teamId), query] as const,
  diagramAccessesRoot: (teamId: string) => [...teamsKeys.all, 'diagram-accesses', teamId] as const,
  diagramAccesses: (teamId: string, query: PaginationQuery = {}) =>
    [...teamsKeys.diagramAccessesRoot(teamId), query] as const,
  folderAccessesRoot: (teamId: string) => [...teamsKeys.all, 'folder-accesses', teamId] as const,
  folderAccesses: (teamId: string, query: PaginationQuery = {}) =>
    [...teamsKeys.folderAccessesRoot(teamId), query] as const,
};
