import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = error instanceof HttpException ? error.getResponse() : null;
    const message = getExceptionMessage(exceptionResponse, error);

    response.status(status).json({
      statusCode: status,
      message,
    });
  }
}

function getExceptionMessage(exceptionResponse: string | object | null, error: unknown): string | string[] {
  if (typeof exceptionResponse === 'string') {
    return exceptionResponse;
  }

  if (exceptionResponse && typeof exceptionResponse === 'object' && 'message' in exceptionResponse) {
    const message = (exceptionResponse as { message?: unknown }).message;

    // Nest validation errors often arrive as string arrays; keeping that shape lets the frontend show actionable form feedback.
    if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
      return message;
    }

    if (typeof message === 'string') {
      return message;
    }
  }

  return error instanceof Error ? error.message : 'Unexpected error';
}
