import type { PaginationQuery } from '@tabliodb/shared';
import type {
  CommentDiagramSummaryDto,
  CommentListResponseDto,
  CommentThreadListResponseDto,
  CommentThreadReadStateDto,
} from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { commentKeys } from './comment.keys';

type CommentQueries = {
  diagramSummary: (
    diagramId: string,
  ) => AppQueryOptions<CommentDiagramSummaryDto, ReturnType<typeof commentKeys.diagramSummary>>;
  listThreadComments: (
    threadId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<CommentListResponseDto, ReturnType<typeof commentKeys.threadComments>>;
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
      queryFn: () => sdk.comments.getDiagramSummary(diagramId),
      queryKey: commentKeys.diagramSummary(diagramId),
    }),
  listThreadComments: (threadId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(threadId),
      queryFn: () => sdk.comments.listThreadComments(threadId, query),
      queryKey: commentKeys.threadComments(threadId, query),
    }),
  readState: (threadId: string) =>
    appQueryOptions({
      enabled: Boolean(threadId),
      queryFn: () => sdk.comments.getThreadReadState(threadId),
      queryKey: commentKeys.readState(threadId),
    }),
  listThreads: (diagramId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(diagramId),
      queryFn: () => sdk.comments.listThreads(diagramId, query),
      queryKey: commentKeys.threadsByDiagram(diagramId, query),
    }),
};
