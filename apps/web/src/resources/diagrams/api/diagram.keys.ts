import type { PaginationQuery } from '@tabliodb/shared';
import type { exportDiagram } from '@tabliodb/sdk';

export type DiagramExportQuery = Omit<Parameters<typeof exportDiagram>[0], 'diagramId'>;

export const diagramsKeys = {
  all: ['diagrams'] as const,
  exports: () => [...diagramsKeys.all, 'export'] as const,
  exportByDiagram: (diagramId: string, query: DiagramExportQuery = {}) =>
    [...diagramsKeys.exports(), { diagramId }, query] as const,
  lists: () => [...diagramsKeys.all, 'list'] as const,
  listByProject: (projectId: string, query: PaginationQuery = {}) =>
    [...diagramsKeys.lists(), { projectId }, query] as const,
  listItemsByProject: (projectId: string) =>
    [...diagramsKeys.lists(), 'items-by-project', { projectId }, { limit: 50 }] as const,
  listByWorkspace: (organizationId: string, query: PaginationQuery = {}) =>
    [...diagramsKeys.lists(), { organizationId }, query] as const,
  listItemsByWorkspace: (organizationId: string) =>
    [...diagramsKeys.lists(), 'items-by-workspace', { organizationId }, { limit: 50 }] as const,
  members: () => [...diagramsKeys.all, 'members'] as const,
  effectiveAccessByDiagram: (diagramId: string, query: PaginationQuery = {}) =>
    [...diagramsKeys.membersRoot(diagramId), 'effective-access', query] as const,
  membersByDiagram: (diagramId: string, query: PaginationQuery = {}) =>
    [...diagramsKeys.members(), { diagramId }, query] as const,
  membersRoot: (diagramId: string) => [...diagramsKeys.members(), { diagramId }] as const,
  reviewEvents: () => [...diagramsKeys.reviews(), 'events'] as const,
  reviewEventsByDiagram: (diagramId: string, query: PaginationQuery = {}) =>
    [...diagramsKeys.reviewEvents(), { diagramId }, query] as const,
  reviewSummary: (diagramId: string) => [...diagramsKeys.reviews(), { diagramId }, 'summary'] as const,
  reviews: () => [...diagramsKeys.all, 'review'] as const,
};
