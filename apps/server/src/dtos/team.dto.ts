import { AccessRole } from '@tabliodb/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DateTimeSchema = z.iso.datetime({ offset: true });
const TeamAccessRoleSchema = z.enum([AccessRole.Editor, AccessRole.Commenter, AccessRole.Viewer]);
const TeamDiagramRoleSchema = z.enum([AccessRole.Editor, AccessRole.Commenter, AccessRole.Viewer]);

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
    folderAccessCount: z.number().int().nonnegative(),
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

const TeamFolderAccessSchema = z
  .object({
    folderId: z.uuid(),
    folderName: z.string(),
    folderSlug: z.string(),
    role: TeamAccessRoleSchema,
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'TeamFolderAccessDto' });

const TeamFolderAccessUpsertSchema = z
  .object({
    folderId: z.uuid(),
    role: TeamAccessRoleSchema.default(AccessRole.Viewer),
  })
  .meta({ id: 'TeamFolderAccessUpsertDto' });

const TeamFolderAccessListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: 'TeamFolderAccessListQueryDto' });

const TeamFolderAccessListResponseSchema = z
  .object({
    items: z.array(TeamFolderAccessSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'TeamFolderAccessListResponseDto' });

const TeamFolderAccessRemoveResponseSchema = z
  .object({
    successful: z.boolean(),
  })
  .meta({ id: 'TeamFolderAccessRemoveResponseDto' });

const TeamDiagramAccessSchema = z
  .object({
    diagramId: z.uuid(),
    diagramName: z.string(),
    folderId: z.uuid().nullable(),
    role: TeamDiagramRoleSchema,
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'TeamDiagramAccessDto' });

const TeamDiagramAccessUpsertSchema = z
  .object({
    diagramId: z.uuid(),
    role: TeamDiagramRoleSchema.default(AccessRole.Viewer),
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
export class TeamFolderAccessDto extends createZodDto(TeamFolderAccessSchema) {}
export class TeamFolderAccessListQueryDto extends createZodDto(TeamFolderAccessListQuerySchema) {}
export class TeamFolderAccessListResponseDto extends createZodDto(TeamFolderAccessListResponseSchema) {}
export class TeamFolderAccessRemoveResponseDto extends createZodDto(TeamFolderAccessRemoveResponseSchema) {}
export class TeamFolderAccessUpsertDto extends createZodDto(TeamFolderAccessUpsertSchema) {}
export class TeamResponseDto extends createZodDto(TeamResponseSchema) {}
export class TeamUpdateDto extends createZodDto(TeamUpdateSchema) {}
