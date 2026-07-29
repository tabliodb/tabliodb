import type { OrganizationRole } from '@tabliodb/shared';
import type { TabliodbClient } from '../fetch-client.js';

export type UserCreateDto = {
  email: string;
  instanceRole?: 'admin';
  name: string;
  organizationId?: string;
  organizationRole?: OrganizationRole.Admin | OrganizationRole.Member;
  password: string;
};

export type UserResponseDto = {
  avatarColor: string | null;
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

export function createUsersResource(client: TabliodbClient) {
  return {
    // Admin console memakai list ini sebagai satu source of truth untuk user, instance role, dan membership ringkas.
    list: () => client.request<UserResponseDto[]>('/users'),
    // Manual creation tetap lewat server agar hashing password, membership, dan instance role dibuat atomik di satu transaksi.
    create: (body: UserCreateDto) => client.request<UserResponseDto>('/users', { body, method: 'POST' }),
  };
}
