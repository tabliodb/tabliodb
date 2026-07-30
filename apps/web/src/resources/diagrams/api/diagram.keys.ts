import type { PaginationQuery } from '@tabliodb/shared';
import type { DiagramExportQuery } from '@tabliodb/sdk';

export const diagramsKeys = {
  all: ['diagrams'] as const,
  exports: () => [...diagramsKeys.all, 'export'] as const,
  exportByDiagram: (diagramId: string, query: DiagramExportQuery = {}) =>
    [...diagramsKeys.exports(), { diagramId }, query] as const,
  lists: () => [...diagramsKeys.all, 'list'] as const,
  listByProject: (projectId: string, query: PaginationQuery = {}) =>
    [...diagramsKeys.lists(), { projectId }, query] as const,
};
