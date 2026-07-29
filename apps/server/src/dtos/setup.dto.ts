import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const SetupStatusResponseSchema = z
  .object({
    completedAt: z.string().datetime().nullable(),
    hasOrganization: z.boolean(),
    hasOwner: z.boolean(),
    isSetupComplete: z.boolean(),
    signupPolicy: z.enum(['signup_disabled', 'invite_only', 'allowed_domains', 'sso_only', 'public_signup']),
  })
  .meta({ id: 'SetupStatusResponseDto' });

const SetupCreateSchema = z
  .object({
    ownerEmail: z.string().email(),
    ownerName: z.string().min(1),
    ownerPassword: z.string().min(8),
    publicUrl: z.string().url().optional(),
    workspaceName: z.string().min(1),
  })
  .meta({ id: 'SetupCreateDto' });

const SetupCreateResponseSchema = z
  .object({
    accessToken: z.string(),
    setup: SetupStatusResponseSchema,
    user: z.object({
      avatarColor: z.string().nullable(),
      email: z.string().email(),
      id: z.string().uuid(),
      name: z.string(),
    }),
  })
  .meta({ id: 'SetupCreateResponseDto' });

export class SetupStatusResponseDto extends createZodDto(SetupStatusResponseSchema) {}
export class SetupCreateDto extends createZodDto(SetupCreateSchema) {}
export class SetupCreateResponseDto extends createZodDto(SetupCreateResponseSchema) {}
