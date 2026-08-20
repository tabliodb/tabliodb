import { diagramReviewSignalCodes } from '@tabliodb/schema-core';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DateTimeSchema = z.iso.datetime({ offset: true });

const IncludeIgnoredQuerySchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    return value === 'true';
  }

  return value;
}, z.boolean().optional());

const ReviewSignalListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    includeIgnored: IncludeIgnoredQuerySchema,
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: 'ReviewSignalListQueryDto' });

const ReviewSignalResponseSchema = z
  .object({
    code: z.string(),
    diagramId: z.uuid(),
    generatedAt: DateTimeSchema,
    id: z.uuid(),
    ignoredAt: DateTimeSchema.nullable(),
    ignoredById: z.uuid().nullable(),
    message: z.string(),
    ruleKey: z.string(),
    severity: z.enum(['info', 'warning', 'error', 'success']),
    targetId: z.string().nullable(),
    targetType: z.string(),
    title: z.string(),
  })
  .meta({ id: 'ReviewSignalResponseDto' });

const ReviewSignalListResponseSchema = z
  .object({
    items: z.array(ReviewSignalResponseSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'ReviewSignalListResponseDto' });

const ReviewSignalRuleKeySchema = z.enum(diagramReviewSignalCodes);

const ReviewSignalSettingsSchema = z
  .object({
    disabledRuleKeys: z.array(ReviewSignalRuleKeySchema).default([]),
  })
  .meta({ id: 'ReviewSignalSettingsDto' });

const ReviewSignalEffectiveSettingsSchema = z
  .object({
    diagram: ReviewSignalSettingsSchema,
    effective: ReviewSignalSettingsSchema,
    project: ReviewSignalSettingsSchema,
  })
  .meta({ id: 'ReviewSignalEffectiveSettingsDto' });

export class ReviewSignalEffectiveSettingsDto extends createZodDto(ReviewSignalEffectiveSettingsSchema) {}
export class ReviewSignalListQueryDto extends createZodDto(ReviewSignalListQuerySchema) {}
export class ReviewSignalListResponseDto extends createZodDto(ReviewSignalListResponseSchema) {}
export class ReviewSignalResponseDto extends createZodDto(ReviewSignalResponseSchema) {}
export class ReviewSignalSettingsDto extends createZodDto(ReviewSignalSettingsSchema) {}
