import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CommentLexicalDocumentSchema } from '../utils/comment-body.js';

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
  avatarUrl: z.string().nullable(),
  cursorColor: z.string(),
  email: z.string().email(),
  id: z.string().uuid(),
  name: z.string(),
});

const CommentThreadSchema = z.object({
  createdAt: DateTimeSchema,
  createdById: z.string().uuid(),
  diagramId: z.string().uuid(),
  id: z.string().uuid(),
  resolvedAt: DateTimeSchema.nullable(),
  resolvedById: z.string().uuid().nullable(),
  status: z.enum(['open', 'resolved']),
  targetId: z.string().nullable(),
  targetType: CommentTargetTypeSchema,
  unreadCount: z.number().int().nonnegative(),
  updatedAt: DateTimeSchema,
});

const CommentResponseSchema = z
  .object({
    author: CommentAuthorSchema,
    body: z.string(),
    bodyFormat: z.literal('lexical'),
    bodyJson: CommentLexicalDocumentSchema,
    bodyText: z.string(),
    createdAt: DateTimeSchema,
    createdById: z.string().uuid(),
    editedAt: DateTimeSchema.nullable(),
    id: z.string().uuid(),
    mentionedUserIds: z.array(z.string().uuid()),
    parentCommentId: z.string().uuid().nullable(),
    replyCount: z.number().int().nonnegative(),
    threadId: z.string().uuid(),
    updatedAt: DateTimeSchema,
  })
  .meta({ id: 'CommentResponseDto' });

const CommentThreadCreateSchema = z
  .object({
    bodyJson: CommentLexicalDocumentSchema,
    diagramId: z.string().uuid(),
    targetId: z.string().nullable(),
    targetType: CommentTargetTypeSchema,
  })
  .meta({ id: 'CommentThreadCreateDto' });

const CommentReplyCreateSchema = z
  .object({
    bodyJson: CommentLexicalDocumentSchema,
    parentCommentId: z.string().uuid().nullable().optional(),
  })
  .meta({ id: 'CommentReplyCreateDto' });

const CommentThreadResponseSchema = z
  .object({
    thread: CommentThreadSchema,
    comment: CommentResponseSchema,
  })
  .meta({ id: 'CommentThreadResponseDto' });

const CommentThreadStatusResponseSchema = CommentThreadSchema.meta({ id: 'CommentThreadStatusResponseDto' });

const CommentThreadListItemSchema = CommentThreadSchema.meta({ id: 'CommentThreadListItemDto' });

const CommentThreadReaderSchema = z.object({
  lastReadAt: DateTimeSchema,
  lastReadCommentId: z.string().uuid().nullable(),
  user: CommentAuthorSchema,
});

const CommentThreadReadStateSchema = z
  .object({
    lastReadAt: DateTimeSchema.nullable(),
    lastReadCommentId: z.string().uuid().nullable(),
    readers: z.array(CommentThreadReaderSchema),
    threadId: z.string().uuid(),
    totalReaderCount: z.number().int().nonnegative(),
    unreadCount: z.number().int().nonnegative(),
    updatedAt: DateTimeSchema.nullable(),
  })
  .meta({ id: 'CommentThreadReadStateDto' });

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
export class CommentThreadReadStateDto extends createZodDto(CommentThreadReadStateSchema) {}
export class CommentThreadListQueryDto extends createZodDto(CommentThreadListQuerySchema) {}
export class CommentThreadListResponseDto extends createZodDto(CommentThreadListResponseSchema) {}
export class CommentThreadResponseDto extends createZodDto(CommentThreadResponseSchema) {}
export class CommentThreadStatusResponseDto extends createZodDto(CommentThreadStatusResponseSchema) {}
