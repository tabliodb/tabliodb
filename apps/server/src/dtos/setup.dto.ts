import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DateTimeSchema = z.iso.datetime({ offset: true });
const SignupPolicySchema = z.enum(['signup_disabled', 'invite_only', 'allowed_domains', 'sso_only', 'public_signup']);

const SetupStatusResponseSchema = z
  .object({
    completedAt: DateTimeSchema.nullable(),
    hasOrganization: z.boolean(),
    hasOwner: z.boolean(),
    isSetupComplete: z.boolean(),
    signupPolicy: SignupPolicySchema,
  })
  .meta({ id: 'SetupStatusResponseDto' });

const InstanceAuthSettingsSchema = z
  .object({
    allowedDomains: z.array(z.string()),
    signupPolicy: SignupPolicySchema,
  })
  .meta({ id: 'InstanceAuthSettingsDto' });

const InstanceAuthSettingsUpdateSchema = z
  .object({
    allowedDomains: z.array(z.string()).max(100),
    signupPolicy: SignupPolicySchema,
  })
  .meta({ id: 'InstanceAuthSettingsUpdateDto' });

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
      avatarUrl: z.string().url().nullable(),
      cursorColor: z.string(),
      email: z.string().email(),
      id: z.string().uuid(),
      name: z.string(),
    }),
  })
  .meta({ id: 'SetupCreateResponseDto' });

export class SetupStatusResponseDto extends createZodDto(SetupStatusResponseSchema) {}
export class InstanceAuthSettingsDto extends createZodDto(InstanceAuthSettingsSchema) {}
export class InstanceAuthSettingsUpdateDto extends createZodDto(InstanceAuthSettingsUpdateSchema) {}
export class SetupCreateDto extends createZodDto(SetupCreateSchema) {}
export class SetupCreateResponseDto extends createZodDto(SetupCreateResponseSchema) {}
