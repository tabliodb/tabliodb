import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DateTimeSchema = z.iso.datetime({ offset: true });
const DiagramReviewStatusSchema = z.enum(['draft', 'reviewed', 'approved', 'changes_requested']);
const DiagramReviewActionSchema = z.enum(['commented', 'approved', 'changes_requested']);

const DiagramReviewActorSchema = z.object({
  avatarUrl: z.string().nullable(),
  cursorColor: z.string(),
  email: z.email(),
  id: z.uuid(),
  name: z.string(),
});

const DiagramReviewEventSchema = z
  .object({
    action: DiagramReviewActionSchema,
    createdAt: DateTimeSchema,
    createdById: z.uuid(),
    diagramId: z.uuid(),
    id: z.uuid(),
    message: z.string().nullable(),
    nextStatus: DiagramReviewStatusSchema,
    previousStatus: DiagramReviewStatusSchema,
    reviewer: DiagramReviewActorSchema,
    snapshotId: z.uuid().nullable(),
  })
  .meta({ id: 'DiagramReviewEventDto' });

const DiagramReviewActionCreateSchema = z
  .object({
    action: DiagramReviewActionSchema,
    message: z.string().trim().max(2000).nullable().optional(),
  })
  .meta({ id: 'DiagramReviewActionCreateDto' });

const DiagramReviewSummarySchema = z
  .object({
    approvedCount: z.number().int().nonnegative(),
    changesRequestedCount: z.number().int().nonnegative(),
    commentedCount: z.number().int().nonnegative(),
    currentStatus: DiagramReviewStatusSchema,
    diagramId: z.uuid(),
    eventCount: z.number().int().nonnegative(),
    latestEvent: DiagramReviewEventSchema.nullable(),
    recentEvents: z.array(DiagramReviewEventSchema),
  })
  .meta({ id: 'DiagramReviewSummaryDto' });

const DiagramReviewEventListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: 'DiagramReviewEventListQueryDto' });

const DiagramReviewEventListResponseSchema = z
  .object({
    items: z.array(DiagramReviewEventSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'DiagramReviewEventListResponseDto' });

export class DiagramReviewActionCreateDto extends createZodDto(DiagramReviewActionCreateSchema) {}
export class DiagramReviewEventDto extends createZodDto(DiagramReviewEventSchema) {}
export class DiagramReviewEventListQueryDto extends createZodDto(DiagramReviewEventListQuerySchema) {}
export class DiagramReviewEventListResponseDto extends createZodDto(DiagramReviewEventListResponseSchema) {}
export class DiagramReviewSummaryDto extends createZodDto(DiagramReviewSummarySchema) {}
