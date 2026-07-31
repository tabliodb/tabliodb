import type { PaginationQuery } from '@tabliodb/shared';

export const commentKeys = {
  all: ['comments'] as const,
  commentLists: () => [...commentKeys.all, 'comment-list'] as const,
  readState: (threadId: string) => [...commentKeys.all, 'read-state', threadId] as const,
  readStates: () => [...commentKeys.all, 'read-state'] as const,
  threadComments: (threadId: string, query: PaginationQuery = {}) =>
    [...commentKeys.commentLists(), 'thread', threadId, query] as const,
  threadLists: () => [...commentKeys.all, 'thread-list'] as const,
  threadsByDiagram: (diagramId: string, query: PaginationQuery = {}) =>
    [...commentKeys.threadLists(), 'diagram', diagramId, query] as const,
};
