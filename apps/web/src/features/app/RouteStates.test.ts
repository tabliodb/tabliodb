import { describe, expect, it } from 'vitest';
import { TabliodbApiError } from '@tabliodb/sdk';
import { getErrorMessage } from './RouteStates';

describe(getErrorMessage.name, () => {
  it('turns bare HTTP status errors into user-facing messages', () => {
    expect(getErrorMessage(new Error('Error: 404'))).toBe(
      'The requested data was not found. It may have been deleted or moved.',
    );
  });

  it('keeps useful application errors intact', () => {
    expect(getErrorMessage(new Error('Project name is required'))).toBe('Project name is required');
  });

  it('reads the canonical API error envelope', () => {
    const error = new TabliodbApiError(
      400,
      {
        code: 'bad_request',
        message: 'Project name is required',
        requestId: 'request-id',
        statusCode: 400,
      },
      new Headers(),
    );

    expect(getErrorMessage(error)).toBe('Project name is required');
  });

  it('shows request id for server errors', () => {
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

    expect(getErrorMessage(error)).toBe('The server hit an unexpected error. Request id: req_123.');
  });
});
