import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ProjectRole } from '@tabliodb/shared';

const DateTimeSchema = z.iso.datetime({ offset: true });
const ProjectRoleSchema = z.enum([ProjectRole.Owner, ProjectRole.Editor, ProjectRole.Commenter, ProjectRole.Viewer]);

const ProjectCreateSchema = z
  .object({
    organizationId: z.string().uuid().optional(),
    name: z.string().min(1),
    description: z.string().optional(),
  })
  .meta({ id: 'ProjectCreateDto' });

const ProjectUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
  })
  .meta({ id: 'ProjectUpdateDto' });

const ProjectResponseSchema = z
  .object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    organizationName: z.string(),
    organizationSlug: z.string(),
    projectRole: ProjectRoleSchema,
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
    organizationId: z.string().uuid().optional(),
  })
  .meta({ id: 'ProjectListQueryDto' });

const ProjectListResponseSchema = z
  .object({
    items: z.array(ProjectResponseSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'ProjectListResponseDto' });

const ProjectMemberSchema = z
  .object({
    userId: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    avatarUrl: z.string().url().nullable(),
    cursorColor: z.string(),
    role: ProjectRoleSchema,
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'ProjectMemberDto' });

const ProjectMemberListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: 'ProjectMemberListQueryDto' });

const ProjectMemberListResponseSchema = z
  .object({
    items: z.array(ProjectMemberSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'ProjectMemberListResponseDto' });

const ProjectMemberCreateSchema = z
  .object({
    email: z.string().email(),
    role: ProjectRoleSchema.default(ProjectRole.Viewer),
  })
  .meta({ id: 'ProjectMemberCreateDto' });

const ProjectMemberUpdateSchema = z
  .object({
    role: ProjectRoleSchema,
  })
  .meta({ id: 'ProjectMemberUpdateDto' });

const ProjectMemberRemoveResponseSchema = z
  .object({
    successful: z.boolean(),
  })
  .meta({ id: 'ProjectMemberRemoveResponseDto' });

const ProjectArchiveResponseSchema = z
  .object({
    successful: z.boolean(),
  })
  .meta({ id: 'ProjectArchiveResponseDto' });

export class ProjectArchiveResponseDto extends createZodDto(ProjectArchiveResponseSchema) {}
export class ProjectCreateDto extends createZodDto(ProjectCreateSchema) {}
export class ProjectListQueryDto extends createZodDto(ProjectListQuerySchema) {}
export class ProjectListResponseDto extends createZodDto(ProjectListResponseSchema) {}
export class ProjectMemberCreateDto extends createZodDto(ProjectMemberCreateSchema) {}
export class ProjectMemberDto extends createZodDto(ProjectMemberSchema) {}
export class ProjectMemberListQueryDto extends createZodDto(ProjectMemberListQuerySchema) {}
export class ProjectMemberListResponseDto extends createZodDto(ProjectMemberListResponseSchema) {}
export class ProjectMemberRemoveResponseDto extends createZodDto(ProjectMemberRemoveResponseSchema) {}
export class ProjectMemberUpdateDto extends createZodDto(ProjectMemberUpdateSchema) {}
export class ProjectResponseDto extends createZodDto(ProjectResponseSchema) {}
export class ProjectUpdateDto extends createZodDto(ProjectUpdateSchema) {}
