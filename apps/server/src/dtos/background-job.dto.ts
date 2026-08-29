import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DateTimeSchema = z.iso.datetime({ offset: true });
const BackgroundJobStatusSchema = z.enum(['queued', 'running', 'completed', 'failed', 'dead']);

const BackgroundJobSchema = z
  .object({
    attempts: z.number().int().nonnegative(),
    completedAt: DateTimeSchema.nullable(),
    createdAt: DateTimeSchema,
    error: z.unknown().nullable(),
    failedAt: DateTimeSchema.nullable(),
    id: z.uuid(),
    lockedAt: DateTimeSchema.nullable(),
    lockedBy: z.string().nullable(),
    maxAttempts: z.number().int().positive(),
    payload: z.unknown(),
    priority: z.number().int(),
    queue: z.string(),
    result: z.unknown().nullable(),
    scheduledAt: DateTimeSchema,
    startedAt: DateTimeSchema.nullable(),
    status: BackgroundJobStatusSchema,
    type: z.string(),
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'AdminBackgroundJobDto' });

const BackgroundJobListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    queue: z.string().trim().max(80).optional(),
    search: z.string().trim().max(120).optional(),
    status: BackgroundJobStatusSchema.optional(),
    type: z.string().trim().max(120).optional(),
  })
  .meta({ id: 'AdminBackgroundJobListQueryDto' });

const BackgroundJobListResponseSchema = z
  .object({
    items: z.array(BackgroundJobSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'AdminBackgroundJobListResponseDto' });

export class AdminBackgroundJobDto extends createZodDto(BackgroundJobSchema) {}
export class AdminBackgroundJobListQueryDto extends createZodDto(BackgroundJobListQuerySchema) {}
export class AdminBackgroundJobListResponseDto extends createZodDto(BackgroundJobListResponseSchema) {}
