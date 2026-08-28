import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { AccessRole } from '@tabliodb/shared';

const DateTimeSchema = z.iso.datetime({ offset: true });
const AccessRoleSchema = z.enum([AccessRole.Owner, AccessRole.Editor, AccessRole.Commenter, AccessRole.Viewer]);
const FolderAssignableAccessRoleSchema = z.enum([AccessRole.Editor, AccessRole.Commenter, AccessRole.Viewer]);

const FolderCreateSchema = z
  .object({
    organizationId: z.uuid(),
    name: z.string().min(1),
    description: z.string().optional(),
  })
  .meta({ id: 'FolderCreateDto' });

const FolderUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
  })
  .meta({ id: 'FolderUpdateDto' });

const FolderResponseSchema = z
  .object({
    id: z.uuid(),
    organizationId: z.uuid(),
    organizationName: z.string(),
    organizationSlug: z.string(),
    folderRole: AccessRoleSchema,
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'FolderResponseDto' });

const FolderListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    organizationId: z.uuid().optional(),
  })
  .meta({ id: 'FolderListQueryDto' });

const FolderListResponseSchema = z
  .object({
    items: z.array(FolderResponseSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'FolderListResponseDto' });

const FolderAccessSchema = z
  .object({
    userId: z.uuid(),
    email: z.email(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
    cursorColor: z.string(),
    role: AccessRoleSchema,
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'FolderAccessDto' });

const FolderAccessListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: 'FolderAccessListQueryDto' });

const FolderAccessListResponseSchema = z
  .object({
    items: z.array(FolderAccessSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'FolderAccessListResponseDto' });

const FolderAccessCreateSchema = z
  .object({
    email: z.email(),
    role: FolderAssignableAccessRoleSchema.default(AccessRole.Viewer),
  })
  .meta({ id: 'FolderAccessCreateDto' });

const FolderAccessUpdateSchema = z
  .object({
    role: FolderAssignableAccessRoleSchema,
  })
  .meta({ id: 'FolderAccessUpdateDto' });

const FolderOwnershipTransferSchema = z
  .object({
    userId: z.uuid(),
  })
  .meta({ id: 'FolderOwnershipTransferDto' });

const FolderAccessRemoveResponseSchema = z
  .object({
    successful: z.boolean(),
  })
  .meta({ id: 'FolderAccessRemoveResponseDto' });

const FolderArchiveResponseSchema = z
  .object({
    successful: z.boolean(),
  })
  .meta({ id: 'FolderArchiveResponseDto' });

export class FolderArchiveResponseDto extends createZodDto(FolderArchiveResponseSchema) {}
export class FolderCreateDto extends createZodDto(FolderCreateSchema) {}
export class FolderListQueryDto extends createZodDto(FolderListQuerySchema) {}
export class FolderListResponseDto extends createZodDto(FolderListResponseSchema) {}
export class FolderAccessCreateDto extends createZodDto(FolderAccessCreateSchema) {}
export class FolderAccessDto extends createZodDto(FolderAccessSchema) {}
export class FolderAccessListQueryDto extends createZodDto(FolderAccessListQuerySchema) {}
export class FolderAccessListResponseDto extends createZodDto(FolderAccessListResponseSchema) {}
export class FolderAccessRemoveResponseDto extends createZodDto(FolderAccessRemoveResponseSchema) {}
export class FolderAccessUpdateDto extends createZodDto(FolderAccessUpdateSchema) {}
export class FolderOwnershipTransferDto extends createZodDto(FolderOwnershipTransferSchema) {}
export class FolderResponseDto extends createZodDto(FolderResponseSchema) {}
export class FolderUpdateDto extends createZodDto(FolderUpdateSchema) {}
