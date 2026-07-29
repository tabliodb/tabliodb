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
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export function createProjectsResource(client: TabliodbClient) {
  return {
    list: () => client.request<ProjectResponseDto[]>('/projects'),
    create: (body: ProjectCreateDto) => client.request<ProjectResponseDto>('/projects', { body, method: 'POST' }),
    listDiagrams: (projectId: string) => client.request<DiagramResponseDto[]>(`/projects/${projectId}/diagrams`),
  };
}
