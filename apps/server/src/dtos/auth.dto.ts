import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
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

const LoginResponseSchema = z
  .object({
    accessToken: z.string(),
    user: z.object({
      id: z.string().uuid(),
      email: z.string().email(),
      name: z.string(),
      avatarColor: z.string().nullable(),
    }),
  })
  .meta({ id: 'LoginResponseDto' });

const ApiKeyCreateSchema = z
  .object({
    name: z.string().min(1).default('API Key'),
    permissions: z.array(z.string()).default(['all']),
  })
  .meta({ id: 'ApiKeyCreateDto' });

const ApiKeyCreateResponseSchema = z
  .object({
    secret: z.string(),
    apiKey: z.object({
      id: z.string().uuid(),
      name: z.string(),
      permissions: z.array(z.string()),
    }),
  })
  .meta({ id: 'ApiKeyCreateResponseDto' });

const LogoutResponseSchema = z
  .object({
    successful: z.boolean(),
  })
  .meta({ id: 'LogoutResponseDto' });

export class LoginCredentialDto extends createZodDto(LoginCredentialSchema) {}
export class SignUpDto extends createZodDto(SignUpSchema) {}
export class LoginResponseDto extends createZodDto(LoginResponseSchema) {}
export class ApiKeyCreateDto extends createZodDto(ApiKeyCreateSchema) {}
export class ApiKeyCreateResponseDto extends createZodDto(ApiKeyCreateResponseSchema) {}
export class LogoutResponseDto extends createZodDto(LogoutResponseSchema) {}
