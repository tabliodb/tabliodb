import type { Permission } from '@tabliodb/shared';
import type { RequestOpts } from '@oazapfts/runtime';
import {
  createApiKey as createApiKeyRequest,
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  signUp as signUpRequest,
} from '../fetch-client.js';

export type LoginCredentialDto = {
  email: string;
  password: string;
};

export type SignUpDto = {
  email: string;
  name: string;
  password: string;
};

export type AuthUserDto = {
  avatarColor: string | null;
  email: string;
  id: string;
  name: string;
};

export type LoginResponseDto = {
  accessToken: string;
  user: AuthUserDto;
};

export type CurrentUserResponseDto = AuthUserDto;

export type LogoutResponseDto = {
  successful: boolean;
};

export type ApiKeyCreateDto = {
  name?: string;
  permissions?: Permission[];
};

export type ApiKeyCreateResponseDto = {
  apiKey: {
    id: string;
    name: string;
    permissions: Permission[];
  };
  secret: string;
};

export type AuthResource = {
  createApiKey: (body: ApiKeyCreateDto) => Promise<ApiKeyCreateResponseDto>;
  login: (body: LoginCredentialDto) => Promise<LoginResponseDto>;
  logout: () => Promise<LogoutResponseDto>;
  me: () => Promise<CurrentUserResponseDto>;
  signUp: (body: SignUpDto) => Promise<LoginResponseDto>;
};

export function createAuthResource(opts?: RequestOpts): AuthResource {
  return {
    me: () => getCurrentUser(opts) as Promise<CurrentUserResponseDto>,
    login: (body: LoginCredentialDto) => loginRequest({ loginCredentialDto: body }, opts) as Promise<LoginResponseDto>,
    signUp: (body: SignUpDto) => signUpRequest({ signUpDto: body }, opts) as Promise<LoginResponseDto>,
    logout: () => logoutRequest(opts) as Promise<LogoutResponseDto>,
    createApiKey: (body: ApiKeyCreateDto) =>
      // Permission di domain shared adalah string literal union; generated OpenAPI menerima string[] yang kompatibel di wire format.
      createApiKeyRequest({ apiKeyCreateDto: body }, opts) as Promise<ApiKeyCreateResponseDto>,
  };
}
