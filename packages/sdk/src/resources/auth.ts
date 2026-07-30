import type { Permission } from '@tabliodb/shared';
import type { RequestOpts } from '@oazapfts/runtime';
import type {
  ApiKeyCreateDto as GeneratedApiKeyCreateDto,
  CurrentUserProfileUpdateDto as GeneratedCurrentUserProfileUpdateDto,
  PasswordResetConfirmDto as GeneratedPasswordResetConfirmDto,
  PasswordResetRequestDto as GeneratedPasswordResetRequestDto,
} from '../fetch-client.js';
import {
  confirmPasswordReset as confirmPasswordResetRequest,
  createApiKey as createApiKeyRequest,
  deleteCurrentUserAvatar as deleteCurrentUserAvatarRequest,
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  requestPasswordReset as requestPasswordResetRequest,
  signUp as signUpRequest,
  updateCurrentUserProfile as updateCurrentUserProfileRequest,
  uploadCurrentUserAvatar as uploadCurrentUserAvatarRequest,
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
  avatarUrl: string | null;
  cursorColor: string;
  email: string;
  id: string;
  name: string;
};

export type LoginResponseDto = {
  accessToken: string;
  user: AuthUserDto;
};

export type CurrentUserResponseDto = AuthUserDto;

export type CurrentUserProfileUpdateDto = {
  cursorColor?: string;
  name?: string;
};

export type LogoutResponseDto = {
  successful: boolean;
};

export type PasswordResetRequestDto = {
  email: string;
};

export type PasswordResetRequestResponseDto = {
  expiresAt: string | null;
  resetToken: string | null;
  resetUrl: string | null;
  successful: boolean;
};

export type PasswordResetConfirmDto = {
  password: string;
  token: string;
};

export type PasswordResetConfirmResponseDto = {
  revokedSessions: number;
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
  confirmPasswordReset: (body: PasswordResetConfirmDto) => Promise<PasswordResetConfirmResponseDto>;
  createApiKey: (body: ApiKeyCreateDto) => Promise<ApiKeyCreateResponseDto>;
  deleteAvatar: () => Promise<CurrentUserResponseDto>;
  login: (body: LoginCredentialDto) => Promise<LoginResponseDto>;
  logout: () => Promise<LogoutResponseDto>;
  me: () => Promise<CurrentUserResponseDto>;
  requestPasswordReset: (body: PasswordResetRequestDto) => Promise<PasswordResetRequestResponseDto>;
  signUp: (body: SignUpDto) => Promise<LoginResponseDto>;
  updateProfile: (body: CurrentUserProfileUpdateDto) => Promise<CurrentUserResponseDto>;
  uploadAvatar: (file: Blob) => Promise<CurrentUserResponseDto>;
};

export function createAuthResource(opts?: RequestOpts): AuthResource {
  return {
    me: () => getCurrentUser(opts) as Promise<CurrentUserResponseDto>,
    uploadAvatar: (file: Blob) =>
      uploadCurrentUserAvatarRequest({ body: { file } }, opts) as Promise<CurrentUserResponseDto>,
    deleteAvatar: () => deleteCurrentUserAvatarRequest(opts) as Promise<CurrentUserResponseDto>,
    updateProfile: (body: CurrentUserProfileUpdateDto) =>
      updateCurrentUserProfileRequest(
        { currentUserProfileUpdateDto: body as unknown as GeneratedCurrentUserProfileUpdateDto },
        opts,
      ) as Promise<CurrentUserResponseDto>,
    login: (body: LoginCredentialDto) => loginRequest({ loginCredentialDto: body }, opts) as Promise<LoginResponseDto>,
    signUp: (body: SignUpDto) => signUpRequest({ signUpDto: body }, opts) as Promise<LoginResponseDto>,
    logout: () => logoutRequest(opts) as Promise<LogoutResponseDto>,
    requestPasswordReset: (body: PasswordResetRequestDto) =>
      requestPasswordResetRequest(
        { passwordResetRequestDto: body as unknown as GeneratedPasswordResetRequestDto },
        opts,
      ) as Promise<PasswordResetRequestResponseDto>,
    confirmPasswordReset: (body: PasswordResetConfirmDto) =>
      confirmPasswordResetRequest(
        { passwordResetConfirmDto: body as unknown as GeneratedPasswordResetConfirmDto },
        opts,
      ) as Promise<PasswordResetConfirmResponseDto>,
    createApiKey: (body: ApiKeyCreateDto) =>
      // Boundary generated-client tetap privat agar enum OpenAPI tidak bocor ke public SDK surface.
      createApiKeyRequest(
        { apiKeyCreateDto: body as unknown as GeneratedApiKeyCreateDto },
        opts,
      ) as unknown as Promise<ApiKeyCreateResponseDto>,
  };
}
