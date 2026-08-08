import type { PaginationQuery } from '@tabliodb/shared';
import {
  getCommentDiagramSummary,
  getCommentReplies,
  getCommentThreadReadState,
  getCommentThreadRootComments,
  getCommentThreads,
  getThreadComments,
} from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { commentKeys } from './comment.keys';
import type {
  CommentDiagramSummaryDto,
  CommentListQuery,
  CommentListResponseDto,
  CommentThreadListResponseDto,
  CommentThreadReadStateDto,
} from './comment.types';

type CommentQueries = {
  diagramSummary: (
    diagramId: string,
  ) => AppQueryOptions<CommentDiagramSummaryDto, ReturnType<typeof commentKeys.diagramSummary>>;
  listThreadComments: (
    threadId: string,
    query?: CommentListQuery,
  ) => AppQueryOptions<CommentListResponseDto, ReturnType<typeof commentKeys.threadComments>>;
  listReplies: (
    commentId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<CommentListResponseDto, ReturnType<typeof commentKeys.commentReplies>>;
  listRootComments: (
    threadId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<CommentListResponseDto, ReturnType<typeof commentKeys.rootComments>>;
  readState: (threadId: string) => AppQueryOptions<CommentThreadReadStateDto, ReturnType<typeof commentKeys.readState>>;
  listThreads: (
    diagramId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<CommentThreadListResponseDto, ReturnType<typeof commentKeys.threadsByDiagram>>;
};

export const commentQueries: CommentQueries = {
  diagramSummary: (diagramId: string) =>
    appQueryOptions({
      enabled: Boolean(diagramId),
      queryFn: () => getCommentDiagramSummary({ diagramId }) as Promise<CommentDiagramSummaryDto>,
      queryKey: commentKeys.diagramSummary(diagramId),
    }),
  listThreadComments: (threadId: string, query: CommentListQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(threadId),
      queryFn: () =>
        getThreadComments({
          threadId,
          ...query,
          parentCommentId: query.parentCommentId === null ? 'null' : query.parentCommentId,
        }) as Promise<CommentListResponseDto>,
      queryKey: commentKeys.threadComments(threadId, query),
    }),
  listReplies: (commentId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(commentId),
      queryFn: () => getCommentReplies({ commentId, ...query }) as Promise<CommentListResponseDto>,
      queryKey: commentKeys.commentReplies(commentId, query),
    }),
  listRootComments: (threadId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(threadId),
      queryFn: () => getCommentThreadRootComments({ threadId, ...query }) as Promise<CommentListResponseDto>,
      queryKey: commentKeys.rootComments(threadId, query),
    }),
  readState: (threadId: string) =>
    appQueryOptions({
      enabled: Boolean(threadId),
      queryFn: () => getCommentThreadReadState({ threadId }),
      queryKey: commentKeys.readState(threadId),
    }),
  listThreads: (diagramId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(diagramId),
      queryFn: () => getCommentThreads({ diagramId, ...query }) as Promise<CommentThreadListResponseDto>,
      queryKey: commentKeys.threadsByDiagram(diagramId, query),
    }),
};
