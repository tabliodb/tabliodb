import type { PaginationQuery } from '@tabliodb/shared';
import type { CommentListQuery } from './comment.types';

export const commentKeys = {
  all: ['comments'] as const,
  commentLists: () => [...commentKeys.all, 'comment-list'] as const,
  commentReplies: (commentId: string, query: PaginationQuery = {}) =>
    [...commentKeys.commentLists(), 'comment', commentId, 'replies', query] as const,
  diagramSummary: (diagramId: string) => [...commentKeys.summaries(), 'diagram', diagramId] as const,
  readState: (threadId: string) => [...commentKeys.all, 'read-state', threadId] as const,
  readStates: () => [...commentKeys.all, 'read-state'] as const,
  rootComments: (threadId: string, query: PaginationQuery = {}) =>
    [...commentKeys.commentLists(), 'thread', threadId, 'root', query] as const,
  summaries: () => [...commentKeys.all, 'summary'] as const,
  threadComments: (threadId: string, query: CommentListQuery = {}) =>
    [...commentKeys.commentLists(), 'thread', threadId, query] as const,
  threadLists: () => [...commentKeys.all, 'thread-list'] as const,
  threadsByDiagram: (diagramId: string, query: PaginationQuery = {}) =>
    [...commentKeys.threadLists(), 'diagram', diagramId, query] as const,
};
