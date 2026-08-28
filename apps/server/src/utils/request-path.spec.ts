import { describe, expect, it } from 'vitest';
import { getRequestRoutePattern, sanitizeRequestPath } from './request-path.js';

describe(sanitizeRequestPath.name, () => {
  it('redacts token route segments from public endpoints', () => {
    expect(sanitizeRequestPath('/api/public/share-links/raw-share-token')).toBe('/api/public/share-links/:token');
    expect(sanitizeRequestPath('/api/invitations/raw-invite-token')).toBe('/api/invitations/:token');
  });

  it('redacts sensitive query values without hiding safe filters', () => {
    expect(sanitizeRequestPath('/api/folders?apiKey=secret&cursor=page-2&refreshToken=raw&sessionkey=local')).toBe(
      '/api/folders?apiKey=%5Bredacted%5D&cursor=page-2&refreshToken=%5Bredacted%5D&sessionkey=%5Bredacted%5D',
    );
  });

  it('uses express route patterns for low-cardinality metrics', () => {
    expect(
      getRequestRoutePattern({
        originalUrl: '/api/folders/folder-id/diagrams?cursor=next-token',
        route: {
          path: '/api/folders/:folderId/diagrams',
        },
      }),
    ).toBe('/api/folders/:folderId/diagrams');
  });
});
