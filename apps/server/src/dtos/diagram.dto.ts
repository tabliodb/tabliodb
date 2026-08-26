import { DatabaseDialectSchema, DiagramModelSchema } from '@tabliodb/schema-core';
import { ProjectRole } from '@tabliodb/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DateTimeSchema = z.iso.datetime({ offset: true });
const DiagramStatusSchema = z.enum(['draft', 'reviewed', 'approved', 'changes_requested']);
const DiagramMemberRoleSchema = z.enum([
  ProjectRole.Owner,
  ProjectRole.Editor,
  ProjectRole.Commenter,
  ProjectRole.Viewer,
]);
const DiagramAssignableMemberRoleSchema = z.enum([ProjectRole.Editor, ProjectRole.Commenter, ProjectRole.Viewer]);
const DiagramEffectiveAccessTypeSchema = z.enum(['direct', 'inherited', 'mixed']);
const DiagramEffectiveAccessSourceTypeSchema = z.enum([
  'direct',
  'diagram_team',
  'folder',
  'folder_team',
  'workspace_admin',
  'workspace_default',
  'workspace_member',
]);

const DiagramCreateSchema = z
  .object({
    organizationId: z.uuid(),
    projectId: z.uuid().nullable().optional(),
    name: z.string().min(1),
    dialect: DatabaseDialectSchema.default('postgresql'),
  })
  .meta({ id: 'DiagramCreateDto' });

const WorkspaceDiagramCreateSchema = z
  .object({
    name: z.string().min(1),
    dialect: DatabaseDialectSchema.default('postgresql'),
  })
  .meta({ id: 'WorkspaceDiagramCreateDto' });

const DiagramUpdateSchema = z
  .object({
    // Diagram settings is a partial update because users may rename the diagram without changing its SQL dialect.
    name: z.string().trim().min(1).max(80).optional(),
    dialect: DatabaseDialectSchema.optional(),
  })
  .meta({ id: 'DiagramUpdateDto' });

const DiagramResponseSchema = z
  .object({
    id: z.uuid(),
    organizationId: z.uuid(),
    projectId: z.uuid().nullable(),
    name: z.string(),
    dialect: DatabaseDialectSchema,
    status: DiagramStatusSchema,
    role: DiagramMemberRoleSchema,
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'DiagramResponseDto' });

const DiagramListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: 'DiagramListQueryDto' });

const DiagramListResponseSchema = z
  .object({
    items: z.array(DiagramResponseSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'DiagramListResponseDto' });

const DiagramMemberSchema = z
  .object({
    userId: z.uuid(),
    email: z.email(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
    cursorColor: z.string(),
    role: DiagramMemberRoleSchema,
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'DiagramMemberDto' });

const DiagramMemberListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: 'DiagramMemberListQueryDto' });

const DiagramMemberListResponseSchema = z
  .object({
    items: z.array(DiagramMemberSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'DiagramMemberListResponseDto' });

const DiagramEffectiveAccessSourceSchema = z
  .object({
    inherited: z.boolean(),
    role: DiagramMemberRoleSchema,
    sourceId: z.uuid().nullable(),
    sourceLabel: z.string(),
    sourceName: z.string().nullable(),
    sourceType: DiagramEffectiveAccessSourceTypeSchema,
  })
  .meta({ id: 'DiagramEffectiveAccessSourceDto' });

const DiagramEffectiveAccessSchema = z
  .object({
    accessType: DiagramEffectiveAccessTypeSchema,
    avatarUrl: z.string().nullable(),
    cursorColor: z.string(),
    directRole: DiagramMemberRoleSchema.nullable(),
    email: z.email(),
    name: z.string(),
    role: DiagramMemberRoleSchema,
    sources: z.array(DiagramEffectiveAccessSourceSchema),
    userId: z.uuid(),
  })
  .meta({ id: 'DiagramEffectiveAccessDto' });

const DiagramEffectiveAccessListResponseSchema = z
  .object({
    items: z.array(DiagramEffectiveAccessSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'DiagramEffectiveAccessListResponseDto' });

const DiagramMemberCreateSchema = z
  .object({
    email: z.email(),
    role: DiagramAssignableMemberRoleSchema.default(ProjectRole.Viewer),
  })
  .meta({ id: 'DiagramMemberCreateDto' });

const DiagramMemberUpdateSchema = z
  .object({
    role: DiagramAssignableMemberRoleSchema,
  })
  .meta({ id: 'DiagramMemberUpdateDto' });

const DiagramOwnershipTransferSchema = z
  .object({
    userId: z.uuid(),
  })
  .meta({ id: 'DiagramOwnershipTransferDto' });

const DiagramMemberRemoveResponseSchema = z
  .object({
    successful: z.boolean(),
  })
  .meta({ id: 'DiagramMemberRemoveResponseDto' });

const DiagramTransferWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  statement: z.string().optional(),
  target: z
    .object({
      id: z.string(),
      type: z.string(),
    })
    .optional(),
});

