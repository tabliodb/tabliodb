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

export class SnapshotCreateDto extends createZodDto(SnapshotCreateSchema) {}
export class SnapshotResponseDto extends createZodDto(SnapshotResponseSchema) {}
