import type { PaginationQuery } from '@tabliodb/shared';
import {
  getTeamMembers,
  getTeamProjectAccesses,
  getTeams,
  type TeamListResponseDtoOutput,
  type TeamMemberListResponseDtoOutput,
  type TeamProjectAccessListResponseDtoOutput,
} from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { teamsKeys, type TeamListQuery } from './team.keys';

type TeamsQueries = {
  list: (query: TeamListQuery) => AppQueryOptions<TeamListResponseDtoOutput, ReturnType<typeof teamsKeys.list>>;
  members: (
    teamId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<TeamMemberListResponseDtoOutput, ReturnType<typeof teamsKeys.members>>;
  projectAccesses: (
    teamId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<TeamProjectAccessListResponseDtoOutput, ReturnType<typeof teamsKeys.projectAccesses>>;
};

export const teamsQueries: TeamsQueries = {
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

  projectAccesses: (teamId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(teamId),
      queryFn: () => getTeamProjectAccesses({ teamId, ...query }),
      queryKey: teamsKeys.projectAccesses(teamId, query),
    }),
};
