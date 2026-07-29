import type { DatabaseDialect } from '@tabliodb/schema-core';
import type { RequestOpts } from '@oazapfts/runtime';
import {
  createDiagram as createDiagramRequest,
  type DiagramCreateDto as GeneratedDiagramCreateDto,
  type DiagramResponseDtoOutput,
} from '../fetch-client.js';

export type DiagramCreateDto = {
  projectId: string;
  name: string;
  dialect?: DatabaseDialect;
};

export type DiagramResponseDto = Omit<DiagramResponseDtoOutput, 'dialect'> & {
  dialect: DatabaseDialect;
};

export function createDiagramsResource(opts?: RequestOpts) {
  return {
    create: (body: DiagramCreateDto) =>
      // DatabaseDialect adalah string union domain; generated client memakai enum OpenAPI, wire value-nya tetap sama.
      createDiagramRequest(
        { diagramCreateDto: body as GeneratedDiagramCreateDto },
        opts,
      ) as Promise<DiagramResponseDto>,
  };
}
