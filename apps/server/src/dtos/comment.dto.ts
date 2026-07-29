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

export class CommentThreadCreateDto extends createZodDto(CommentThreadCreateSchema) {}
export class CommentThreadResponseDto extends createZodDto(CommentThreadResponseSchema) {}
