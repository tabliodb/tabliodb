import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { TabliodbHeader } from '../constants.js';

export function requestIdMiddleware(): RequestHandler {
  return (request, response, next) => {
    const requestId = readRequestId(request.headers[TabliodbHeader.RequestId]) ?? randomUUID();

    // The generated id is written back to request headers so guards/services can read one stable value for audit logs.
    request.headers[TabliodbHeader.RequestId] = requestId;
    response.setHeader(TabliodbHeader.RequestId, requestId);
    next();
  };
}

function readRequestId(value: string | string[] | undefined): string | null {
  const requestId = Array.isArray(value) ? value[0] : value;
  const normalized = requestId?.trim();

  return normalized ? normalized.slice(0, 128) : null;
}
