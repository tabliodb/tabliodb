import { OrganizationRole } from '@tabliodb/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UserOrganizationRoleSchema = z.enum([OrganizationRole.Admin, OrganizationRole.Member]);
const InstanceRoleSchema = z.enum(['owner', 'admin']);
const UserRoleFilterSchema = z.enum(['owner', 'instance-admin', 'org-admin', 'member']);

const UserCreateSchema = z
  .object({
    email: z.string().email(),
    name: z.string().min(1),
    password: z.string().min(8),
    organizationId: z.string().uuid().optional(),
    organizationRole: UserOrganizationRoleSchema.optional(),
    instanceRole: z.enum(['admin']).optional(),
  })
  .meta({ id: 'UserCreateDto' });

const UserResponseSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    avatarColor: z.string().nullable(),
    isDisabled: z.boolean(),
    instanceRole: InstanceRoleSchema.nullable(),
    organizations: z.array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        slug: z.string(),
        role: z.string(),
        status: z.string(),
      }),
    ),
    createdAt: z.date(),
    updatedAt: z.date(),
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

export class UserCreateDto extends createZodDto(UserCreateSchema) {}
export class UserListQueryDto extends createZodDto(UserListQuerySchema) {}
export class UserListResponseDto extends createZodDto(UserListResponseSchema) {}
export class UserResponseDto extends createZodDto(UserResponseSchema) {}
