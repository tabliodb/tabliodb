import type { PaginationQuery } from '@tabliodb/shared';
import {
  getTeamDiagramAccesses,
  getTeamMembers,
  getTeamFolderAccesses,
  getTeams,
  type TeamDiagramAccessListResponseDtoOutput,
  type TeamListResponseDtoOutput,
  type TeamMemberListResponseDtoOutput,
  type TeamFolderAccessListResponseDtoOutput,
} from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { teamsKeys, type TeamListQuery } from './team.keys';

type TeamsQueries = {
  diagramAccesses: (
    teamId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<TeamDiagramAccessListResponseDtoOutput, ReturnType<typeof teamsKeys.diagramAccesses>>;
  list: (query: TeamListQuery) => AppQueryOptions<TeamListResponseDtoOutput, ReturnType<typeof teamsKeys.list>>;
  members: (
    teamId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<TeamMemberListResponseDtoOutput, ReturnType<typeof teamsKeys.members>>;
  folderAccesses: (
    teamId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<TeamFolderAccessListResponseDtoOutput, ReturnType<typeof teamsKeys.folderAccesses>>;
};

export const teamsQueries: TeamsQueries = {
  diagramAccesses: (teamId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(teamId),
      queryFn: () => getTeamDiagramAccesses({ teamId, ...query }),
      queryKey: teamsKeys.diagramAccesses(teamId, query),
    }),

  list: (query: TeamListQuery) =>
    appQueryOptions({
      enabled: Boolean(query.organizationId),
      queryFn: () => getTeams(query),
      queryKey: teamsKeys.list(query),
    }),

  members: (teamId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(teamId),
      queryFn: () => getTeamMembers({ teamId, ...query }),
      queryKey: teamsKeys.members(teamId, query),
    }),

  folderAccesses: (teamId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(teamId),
      queryFn: () => getTeamFolderAccesses({ teamId, ...query }),
      queryKey: teamsKeys.folderAccesses(teamId, query),
    }),
};
