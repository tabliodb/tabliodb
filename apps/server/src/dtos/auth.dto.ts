import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Permission } from '@tabliodb/shared';
import type { AuthContext } from '../database.js';

export type AuthDto = AuthContext;

const DateTimeSchema = z.iso.datetime({ offset: true });

export const SessionBindingSchema = z
  .object({
    algorithm: z.literal('ecdsa-p256-sha256'),
    publicKey: z
      .object({
        crv: z.literal('P-256'),
        ext: z.boolean().optional(),
        key_ops: z.array(z.string()).optional(),
        kty: z.literal('EC'),
        x: z.string().min(1),
        y: z.string().min(1),
      })
      .meta({ id: 'SessionBindingPublicKeyDto' }),
  })
  .meta({ id: 'SessionBindingDto' });

const LoginCredentialSchema = z
  .object({
    email: z.email(),
    password: z.string().min(1),
    sessionBinding: SessionBindingSchema.optional(),
  })
  .meta({ id: 'LoginCredentialDto' });

const OidcLoginProviderSchema = z
  .object({
    buttonLabel: z.string(),
    enabled: z.boolean(),
  })
  .meta({ id: 'OidcLoginProviderDto' });

const OidcLoginStartSchema = z
  .object({
    returnTo: z.string().max(500).optional(),
    sessionBinding: SessionBindingSchema.optional(),
  })
  .meta({ id: 'OidcLoginStartDto' });

const OidcLoginStartResponseSchema = z
  .object({
    authorizationUrl: z.url(),
  })
  .meta({ id: 'OidcLoginStartResponseDto' });

const SignUpSchema = LoginCredentialSchema.extend({
  name: z.string().min(1),
}).meta({ id: 'SignUpDto' });

const PasswordResetRequestSchema = z
  .object({
    email: z.email(),
  })
  .meta({ id: 'PasswordResetRequestDto' });

const PasswordResetConfirmSchema = z
  .object({
    password: z.string().min(8),
    token: z.string().min(16),
  })
  .meta({ id: 'PasswordResetConfirmDto' });

const AuthUserSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
    cursorColor: z.string(),
    passwordChangeRequired: z.boolean(),
  })
  .meta({ id: 'AuthUserDto' });

const CurrentUserProfileUpdateSchema = z
  .object({
    cursorColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Use a valid hex color.')
      .optional(),
    name: z.string().trim().min(1).max(120).optional(),
  })
  .meta({ id: 'CurrentUserProfileUpdateDto' });

const CurrentUserPasswordUpdateSchema = z
  .object({
    currentPassword: z.string().min(1),
    password: z.string().min(8),
  })
  .meta({ id: 'CurrentUserPasswordUpdateDto' });

const CurrentUserTemporaryPasswordUpdateSchema = z
  .object({
    password: z.string().min(8),
  })
  .meta({ id: 'CurrentUserTemporaryPasswordUpdateDto' });

const CurrentUserEditorPreferenceSchema = z
  .object({
    diagramId: z.uuid().nullable(),
    diagramName: z.string().nullable(),
    organizationId: z.uuid().nullable(),
    organizationName: z.string().nullable(),
    projectId: z.uuid().nullable(),
    projectName: z.string().nullable(),
    updatedAt: DateTimeSchema.nullable(),
    workspaceSlug: z.string().nullable(),
  })
  .meta({ id: 'CurrentUserEditorPreferenceDto' });

const CurrentUserEditorPreferenceUpdateSchema = z
  .object({
    diagramId: z.uuid().nullable().optional(),
    organizationId: z.uuid(),
    projectId: z.uuid().nullable().optional(),
  })
  .meta({ id: 'CurrentUserEditorPreferenceUpdateDto' });

const LoginResponseSchema = z
  .object({
    accessToken: z.string(),
    user: AuthUserSchema,
  })
  .meta({ id: 'LoginResponseDto' });

const CurrentUserResponseSchema = AuthUserSchema.meta({ id: 'CurrentUserResponseDto' });

const ApiKeyCreateSchema = z
  .object({
    expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
    name: z.string().trim().min(1).max(120).default('API Key'),
    permissions: z.array(z.enum(Permission)).default([Permission.All]),
  })
  .meta({ id: 'ApiKeyCreateDto' });

