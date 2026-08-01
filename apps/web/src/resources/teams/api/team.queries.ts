import type { PaginationQuery } from '@tabliodb/shared';
import type {
  TeamListQuery,
  TeamListResponseDto,
  TeamMemberListResponseDto,
  TeamProjectAccessListResponseDto,
} from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { teamsKeys } from './team.keys';

type TeamsQueries = {
  list: (query: TeamListQuery) => AppQueryOptions<TeamListResponseDto, ReturnType<typeof teamsKeys.list>>;
  members: (
    teamId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<TeamMemberListResponseDto, ReturnType<typeof teamsKeys.members>>;
  projectAccesses: (
    teamId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<TeamProjectAccessListResponseDto, ReturnType<typeof teamsKeys.projectAccesses>>;
};

export const teamsQueries: TeamsQueries = {
  list: (query: TeamListQuery) =>
    appQueryOptions({
      enabled: Boolean(query.organizationId),
      queryFn: () => sdk.teams.list(query),
      queryKey: teamsKeys.list(query),
    }),

  members: (teamId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(teamId),
      queryFn: () => sdk.teams.listMembers(teamId, query),
      queryKey: teamsKeys.members(teamId, query),
    }),

  projectAccesses: (teamId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(teamId),
      queryFn: () => sdk.teams.listProjectAccesses(teamId, query),
      queryKey: teamsKeys.projectAccesses(teamId, query),
    }),
};
