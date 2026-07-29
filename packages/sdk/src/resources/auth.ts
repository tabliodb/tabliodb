import type { Permission } from '@tabliodb/shared';
import type { TabliodbClient } from '../fetch-client.js';

export type LoginCredentialDto = {
  email: string;
  password: string;
};

export type SignUpDto = LoginCredentialDto & {
  name: string;
};

export type LoginResponseDto = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarColor: string | null;
  };
};

export type ApiKeyCreateDto = {
  name?: string;
  permissions?: Permission[];
};

export type ApiKeyCreateResponseDto = {
  secret: string;
  apiKey: {
    id: string;
    name: string;
    permissions: Permission[];
  };
};

export function createAuthResource(client: TabliodbClient) {
  return {
    login: (body: LoginCredentialDto) => client.request<LoginResponseDto>('/auth/login', { body, method: 'POST' }),
    signUp: (body: SignUpDto) => client.request<LoginResponseDto>('/auth/sign-up', { body, method: 'POST' }),
    logout: () => client.request<{ successful: true }>('/auth/logout', { method: 'POST' }),
    createApiKey: (body: ApiKeyCreateDto) =>
      client.request<ApiKeyCreateResponseDto>('/auth/api-keys', { body, method: 'POST' }),
  };
}
