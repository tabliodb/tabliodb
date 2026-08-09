import { describe, expect, it } from 'vitest';
import { TabliodbApiError, getTabliodbApiErrorMessage, getTabliodbApiErrorRequestId } from './fetch-errors.js';

describe('SDK API error helpers', () => {
  it('reads message and request id from the Tabliodb error envelope', () => {
    const error = new TabliodbApiError(
      500,
      {
        code: 'internal_server_error',
        message: 'The server hit an unexpected error.',
        requestId: 'req_123',
        statusCode: 500,
      },
      new Headers(),
    );

    expect(getTabliodbApiErrorMessage(error)).toBe('The server hit an unexpected error.');
    expect(getTabliodbApiErrorRequestId(error)).toBe('req_123');
  });
});
