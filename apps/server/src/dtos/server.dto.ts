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

export type ServerHealthResponse = z.infer<typeof ServerHealthResponseSchema>;

export class ServerHealthResponseDto extends createZodDto(ServerHealthResponseSchema) {}
