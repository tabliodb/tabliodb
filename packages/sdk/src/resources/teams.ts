import type { Paginated, PaginationQuery, ProjectRole } from '@tabliodb/shared';
import type { RequestOpts } from '@oazapfts/runtime';
import type {
  TeamCreateDto as GeneratedTeamCreateDto,
  TeamMemberCreateDto as GeneratedTeamMemberCreateDto,
  TeamProjectAccessUpsertDto as GeneratedTeamProjectAccessUpsertDto,
  TeamUpdateDto as GeneratedTeamUpdateDto,
} from '../fetch-client.js';
import {
  addTeamMember as addTeamMemberRequest,
  archiveTeam as archiveTeamRequest,
  createTeam as createTeamRequest,
  getTeamMembers,
  getTeamProjectAccesses,
  getTeams,
  removeTeamMember as removeTeamMemberRequest,
  removeTeamProjectAccess as removeTeamProjectAccessRequest,
  updateTeam as updateTeamRequest,
  upsertTeamProjectAccess as upsertTeamProjectAccessRequest,
} from '../fetch-client.js';

export type TeamProjectRole = ProjectRole.Editor | ProjectRole.Commenter | ProjectRole.Viewer;

export type TeamCreateDto = {
  description?: string;
  name: string;
  organizationId: string;
};

export type TeamUpdateDto = {
  description?: string | null;
  name?: string;
};

export type TeamResponseDto = {
  createdAt: string;
  description: string | null;
  id: string;
  memberCount: number;
  name: string;
  organizationId: string;
  projectAccessCount: number;
  slug: string;
  updatedAt: string;
};

export type TeamListQuery = PaginationQuery & {
  organizationId: string;
};

export type TeamListResponseDto = Paginated<TeamResponseDto>;

export type TeamArchiveResponseDto = {
  successful: boolean;
};

export type TeamMemberCreateDto = {
  email: string;
};

export type TeamMemberDto = {
  avatarUrl: string | null;
  createdAt: string;
  cursorColor: string;
  email: string;
  name: string;
  userId: string;
};

export type TeamMemberListResponseDto = Paginated<TeamMemberDto>;

export type TeamMemberRemoveResponseDto = {
  successful: boolean;
};

export type TeamProjectAccessDto = {
  createdAt: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
  role: TeamProjectRole;
  updatedAt: string;
};

export type TeamProjectAccessUpsertDto = {
  projectId: string;
  role?: TeamProjectRole;
};

export type TeamProjectAccessListResponseDto = Paginated<TeamProjectAccessDto>;

export type TeamProjectAccessRemoveResponseDto = {
  successful: boolean;
};

export type TeamsResource = {
  addMember: (teamId: string, body: TeamMemberCreateDto) => Promise<TeamMemberDto>;
  archive: (teamId: string) => Promise<TeamArchiveResponseDto>;
  create: (body: TeamCreateDto) => Promise<TeamResponseDto>;
  list: (query: TeamListQuery) => Promise<TeamListResponseDto>;
  listMembers: (teamId: string, query?: PaginationQuery) => Promise<TeamMemberListResponseDto>;
  listProjectAccesses: (teamId: string, query?: PaginationQuery) => Promise<TeamProjectAccessListResponseDto>;
  removeMember: (teamId: string, userId: string) => Promise<TeamMemberRemoveResponseDto>;
  removeProjectAccess: (teamId: string, projectId: string) => Promise<TeamProjectAccessRemoveResponseDto>;
  update: (teamId: string, body: TeamUpdateDto) => Promise<TeamResponseDto>;
  upsertProjectAccess: (teamId: string, body: TeamProjectAccessUpsertDto) => Promise<TeamProjectAccessDto>;
};

export function createTeamsResource(opts?: RequestOpts): TeamsResource {
  return {
    list: (query: TeamListQuery) => getTeams(query, opts) as unknown as Promise<TeamListResponseDto>,
    create: (body: TeamCreateDto) =>
      createTeamRequest(
        { teamCreateDto: body as unknown as GeneratedTeamCreateDto },
        opts,
      ) as unknown as Promise<TeamResponseDto>,
    update: (teamId: string, body: TeamUpdateDto) =>
      updateTeamRequest(
        { teamId, teamUpdateDto: body as unknown as GeneratedTeamUpdateDto },
        opts,
      ) as unknown as Promise<TeamResponseDto>,
    archive: (teamId: string) => archiveTeamRequest({ teamId }, opts) as Promise<TeamArchiveResponseDto>,
    listMembers: (teamId: string, query: PaginationQuery = {}) =>
      getTeamMembers({ teamId, ...query }, opts) as unknown as Promise<TeamMemberListResponseDto>,
    addMember: (teamId: string, body: TeamMemberCreateDto) =>
      addTeamMemberRequest(
        { teamId, teamMemberCreateDto: body as unknown as GeneratedTeamMemberCreateDto },
        opts,
      ) as unknown as Promise<TeamMemberDto>,
    removeMember: (teamId: string, userId: string) =>
      removeTeamMemberRequest({ teamId, userId }, opts) as Promise<TeamMemberRemoveResponseDto>,
    listProjectAccesses: (teamId: string, query: PaginationQuery = {}) =>
      getTeamProjectAccesses({ teamId, ...query }, opts) as unknown as Promise<TeamProjectAccessListResponseDto>,
    upsertProjectAccess: (teamId: string, body: TeamProjectAccessUpsertDto) =>
      // Team project roles intentionally exclude owner; app-facing SDK keeps that narrower union explicit.
      upsertTeamProjectAccessRequest(
        { teamId, teamProjectAccessUpsertDto: body as unknown as GeneratedTeamProjectAccessUpsertDto },
        opts,
      ) as unknown as Promise<TeamProjectAccessDto>,
    removeProjectAccess: (teamId: string, projectId: string) =>
      removeTeamProjectAccessRequest({ teamId, projectId }, opts) as Promise<TeamProjectAccessRemoveResponseDto>,
  };
}
