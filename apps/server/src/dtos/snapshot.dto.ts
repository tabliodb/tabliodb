import { DiagramModelSchema } from '@tabliodb/schema-core';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const SnapshotCreateSchema = z
  .object({
    diagramId: z.string().uuid(),
    message: z.string().optional(),
    snapshot: DiagramModelSchema,
  })
  .meta({ id: 'SnapshotCreateDto' });

const SnapshotResponseSchema = z
  .object({
    id: z.string().uuid(),
    diagramId: z.string().uuid(),
    version: z.number(),
    message: z.string().nullable(),
    snapshot: DiagramModelSchema,
    createdAt: z.date(),
  })
  .meta({ id: 'SnapshotResponseDto' });

const SnapshotListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: 'SnapshotListQueryDto' });

const SnapshotListResponseSchema = z
  .object({
    items: z.array(SnapshotResponseSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'SnapshotListResponseDto' });

export class SnapshotCreateDto extends createZodDto(SnapshotCreateSchema) {}
export class SnapshotListQueryDto extends createZodDto(SnapshotListQuerySchema) {}
export class SnapshotListResponseDto extends createZodDto(SnapshotListResponseSchema) {}
export class SnapshotResponseDto extends createZodDto(SnapshotResponseSchema) {}
