import type { OrganizationRole, Paginated, PaginationQuery } from '@tabliodb/shared';
import type { RequestOpts } from '@oazapfts/runtime';
import {
  createUser as createUserRequest,
  getUsers,
  type UserCreateDto as GeneratedUserCreateDto,
  type UserResponseDtoOutput,
} from '../fetch-client.js';

export type UserCreateDto = {
  email: string;
  instanceRole?: 'admin';
  name: string;
  organizationId?: string;
  organizationRole?: OrganizationRole.Admin | OrganizationRole.Member;
  password: string;
};

export type UserResponseDto = Omit<UserResponseDtoOutput, 'instanceRole'> & {
  instanceRole: 'owner' | 'admin' | null;
};

export type UserRoleFilter = 'owner' | 'instance-admin' | 'org-admin' | 'member';

export type UserListQuery = PaginationQuery & {
  role?: UserRoleFilter;
  search?: string;
};

export type UserListResponseDto = Paginated<UserResponseDto>;

export function createUsersResource(opts?: RequestOpts) {
  return {
    // Admin console memakai list ini sebagai satu source of truth untuk user, instance role, dan membership ringkas.
    list: (query: UserListQuery = {}) => getUsers(query, opts) as Promise<UserListResponseDto>,
    // Manual creation tetap lewat server agar hashing password, membership, dan instance role dibuat atomik di satu transaksi.
    create: (body: UserCreateDto) =>
      // Shared OrganizationRole adalah enum domain; cast ini hanya menjembatani enum generated yang value string-nya sama.
      createUserRequest({ userCreateDto: body as GeneratedUserCreateDto }, opts) as Promise<UserResponseDto>,
  };
}
