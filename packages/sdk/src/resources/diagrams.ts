import type { DatabaseDialect } from '@tabliodb/schema-core';
import type { RequestOpts } from '@oazapfts/runtime';
import {
  createDiagram as createDiagramRequest,
  type DiagramCreateDto as GeneratedDiagramCreateDto,
  updateDiagram as updateDiagramRequest,
  type DiagramUpdateDto as GeneratedDiagramUpdateDto,
} from '../fetch-client.js';

export type DiagramCreateDto = {
  projectId: string;
  name: string;
  dialect?: DatabaseDialect;
};

export type DiagramUpdateDto = {
  name?: string;
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
  update: (diagramId: string, body: DiagramUpdateDto) => Promise<DiagramResponseDto>;
};

export function createDiagramsResource(opts?: RequestOpts): DiagramsResource {
  return {
    create: (body: DiagramCreateDto) =>
      // DatabaseDialect adalah string union domain; generated client memakai enum OpenAPI, wire value-nya tetap sama.
      createDiagramRequest(
        { diagramCreateDto: body as GeneratedDiagramCreateDto },
        opts,
      ) as Promise<DiagramResponseDto>,
    update: (diagramId: string, body: DiagramUpdateDto) =>
      // Generated OpenAPI enum dan schema-core union berbagi wire value yang sama, jadi casting ini hanya menjaga public SDK tetap domain-friendly.
      updateDiagramRequest(
        { diagramId, diagramUpdateDto: body as GeneratedDiagramUpdateDto },
        opts,
      ) as Promise<DiagramResponseDto>,
  };
}
