import type { Paginated, PaginationQuery } from '@tabliodb/shared';
import type { TabliodbClient } from '../fetch-client.js';
import type { DiagramResponseDto } from './diagrams.js';

export type ProjectCreateDto = {
  organizationId?: string;
  name: string;
  description?: string;
};

export type ProjectResponseDto = {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectListResponseDto = Paginated<ProjectResponseDto>;
export type DiagramListResponseDto = Paginated<DiagramResponseDto>;

export function createProjectsResource(client: TabliodbClient) {
  return {
    list: (query: PaginationQuery = {}) => client.request<ProjectListResponseDto>('/projects', { query }),
    create: (body: ProjectCreateDto) => client.request<ProjectResponseDto>('/projects', { body, method: 'POST' }),
    listDiagrams: (projectId: string, query: PaginationQuery = {}) =>
      client.request<DiagramListResponseDto>(`/projects/${projectId}/diagrams`, { query }),
  };
}