const ApiKeySchema = z
  .object({
    createdAt: DateTimeSchema,
    expiresAt: DateTimeSchema.nullable(),
    id: z.uuid(),
    lastUsedAt: DateTimeSchema.nullable(),
    name: z.string(),
    permissions: z.array(z.enum(Permission)),
    prefix: z.string(),
    revokedAt: DateTimeSchema.nullable(),
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'ApiKeyDto' });

const ApiKeyCreateResponseSchema = z
  .object({
    secret: z.string(),
    apiKey: ApiKeySchema,
  })
  .meta({ id: 'ApiKeyCreateResponseDto' });

const ApiKeyListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: 'ApiKeyListQueryDto' });

const ApiKeyListResponseSchema = z
  .object({
    items: z.array(ApiKeySchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'ApiKeyListResponseDto' });

const ApiKeyRevokeResponseSchema = z
  .object({
    id: z.string().uuid(),
    revoked: z.boolean(),
  })
  .meta({ id: 'ApiKeyRevokeResponseDto' });

const LogoutResponseSchema = z
  .object({
    successful: z.boolean(),
  })
  .meta({ id: 'LogoutResponseDto' });

const PasswordResetRequestResponseSchema = z
  .object({
    expiresAt: z.iso.datetime({ offset: true }).nullable(),
    resetToken: z.string().nullable(),
    resetUrl: z.url().nullable(),
    successful: z.boolean(),
  })
  .meta({ id: 'PasswordResetRequestResponseDto' });

const PasswordResetConfirmResponseSchema = z
  .object({
    revokedSessions: z.number().int().nonnegative(),
    successful: z.boolean(),
  })
  .meta({ id: 'PasswordResetConfirmResponseDto' });

export class LoginCredentialDto extends createZodDto(LoginCredentialSchema) {}
export class OidcLoginProviderDto extends createZodDto(OidcLoginProviderSchema) {}
export class OidcLoginStartDto extends createZodDto(OidcLoginStartSchema) {}
export class OidcLoginStartResponseDto extends createZodDto(OidcLoginStartResponseSchema) {}
export class SessionBindingDto extends createZodDto(SessionBindingSchema) {}
export class SignUpDto extends createZodDto(SignUpSchema) {}
export class LoginResponseDto extends createZodDto(LoginResponseSchema) {}
export class CurrentUserResponseDto extends createZodDto(CurrentUserResponseSchema) {}
export class CurrentUserProfileUpdateDto extends createZodDto(CurrentUserProfileUpdateSchema) {}
export class CurrentUserPasswordUpdateDto extends createZodDto(CurrentUserPasswordUpdateSchema) {}
export class CurrentUserTemporaryPasswordUpdateDto extends createZodDto(CurrentUserTemporaryPasswordUpdateSchema) {}
export class CurrentUserEditorPreferenceDto extends createZodDto(CurrentUserEditorPreferenceSchema) {}
export class CurrentUserEditorPreferenceUpdateDto extends createZodDto(CurrentUserEditorPreferenceUpdateSchema) {}
export class ApiKeyCreateDto extends createZodDto(ApiKeyCreateSchema) {}
export class ApiKeyCreateResponseDto extends createZodDto(ApiKeyCreateResponseSchema) {}
export class ApiKeyListQueryDto extends createZodDto(ApiKeyListQuerySchema) {}
export class ApiKeyListResponseDto extends createZodDto(ApiKeyListResponseSchema) {}
export class ApiKeyRevokeResponseDto extends createZodDto(ApiKeyRevokeResponseSchema) {}
export class LogoutResponseDto extends createZodDto(LogoutResponseSchema) {}
export class PasswordResetConfirmDto extends createZodDto(PasswordResetConfirmSchema) {}
export class PasswordResetConfirmResponseDto extends createZodDto(PasswordResetConfirmResponseSchema) {}
export class PasswordResetRequestDto extends createZodDto(PasswordResetRequestSchema) {}
export class PasswordResetRequestResponseDto extends createZodDto(PasswordResetRequestResponseSchema) {}
