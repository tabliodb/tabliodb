import { DatabaseDialectSchema, DiagramModelSchema } from '@tabliodb/schema-core';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DateTimeSchema = z.iso.datetime({ offset: true });

const SnapshotCreateSchema = z
  .object({
    diagramId: z.uuid(),
    message: z.string().optional(),
    snapshot: DiagramModelSchema,
  })
  .meta({ id: 'SnapshotCreateDto' });

const SnapshotResponseSchema = z
  .object({
    id: z.uuid(),
    diagramId: z.uuid(),
    version: z.number(),
    message: z.string().nullable(),
    snapshot: DiagramModelSchema,
    restoredFromSnapshotId: z.uuid().nullable(),
    createdAt: DateTimeSchema,
  })
  .meta({ id: 'SnapshotResponseDto' });

const SnapshotReferenceSchema = z
  .object({
    id: z.string().uuid(),
    diagramId: z.string().uuid(),
    version: z.number(),
    message: z.string().nullable(),
    restoredFromSnapshotId: z.string().uuid().nullable(),
    createdAt: DateTimeSchema,
  })
  .meta({ id: 'SnapshotReferenceDto' });

const SnapshotEntityChangeSummarySchema = z
  .object({
    added: z.number().int().nonnegative(),
    removed: z.number().int().nonnegative(),
    changed: z.number().int().nonnegative(),
  })
  .meta({ id: 'SnapshotEntityChangeSummaryDto' });

const SnapshotTableRenameSchema = z
  .object({
    id: z.string(),
    fromName: z.string(),
    toName: z.string(),
  })
  .meta({ id: 'SnapshotTableRenameDto' });

const SnapshotTableChangeSummarySchema = SnapshotEntityChangeSummarySchema.extend({
  renamed: z.array(SnapshotTableRenameSchema),
}).meta({ id: 'SnapshotTableChangeSummaryDto' });

const SnapshotMigrationSqlWarningSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statement: z.string().optional(),
    target: z
      .object({
        id: z.string(),
        type: z.enum(['check', 'column', 'enum', 'index', 'relationship', 'table']),
      })
      .optional(),
  })
  .meta({ id: 'SnapshotMigrationSqlWarningDto' });

const SnapshotMigrationSqlSchema = z
  .object({
    dialect: DatabaseDialectSchema,
    sql: z.string(),
    warnings: z.array(SnapshotMigrationSqlWarningSchema),
  })
  .meta({ id: 'SnapshotMigrationSqlDto' });

const SnapshotDiffResponseSchema = z
  .object({
    fromSnapshot: SnapshotReferenceSchema,
    toSnapshot: SnapshotReferenceSchema,
    migrationSql: SnapshotMigrationSqlSchema,
    tables: SnapshotTableChangeSummarySchema,
    columns: SnapshotEntityChangeSummarySchema,
    relationships: SnapshotEntityChangeSummarySchema,
    indexes: SnapshotEntityChangeSummarySchema,
    enums: SnapshotEntityChangeSummarySchema,
    checks: SnapshotEntityChangeSummarySchema,
    notes: SnapshotEntityChangeSummarySchema,
    groups: SnapshotEntityChangeSummarySchema,
    dialectChanged: z.boolean(),
    metadataChanged: z.boolean(),
    schemaVersionChanged: z.boolean(),
  })
  .meta({ id: 'SnapshotDiffResponseDto' });

const SnapshotListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: 'SnapshotListQueryDto' });

const SnapshotListResponseSchema = z
  .object({
    items: z.array(SnapshotResponseSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'SnapshotListResponseDto' });

export class SnapshotCreateDto extends createZodDto(SnapshotCreateSchema) {}
export class SnapshotDiffResponseDto extends createZodDto(SnapshotDiffResponseSchema) {}
export class SnapshotListQueryDto extends createZodDto(SnapshotListQuerySchema) {}
export class SnapshotListResponseDto extends createZodDto(SnapshotListResponseSchema) {}
export class SnapshotResponseDto extends createZodDto(SnapshotResponseSchema) {}
