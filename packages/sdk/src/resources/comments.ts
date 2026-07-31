import type { Paginated, PaginationQuery } from '@tabliodb/shared';
import type { RequestOpts } from '@oazapfts/runtime';
import type {
  CommentReplyCreateDto as GeneratedCommentReplyCreateDto,
  CommentThreadCreateDto as GeneratedCommentThreadCreateDto,
} from '../fetch-client.js';
import {
  createCommentThread as createCommentThreadRequest,
  getCommentThreadReadState,
  getCommentThreads,
  getThreadComments,
  markCommentThreadRead,
  replyToCommentThread,
  resolveCommentThread,
  unresolveCommentThread,
} from '../fetch-client.js';

export type CommentTargetType =
  'check' | 'column' | 'diagram' | 'enum' | 'group' | 'index' | 'note' | 'relationship' | 'table';

export type CommentAuthorDto = {
  avatarUrl: string | null;
  cursorColor: string;
  email: string;
  id: string;
  name: string;
};

export type CommentThreadCreateDto = {
  body: string;
  diagramId: string;
  targetId: string | null;
  targetType: CommentTargetType;
};

export type CommentReplyCreateDto = {
  body: string;
  parentCommentId?: string | null;
};

export type CommentResponseDto = {
  author: CommentAuthorDto;
  body: string;
  bodyFormat: 'markdown';
  createdAt: string;
  createdById: string;
  editedAt: string | null;
  id: string;
  parentCommentId: string | null;
  replyCount: number;
  threadId: string;
  updatedAt: string;
};

export type CommentThreadDto = {
  createdAt: string;
  createdById: string;
  diagramId: string;
  id: string;
  resolvedAt: string | null;
  resolvedById: string | null;
  status: 'open' | 'resolved';
  targetId: string | null;
  targetType: CommentTargetType;
  unreadCount: number;
  updatedAt: string;
};

export type CommentThreadReaderDto = {
  lastReadAt: string;
  lastReadCommentId: string | null;
  user: CommentAuthorDto;
};

export type CommentThreadReadStateDto = {
  lastReadAt: string | null;
  lastReadCommentId: string | null;
  readers: CommentThreadReaderDto[];
  threadId: string;
  totalReaderCount: number;
  unreadCount: number;
  updatedAt: string | null;
};

export type CommentThreadResponseDto = {
  comment: CommentResponseDto;
  thread: CommentThreadDto;
};

export type CommentThreadListItemDto = CommentThreadDto;
export type CommentThreadListResponseDto = Paginated<CommentThreadListItemDto>;
export type CommentListResponseDto = Paginated<CommentResponseDto>;

export type CommentsResource = {
  createThread: (body: CommentThreadCreateDto) => Promise<CommentThreadResponseDto>;
  getThreadReadState: (threadId: string) => Promise<CommentThreadReadStateDto>;
  listThreadComments: (threadId: string, query?: PaginationQuery) => Promise<CommentListResponseDto>;
  listThreads: (diagramId: string, query?: PaginationQuery) => Promise<CommentThreadListResponseDto>;
  markThreadRead: (threadId: string) => Promise<CommentThreadReadStateDto>;
  replyToThread: (threadId: string, body: CommentReplyCreateDto) => Promise<CommentThreadResponseDto>;
  resolveThread: (threadId: string) => Promise<CommentThreadDto>;
  unresolveThread: (threadId: string) => Promise<CommentThreadDto>;
};

export function createCommentsResource(opts?: RequestOpts): CommentsResource {
  return {
    createThread: (body: CommentThreadCreateDto) =>
      // Boundary generated-client tetap privat agar enum OpenAPI tidak bocor ke public SDK surface.
      createCommentThreadRequest(
        { commentThreadCreateDto: body as unknown as GeneratedCommentThreadCreateDto },
        opts,
      ) as Promise<CommentThreadResponseDto>,
    getThreadReadState: (threadId: string) =>
      getCommentThreadReadState({ threadId }, opts) as Promise<CommentThreadReadStateDto>,
    listThreadComments: (threadId: string, query: PaginationQuery = {}) =>
      getThreadComments({ threadId, ...query }, opts) as Promise<CommentListResponseDto>,
    listThreads: (diagramId: string, query: PaginationQuery = {}) =>
      getCommentThreads({ diagramId, ...query }, opts) as Promise<CommentThreadListResponseDto>,
    markThreadRead: (threadId: string) =>
      markCommentThreadRead({ threadId }, opts) as Promise<CommentThreadReadStateDto>,
    replyToThread: (threadId: string, body: CommentReplyCreateDto) =>
      // Reply body tetap memakai tipe public SDK agar web tidak perlu import enum/DTO dari generated fetch-client.
      replyToCommentThread(
        { threadId, commentReplyCreateDto: body as unknown as GeneratedCommentReplyCreateDto },
        opts,
      ) as Promise<CommentThreadResponseDto>,
    resolveThread: (threadId: string) => resolveCommentThread({ threadId }, opts) as Promise<CommentThreadDto>,
    unresolveThread: (threadId: string) => unresolveCommentThread({ threadId }, opts) as Promise<CommentThreadDto>,
  };
}
