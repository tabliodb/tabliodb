import { createZodDto } from 'nestjs-zod';
import { OrganizationRole } from '@tabliodb/shared';
import { z } from 'zod';
import { SessionBindingSchema } from './auth.dto.js';

const DateTimeSchema = z.iso.datetime({ offset: true });
const SignupPolicySchema = z.enum(['signup_disabled', 'invite_only', 'allowed_domains', 'sso_only', 'public_signup']);
const OidcAutoJoinOrganizationRoleSchema = z.enum([OrganizationRole.Member, OrganizationRole.Guest]);
const SmtpSecuritySchema = z.enum(['none', 'starttls', 'tls']).meta({ id: 'SmtpSecurity' });

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

const OidcProviderSettingsSchema = z
  .object({
    autoCreateUsers: z.boolean(),
    autoJoinOrganizationId: z.string().uuid().nullable(),
    autoJoinOrganizationRole: OidcAutoJoinOrganizationRoleSchema.nullable(),
    buttonLabel: z.string(),
    clientId: z.string().nullable(),
    clientSecretConfigured: z.boolean(),
    clientSecretKeyId: z.string().nullable(),
    clientSecretUpdatedAt: DateTimeSchema.nullable(),
    enabled: z.boolean(),
    issuerUrl: z.string().nullable(),
    scopes: z.array(z.string()),
  })
  .meta({ id: 'OidcProviderSettingsDto' });

const OidcProviderSettingsUpdateSchema = z
  .object({
    autoCreateUsers: z.boolean(),
    autoJoinOrganizationId: z.string().uuid().nullable(),
    autoJoinOrganizationRole: OidcAutoJoinOrganizationRoleSchema.nullable(),
    buttonLabel: z.string().min(1).max(60),
    clearClientSecret: z.boolean().optional(),
    clientId: z.string().min(1).max(200).nullable(),
    clientSecret: z.string().min(1).max(4096).optional(),
    enabled: z.boolean(),
    issuerUrl: z.url().nullable(),
    scopes: z.array(z.string().min(1).max(80)).max(20),
  })
  .meta({ id: 'OidcProviderSettingsUpdateDto' });

const SmtpSettingsSchema = z
  .object({
    enabled: z.boolean(),
    fromEmail: z.string().email().nullable(),
    fromName: z.string().nullable(),
    host: z.string().nullable(),
    passwordConfigured: z.boolean(),
    passwordKeyId: z.string().nullable(),
    passwordUpdatedAt: DateTimeSchema.nullable(),
    port: z.number().int().min(1).max(65_535).nullable(),
    replyToEmail: z.string().email().nullable(),
    security: SmtpSecuritySchema,
    username: z.string().nullable(),
  })
  .meta({ id: 'SmtpSettingsDto' });

const SmtpSettingsUpdateSchema = z
  .object({
    clearPassword: z.boolean().optional(),
    enabled: z.boolean(),
    fromEmail: z.string().email().nullable(),
    fromName: z.string().min(1).max(120).nullable(),
    host: z.string().min(1).max(255).nullable(),
    password: z.string().min(1).max(4096).optional(),
    port: z.number().int().min(1).max(65_535).nullable(),
    replyToEmail: z.string().email().nullable(),
    security: SmtpSecuritySchema,
    username: z.string().min(1).max(255).nullable(),
  })
  .meta({ id: 'SmtpSettingsUpdateDto' });

const SetupCreateSchema = z
  .object({
    ownerEmail: z.string().email(),
    ownerName: z.string().min(1),
    ownerPassword: z.string().min(8),
    publicUrl: z.string().url().optional(),
    sessionBinding: SessionBindingSchema.optional(),
    workspaceName: z.string().min(1),
  })
  .meta({ id: 'SetupCreateDto' });

const SetupCreateResponseSchema = z
  .object({
    accessToken: z.string(),
    setup: SetupStatusResponseSchema,
    user: z.object({
      avatarUrl: z.string().nullable(),
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
export class OidcProviderSettingsDto extends createZodDto(OidcProviderSettingsSchema) {}
export class OidcProviderSettingsUpdateDto extends createZodDto(OidcProviderSettingsUpdateSchema) {}
export class SmtpSettingsDto extends createZodDto(SmtpSettingsSchema) {}
export class SmtpSettingsUpdateDto extends createZodDto(SmtpSettingsUpdateSchema) {}
export class SetupCreateDto extends createZodDto(SetupCreateSchema) {}
export class SetupCreateResponseDto extends createZodDto(SetupCreateResponseSchema) {}
