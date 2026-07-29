import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CommentThreadCreateSchema = z
  .object({
    diagramId: z.string().uuid(),
    targetType: z.enum(['table', 'column', 'relationship', 'enum', 'note', 'diagram']),
    targetId: z.string(),
    body: z.string().min(1),
  })
  .meta({ id: 'CommentThreadCreateDto' });

const CommentThreadResponseSchema = z
  .object({
    thread: z.object({
      id: z.string().uuid(),
      diagramId: z.string().uuid(),
      targetType: z.string(),
      targetId: z.string(),
      resolvedAt: z.date().nullable(),
      createdAt: z.date(),
      updatedAt: z.date(),
    }),
    comment: z.object({
      id: z.string().uuid(),
      threadId: z.string().uuid(),
      body: z.string(),
      createdAt: z.date(),
      updatedAt: z.date(),
    }),
  })
  .meta({ id: 'CommentThreadResponseDto' });

const CommentThreadListItemSchema = z
  .object({
    id: z.string().uuid(),
    diagramId: z.string().uuid(),
    targetType: z.string(),
    targetId: z.string().nullable(),
    status: z.string(),
    resolvedAt: z.date().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
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

export class CommentThreadCreateDto extends createZodDto(CommentThreadCreateSchema) {}
export class CommentThreadListQueryDto extends createZodDto(CommentThreadListQuerySchema) {}
export class CommentThreadListResponseDto extends createZodDto(CommentThreadListResponseSchema) {}
export class CommentThreadResponseDto extends createZodDto(CommentThreadResponseSchema) {}
