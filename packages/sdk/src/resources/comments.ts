import type { Paginated, PaginationQuery } from '@tabliodb/shared';
import type { RequestOpts } from '@oazapfts/runtime';
import {
  createCommentThread as createCommentThreadRequest,
  getCommentThreads,
  type CommentThreadCreateDto as GeneratedCommentThreadCreateDto,
  type CommentThreadListItemDtoOutput,
  type CommentThreadListResponseDtoOutput,
  type CommentThreadResponseDtoOutput,
} from '../fetch-client.js';

export type CommentThreadCreateDto = GeneratedCommentThreadCreateDto;

export type CommentThreadResponseDto = CommentThreadResponseDtoOutput;
export type CommentThreadListItemDto = CommentThreadListItemDtoOutput;

export type CommentThreadListResponseDto = Paginated<CommentThreadListItemDto>;

export function createCommentsResource(opts?: RequestOpts) {
  return {
    createThread: (body: CommentThreadCreateDto) =>
      createCommentThreadRequest({ commentThreadCreateDto: body }, opts) as Promise<CommentThreadResponseDto>,
    listThreads: (diagramId: string, query: PaginationQuery = {}) =>
      getCommentThreads({ diagramId, ...query }, opts) as Promise<CommentThreadListResponseDtoOutput>,
  };
}
