import type { DatabaseDialect, DiagramModel } from '@tabliodb/schema-core';
import type { Paginated, PaginationQuery } from '@tabliodb/shared';
import type { RequestOpts } from '@oazapfts/runtime';
import {
  createDiagramReviewAction as createDiagramReviewActionRequest,
  createDiagram as createDiagramRequest,
  type DiagramReviewActionCreateDto as GeneratedDiagramReviewActionCreateDto,
  type DiagramCreateDto as GeneratedDiagramCreateDto,
  exportDiagram as exportDiagramRequest,
  getDiagramReviewEvents as getDiagramReviewEventsRequest,
  getDiagramReviewSummary as getDiagramReviewSummaryRequest,
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

export type DiagramReviewStatus = 'approved' | 'changes_requested' | 'draft' | 'reviewed';
export type DiagramReviewAction = 'approved' | 'changes_requested' | 'commented';

export type DiagramResponseDto = {
  createdAt: string;
  dialect: DatabaseDialect;
  id: string;
  name: string;
  projectId: string;
  status: DiagramReviewStatus;
  updatedAt: string;
};

export type DiagramReviewActorDto = {
  avatarUrl: string | null;
  cursorColor: string;
  email: string;
  id: string;
  name: string;
};

export type DiagramReviewEventDto = {
  action: DiagramReviewAction;
  createdAt: string;
  createdById: string;
  diagramId: string;
  id: string;
  message: string | null;
  nextStatus: DiagramReviewStatus;
  previousStatus: DiagramReviewStatus;
  reviewer: DiagramReviewActorDto;
  snapshotId: string | null;
};

export type DiagramReviewActionCreateDto = {
  action: DiagramReviewAction;
  message?: string | null;
};

export type DiagramReviewSummaryDto = {
  approvedCount: number;
  changesRequestedCount: number;
  commentedCount: number;
  currentStatus: DiagramReviewStatus;
  diagramId: string;
  eventCount: number;
  latestEvent: DiagramReviewEventDto | null;
  recentEvents: DiagramReviewEventDto[];
};

export type DiagramReviewEventListResponseDto = Paginated<DiagramReviewEventDto>;

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
  createReviewAction: (diagramId: string, body: DiagramReviewActionCreateDto) => Promise<DiagramReviewSummaryDto>;
  create: (body: DiagramCreateDto) => Promise<DiagramResponseDto>;
  export: (diagramId: string, query?: DiagramExportQuery) => Promise<DiagramExportResponseDto>;
  getReviewSummary: (diagramId: string) => Promise<DiagramReviewSummaryDto>;
  import: (diagramId: string, body: DiagramImportDto) => Promise<DiagramImportResponseDto>;
  listReviewEvents: (diagramId: string, query?: PaginationQuery) => Promise<DiagramReviewEventListResponseDto>;
  update: (diagramId: string, body: DiagramUpdateDto) => Promise<DiagramResponseDto>;
};

export function createDiagramsResource(opts?: RequestOpts): DiagramsResource {
  return {
    createReviewAction: (diagramId: string, body: DiagramReviewActionCreateDto) =>
      createDiagramReviewActionRequest(
        {
          diagramId,
          diagramReviewActionCreateDto: body as unknown as GeneratedDiagramReviewActionCreateDto,
        },
        opts,
      ) as unknown as Promise<DiagramReviewSummaryDto>,
    create: (body: DiagramCreateDto) =>
      // DatabaseDialect adalah string union domain; generated client memakai enum OpenAPI, wire value-nya tetap sama.
      createDiagramRequest(
        { diagramCreateDto: body as GeneratedDiagramCreateDto },
        opts,
      ) as Promise<DiagramResponseDto>,
    getReviewSummary: (diagramId: string) =>
      getDiagramReviewSummaryRequest({ diagramId }, opts) as unknown as Promise<DiagramReviewSummaryDto>,
    listReviewEvents: (diagramId: string, query: PaginationQuery = {}) =>
      getDiagramReviewEventsRequest(
        { diagramId, ...query },
        opts,
      ) as unknown as Promise<DiagramReviewEventListResponseDto>,
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
