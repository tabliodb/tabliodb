import { DatabaseDialectSchema, DiagramModelSchema } from '@tabliodb/schema-core';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DateTimeSchema = z.iso.datetime({ offset: true });
const ShareLinkStatusSchema = z.enum(['active', 'expired', 'revoked']);
const ShareLinkTargetTypeSchema = z.enum(['diagram', 'snapshot']);

const DiagramShareLinkSchema = z
  .object({
    id: z.uuid(),
    diagramId: z.uuid(),
    snapshotId: z.uuid().nullable(),
    targetType: ShareLinkTargetTypeSchema,
    label: z.string().nullable(),
    status: ShareLinkStatusSchema,
    expiresAt: DateTimeSchema.nullable(),
    revokedAt: DateTimeSchema.nullable(),
    createdById: z.uuid(),
    createdByName: z.string(),
    accessCount: z.number().int().nonnegative(),
    lastUsedAt: DateTimeSchema.nullable(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'DiagramShareLinkDto' });

const DiagramShareLinkListResponseSchema = z
  .object({
    items: z.array(DiagramShareLinkSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'DiagramShareLinkListResponseDto' });

const DiagramShareLinkCreateSchema = z
  .object({
    expiresAt: DateTimeSchema.nullable().optional(),
    label: z.string().trim().min(1).max(80).optional(),
    snapshotId: z.string().uuid().optional(),
    targetType: ShareLinkTargetTypeSchema.default('diagram'),
  })
  .meta({ id: 'DiagramShareLinkCreateDto' });

const DiagramShareLinkCreateResponseSchema = z
  .object({
    shareLink: DiagramShareLinkSchema,
    token: z.string(),
    url: z.string().url(),
  })
  .meta({ id: 'DiagramShareLinkCreateResponseDto' });

const DiagramShareLinkRevokeResponseSchema = z
  .object({
    successful: z.boolean(),
  })
  .meta({ id: 'DiagramShareLinkRevokeResponseDto' });

const DiagramShareLinkListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: 'DiagramShareLinkListQueryDto' });

const PublicDiagramShareSnapshotSchema = z
  .object({
    id: z.string().uuid(),
    version: z.number().int().positive(),
    message: z.string().nullable(),
    createdAt: DateTimeSchema,
  })
  .meta({ id: 'PublicDiagramShareSnapshotDto' });

const PublicDiagramShareResponseSchema = z
  .object({
    diagram: z.object({
      id: z.string().uuid(),
      dialect: DatabaseDialectSchema,
      name: z.string(),
      organizationName: z.string(),
      projectName: z.string(),
    }),
    model: DiagramModelSchema,
    share: z.object({
      expiresAt: DateTimeSchema.nullable(),
      targetType: ShareLinkTargetTypeSchema,
    }),
    snapshot: PublicDiagramShareSnapshotSchema.nullable(),
  })
  .meta({ id: 'PublicDiagramShareResponseDto' });

export class DiagramShareLinkCreateDto extends createZodDto(DiagramShareLinkCreateSchema) {}
export class DiagramShareLinkCreateResponseDto extends createZodDto(DiagramShareLinkCreateResponseSchema) {}
export class DiagramShareLinkDto extends createZodDto(DiagramShareLinkSchema) {}
export class DiagramShareLinkListQueryDto extends createZodDto(DiagramShareLinkListQuerySchema) {}
export class DiagramShareLinkListResponseDto extends createZodDto(DiagramShareLinkListResponseSchema) {}
export class DiagramShareLinkRevokeResponseDto extends createZodDto(DiagramShareLinkRevokeResponseSchema) {}
export class PublicDiagramShareResponseDto extends createZodDto(PublicDiagramShareResponseSchema) {}
