import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TabliodbHeader } from '../constants.js';

type ApiErrorResponse = {
  code: string;
  details?: string[];
  error: string;
  message: string;
  method: string;
  path: string;
  requestId: string | null;
  statusCode: number;
  timestamp: string;
};

type NormalizedException = {
  code: string;
  details?: string[];
  error: string;
  message: string;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = error instanceof HttpException ? error.getResponse() : null;
    const normalized = normalizeException(exceptionResponse, error, status);
    const body: ApiErrorResponse = {
      code: normalized.code,
      details: normalized.details,
      error: normalized.error,
      message: normalized.message,
      method: request.method,
      path: request.originalUrl || request.url,
      // The request id is returned to the client so support/debugging can correlate UI reports with server logs.
      requestId: readHeader(request.headers[TabliodbHeader.RequestId]),
      statusCode: status,
      timestamp: new Date().toISOString(),
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Internal exception details are logged server-side but replaced with a stable user-facing response payload.
      this.logger.error(
        `${request.method} ${request.originalUrl || request.url} failed with ${status}. ${formatErrorMessage(error)}`,
      );
    }

    response.status(status).json(body);
  }
}

function normalizeException(
  exceptionResponse: string | object | null,
  error: unknown,
  status: number,
): NormalizedException {
  if (typeof exceptionResponse === 'string') {
    return {
      code: createDefaultErrorCode(status),
      error: getHttpStatusTitle(status),
      message: exceptionResponse,
    };
  }

  if (exceptionResponse && typeof exceptionResponse === 'object') {
    const response = exceptionResponse as {
      code?: unknown;
      error?: unknown;
      message?: unknown;
      statusCode?: unknown;
    };
    const details = normalizeDetails(response.message);
    const message =
      status >= HttpStatus.INTERNAL_SERVER_ERROR
        ? getInternalServerErrorMessage()
        : (normalizeMessage(response.message) ??
          normalizeMessage(response.error) ??
          getHttpStatusFallbackMessage(status));

    return {
      code:
        typeof response.code === 'string' && response.code.trim()
          ? response.code.trim()
          : createDefaultErrorCode(status),
      details: status >= HttpStatus.INTERNAL_SERVER_ERROR ? undefined : details,
      error:
        status < HttpStatus.INTERNAL_SERVER_ERROR && typeof response.error === 'string' && response.error.trim()
          ? response.error.trim()
          : getHttpStatusTitle(status),
      message,
    };
  }

  if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
    return {
      code: createDefaultErrorCode(status),
      error: getHttpStatusTitle(status),
      message: getInternalServerErrorMessage(),
    };
  }

  return {
    code: createDefaultErrorCode(status),
    error: getHttpStatusTitle(status),
    message: error instanceof Error ? error.message : getHttpStatusFallbackMessage(status),
  };
}

function normalizeMessage(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null;
  }

  if (Array.isArray(value)) {
    const details = normalizeDetails(value);

    if (details.length > 0) {
      return details.join(' ');
    }
  }

  return null;
}

function normalizeDetails(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim();
      }

      if (item && typeof item === 'object' && 'message' in item) {
        const message = (item as { message?: unknown }).message;
        return typeof message === 'string' ? message.trim() : '';
      }

      return '';
    })
    .filter((item) => item.length > 0);
}

function createDefaultErrorCode(status: number): string {
  const codeByStatus: Record<number, string> = {
    [HttpStatus.BAD_REQUEST]: 'bad_request',
    [HttpStatus.UNAUTHORIZED]: 'unauthorized',
    [HttpStatus.FORBIDDEN]: 'forbidden',
    [HttpStatus.NOT_FOUND]: 'not_found',
    [HttpStatus.CONFLICT]: 'conflict',
    [HttpStatus.UNPROCESSABLE_ENTITY]: 'validation_failed',
    [HttpStatus.TOO_MANY_REQUESTS]: 'rate_limited',
  };

  return (
    codeByStatus[status] ?? (status >= HttpStatus.INTERNAL_SERVER_ERROR ? 'internal_server_error' : 'request_failed')
  );
}

function getHttpStatusTitle(status: number): string {
  const titleByStatus: Record<number, string> = {
    [HttpStatus.BAD_REQUEST]: 'Bad Request',
    [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
    [HttpStatus.FORBIDDEN]: 'Forbidden',
    [HttpStatus.NOT_FOUND]: 'Not Found',
    [HttpStatus.CONFLICT]: 'Conflict',
    [HttpStatus.UNPROCESSABLE_ENTITY]: 'Validation Failed',
    [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
  };

  return (
    titleByStatus[status] ?? (status >= HttpStatus.INTERNAL_SERVER_ERROR ? 'Internal Server Error' : 'Request Failed')
  );
}

function getHttpStatusFallbackMessage(status: number): string {
  const messageByStatus: Record<number, string> = {
    [HttpStatus.BAD_REQUEST]: 'The request could not be processed. Please review the entered data.',
    [HttpStatus.UNAUTHORIZED]: 'Authentication is required to continue.',
    [HttpStatus.FORBIDDEN]: 'You do not have permission to perform this action.',
    [HttpStatus.NOT_FOUND]: 'The requested data was not found.',
    [HttpStatus.CONFLICT]: 'This action conflicts with existing data. Please refresh and try again.',
    [HttpStatus.UNPROCESSABLE_ENTITY]: 'Some fields are invalid. Please review the form and try again.',
    [HttpStatus.TOO_MANY_REQUESTS]: 'Too many requests. Please wait a moment and try again.',
  };

  return messageByStatus[status] ?? 'The server could not complete this request. Please try again.';
}

function getInternalServerErrorMessage(): string {
  return 'The server hit an unexpected error. Please try again or contact an administrator with the request id.';
}

function readHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
