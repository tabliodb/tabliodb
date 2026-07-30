import type { OrganizationRole, Paginated, PaginationQuery } from '@tabliodb/shared';
import type { RequestOpts } from '@oazapfts/runtime';
import type {
  UserCreateDto as GeneratedUserCreateDto,
  UserPasswordResetDto as GeneratedUserPasswordResetDto,
  UserStatusUpdateDto as GeneratedUserStatusUpdateDto,
} from '../fetch-client.js';
import {
  createUser as createUserRequest,
  getUsers,
  resetUserPassword as resetUserPasswordRequest,
  revokeUserSessions as revokeUserSessionsRequest,
  updateUserStatus as updateUserStatusRequest,
} from '../fetch-client.js';

export type UserCreateDto = {
  email: string;
  instanceRole?: 'admin';
  name: string;
  organizationId?: string;
  organizationRole?: OrganizationRole.Admin | OrganizationRole.Member;
  password: string;
};

export type UserResponseDto = {
  cursorColor: string;
  createdAt: string;
  email: string;
  id: string;
  instanceRole: 'owner' | 'admin' | null;
  isDisabled: boolean;
  name: string;
  organizations: Array<{
    id: string;
    name: string;
    role: string;
    slug: string;
    status: string;
  }>;
  updatedAt: string;
};

export type UserRoleFilter = 'owner' | 'instance-admin' | 'org-admin' | 'member';

export type UserListQuery = PaginationQuery & {
  role?: UserRoleFilter;
  search?: string;
};

export type UserListResponseDto = Paginated<UserResponseDto>;
export type UserPasswordResetDto = {
  password: string;
};
export type UserPasswordResetResponseDto = {
  revokedSessions: number;
  successful: boolean;
};
export type UserSessionRevokeResponseDto = {
  revokedSessions: number;
  successful: boolean;
};
export type UserStatusUpdateDto = {
  isDisabled: boolean;
};

export type UsersResource = {
  create: (body: UserCreateDto) => Promise<UserResponseDto>;
  list: (query?: UserListQuery) => Promise<UserListResponseDto>;
  resetPassword: (userId: string, body: UserPasswordResetDto) => Promise<UserPasswordResetResponseDto>;
  revokeSessions: (userId: string) => Promise<UserSessionRevokeResponseDto>;
  updateStatus: (userId: string, body: UserStatusUpdateDto) => Promise<UserResponseDto>;
};

export function createUsersResource(opts?: RequestOpts): UsersResource {
  return {
    // Admin console memakai list ini sebagai satu source of truth untuk user, instance role, dan membership ringkas.
    list: (query: UserListQuery = {}) => getUsers(query, opts) as Promise<UserListResponseDto>,
    // Manual creation tetap lewat server agar hashing password, membership, dan instance role dibuat atomik di satu transaksi.
    create: (body: UserCreateDto) =>
      // Shared OrganizationRole adalah enum domain; cast ini hanya menjembatani enum generated yang value string-nya sama.
      createUserRequest({ userCreateDto: body as unknown as GeneratedUserCreateDto }, opts) as Promise<UserResponseDto>,
    resetPassword: (userId: string, body: UserPasswordResetDto) =>
      resetUserPasswordRequest(
        { userId, userPasswordResetDto: body as GeneratedUserPasswordResetDto },
        opts,
      ) as Promise<UserPasswordResetResponseDto>,
    revokeSessions: (userId: string) =>
      revokeUserSessionsRequest({ userId }, opts) as Promise<UserSessionRevokeResponseDto>,
    updateStatus: (userId: string, body: UserStatusUpdateDto) =>
      updateUserStatusRequest(
        { userId, userStatusUpdateDto: body as GeneratedUserStatusUpdateDto },
        opts,
      ) as Promise<UserResponseDto>,
  };
}
