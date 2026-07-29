import type { Permission } from '@tabliodb/shared';
import type { RequestOpts } from '@oazapfts/runtime';
import {
  createApiKey as createApiKeyRequest,
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  signUp as signUpRequest,
  type ApiKeyCreateDto as GeneratedApiKeyCreateDto,
  type ApiKeyCreateResponseDtoOutput,
  type AuthUserDtoOutput,
  type LoginCredentialDto as GeneratedLoginCredentialDto,
  type LoginResponseDtoOutput,
  type LogoutResponseDtoOutput,
  type SignUpDto as GeneratedSignUpDto,
} from '../fetch-client.js';

export type LoginCredentialDto = GeneratedLoginCredentialDto;

export type SignUpDto = GeneratedSignUpDto;

export type LoginResponseDto = LoginResponseDtoOutput;

export type CurrentUserResponseDto = AuthUserDtoOutput;

export type ApiKeyCreateDto = {
  name?: string;
  permissions?: Permission[];
};

export type ApiKeyCreateResponseDto = ApiKeyCreateResponseDtoOutput;

export function createAuthResource(opts?: RequestOpts) {
  return {
    me: () => getCurrentUser(opts) as Promise<CurrentUserResponseDto>,
    login: (body: LoginCredentialDto) => loginRequest({ loginCredentialDto: body }, opts) as Promise<LoginResponseDto>,
    signUp: (body: SignUpDto) => signUpRequest({ signUpDto: body }, opts) as Promise<LoginResponseDto>,
    logout: () => logoutRequest(opts) as Promise<LogoutResponseDtoOutput>,
    createApiKey: (body: ApiKeyCreateDto) =>
      // Permission di domain shared adalah string literal union; generated OpenAPI menerima string[] yang kompatibel di wire format.
      createApiKeyRequest(
        { apiKeyCreateDto: body as GeneratedApiKeyCreateDto },
        opts,
      ) as Promise<ApiKeyCreateResponseDto>,
  };
}
