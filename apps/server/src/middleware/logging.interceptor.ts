import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { TabliodbHeader } from '../constants.js';
import type { AuthContext } from '../database.js';
import { sanitizeRequestPath } from '../utils/request-path.js';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthContext }>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        error: (error) => {
          this.logger.warn({
            ...createHttpLogRecord(request, Date.now() - startedAt),
            event: 'http.request_failed',
            statusCode: getErrorStatus(error),
          });
        },
        next: () => {
          this.logger.log({
            ...createHttpLogRecord(request, Date.now() - startedAt),
            event: 'http.request_completed',
            statusCode: response.statusCode,
          });
        },
      }),
    );
  }
}

function createHttpLogRecord(request: Request & { user?: AuthContext }, durationMs: number) {
  return {
    authSource: request.user?.apiKey ? 'api-key' : request.user?.session?.source,
    durationMs,
    ipAddress: request.ip ?? null,
    method: request.method,
    path: sanitizeRequestPath(request.originalUrl || request.url),
    requestId: readHeader(request.headers[TabliodbHeader.RequestId]),
    userAgent: readHeader(request.headers['user-agent']),
    userId: request.user?.user.id,
  };
}

function getErrorStatus(error: unknown): number {
  return error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
}

function readHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