const DiagramExportFormatSchema = z.enum(['tabliodb_json', 'sql', 'markdown', 'mermaid', 'svg']);
const DiagramImportSourceSchema = z.enum(['tabliodb_json', 'sql']);

const DiagramExportQuerySchema = z
  .object({
    dialect: DatabaseDialectSchema.optional(),
    format: DiagramExportFormatSchema.default('tabliodb_json'),
    includeComments: z.coerce.boolean().optional(),
  })
  .meta({ id: 'DiagramExportQueryDto' });

const DiagramExportResponseSchema = z
  .object({
    content: z.string(),
    filename: z.string(),
    format: DiagramExportFormatSchema,
    mediaType: z.string(),
    warnings: z.array(DiagramTransferWarningSchema),
  })
  .meta({ id: 'DiagramExportResponseDto' });

const DiagramImportSchema = z
  .object({
    content: z.string().min(1),
    dialect: DatabaseDialectSchema.optional(),
    mode: z.enum(['replace']).default('replace'),
    source: DiagramImportSourceSchema,
  })
  .meta({ id: 'DiagramImportDto' });

const DiagramImportResponseSchema = z
  .object({
    diagram: DiagramResponseSchema,
    model: DiagramModelSchema,
    warnings: z.array(DiagramTransferWarningSchema),
  })
  .meta({ id: 'DiagramImportResponseDto' });

export class DiagramCreateDto extends createZodDto(DiagramCreateSchema) {}
export class DiagramEffectiveAccessDto extends createZodDto(DiagramEffectiveAccessSchema) {}
export class DiagramEffectiveAccessListResponseDto extends createZodDto(DiagramEffectiveAccessListResponseSchema) {}
export class DiagramEffectiveAccessSourceDto extends createZodDto(DiagramEffectiveAccessSourceSchema) {}
export class DiagramExportQueryDto extends createZodDto(DiagramExportQuerySchema) {}
export class DiagramExportResponseDto extends createZodDto(DiagramExportResponseSchema) {}
export class DiagramImportDto extends createZodDto(DiagramImportSchema) {}
export class DiagramImportResponseDto extends createZodDto(DiagramImportResponseSchema) {}
export class DiagramListQueryDto extends createZodDto(DiagramListQuerySchema) {}
export class DiagramListResponseDto extends createZodDto(DiagramListResponseSchema) {}
export class DiagramMemberCreateDto extends createZodDto(DiagramMemberCreateSchema) {}
export class DiagramMemberDto extends createZodDto(DiagramMemberSchema) {}
export class DiagramMemberListQueryDto extends createZodDto(DiagramMemberListQuerySchema) {}
export class DiagramMemberListResponseDto extends createZodDto(DiagramMemberListResponseSchema) {}
export class DiagramMemberRemoveResponseDto extends createZodDto(DiagramMemberRemoveResponseSchema) {}
export class DiagramMemberUpdateDto extends createZodDto(DiagramMemberUpdateSchema) {}
export class DiagramOwnershipTransferDto extends createZodDto(DiagramOwnershipTransferSchema) {}
export class DiagramResponseDto extends createZodDto(DiagramResponseSchema) {}
export class DiagramUpdateDto extends createZodDto(DiagramUpdateSchema) {}
export class WorkspaceDiagramCreateDto extends createZodDto(WorkspaceDiagramCreateSchema) {}
