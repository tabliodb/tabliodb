import type { PaginationQuery } from '@tabliodb/shared';

export const diagramsKeys = {
  all: ['diagrams'] as const,
  lists: () => [...diagramsKeys.all, 'list'] as const,
  listByProject: (projectId: string, query: PaginationQuery = {}) =>
    [...diagramsKeys.lists(), { projectId }, query] as const,
};
