import { DatabaseDialectSchema } from '@tabliodb/schema-core';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

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
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .meta({ id: 'DiagramResponseDto' });

export class DiagramCreateDto extends createZodDto(DiagramCreateSchema) {}
export class DiagramResponseDto extends createZodDto(DiagramResponseSchema) {}
