import { ProjectRole } from '@tabliodb/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DateTimeSchema = z.iso.datetime({ offset: true });
const TeamProjectRoleSchema = z.enum([ProjectRole.Editor, ProjectRole.Commenter, ProjectRole.Viewer]);
const TeamDiagramRoleSchema = z.enum([ProjectRole.Editor, ProjectRole.Commenter, ProjectRole.Viewer]);

const TeamCreateSchema = z
  .object({
    organizationId: z.uuid(),
    name: z.string().trim().min(1),
    description: z.string().trim().optional(),
  })
  .meta({ id: 'TeamCreateDto' });

const TeamUpdateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().nullable().optional(),
  })
  .meta({ id: 'TeamUpdateDto' });

const TeamResponseSchema = z
  .object({
    id: z.uuid(),
    organizationId: z.uuid(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    memberCount: z.number().int().nonnegative(),
    diagramAccessCount: z.number().int().nonnegative(),
    projectAccessCount: z.number().int().nonnegative(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'TeamResponseDto' });

const TeamListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    organizationId: z.uuid(),
  })
  .meta({ id: 'TeamListQueryDto' });

const TeamListResponseSchema = z
  .object({
    items: z.array(TeamResponseSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'TeamListResponseDto' });

const TeamArchiveResponseSchema = z
  .object({
    successful: z.boolean(),
  })
  .meta({ id: 'TeamArchiveResponseDto' });

const TeamMemberSchema = z
  .object({
    userId: z.uuid(),
    email: z.email(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
    cursorColor: z.string(),
    createdAt: DateTimeSchema,
  })
  .meta({ id: 'TeamMemberDto' });

const TeamMemberCreateSchema = z
  .object({
    email: z.email(),
  })
  .meta({ id: 'TeamMemberCreateDto' });

const TeamMemberListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: 'TeamMemberListQueryDto' });

const TeamMemberListResponseSchema = z
  .object({
    items: z.array(TeamMemberSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'TeamMemberListResponseDto' });

const TeamMemberRemoveResponseSchema = z
  .object({
    successful: z.boolean(),
  })
  .meta({ id: 'TeamMemberRemoveResponseDto' });

const TeamProjectAccessSchema = z
  .object({
    projectId: z.uuid(),
    projectName: z.string(),
    projectSlug: z.string(),
    role: TeamProjectRoleSchema,
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'TeamProjectAccessDto' });

const TeamProjectAccessUpsertSchema = z
  .object({
    projectId: z.uuid(),
    role: TeamProjectRoleSchema.default(ProjectRole.Viewer),
  })
  .meta({ id: 'TeamProjectAccessUpsertDto' });

const TeamProjectAccessListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: 'TeamProjectAccessListQueryDto' });

const TeamProjectAccessListResponseSchema = z
  .object({
    items: z.array(TeamProjectAccessSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'TeamProjectAccessListResponseDto' });

const TeamProjectAccessRemoveResponseSchema = z
  .object({
    successful: z.boolean(),
  })
  .meta({ id: 'TeamProjectAccessRemoveResponseDto' });

const TeamDiagramAccessSchema = z
  .object({
    diagramId: z.uuid(),
    diagramName: z.string(),
    projectId: z.uuid().nullable(),
    role: TeamDiagramRoleSchema,
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'TeamDiagramAccessDto' });

const TeamDiagramAccessUpsertSchema = z
  .object({
    diagramId: z.uuid(),
    role: TeamDiagramRoleSchema.default(ProjectRole.Viewer),
  })
  .meta({ id: 'TeamDiagramAccessUpsertDto' });

const TeamDiagramAccessListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: 'TeamDiagramAccessListQueryDto' });

const TeamDiagramAccessListResponseSchema = z
  .object({
    items: z.array(TeamDiagramAccessSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'TeamDiagramAccessListResponseDto' });

const TeamDiagramAccessRemoveResponseSchema = z
  .object({
    successful: z.boolean(),
  })
  .meta({ id: 'TeamDiagramAccessRemoveResponseDto' });

export class TeamArchiveResponseDto extends createZodDto(TeamArchiveResponseSchema) {}
export class TeamCreateDto extends createZodDto(TeamCreateSchema) {}
export class TeamDiagramAccessDto extends createZodDto(TeamDiagramAccessSchema) {}
export class TeamDiagramAccessListQueryDto extends createZodDto(TeamDiagramAccessListQuerySchema) {}
export class TeamDiagramAccessListResponseDto extends createZodDto(TeamDiagramAccessListResponseSchema) {}
export class TeamDiagramAccessRemoveResponseDto extends createZodDto(TeamDiagramAccessRemoveResponseSchema) {}
export class TeamDiagramAccessUpsertDto extends createZodDto(TeamDiagramAccessUpsertSchema) {}
export class TeamListQueryDto extends createZodDto(TeamListQuerySchema) {}
export class TeamListResponseDto extends createZodDto(TeamListResponseSchema) {}
export class TeamMemberCreateDto extends createZodDto(TeamMemberCreateSchema) {}
export class TeamMemberDto extends createZodDto(TeamMemberSchema) {}
export class TeamMemberListQueryDto extends createZodDto(TeamMemberListQuerySchema) {}
export class TeamMemberListResponseDto extends createZodDto(TeamMemberListResponseSchema) {}
export class TeamMemberRemoveResponseDto extends createZodDto(TeamMemberRemoveResponseSchema) {}
export class TeamProjectAccessDto extends createZodDto(TeamProjectAccessSchema) {}
export class TeamProjectAccessListQueryDto extends createZodDto(TeamProjectAccessListQuerySchema) {}
export class TeamProjectAccessListResponseDto extends createZodDto(TeamProjectAccessListResponseSchema) {}
export class TeamProjectAccessRemoveResponseDto extends createZodDto(TeamProjectAccessRemoveResponseSchema) {}
export class TeamProjectAccessUpsertDto extends createZodDto(TeamProjectAccessUpsertSchema) {}
export class TeamResponseDto extends createZodDto(TeamResponseSchema) {}
export class TeamUpdateDto extends createZodDto(TeamUpdateSchema) {}
