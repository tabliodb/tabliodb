import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DateTimeSchema = z.iso.datetime({ offset: true });

const ProjectCreateSchema = z
  .object({
    organizationId: z.string().uuid().optional(),
    name: z.string().min(1),
    description: z.string().optional(),
  })
  .meta({ id: 'ProjectCreateDto' });

const ProjectResponseSchema = z
  .object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    organizationName: z.string(),
    organizationSlug: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'ProjectResponseDto' });

const ProjectListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: 'ProjectListQueryDto' });

const ProjectListResponseSchema = z
  .object({
    items: z.array(ProjectResponseSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'ProjectListResponseDto' });

export class ProjectCreateDto extends createZodDto(ProjectCreateSchema) {}
export class ProjectListQueryDto extends createZodDto(ProjectListQuerySchema) {}
export class ProjectListResponseDto extends createZodDto(ProjectListResponseSchema) {}
export class ProjectResponseDto extends createZodDto(ProjectResponseSchema) {}
