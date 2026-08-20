import { DatabaseDialectSchema } from '@tabliodb/schema-core';
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

const NotificationUserSchema = z.object({
  avatarUrl: z.string().nullable(),
  cursorColor: z.string(),
  email: z.email(),
  id: z.uuid(),
  name: z.string(),
});

const NotificationProjectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  organizationId: z.uuid(),
  organizationName: z.string(),
  organizationSlug: z.string(),
  slug: z.string(),
});

const NotificationDiagramSchema = z.object({
  dialect: DatabaseDialectSchema,
  id: z.uuid(),
  name: z.string(),
});

const NotificationThreadSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['open', 'resolved']),
  targetId: z.string().nullable(),
  targetType: CommentTargetTypeSchema,
  updatedAt: DateTimeSchema,
});

const NotificationCommentSchema = z.object({
  author: NotificationUserSchema,
  body: z.string(),
  bodyFormat: z.literal('lexical'),
  bodyJson: CommentLexicalDocumentSchema,
  bodyText: z.string(),
  createdAt: DateTimeSchema,
  createdById: z.string().uuid(),
  deletedAt: DateTimeSchema.nullable(),
  editedAt: DateTimeSchema.nullable(),
  id: z.string().uuid(),
  mentionedUserIds: z.array(z.string().uuid()),
  parentCommentId: z.string().uuid().nullable(),
  replyCount: z.number().int().nonnegative(),
  threadId: z.string().uuid(),
  updatedAt: DateTimeSchema,
});

const NotificationParentCommentSchema = z
  .object({
    author: NotificationUserSchema,
    bodyText: z.string(),
    id: z.string().uuid(),
  })
  .nullable();

const NotificationInboxItemSchema = z
  .object({
    comment: NotificationCommentSchema,
    createdAt: DateTimeSchema,
    diagram: NotificationDiagramSchema,
    id: z.string(),
    isUnread: z.boolean(),
    parentComment: NotificationParentCommentSchema,
    project: NotificationProjectSchema,
    thread: NotificationThreadSchema,
    type: z.enum(['mention', 'reply']),
  })
  .meta({ id: 'NotificationInboxItemDto' });

const NotificationInboxListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: 'NotificationInboxListQueryDto' });

const NotificationInboxListResponseSchema = z
  .object({
    items: z.array(NotificationInboxItemSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'NotificationInboxListResponseDto' });

const NotificationSummarySchema = z
  .object({
    totalCount: z.number().int().nonnegative(),
    unreadCount: z.number().int().nonnegative(),
    updatedAt: DateTimeSchema.nullable(),
  })
  .meta({ id: 'NotificationSummaryDto' });

export class NotificationInboxItemDto extends createZodDto(NotificationInboxItemSchema) {}
export class NotificationInboxListQueryDto extends createZodDto(NotificationInboxListQuerySchema) {}
export class NotificationInboxListResponseDto extends createZodDto(NotificationInboxListResponseSchema) {}
export class NotificationSummaryDto extends createZodDto(NotificationSummarySchema) {}
