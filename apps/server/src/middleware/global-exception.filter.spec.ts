import { BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TabliodbHeader } from '../constants.js';
import { GlobalExceptionFilter } from './global-exception.filter.js';

describe(GlobalExceptionFilter.name, () => {
  const loggerErrorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

  beforeEach(() => {
    loggerErrorSpy.mockClear();
  });

  it('returns a stable API error envelope for client errors', () => {
    const { host, response } = createHttpHost();
    const filter = new GlobalExceptionFilter();

    filter.catch(
      new BadRequestException({
        code: 'validation_failed',
        message: ['Project name is required', 'Project slug is invalid'],
      }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'validation_failed',
        details: ['Project name is required', 'Project slug is invalid'],
        error: 'Bad Request',
        message: 'Project name is required Project slug is invalid',
        method: 'POST',
        path: '/api/projects',
        requestId: 'request-id',
        statusCode: 400,
        timestamp: expect.any(String),
      }),
    );
  });

  it('hides internal exception details but keeps the request id', () => {
    const { host, response } = createHttpHost();
    const filter = new GlobalExceptionFilter();

    filter.catch(new InternalServerErrorException('database password leaked in stack'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'internal_server_error',
        error: 'Internal Server Error',
        message:
          'The server hit an unexpected error. Please try again or contact an administrator with the request id.',
        requestId: 'request-id',
        statusCode: 500,
      }),
    );
    // Internal details stay in server logs, while the response body remains safe for end users.
    expect(loggerErrorSpy).toHaveBeenCalled();
  });
});

function createHttpHost(): {
  host: ArgumentsHost;
  response: {
    json: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
  };
} {
  const request = {
    headers: {
      [TabliodbHeader.RequestId]: 'request-id',
    },
    method: 'POST',
    originalUrl: '/api/projects',
    url: '/api/projects',
  };
  const response = {
    json: vi.fn(),
    status: vi.fn().mockReturnThis(),
  };

  return {
    host: {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost,
    response,
  };
}
