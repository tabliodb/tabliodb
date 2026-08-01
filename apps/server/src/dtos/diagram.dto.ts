import { DatabaseDialectSchema, DiagramModelSchema } from '@tabliodb/schema-core';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DateTimeSchema = z.iso.datetime({ offset: true });
const DiagramStatusSchema = z.enum(['draft', 'reviewed', 'approved', 'changes_requested']);

const DiagramCreateSchema = z
  .object({
    projectId: z.string().uuid(),
    name: z.string().min(1),
    dialect: DatabaseDialectSchema.default('postgresql'),
  })
  .meta({ id: 'DiagramCreateDto' });

const DiagramUpdateSchema = z
  .object({
    // Diagram settings is a partial update because users may rename the diagram without changing its SQL dialect.
    name: z.string().trim().min(1).max(80).optional(),
    dialect: DatabaseDialectSchema.optional(),
  })
  .meta({ id: 'DiagramUpdateDto' });

const DiagramResponseSchema = z
  .object({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
    name: z.string(),
    dialect: DatabaseDialectSchema,
    status: DiagramStatusSchema,
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

const DiagramExportFormatSchema = z.enum(['tabliodb_json', 'sql', 'markdown', 'svg']);
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
export class DiagramExportQueryDto extends createZodDto(DiagramExportQuerySchema) {}
export class DiagramExportResponseDto extends createZodDto(DiagramExportResponseSchema) {}
export class DiagramImportDto extends createZodDto(DiagramImportSchema) {}
export class DiagramImportResponseDto extends createZodDto(DiagramImportResponseSchema) {}
export class DiagramListQueryDto extends createZodDto(DiagramListQuerySchema) {}
export class DiagramListResponseDto extends createZodDto(DiagramListResponseSchema) {}
export class DiagramResponseDto extends createZodDto(DiagramResponseSchema) {}
export class DiagramUpdateDto extends createZodDto(DiagramUpdateSchema) {}
