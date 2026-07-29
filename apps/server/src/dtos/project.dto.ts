import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

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
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .meta({ id: 'ProjectResponseDto' });

export class ProjectCreateDto extends createZodDto(ProjectCreateSchema) {}
export class ProjectResponseDto extends createZodDto(ProjectResponseSchema) {}
