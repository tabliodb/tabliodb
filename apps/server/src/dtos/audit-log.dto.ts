import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DateTimeSchema = z.iso.datetime({ offset: true });
const AuditMetadataSchema = z.record(z.string(), z.unknown());

const AuditLogSchema = z
  .object({
    id: z.string().uuid(),
    organizationId: z.string().uuid().nullable(),
    projectId: z.string().uuid().nullable(),
    diagramId: z.string().uuid().nullable(),
    actorId: z.string().uuid().nullable(),
    actorName: z.string().nullable(),
    actorEmail: z.string().email().nullable(),
    action: z.string(),
    entityType: z.string(),
    entityId: z.string(),
    metadata: AuditMetadataSchema,
    ipAddress: z.string().nullable(),
    userAgent: z.string().nullable(),
    requestId: z.string().nullable(),
    createdAt: DateTimeSchema,
  })
  .meta({ id: 'AuditLogDto' });

const AuditLogListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: 'AuditLogListQueryDto' });

const AuditLogListResponseSchema = z
  .object({
    items: z.array(AuditLogSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'AuditLogListResponseDto' });

export class AuditLogDto extends createZodDto(AuditLogSchema) {}
export class AuditLogListQueryDto extends createZodDto(AuditLogListQuerySchema) {}
export class AuditLogListResponseDto extends createZodDto(AuditLogListResponseSchema) {}
