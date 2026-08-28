import { OrganizationRole, AccessRole } from '@tabliodb/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { LoginResponseDto, SessionBindingSchema } from './auth.dto.js';

const DateTimeSchema = z.iso.datetime({ offset: true });
const InvitationStatusSchema = z.enum(['pending', 'accepted', 'revoked', 'expired']);
const InvitationOrganizationRoleSchema = z.enum([OrganizationRole.Admin, OrganizationRole.Member, OrganizationRole.Guest]);
const InvitationAccessRoleSchema = z.enum([AccessRole.Editor, AccessRole.Commenter, AccessRole.Viewer]);
const InvitationDiagramRoleSchema = z.enum([AccessRole.Owner, AccessRole.Editor, AccessRole.Commenter, AccessRole.Viewer]);

const InvitationSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    organizationId: z.uuid(),
    organizationName: z.string(),
    organizationSlug: z.string(),
    organizationRole: InvitationOrganizationRoleSchema,
    folderId: z.uuid().nullable(),
    folderName: z.string().nullable(),
    folderRole: InvitationAccessRoleSchema.nullable(),
    diagramId: z.uuid().nullable(),
    diagramName: z.string().nullable(),
    diagramRole: InvitationDiagramRoleSchema.nullable(),
    message: z.string().nullable(),
    invitedById: z.uuid(),
    invitedByName: z.string(),
    acceptedById: z.uuid().nullable(),
    acceptedAt: DateTimeSchema.nullable(),
    revokedAt: DateTimeSchema.nullable(),
    expiresAt: DateTimeSchema,
    createdAt: DateTimeSchema,
    status: InvitationStatusSchema,
  })
  .meta({ id: 'InvitationDto' });

const InvitationPublicSchema = InvitationSchema.pick({
  email: true,
  organizationName: true,
  organizationRole: true,
  folderName: true,
  folderRole: true,
  diagramName: true,
  diagramRole: true,
  message: true,
  expiresAt: true,
  status: true,
}).meta({ id: 'InvitationPublicDto' });

const InvitationCreateSchema = z
  .object({
    email: z.email(),
    organizationId: z.uuid().optional(),
    organizationRole: InvitationOrganizationRoleSchema.optional(),
    folderId: z.uuid().optional(),
    folderRole: InvitationAccessRoleSchema.optional(),
    diagramId: z.uuid().optional(),
    diagramRole: InvitationDiagramRoleSchema.optional(),
    message: z.string().trim().max(500).optional(),
    expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
  })
  .meta({ id: 'InvitationCreateDto' });

const InvitationCreateResponseSchema = z
  .object({
    invitation: InvitationSchema,
    token: z.string(),
    acceptUrl: z.url(),
  })
  .meta({ id: 'InvitationCreateResponseDto' });

const InvitationAcceptSchema = z
  .object({
    token: z.string().min(16),
    name: z.string().min(1),
    password: z.string().min(8),
    sessionBinding: SessionBindingSchema.optional(),
  })
  .meta({ id: 'InvitationAcceptDto' });

const InvitationAcceptResponseSchema = LoginResponseDto.schema
  .extend({
    invitation: InvitationPublicSchema,
  })
  .meta({ id: 'InvitationAcceptResponseDto' });

export class InvitationAcceptDto extends createZodDto(InvitationAcceptSchema) {}
export class InvitationAcceptResponseDto extends createZodDto(InvitationAcceptResponseSchema) {}
export class InvitationCreateDto extends createZodDto(InvitationCreateSchema) {}
export class InvitationCreateResponseDto extends createZodDto(InvitationCreateResponseSchema) {}
export class InvitationDto extends createZodDto(InvitationSchema) {}
export class InvitationPublicDto extends createZodDto(InvitationPublicSchema) {}
