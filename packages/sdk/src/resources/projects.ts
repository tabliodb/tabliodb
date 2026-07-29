import type { Paginated, PaginationQuery, ProjectRole } from '@tabliodb/shared';
import type { RequestOpts } from '@oazapfts/runtime';
import type {
  ProjectMemberCreateDto as GeneratedProjectMemberCreateDto,
  ProjectMemberUpdateDto as GeneratedProjectMemberUpdateDto,
} from '../fetch-client.js';
import {
  addProjectMember as addProjectMemberRequest,
  archiveProject as archiveProjectRequest,
  createProject as createProjectRequest,
  getProjectMembers,
  getProjectDiagrams,
  getProjects,
  removeProjectMember as removeProjectMemberRequest,
  updateProjectMember as updateProjectMemberRequest,
  updateProject as updateProjectRequest,
} from '../fetch-client.js';
import type { DiagramResponseDto } from './diagrams.js';

export type ProjectCreateDto = {
  description?: string;
  name: string;
  organizationId?: string;
};

export type ProjectUpdateDto = {
  description?: string | null;
  name?: string;
};

export type ProjectResponseDto = {
  createdAt: string;
  description: string | null;
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  slug: string;
  updatedAt: string;
};

export type ProjectArchiveResponseDto = {
  successful: boolean;
};

export type ProjectMemberDto = {
  avatarColor: string | null;
  createdAt: string;
  email: string;
  name: string;
  role: ProjectRole;
  updatedAt: string;
  userId: string;
};

export type ProjectMemberListResponseDto = Paginated<ProjectMemberDto>;

export type ProjectMemberCreateDto = {
  email: string;
  role?: ProjectRole;
};

export type ProjectMemberUpdateDto = {
  role: ProjectRole;
};

export type ProjectMemberRemoveResponseDto = {
  successful: boolean;
};

export type ProjectListResponseDto = Paginated<ProjectResponseDto>;
export type DiagramListResponseDto = Paginated<DiagramResponseDto>;

export type ProjectsResource = {
  addMember: (projectId: string, body: ProjectMemberCreateDto) => Promise<ProjectMemberDto>;
  archive: (projectId: string) => Promise<ProjectArchiveResponseDto>;
  create: (body: ProjectCreateDto) => Promise<ProjectResponseDto>;
  list: (query?: PaginationQuery) => Promise<ProjectListResponseDto>;
  listDiagrams: (projectId: string, query?: PaginationQuery) => Promise<DiagramListResponseDto>;
  listMembers: (projectId: string, query?: PaginationQuery) => Promise<ProjectMemberListResponseDto>;
  removeMember: (projectId: string, userId: string) => Promise<ProjectMemberRemoveResponseDto>;
  update: (projectId: string, body: ProjectUpdateDto) => Promise<ProjectResponseDto>;
  updateMember: (projectId: string, userId: string, body: ProjectMemberUpdateDto) => Promise<ProjectMemberDto>;
};

export function createProjectsResource(opts?: RequestOpts): ProjectsResource {
  return {
    list: (query: PaginationQuery = {}) => getProjects(query, opts) as Promise<ProjectListResponseDto>,
    create: (body: ProjectCreateDto) =>
      createProjectRequest({ projectCreateDto: body }, opts) as Promise<ProjectResponseDto>,
    update: (projectId: string, body: ProjectUpdateDto) =>
      updateProjectRequest({ projectId, projectUpdateDto: body }, opts) as Promise<ProjectResponseDto>,
    archive: (projectId: string) => archiveProjectRequest({ projectId }, opts) as Promise<ProjectArchiveResponseDto>,
    listDiagrams: (projectId: string, query: PaginationQuery = {}) =>
      getProjectDiagrams({ projectId, ...query }, opts) as Promise<DiagramListResponseDto>,
    listMembers: (projectId: string, query: PaginationQuery = {}) =>
      getProjectMembers({ projectId, ...query }, opts) as unknown as Promise<ProjectMemberListResponseDto>,
    addMember: (projectId: string, body: ProjectMemberCreateDto) =>
      // Generated enum stays private; shared ProjectRole remains the SDK surface consumed by app code.
      addProjectMemberRequest(
        { projectId, projectMemberCreateDto: body as unknown as GeneratedProjectMemberCreateDto },
        opts,
      ) as unknown as Promise<ProjectMemberDto>,
    updateMember: (projectId: string, userId: string, body: ProjectMemberUpdateDto) =>
      // This mirrors addMember so generated OpenAPI role enums never leak into app-level resource code.
      updateProjectMemberRequest(
        { projectId, userId, projectMemberUpdateDto: body as unknown as GeneratedProjectMemberUpdateDto },
        opts,
      ) as unknown as Promise<ProjectMemberDto>,
    removeMember: (projectId: string, userId: string) =>
      removeProjectMemberRequest({ projectId, userId }, opts) as Promise<ProjectMemberRemoveResponseDto>,
  };
}
