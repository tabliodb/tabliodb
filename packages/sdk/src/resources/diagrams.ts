import type { DatabaseDialect, DiagramModel } from '@tabliodb/schema-core';
import type { RequestOpts } from '@oazapfts/runtime';
import {
  createDiagram as createDiagramRequest,
  type DiagramCreateDto as GeneratedDiagramCreateDto,
  exportDiagram as exportDiagramRequest,
  importDiagram as importDiagramRequest,
  type DiagramImportDto as GeneratedDiagramImportDto,
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

export type DiagramTransferWarningDto = {
  code: string;
  message: string;
  statement?: string;
  target?: {
    id: string;
    type: string;
  };
};

export type DiagramExportFormat = 'tabliodb_json' | 'sql' | 'markdown' | 'svg';

export type DiagramExportQuery = {
  dialect?: DatabaseDialect;
  format?: DiagramExportFormat;
  includeComments?: boolean;
};

export type DiagramExportResponseDto = {
  content: string;
  filename: string;
  format: DiagramExportFormat;
  mediaType: string;
  warnings: DiagramTransferWarningDto[];
};

export type DiagramImportSource = 'tabliodb_json' | 'sql';

export type DiagramImportDto = {
  content: string;
  dialect?: DatabaseDialect;
  mode?: 'replace';
  source: DiagramImportSource;
};

export type DiagramImportResponseDto = {
  diagram: DiagramResponseDto;
  model: DiagramModel;
  warnings: DiagramTransferWarningDto[];
};

export type DiagramsResource = {
  create: (body: DiagramCreateDto) => Promise<DiagramResponseDto>;
  export: (diagramId: string, query?: DiagramExportQuery) => Promise<DiagramExportResponseDto>;
  import: (diagramId: string, body: DiagramImportDto) => Promise<DiagramImportResponseDto>;
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
    export: (diagramId: string, query: DiagramExportQuery = {}) =>
      exportDiagramRequest({ diagramId, ...query }, opts) as Promise<DiagramExportResponseDto>,
    import: (diagramId: string, body: DiagramImportDto) =>
      importDiagramRequest(
        { diagramId, diagramImportDto: body as unknown as GeneratedDiagramImportDto },
        opts,
      ) as Promise<DiagramImportResponseDto>,
  };
}
