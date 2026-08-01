import { describe, expect, it, vi } from 'vitest';
import { TabliodbHeader } from '../constants.js';
import { requestIdMiddleware } from './request-id.middleware.js';

describe('requestIdMiddleware', () => {
  it('keeps an existing request id and echoes it on the response', () => {
    const request = {
      headers: {
        [TabliodbHeader.RequestId]: 'edge-request-id',
      },
    };
    const response = {
      setHeader: vi.fn(),
    };
    const next = vi.fn();

    requestIdMiddleware()(request as never, response as never, next);

    expect(request.headers[TabliodbHeader.RequestId]).toBe('edge-request-id');
    expect(response.setHeader).toHaveBeenCalledWith(TabliodbHeader.RequestId, 'edge-request-id');
    expect(next).toHaveBeenCalled();
  });

  it('generates a request id when the client does not provide one', () => {
    const request = {
      headers: {} as Record<string, string | string[] | undefined>,
    };
    const response = {
      setHeader: vi.fn(),
    };
    const next = vi.fn();

    requestIdMiddleware()(request as never, response as never, next);

    // Request id dihasilkan sebelum AuthGuard berjalan, sehingga audit log tetap punya correlation id.
    expect(request.headers[TabliodbHeader.RequestId]).toEqual(expect.any(String));
    expect(response.setHeader).toHaveBeenCalledWith(
      TabliodbHeader.RequestId,
      request.headers[TabliodbHeader.RequestId],
    );
    expect(next).toHaveBeenCalled();
  });
});
