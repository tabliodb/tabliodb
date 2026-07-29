import { ProjectRole } from '@tabliodb/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DateTimeSchema = z.iso.datetime({ offset: true });
const DefaultProjectRoleSchema = z.enum([ProjectRole.Editor, ProjectRole.Commenter, ProjectRole.Viewer]);

const OrganizationSettingsSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    defaultProjectRole: DefaultProjectRoleSchema.nullable(),
    allowMemberProjectCreate: z.boolean(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'OrganizationSettingsDto' });

const OrganizationSettingsUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    defaultProjectRole: DefaultProjectRoleSchema.nullable().optional(),
    allowMemberProjectCreate: z.boolean().optional(),
  })
  .meta({ id: 'OrganizationSettingsUpdateDto' });

export class OrganizationSettingsDto extends createZodDto(OrganizationSettingsSchema) {}
export class OrganizationSettingsUpdateDto extends createZodDto(OrganizationSettingsUpdateSchema) {}
