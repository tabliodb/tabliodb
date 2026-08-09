import { HttpError } from '@oazapfts/runtime';

export { HttpError as TabliodbApiError };

export type TabliodbApiErrorResponse = {
  code?: string;
  details?: string[];
  error?: string;
  message?: string | string[];
  method?: string;
  path?: string;
  requestId?: string | null;
  statusCode?: number;
  timestamp?: string;
};

export function getTabliodbApiErrorResponse(error: unknown): TabliodbApiErrorResponse | null {
  if (!(error instanceof HttpError) || !error.data || typeof error.data !== 'object') {
    return null;
  }

  return error.data as TabliodbApiErrorResponse;
}

export function getTabliodbApiErrorMessage(error: unknown): string | null {
  const response = getTabliodbApiErrorResponse(error);

  if (!response) {
    return null;
  }

  // Prefer the canonical backend message, then fall back to validation details or HTTP title.
  return (
    normalizeErrorText(response.message) ?? normalizeErrorText(response.details) ?? normalizeErrorText(response.error)
  );
}

export function getTabliodbApiErrorRequestId(error: unknown): string | null {
  const response = getTabliodbApiErrorResponse(error);

  return typeof response?.requestId === 'string' && response.requestId.trim() ? response.requestId : null;
}

function normalizeErrorText(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null;
  }

  if (Array.isArray(value)) {
    const messages = value.map((item) => normalizeErrorText(item)).filter((item): item is string => Boolean(item));

    return messages.length > 0 ? messages.join(' ') : null;
  }

  return null;
}
