import { OrganizationRole } from '@tabliodb/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UserOrganizationRoleSchema = z.enum([OrganizationRole.Admin, OrganizationRole.Member]);
const InstanceRoleSchema = z.enum(['owner', 'admin']);
const UserRoleFilterSchema = z.enum(['owner', 'instance-admin', 'org-admin', 'member']);
const DateTimeSchema = z.iso.datetime({ offset: true });

const UserCreateSchema = z
  .object({
    email: z.email(),
    name: z.string().min(1),
    password: z.string().min(8),
    organizationId: z.uuid().optional(),
    organizationRole: UserOrganizationRoleSchema.optional(),
    instanceRole: z.enum(['admin']).optional(),
  })
  .meta({ id: 'UserCreateDto' });

const UserStatusUpdateSchema = z
  .object({
    isDisabled: z.boolean(),
  })
  .meta({ id: 'UserStatusUpdateDto' });

const UserPasswordResetSchema = z
  .object({
    password: z.string().min(8),
  })
  .meta({ id: 'UserPasswordResetDto' });

const UserResponseSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
    cursorColor: z.string(),
    isDisabled: z.boolean(),
    passwordChangeRequired: z.boolean(),
    instanceRole: InstanceRoleSchema.nullable(),
    organizations: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        slug: z.string(),
        role: z.string(),
        status: z.string(),
      }),
    ),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'UserResponseDto' });

const UserListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    role: UserRoleFilterSchema.optional(),
    search: z.string().trim().max(120).optional(),
  })
  .meta({ id: 'UserListQueryDto' });

const UserListResponseSchema = z
  .object({
    items: z.array(UserResponseSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'UserListResponseDto' });

const UserPasswordResetResponseSchema = z
  .object({
    successful: z.boolean(),
    revokedSessions: z.number().int().nonnegative(),
  })
  .meta({ id: 'UserPasswordResetResponseDto' });

const UserSessionRevokeResponseSchema = z
  .object({
    successful: z.boolean(),
    revokedSessions: z.number().int().nonnegative(),
  })
  .meta({ id: 'UserSessionRevokeResponseDto' });

export class UserCreateDto extends createZodDto(UserCreateSchema) {}
export class UserListQueryDto extends createZodDto(UserListQuerySchema) {}
export class UserListResponseDto extends createZodDto(UserListResponseSchema) {}
export class UserPasswordResetDto extends createZodDto(UserPasswordResetSchema) {}
export class UserPasswordResetResponseDto extends createZodDto(UserPasswordResetResponseSchema) {}
export class UserResponseDto extends createZodDto(UserResponseSchema) {}
export class UserSessionRevokeResponseDto extends createZodDto(UserSessionRevokeResponseSchema) {}
export class UserStatusUpdateDto extends createZodDto(UserStatusUpdateSchema) {}
