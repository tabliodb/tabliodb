import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ServerDependencyHealthSchema = z
  .object({
    latencyMs: z.number().int().min(0).optional(),
    message: z.string().optional(),
    status: z.enum(['disabled', 'error', 'ok']),
  })
  .meta({ id: 'ServerDependencyHealthDto' });

export const ServerHealthResponseSchema = z
  .object({
    checkedAt: z.string(),
    dependencies: z.object({
      database: ServerDependencyHealthSchema,
      redis: ServerDependencyHealthSchema,
    }),
    name: z.string(),
    ok: z.boolean(),
    uptimeSeconds: z.number().int().min(0),
    version: z.string(),
  })
  .meta({ id: 'ServerHealthResponseDto' });

export const ServerMemoryMetricsSchema = z
  .object({
    arrayBuffers: z.number().int().min(0),
    external: z.number().int().min(0),
    heapTotal: z.number().int().min(0),
    heapUsed: z.number().int().min(0),
    rss: z.number().int().min(0),
  })
  .meta({ id: 'ServerMemoryMetricsDto' });

export const ServerHttpRouteMetricsSchema = z
  .object({
    averageDurationMs: z.number().int().min(0),
    count: z.number().int().min(0),
    errorCount: z.number().int().min(0),
    lastSeenAt: z.string(),
    lastStatusCode: z.number().int().min(100).max(599),
    maxDurationMs: z.number().int().min(0),
    method: z.string(),
    p95DurationMs: z.number().int().min(0),
    path: z.string(),
  })
  .meta({ id: 'ServerHttpRouteMetricsDto' });

export const ServerMetricsResponseSchema = z
  .object({
    generatedAt: z.string(),
    http: z.object({
      errorRequests: z.number().int().min(0),
      methods: z.array(
        z.object({
          count: z.number().int().min(0),
          method: z.string(),
        }),
      ),
      routes: z.array(ServerHttpRouteMetricsSchema),
      statusGroups: z.object({
        clientError: z.number().int().min(0),
        informational: z.number().int().min(0),
        redirection: z.number().int().min(0),
        serverError: z.number().int().min(0),
        success: z.number().int().min(0),
      }),
      totalRequests: z.number().int().min(0),
    }),
    process: z.object({
      memoryBytes: ServerMemoryMetricsSchema,
      nodeVersion: z.string(),
      pid: z.number().int().min(0),
      uptimeSeconds: z.number().int().min(0),
    }),
    startedAt: z.string(),
    window: z.object({
      maxTrackedRoutes: z.number().int().min(1),
      routeDurationSampleSize: z.number().int().min(1),
    }),
  })
  .meta({ id: 'ServerMetricsResponseDto' });

export type ServerHealthResponse = z.infer<typeof ServerHealthResponseSchema>;
export type ServerMetricsResponse = z.infer<typeof ServerMetricsResponseSchema>;

export class ServerHealthResponseDto extends createZodDto(ServerHealthResponseSchema) {}
export class ServerMetricsResponseDto extends createZodDto(ServerMetricsResponseSchema) {}
