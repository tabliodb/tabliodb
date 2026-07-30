import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Permission } from '@tabliodb/shared';
import type { AuthContext } from '../database.js';

export type AuthDto = AuthContext;

const LoginCredentialSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .meta({ id: 'LoginCredentialDto' });

const SignUpSchema = LoginCredentialSchema.extend({
  name: z.string().min(1),
}).meta({ id: 'SignUpDto' });

const PasswordResetRequestSchema = z
  .object({
    email: z.string().email(),
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
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
    cursorColor: z.string(),
  })
  .meta({ id: 'AuthUserDto' });

const LoginResponseSchema = z
  .object({
    accessToken: z.string(),
    user: AuthUserSchema,
  })
  .meta({ id: 'LoginResponseDto' });

const CurrentUserResponseSchema = AuthUserSchema.meta({ id: 'CurrentUserResponseDto' });

const ApiKeyCreateSchema = z
  .object({
    name: z.string().min(1).default('API Key'),
    permissions: z.array(z.enum(Permission)).default([Permission.All]),
  })
  .meta({ id: 'ApiKeyCreateDto' });

const ApiKeyCreateResponseSchema = z
  .object({
    secret: z.string(),
    apiKey: z.object({
      id: z.string().uuid(),
      name: z.string(),
      permissions: z.array(z.enum(Permission)),
    }),
  })
  .meta({ id: 'ApiKeyCreateResponseDto' });

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
export class SignUpDto extends createZodDto(SignUpSchema) {}
export class LoginResponseDto extends createZodDto(LoginResponseSchema) {}
export class CurrentUserResponseDto extends createZodDto(CurrentUserResponseSchema) {}
export class ApiKeyCreateDto extends createZodDto(ApiKeyCreateSchema) {}
export class ApiKeyCreateResponseDto extends createZodDto(ApiKeyCreateResponseSchema) {}
export class LogoutResponseDto extends createZodDto(LogoutResponseSchema) {}
export class PasswordResetConfirmDto extends createZodDto(PasswordResetConfirmSchema) {}
export class PasswordResetConfirmResponseDto extends createZodDto(PasswordResetConfirmResponseSchema) {}
export class PasswordResetRequestDto extends createZodDto(PasswordResetRequestSchema) {}
export class PasswordResetRequestResponseDto extends createZodDto(PasswordResetRequestResponseSchema) {}
