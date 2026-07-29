import type { Paginated, PaginationQuery } from '@tabliodb/shared';
import type { RequestOpts } from '@oazapfts/runtime';
import {
  createProject as createProjectRequest,
  getProjectDiagrams,
  getProjects,
  type ProjectCreateDto as GeneratedProjectCreateDto,
  type ProjectListResponseDtoOutput,
  type ProjectResponseDtoOutput,
} from '../fetch-client.js';
import type { DiagramResponseDto } from './diagrams.js';

export type ProjectCreateDto = GeneratedProjectCreateDto;

export type ProjectResponseDto = ProjectResponseDtoOutput;

export type ProjectListResponseDto = Paginated<ProjectResponseDto>;
export type DiagramListResponseDto = Paginated<DiagramResponseDto>;

export function createProjectsResource(opts?: RequestOpts) {
  return {
    list: (query: PaginationQuery = {}) => getProjects(query, opts) as Promise<ProjectListResponseDtoOutput>,
    create: (body: ProjectCreateDto) =>
      createProjectRequest({ projectCreateDto: body }, opts) as Promise<ProjectResponseDto>,
    listDiagrams: (projectId: string, query: PaginationQuery = {}) =>
      getProjectDiagrams({ projectId, ...query }, opts) as Promise<DiagramListResponseDto>,
  };
}
