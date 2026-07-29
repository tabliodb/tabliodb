import type { DatabaseDialect } from '@tabliodb/schema-core';
import type { TabliodbClient } from '../fetch-client.js';

export type DiagramCreateDto = {
  projectId: string;
  name: string;
  dialect?: DatabaseDialect;
};

export type DiagramResponseDto = {
  id: string;
  projectId: string;
  name: string;
  dialect: DatabaseDialect;
  createdAt: string;
  updatedAt: string;
};

export function createDiagramsResource(client: TabliodbClient) {
  return {
    create: (body: DiagramCreateDto) => client.request<DiagramResponseDto>('/diagrams', { body, method: 'POST' }),
  };
}
