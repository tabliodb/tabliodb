import { DatabaseDialectSchema } from '@tabliodb/schema-core';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DateTimeSchema = z.iso.datetime({ offset: true });

const DiagramCreateSchema = z
  .object({
    projectId: z.string().uuid(),
    name: z.string().min(1),
    dialect: DatabaseDialectSchema.default('postgresql'),
  })
  .meta({ id: 'DiagramCreateDto' });

const DiagramResponseSchema = z
  .object({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
    name: z.string(),
    dialect: DatabaseDialectSchema,
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'DiagramResponseDto' });

const DiagramListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: 'DiagramListQueryDto' });

const DiagramListResponseSchema = z
  .object({
    items: z.array(DiagramResponseSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'DiagramListResponseDto' });

export class DiagramCreateDto extends createZodDto(DiagramCreateSchema) {}
export class DiagramListQueryDto extends createZodDto(DiagramListQuerySchema) {}
export class DiagramListResponseDto extends createZodDto(DiagramListResponseSchema) {}
export class DiagramResponseDto extends createZodDto(DiagramResponseSchema) {}
