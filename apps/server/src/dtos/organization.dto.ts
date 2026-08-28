import { OrganizationRole, AccessRole } from '@tabliodb/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DateTimeSchema = z.iso.datetime({ offset: true });
const DefaultFolderRoleSchema = z.enum([AccessRole.Editor, AccessRole.Commenter, AccessRole.Viewer]);
const OrganizationRoleSchema = z.enum([
  OrganizationRole.Owner,
  OrganizationRole.Admin,
  OrganizationRole.Member,
  OrganizationRole.Guest,
]);
const OrganizationAssignableMemberRoleSchema = z.enum([
  OrganizationRole.Admin,
  OrganizationRole.Member,
  OrganizationRole.Guest,
]);

const OrganizationSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    role: OrganizationRoleSchema,
    status: z.string(),
    defaultFolderRole: DefaultFolderRoleSchema.nullable(),
    allowMemberFolderCreate: z.boolean(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'OrganizationDto' });

const OrganizationListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: 'OrganizationListQueryDto' });

const OrganizationListResponseSchema = z
  .object({
    items: z.array(OrganizationSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'OrganizationListResponseDto' });

const OrganizationCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
  })
  .meta({ id: 'OrganizationCreateDto' });

const OrganizationMemberSchema = z
  .object({
    avatarUrl: z.string().nullable(),
    cursorColor: z.string(),
    createdAt: DateTimeSchema,
    email: z.email(),
    joinedAt: DateTimeSchema.nullable(),
    name: z.string(),
    role: OrganizationRoleSchema,
    status: z.enum(['pending', 'active', 'suspended']),
    updatedAt: DateTimeSchema,
    userId: z.uuid(),
  })
  .meta({ id: 'OrganizationMemberDto' });

const OrganizationMemberListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: 'OrganizationMemberListQueryDto' });

const OrganizationMemberListResponseSchema = z
  .object({
    items: z.array(OrganizationMemberSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'OrganizationMemberListResponseDto' });

const OrganizationMemberCreateSchema = z
  .object({
    email: z.email(),
    role: OrganizationAssignableMemberRoleSchema.default(OrganizationRole.Member),
  })
  .meta({ id: 'OrganizationMemberCreateDto' });

const OrganizationMemberUpdateSchema = z
  .object({
    role: OrganizationAssignableMemberRoleSchema,
  })
  .meta({ id: 'OrganizationMemberUpdateDto' });

const OrganizationOwnershipTransferSchema = z
  .object({
    userId: z.uuid(),
  })
  .meta({ id: 'OrganizationOwnershipTransferDto' });

const OrganizationMemberRemoveResponseSchema = z
  .object({
    successful: z.boolean(),
  })
  .meta({ id: 'OrganizationMemberRemoveResponseDto' });

const OrganizationSettingsSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    defaultFolderRole: DefaultFolderRoleSchema.nullable(),
    allowMemberFolderCreate: z.boolean(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'OrganizationSettingsDto' });

const OrganizationSettingsUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    defaultFolderRole: DefaultFolderRoleSchema.nullable().optional(),
    allowMemberFolderCreate: z.boolean().optional(),
  })
  .meta({ id: 'OrganizationSettingsUpdateDto' });

export class OrganizationDto extends createZodDto(OrganizationSchema) {}
export class OrganizationCreateDto extends createZodDto(OrganizationCreateSchema) {}
export class OrganizationListQueryDto extends createZodDto(OrganizationListQuerySchema) {}
export class OrganizationListResponseDto extends createZodDto(OrganizationListResponseSchema) {}
export class OrganizationMemberCreateDto extends createZodDto(OrganizationMemberCreateSchema) {}
export class OrganizationMemberDto extends createZodDto(OrganizationMemberSchema) {}
export class OrganizationMemberListQueryDto extends createZodDto(OrganizationMemberListQuerySchema) {}
export class OrganizationMemberListResponseDto extends createZodDto(OrganizationMemberListResponseSchema) {}
export class OrganizationMemberRemoveResponseDto extends createZodDto(OrganizationMemberRemoveResponseSchema) {}
export class OrganizationMemberUpdateDto extends createZodDto(OrganizationMemberUpdateSchema) {}
export class OrganizationOwnershipTransferDto extends createZodDto(OrganizationOwnershipTransferSchema) {}
export class OrganizationSettingsDto extends createZodDto(OrganizationSettingsSchema) {}
export class OrganizationSettingsUpdateDto extends createZodDto(OrganizationSettingsUpdateSchema) {}
