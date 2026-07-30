import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DateTimeSchema = z.iso.datetime({ offset: true });
const CommentTargetTypeSchema = z.enum([
  'diagram',
  'table',
  'column',
  'relationship',
  'index',
  'enum',
  'check',
  'note',
  'group',
]);

const CommentAuthorSchema = z.object({
  avatarUrl: z.string().url().nullable(),
  cursorColor: z.string(),
  email: z.string().email(),
  id: z.string().uuid(),
  name: z.string(),
});

const CommentResponseSchema = z
  .object({
    author: CommentAuthorSchema,
    body: z.string(),
    bodyFormat: z.literal('markdown'),
    createdAt: DateTimeSchema,
    createdById: z.string().uuid(),
    editedAt: DateTimeSchema.nullable(),
    id: z.string().uuid(),
    threadId: z.string().uuid(),
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'CommentResponseDto' });

const CommentThreadCreateSchema = z
  .object({
    body: z.string().trim().min(1).max(4000),
    diagramId: z.string().uuid(),
    targetId: z.string().nullable(),
    targetType: CommentTargetTypeSchema,
  })
  .meta({ id: 'CommentThreadCreateDto' });

const CommentReplyCreateSchema = z
  .object({
    body: z.string().trim().min(1).max(4000),
  })
  .meta({ id: 'CommentReplyCreateDto' });

const CommentThreadResponseSchema = z
  .object({
    thread: z.object({
      createdAt: DateTimeSchema,
      createdById: z.string().uuid(),
      diagramId: z.string().uuid(),
      id: z.string().uuid(),
      resolvedAt: DateTimeSchema.nullable(),
      resolvedById: z.string().uuid().nullable(),
      status: z.enum(['open', 'resolved']),
      targetId: z.string().nullable(),
      targetType: CommentTargetTypeSchema,
      updatedAt: DateTimeSchema,
    }),
    comment: CommentResponseSchema,
  })
  .meta({ id: 'CommentThreadResponseDto' });

const CommentThreadStatusResponseSchema = z
  .object({
    createdAt: DateTimeSchema,
    createdById: z.string().uuid(),
    diagramId: z.string().uuid(),
    id: z.string().uuid(),
    resolvedAt: DateTimeSchema.nullable(),
    resolvedById: z.string().uuid().nullable(),
    status: z.enum(['open', 'resolved']),
    targetId: z.string().nullable(),
    targetType: CommentTargetTypeSchema,
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'CommentThreadStatusResponseDto' });

const CommentThreadListItemSchema = z
  .object({
    createdAt: DateTimeSchema,
    createdById: z.string().uuid(),
    diagramId: z.string().uuid(),
    id: z.string().uuid(),
    resolvedAt: DateTimeSchema.nullable(),
    resolvedById: z.string().uuid().nullable(),
    status: z.enum(['open', 'resolved']),
    targetId: z.string().nullable(),
    targetType: CommentTargetTypeSchema,
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'CommentThreadListItemDto' });

const CommentThreadListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: 'CommentThreadListQueryDto' });

const CommentThreadListResponseSchema = z
  .object({
    items: z.array(CommentThreadListItemSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'CommentThreadListResponseDto' });

const CommentListResponseSchema = z
  .object({
    items: z.array(CommentResponseSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'CommentListResponseDto' });

export class CommentListResponseDto extends createZodDto(CommentListResponseSchema) {}
export class CommentReplyCreateDto extends createZodDto(CommentReplyCreateSchema) {}
export class CommentResponseDto extends createZodDto(CommentResponseSchema) {}
export class CommentThreadCreateDto extends createZodDto(CommentThreadCreateSchema) {}
export class CommentThreadListQueryDto extends createZodDto(CommentThreadListQuerySchema) {}
export class CommentThreadListResponseDto extends createZodDto(CommentThreadListResponseSchema) {}
export class CommentThreadResponseDto extends createZodDto(CommentThreadResponseSchema) {}
export class CommentThreadStatusResponseDto extends createZodDto(CommentThreadStatusResponseSchema) {}
