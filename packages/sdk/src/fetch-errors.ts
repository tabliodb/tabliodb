import type { ApiErrorResponse } from '@tabliodb/shared';

export class TabliodbApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly response?: ApiErrorResponse,
  ) {
    super(message);
    this.name = 'TabliodbApiError';
  }
}
