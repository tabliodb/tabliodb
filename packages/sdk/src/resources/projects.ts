import type { Paginated, PaginationQuery } from '@tabliodb/shared';
import type { RequestOpts } from '@oazapfts/runtime';
import {
  createProject as createProjectRequest,
  getProjectDiagrams,
  getProjects,
} from '../fetch-client.js';
import type { DiagramResponseDto } from './diagrams.js';

export type ProjectCreateDto = {
  description?: string;
  name: string;
  organizationId?: string;
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

export type ProjectListResponseDto = Paginated<ProjectResponseDto>;
export type DiagramListResponseDto = Paginated<DiagramResponseDto>;

export type ProjectsResource = {
  create: (body: ProjectCreateDto) => Promise<ProjectResponseDto>;
  list: (query?: PaginationQuery) => Promise<ProjectListResponseDto>;
  listDiagrams: (projectId: string, query?: PaginationQuery) => Promise<DiagramListResponseDto>;
};

export function createProjectsResource(opts?: RequestOpts): ProjectsResource {
  return {
    list: (query: PaginationQuery = {}) => getProjects(query, opts) as Promise<ProjectListResponseDto>,
    create: (body: ProjectCreateDto) =>
      createProjectRequest({ projectCreateDto: body }, opts) as Promise<ProjectResponseDto>,
    listDiagrams: (projectId: string, query: PaginationQuery = {}) =>
      getProjectDiagrams({ projectId, ...query }, opts) as Promise<DiagramListResponseDto>,
  };
}
