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
import { MetricsService } from '../services/metrics.service.js';
import { getRequestRoutePattern, sanitizeRequestPath } from '../utils/request-path.js';

const nestPathMetadataKey = 'path';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthContext }>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        error: (error) => {
          const durationMs = Date.now() - startedAt;
          const statusCode = getErrorStatus(error);
          const record = createHttpLogRecord(context, request, durationMs);

          this.metricsService.recordHttpRequest({
            durationMs,
            method: record.method,
            path: record.routePattern,
            statusCode,
          });
          this.logger.warn({
            ...record,
            event: 'http.request_failed',
            statusCode,
          });
        },
        next: () => {
          const durationMs = Date.now() - startedAt;
          const record = createHttpLogRecord(context, request, durationMs);

          this.metricsService.recordHttpRequest({
            durationMs,
            method: record.method,
            path: record.routePattern,
            statusCode: response.statusCode,
          });
          this.logger.log({
            ...record,
            event: 'http.request_completed',
            statusCode: response.statusCode,
          });
        },
      }),
    );
  }
}

function createHttpLogRecord(context: ExecutionContext, request: Request & { user?: AuthContext }, durationMs: number) {
  return {
    authSource: request.user?.apiKey ? 'api-key' : request.user?.session?.source,
    durationMs,
    ipAddress: request.ip ?? null,
    method: request.method,
    path: sanitizeRequestPath(request.originalUrl || request.url),
    requestId: readHeader(request.headers[TabliodbHeader.RequestId]),
    routePattern: getNestRoutePattern(context) ?? getRequestRoutePattern(request),
    userAgent: readHeader(request.headers['user-agent']),
    userId: request.user?.user.id,
  };
}

function getNestRoutePattern(context: ExecutionContext): string | null {
  const controllerPath = readRoutePathMetadata(Reflect.getMetadata(nestPathMetadataKey, context.getClass()));
  const handlerPath = readRoutePathMetadata(Reflect.getMetadata(nestPathMetadataKey, context.getHandler()));

  if (!controllerPath && !handlerPath) {
    return null;
  }

  // The app uses a fixed global API prefix; route metadata keeps dynamic params as ":id" for low-cardinality metrics.
  return normalizeRoutePattern(['api', controllerPath, handlerPath]);
}

function readRoutePathMetadata(value: unknown): string {
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === 'string') ?? '';
  }

  return typeof value === 'string' ? value : '';
}

function normalizeRoutePattern(parts: string[]): string {
  const path = parts
    .map((part) => part.trim().replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');

  return `/${path}`;
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
