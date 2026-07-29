import type { DatabaseDialect } from '@tabliodb/schema-core';
import type { RequestOpts } from '@oazapfts/runtime';
import {
  createDiagram as createDiagramRequest,
  type DiagramCreateDto as GeneratedDiagramCreateDto,
} from '../fetch-client.js';

export type DiagramCreateDto = {
  projectId: string;
  name: string;
  dialect?: DatabaseDialect;
};

export type DiagramResponseDto = {
  createdAt: string;
  dialect: DatabaseDialect;
  id: string;
  name: string;
  projectId: string;
  updatedAt: string;
};

export type DiagramsResource = {
  create: (body: DiagramCreateDto) => Promise<DiagramResponseDto>;
};

export function createDiagramsResource(opts?: RequestOpts): DiagramsResource {
  return {
    create: (body: DiagramCreateDto) =>
      // DatabaseDialect adalah string union domain; generated client memakai enum OpenAPI, wire value-nya tetap sama.
      createDiagramRequest(
        { diagramCreateDto: body as GeneratedDiagramCreateDto },
        opts,
      ) as Promise<DiagramResponseDto>,
  };
}
