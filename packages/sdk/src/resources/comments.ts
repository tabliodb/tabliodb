import type { Paginated, PaginationQuery } from '@tabliodb/shared';
import type { TabliodbClient } from '../fetch-client.js';

export type CommentThreadCreateDto = {
  diagramId: string;
  targetType: 'table' | 'column' | 'relationship' | 'enum' | 'note' | 'diagram';
  targetId: string | null;
  body: string;
};

export type CommentThreadListItemDto = {
  createdAt: string;
  diagramId: string;
  id: string;
  resolvedAt: string | null;
  status: string;
  targetId: string;
  targetType: string;
  updatedAt: string;
};

export type CommentThreadListResponseDto = Paginated<CommentThreadListItemDto>;

export function createCommentsResource(client: TabliodbClient) {
  return {
    createThread: (body: CommentThreadCreateDto) => client.request('/comments/threads', { body, method: 'POST' }),
    listThreads: (diagramId: string, query: PaginationQuery = {}) =>
      client.request<CommentThreadListResponseDto>(`/comments/diagram/${diagramId}/threads`, { query }),
  };
}
