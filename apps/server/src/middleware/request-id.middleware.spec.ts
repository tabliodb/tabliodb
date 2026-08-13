import { describe, expect, it, vi } from 'vitest';
import { TabliodbHeader } from '../constants.js';
import { requestIdMiddleware } from './request-id.middleware.js';

describe('requestIdMiddleware', () => {
  it('keeps an existing request id and echoes it on the response', () => {
    const request = {
      headers: {
        [TabliodbHeader.RequestId]: ' edge-request-id_01:trace.segment ',
      },
    };
    const response = {
      setHeader: vi.fn(),
    };
    const next = vi.fn();

    requestIdMiddleware()(request as never, response as never, next);

    expect(request.headers[TabliodbHeader.RequestId]).toBe('edge-request-id_01:trace.segment');
    expect(response.setHeader).toHaveBeenCalledWith(TabliodbHeader.RequestId, 'edge-request-id_01:trace.segment');
    expect(next).toHaveBeenCalled();
  });

  it('bounds a long safe request id before echoing it', () => {
    const request = {
      headers: {
        [TabliodbHeader.RequestId]: 'a'.repeat(160),
      },
    };
    const response = {
      setHeader: vi.fn(),
    };
    const next = vi.fn();

    requestIdMiddleware()(request as never, response as never, next);

    // Correlation ids stay small enough for headers, logs, and audit rows even when an upstream proxy sends a long value.
    expect(request.headers[TabliodbHeader.RequestId]).toBe('a'.repeat(128));
    expect(response.setHeader).toHaveBeenCalledWith(TabliodbHeader.RequestId, 'a'.repeat(128));
    expect(next).toHaveBeenCalled();
  });

  it('replaces unsafe client request ids with a generated id', () => {
    const request = {
      headers: {
        [TabliodbHeader.RequestId]: 'trace id with spaces',
      },
    };
    const response = {
      setHeader: vi.fn(),
    };
    const next = vi.fn();

    requestIdMiddleware()(request as never, response as never, next);

    // Values outside the trace-safe charset are not echoed back into response headers or structured logs.
    expect(request.headers[TabliodbHeader.RequestId]).toEqual(expect.any(String));
    expect(request.headers[TabliodbHeader.RequestId]).not.toBe('trace id with spaces');
    expect(response.setHeader).toHaveBeenCalledWith(
      TabliodbHeader.RequestId,
      request.headers[TabliodbHeader.RequestId],
    );
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
