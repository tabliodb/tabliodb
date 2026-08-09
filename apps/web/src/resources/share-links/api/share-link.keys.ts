import type { PaginationQuery } from '@tabliodb/shared';

export const shareLinkKeys = {
  all: ['share-links'] as const,
  lists: () => [...shareLinkKeys.all, 'list'] as const,
  listByDiagram: (diagramId: string, query: PaginationQuery = {}) =>
    [...shareLinkKeys.lists(), { diagramId }, query] as const,
  public: () => [...shareLinkKeys.all, 'public'] as const,
  publicByToken: (token: string) => [...shareLinkKeys.public(), { token }] as const,
};
