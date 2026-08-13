import { describe, expect, it } from 'vitest';
import { UNSAFE_ErrorResponseImpl as ErrorResponse } from 'react-router';
import { TabliodbApiError } from '@tabliodb/sdk';
import { getErrorMessage } from './RouteStates';

describe(getErrorMessage.name, () => {
  it('turns bare HTTP status errors into user-facing messages', () => {
    expect(getErrorMessage(new Error('Error: 404'))).toBe(
      'The requested data was not found. It may have been deleted or moved.',
    );
    expect(getErrorMessage(new Error('HTTP 403 Forbidden'))).toBe('You do not have permission to perform this action.');
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

  it('replaces generic API status titles with product messages', () => {
    const error = new TabliodbApiError(
      404,
      {
        error: 'Not Found',
        statusCode: 404,
      },
      new Headers(),
    );

    expect(getErrorMessage(error)).toBe('The requested data was not found. It may have been deleted or moved.');
  });

  it('reads React Router error response data from loaders and actions', () => {
    const error = new ErrorResponse(400, 'Bad Request', 'Invitation token is required');

    expect(getErrorMessage(error)).toBe('Invitation token is required');
  });

  it('reads validation details from React Router API-like envelopes', () => {
    const error = new ErrorResponse(422, 'Unprocessable Entity', {
      details: ['Name is required.', 'Email must be valid.'],
      requestId: 'req_validation',
    });

    expect(getErrorMessage(error)).toBe('Name is required. Email must be valid.');
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
