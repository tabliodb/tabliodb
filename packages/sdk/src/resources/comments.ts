import type { TabliodbClient } from '../fetch-client.js';

export type CommentThreadCreateDto = {
  diagramId: string;
  targetType: 'table' | 'column' | 'relationship' | 'enum' | 'note' | 'diagram';
  targetId: string;
  body: string;
};

export function createCommentsResource(client: TabliodbClient) {
  return {
    createThread: (body: CommentThreadCreateDto) => client.request('/comments/threads', { body, method: 'POST' }),
    listThreads: (diagramId: string) => client.request(`/comments/diagram/${diagramId}/threads`),
  };
}
