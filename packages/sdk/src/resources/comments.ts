import type { Paginated, PaginationQuery } from '@tabliodb/shared';
import type { RequestOpts } from '@oazapfts/runtime';
import type { CommentThreadCreateDto as GeneratedCommentThreadCreateDto } from '../fetch-client.js';
import {
  createCommentThread as createCommentThreadRequest,
  getCommentThreads,
} from '../fetch-client.js';

export type CommentTargetType = 'column' | 'diagram' | 'enum' | 'note' | 'relationship' | 'table';

export type CommentThreadCreateDto = {
  body: string;
  diagramId: string;
  targetId: string | null;
  targetType: CommentTargetType;
};

export type CommentThreadResponseDto = {
  comment: {
    body: string;
    createdAt: string;
    id: string;
    threadId: string;
    updatedAt: string;
  };
  thread: {
    createdAt: string;
    diagramId: string;
    id: string;
    resolvedAt: string | null;
    targetId: string | null;
    targetType: string;
    updatedAt: string;
  };
};

export type CommentThreadListItemDto = {
  createdAt: string;
  diagramId: string;
  id: string;
  resolvedAt: string | null;
  status: string;
  targetId: string | null;
  targetType: string;
  updatedAt: string;
};

export type CommentThreadListResponseDto = Paginated<CommentThreadListItemDto>;

export type CommentsResource = {
  createThread: (body: CommentThreadCreateDto) => Promise<CommentThreadResponseDto>;
  listThreads: (diagramId: string, query?: PaginationQuery) => Promise<CommentThreadListResponseDto>;
};

export function createCommentsResource(opts?: RequestOpts): CommentsResource {
  return {
    createThread: (body: CommentThreadCreateDto) =>
      // Boundary generated-client tetap privat agar enum OpenAPI tidak bocor ke public SDK surface.
      createCommentThreadRequest(
        { commentThreadCreateDto: body as unknown as GeneratedCommentThreadCreateDto },
        opts,
      ) as Promise<CommentThreadResponseDto>,
    listThreads: (diagramId: string, query: PaginationQuery = {}) =>
      getCommentThreads({ diagramId, ...query }, opts) as Promise<CommentThreadListResponseDto>,
  };
}
