import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Permission } from '@tabliodb/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditAction } from '../constants.js';
import type { AuthContext } from '../database.js';
import { createPlainTextCommentLexicalDocument } from '../utils/comment-body.js';
import { CommentService } from './comment.service.js';

const auth: AuthContext = {
  user: {
    avatarUrl: null,
    cursorColor: '#58cc02',
    email: 'commenter@tabliodb.local',
    id: 'user-id',
    name: 'Commenter User',
    passwordChangeRequired: false,
  },
};

const thread = {
  createdAt: new Date('2026-07-30T08:00:00.000Z'),
  createdById: 'user-id',
  diagramId: 'diagram-id',
  id: 'thread-id',
  resolvedAt: null,
  resolvedById: null,
  status: 'open' as const,
  targetId: 'table-id',
  targetType: 'table',
  updatedAt: new Date('2026-07-30T08:00:00.000Z'),
};

const scopedThread = {
  ...thread,
  organizationId: 'organization-id',
  projectId: 'project-id',
};

const comment = {
  bodyFormat: 'lexical' as const,
  bodyJson: createPlainTextCommentLexicalDocument('Please review this table.'),
  bodyText: 'Please review this table.',
  createdAt: new Date('2026-07-30T08:01:00.000Z'),
  createdById: 'user-id',
  deletedAt: null,
  editedAt: null,
  id: 'comment-id',
  parentCommentId: null,
  replyCount: 0,
  threadId: 'thread-id',
  updatedAt: new Date('2026-07-30T08:01:00.000Z'),
};

describe(CommentService.name, () => {
  const auditLogRepository = {
    create: vi.fn(),
  };
  const backgroundJobService = {
    enqueueCommentNotificationDelivery: vi.fn(),
  };
  const commentRepository = {
    createCommentReply: vi.fn(),
    createThreadWithComment: vi.fn(),
    deleteComment: vi.fn(),
    getCommentInThread: vi.fn(),
    getCommentForResponse: vi.fn(),
    getCommentThreadScope: vi.fn(),
    getCommentWithThread: vi.fn(),
    getComments: vi.fn(),
    getDiagramSummary: vi.fn(),
    getMentionableUsersForDiagram: vi.fn(),
    getThreadReadState: vi.fn(),
    getThreadById: vi.fn(),
    getThreadWithScope: vi.fn(),
    getThreads: vi.fn(),
    markThreadRead: vi.fn(),
    resolveThread: vi.fn(),
    unresolveThread: vi.fn(),
    updateComment: vi.fn(),
  };
  const diagramService = {
    requireDiagram: vi.fn(),
  };
  const diagramReviewService = {
    recordCommented: vi.fn(),
  };

  let service: CommentService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new CommentService(
      auditLogRepository as never,
      backgroundJobService as never,
      commentRepository as never,
      diagramService as never,
      diagramReviewService as never,
    );
  });

  function commentBody(bodyText: string) {
    return createPlainTextCommentLexicalDocument(bodyText) as never;
  }

  it('rejects replies when the user cannot comment on the thread diagram', async () => {
    commentRepository.getThreadById.mockResolvedValue(thread);
    diagramService.requireDiagram.mockRejectedValue(new ForbiddenException());

    await expect(
      service.replyToThread(auth, 'thread-id', { bodyJson: commentBody('Readonly reply') }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Route berbasis thread harus resolve diagramId dulu, lalu permission comment dicek sebelum insert reply.
    expect(diagramService.requireDiagram).toHaveBeenCalledWith(auth, 'diagram-id', Permission.DiagramComment);
    expect(commentRepository.createCommentReply).not.toHaveBeenCalled();
  });

  it('creates a reply and serializes the current user as the author', async () => {
    commentRepository.getThreadById.mockResolvedValue(thread);
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });
    commentRepository.createCommentReply.mockResolvedValue({ comment, thread });

    await expect(
      service.replyToThread(auth, 'thread-id', { bodyJson: commentBody('Looks good.') }),
    ).resolves.toMatchObject({
      comment: {
        author: {
          email: 'commenter@tabliodb.local',
          id: 'user-id',
          name: 'Commenter User',
        },
        body: 'Please review this table.',
        bodyFormat: 'lexical',
        bodyText: 'Please review this table.',
        createdAt: '2026-07-30T08:01:00.000Z',
      },
      thread: {
        id: 'thread-id',
        status: 'open',
        targetType: 'table',
      },
    });

    expect(commentRepository.createCommentReply).toHaveBeenCalledWith({
      bodyJson: createPlainTextCommentLexicalDocument('Looks good.'),
      bodyText: 'Looks good.',
      createdById: 'user-id',
      mentionUserIds: [],
      parentCommentId: null,
      threadId: 'thread-id',
    });
  });

  it('rejects empty Lexical comment documents before inserting a reply', async () => {
    commentRepository.getThreadById.mockResolvedValue(thread);
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });

    await expect(service.replyToThread(auth, 'thread-id', { bodyJson: commentBody('') })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(commentRepository.createCommentReply).not.toHaveBeenCalled();
  });

  it('updates an author-owned comment after diagram comment permission passes', async () => {
    commentRepository.getCommentWithThread.mockResolvedValue({
      createdById: 'user-id',
      deletedAt: null,
      diagramId: 'diagram-id',
      id: 'comment-id',
      organizationId: 'organization-id',
      parentCommentId: null,
      projectId: 'project-id',
      threadId: 'thread-id',
    });
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });
    commentRepository.updateComment.mockResolvedValue({
      ...comment,
      bodyJson: createPlainTextCommentLexicalDocument('Updated comment body.'),
      bodyText: 'Updated comment body.',
      editedAt: new Date('2026-07-30T08:08:00.000Z'),
      replyCount: 2,
      updatedAt: new Date('2026-07-30T08:08:00.000Z'),
    });

    await expect(
      service.updateComment(auth, 'comment-id', { bodyJson: commentBody('Updated comment body.') }),
    ).resolves.toMatchObject({
      body: 'Updated comment body.',
      editedAt: '2026-07-30T08:08:00.000Z',
      id: 'comment-id',
      replyCount: 2,
    });

    expect(diagramService.requireDiagram).toHaveBeenCalledWith(auth, 'diagram-id', Permission.DiagramComment);
    expect(commentRepository.updateComment).toHaveBeenCalledWith({
      bodyJson: createPlainTextCommentLexicalDocument('Updated comment body.'),
      bodyText: 'Updated comment body.',
      commentId: 'comment-id',
      editedById: 'user-id',
      mentionUserIds: [],
    });
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CommentEdited,
        actorId: 'user-id',
        diagramId: 'diagram-id',
        entityId: 'comment-id',
        entityType: 'comment',
        metadata: {
          mentionedUserCount: 0,
          parentCommentId: null,
          threadId: 'thread-id',
        },
        organizationId: 'organization-id',
        projectId: 'project-id',
      }),
    );
  });

  it('rejects comment edits from users other than the author', async () => {
    commentRepository.getCommentWithThread.mockResolvedValue({
      createdById: 'other-user-id',
      deletedAt: null,
      diagramId: 'diagram-id',
      id: 'comment-id',
      parentCommentId: null,
      threadId: 'thread-id',
    });
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });

    await expect(
      service.updateComment(auth, 'comment-id', { bodyJson: commentBody('Not mine.') }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(commentRepository.updateComment).not.toHaveBeenCalled();
  });

  it('soft deletes an author-owned comment and records audit metadata', async () => {
    commentRepository.getCommentWithThread.mockResolvedValue({
      createdById: 'user-id',
      deletedAt: null,
      diagramId: 'diagram-id',
      id: 'comment-id',
      organizationId: 'organization-id',
      parentCommentId: 'parent-comment-id',
      projectId: 'project-id',
      threadId: 'thread-id',
    });
    commentRepository.getCommentForResponse.mockResolvedValue({
      ...comment,
      authorAvatarUrl: null,
      authorCursorColor: '#58cc02',
      authorEmail: 'commenter@tabliodb.local',
      authorId: 'user-id',
      authorName: 'Commenter User',
      bodyJson: createPlainTextCommentLexicalDocument('Sensitive deleted detail.'),
      bodyText: 'Sensitive deleted detail.',
      deletedAt: new Date('2026-07-30T08:12:00.000Z'),
      mentionedUserIds: ['teammate-id'],
      parentCommentId: 'parent-comment-id',
      replyCount: 1,
      updatedAt: new Date('2026-07-30T08:12:00.000Z'),
    });
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });

    await expect(service.deleteComment(auth, 'comment-id')).resolves.toMatchObject({
      body: '',
      bodyText: '',
      deletedAt: '2026-07-30T08:12:00.000Z',
      id: 'comment-id',
      mentionedUserIds: [],
      parentCommentId: 'parent-comment-id',
      replyCount: 1,
    });

    expect(diagramService.requireDiagram).toHaveBeenCalledTimes(1);
    expect(diagramService.requireDiagram).toHaveBeenCalledWith(auth, 'diagram-id', Permission.DiagramComment);
    expect(commentRepository.deleteComment).toHaveBeenCalledWith('comment-id');
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CommentDeleted,
        actorId: 'user-id',
        diagramId: 'diagram-id',
        entityId: 'comment-id',
        entityType: 'comment',
        metadata: {
          deletedByAuthor: true,
          parentCommentId: 'parent-comment-id',
          threadId: 'thread-id',
        },
        organizationId: 'organization-id',
        projectId: 'project-id',
      }),
    );
  });

  it('rejects deleting another user comment without diagram update permission', async () => {
    commentRepository.getCommentWithThread.mockResolvedValue({
      createdById: 'other-user-id',
      deletedAt: null,
      diagramId: 'diagram-id',
      id: 'comment-id',
      organizationId: 'organization-id',
      parentCommentId: null,
      projectId: 'project-id',
      threadId: 'thread-id',
    });
    diagramService.requireDiagram
      .mockResolvedValueOnce({ id: 'diagram-id' })
      .mockRejectedValueOnce(new ForbiddenException());

    await expect(service.deleteComment(auth, 'comment-id')).rejects.toBeInstanceOf(ForbiddenException);

    expect(diagramService.requireDiagram).toHaveBeenNthCalledWith(1, auth, 'diagram-id', Permission.DiagramComment);
    expect(diagramService.requireDiagram).toHaveBeenNthCalledWith(2, auth, 'diagram-id', Permission.DiagramUpdate);
    expect(commentRepository.deleteComment).not.toHaveBeenCalled();
    expect(auditLogRepository.create).not.toHaveBeenCalled();
  });

  it('strips unknown Lexical nodes and stores server-derived plain text', async () => {
    const bodyJson = {
      root: {
        children: [
          {
            children: [
              { type: 'text', text: 'Visible text', version: 1 },
              { type: 'unsafe-html', html: '<img src=x onerror=alert(1)>', version: 1 },
            ],
            type: 'paragraph',
            version: 1,
          },
        ],
        type: 'root',
        version: 1,
      },
    };
    commentRepository.getThreadById.mockResolvedValue(thread);
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });
    commentRepository.createCommentReply.mockResolvedValue({
      comment: {
        ...comment,
        bodyJson: createPlainTextCommentLexicalDocument('Visible text'),
        bodyText: 'Visible text',
      },
      thread,
    });

    await expect(service.replyToThread(auth, 'thread-id', { bodyJson: bodyJson as never })).resolves.toMatchObject({
      comment: {
        body: 'Visible text',
        bodyText: 'Visible text',
      },
    });

    expect(commentRepository.createCommentReply).toHaveBeenCalledWith({
      bodyJson: createPlainTextCommentLexicalDocument('Visible text'),
      bodyText: 'Visible text',
      createdById: 'user-id',
      mentionUserIds: [],
      parentCommentId: null,
      threadId: 'thread-id',
    });
  });

  it('stores only project-accessible mentions and skips self mentions', async () => {
    commentRepository.getThreadById.mockResolvedValue(thread);
    commentRepository.getMentionableUsersForDiagram.mockResolvedValue([
      { email: 'commenter@tabliodb.local', name: 'Commenter User', userId: 'user-id' },
      { email: 'teammate@tabliodb.local', name: 'Team Mate', userId: 'teammate-id' },
    ]);
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });
    commentRepository.createCommentReply.mockResolvedValue({
      comment: {
        ...comment,
        bodyJson: createPlainTextCommentLexicalDocument(
          'Please ask @Team Mate and @Commenter User plus @outsider@example.local.',
        ),
        bodyText: 'Please ask @Team Mate and @Commenter User plus @outsider@example.local.',
      },
      thread,
    });

    await expect(
      service.replyToThread(auth, 'thread-id', {
        bodyJson: commentBody('Please ask @Team Mate and @Commenter User plus @outsider@example.local.'),
      }),
    ).resolves.toMatchObject({
      comment: {
        mentionedUserIds: ['teammate-id'],
      },
    });

    expect(commentRepository.getMentionableUsersForDiagram).toHaveBeenCalledWith('diagram-id');
    expect(commentRepository.createCommentReply).toHaveBeenCalledWith({
      bodyJson: createPlainTextCommentLexicalDocument(
        'Please ask @Team Mate and @Commenter User plus @outsider@example.local.',
      ),
      bodyText: 'Please ask @Team Mate and @Commenter User plus @outsider@example.local.',
      createdById: 'user-id',
      mentionUserIds: ['teammate-id'],
      parentCommentId: null,
      threadId: 'thread-id',
    });
  });

  it('returns paginated threads with per-user unread counts', async () => {
    commentRepository.getThreads.mockResolvedValue({
      items: [{ ...thread, unreadCount: 3 }],
      nextCursor: null,
      totalCount: 1,
    });
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });

    await expect(service.getThreads(auth, 'diagram-id', { limit: 50 })).resolves.toMatchObject({
      items: [
        {
          id: 'thread-id',
          status: 'open',
          targetType: 'table',
          unreadCount: 3,
        },
      ],
      totalCount: 1,
    });

    expect(diagramService.requireDiagram).toHaveBeenCalledWith(auth, 'diagram-id', Permission.DiagramRead);
    expect(commentRepository.getThreads).toHaveBeenCalledWith('diagram-id', {
      cursor: undefined,
      limit: 50,
      userId: 'user-id',
    });
  });

  it('returns a diagram comment summary without reading the full thread list', async () => {
    commentRepository.getDiagramSummary.mockResolvedValue({
      openCount: 2,
      resolvedCount: 1,
      targets: [
        {
          openCount: 2,
          resolvedCount: 0,
          targetId: 'table-id',
          targetType: 'table',
          totalCount: 2,
          unreadCount: 4,
          updatedAt: new Date('2026-07-30T08:09:00.000Z'),
        },
      ],
      totalCount: 3,
      unreadCount: 4,
      updatedAt: new Date('2026-07-30T08:10:00.000Z'),
    });
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });

    await expect(service.getDiagramSummary(auth, 'diagram-id')).resolves.toMatchObject({
      diagramId: 'diagram-id',
      openCount: 2,
      resolvedCount: 1,
      targets: [
        {
          openCount: 2,
          targetId: 'table-id',
          targetType: 'table',
          totalCount: 2,
          unreadCount: 4,
          updatedAt: '2026-07-30T08:09:00.000Z',
        },
      ],
      totalCount: 3,
      unreadCount: 4,
      updatedAt: '2026-07-30T08:10:00.000Z',
    });

    expect(diagramService.requireDiagram).toHaveBeenCalledWith(auth, 'diagram-id', Permission.DiagramRead);
    expect(commentRepository.getDiagramSummary).toHaveBeenCalledWith('diagram-id', 'user-id');
    // Summary endpoint sengaja tidak memakai getThreads supaya marker canvas tidak bergantung pada page pertama thread.
    expect(commentRepository.getThreads).not.toHaveBeenCalled();
  });

  it('returns deleted comments as tombstones without leaking stored body content', async () => {
    commentRepository.getThreadById.mockResolvedValue(thread);
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });
    commentRepository.getComments.mockResolvedValue({
      items: [
        {
          ...comment,
          authorAvatarUrl: null,
          authorCursorColor: '#58cc02',
          authorEmail: 'commenter@tabliodb.local',
          authorId: 'user-id',
          authorName: 'Commenter User',
          bodyJson: createPlainTextCommentLexicalDocument('Sensitive deleted detail.'),
          bodyText: 'Sensitive deleted detail.',
          deletedAt: new Date('2026-07-30T08:03:00.000Z'),
          mentionedUserIds: ['teammate-id'],
          replyCount: 2,
        },
      ],
      nextCursor: null,
      totalCount: 1,
    });

    await expect(service.getThreadComments(auth, 'thread-id', { limit: 50 })).resolves.toMatchObject({
      items: [
        {
          body: '',
          bodyText: '',
          deletedAt: '2026-07-30T08:03:00.000Z',
          mentionedUserIds: [],
          replyCount: 2,
        },
      ],
      totalCount: 1,
    });

    expect(diagramService.requireDiagram).toHaveBeenCalledWith(auth, 'diagram-id', Permission.DiagramRead);
    expect(commentRepository.getComments).toHaveBeenCalledWith('thread-id', {
      cursor: undefined,
      limit: 50,
      parentCommentId: undefined,
    });
  });

  it('returns only root comments for a thread through an explicit parent filter', async () => {
    commentRepository.getThreadById.mockResolvedValue(thread);
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });
    commentRepository.getComments.mockResolvedValue({
      items: [
        {
          ...comment,
          authorAvatarUrl: null,
          authorCursorColor: '#58cc02',
          authorEmail: 'commenter@tabliodb.local',
          authorId: 'user-id',
          authorName: 'Commenter User',
          mentionedUserIds: [],
          replyCount: 2,
        },
      ],
      nextCursor: 'offset:50',
      totalCount: 12,
    });

    await expect(
      service.getThreadRootComments(auth, 'thread-id', { cursor: 'offset:0', limit: 50 }),
    ).resolves.toMatchObject({
      items: [
        {
          id: 'comment-id',
          parentCommentId: null,
          replyCount: 2,
        },
      ],
      nextCursor: 'offset:50',
      totalCount: 12,
    });

    expect(diagramService.requireDiagram).toHaveBeenCalledWith(auth, 'diagram-id', Permission.DiagramRead);
    expect(commentRepository.getComments).toHaveBeenCalledWith('thread-id', {
      cursor: 'offset:0',
      limit: 50,
      // Root endpoint selalu meminta parent null agar UI bisa memuat level pertama tanpa reply nested.
      parentCommentId: null,
    });
  });

  it('returns direct replies for a comment without rejecting deleted tombstone parents', async () => {
    commentRepository.getCommentThreadScope.mockResolvedValue({
      deletedAt: new Date('2026-07-30T08:03:00.000Z'),
      diagramId: 'diagram-id',
      id: 'parent-comment-id',
      organizationId: 'organization-id',
      projectId: 'project-id',
      threadId: 'thread-id',
    });
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });
    commentRepository.getComments.mockResolvedValue({
      items: [
        {
          ...comment,
          authorAvatarUrl: null,
          authorCursorColor: '#58cc02',
          authorEmail: 'commenter@tabliodb.local',
          authorId: 'user-id',
          authorName: 'Commenter User',
          id: 'reply-id',
          mentionedUserIds: [],
          parentCommentId: 'parent-comment-id',
          replyCount: 0,
        },
      ],
      nextCursor: null,
      totalCount: 1,
    });

    await expect(service.getCommentReplies(auth, 'parent-comment-id', { limit: 20 })).resolves.toMatchObject({
      items: [
        {
          id: 'reply-id',
          parentCommentId: 'parent-comment-id',
        },
      ],
      totalCount: 1,
    });

    expect(diagramService.requireDiagram).toHaveBeenCalledWith(auth, 'diagram-id', Permission.DiagramRead);
    expect(commentRepository.getComments).toHaveBeenCalledWith('thread-id', {
      cursor: undefined,
      limit: 20,
      parentCommentId: 'parent-comment-id',
    });
  });

  it('returns the read state for a thread after diagram read permission passes', async () => {
    commentRepository.getThreadById.mockResolvedValue(thread);
    commentRepository.getThreadReadState.mockResolvedValue({
      readState: {
        lastReadAt: new Date('2026-07-30T08:05:00.000Z'),
        lastReadCommentId: 'comment-id',
        threadId: 'thread-id',
        updatedAt: new Date('2026-07-30T08:06:00.000Z'),
        userId: 'user-id',
      },
      readers: [
        {
          lastReadAt: new Date('2026-07-30T08:04:00.000Z'),
          lastReadCommentId: 'comment-id',
          updatedAt: new Date('2026-07-30T08:04:30.000Z'),
          userAvatarUrl: null,
          userCursorColor: '#1cb0f6',
          userEmail: 'teammate@tabliodb.local',
          userId: 'teammate-id',
          userName: 'Team Mate',
        },
      ],
      totalReaderCount: 2,
      unreadCount: 0,
    });
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });

    await expect(service.getThreadReadState(auth, 'thread-id')).resolves.toMatchObject({
      lastReadAt: '2026-07-30T08:05:00.000Z',
      lastReadCommentId: 'comment-id',
      readers: [
        {
          user: {
            cursorColor: '#1cb0f6',
            email: 'teammate@tabliodb.local',
            id: 'teammate-id',
            name: 'Team Mate',
          },
        },
      ],
      threadId: 'thread-id',
      totalReaderCount: 2,
      unreadCount: 0,
      updatedAt: '2026-07-30T08:06:00.000Z',
    });

    expect(diagramService.requireDiagram).toHaveBeenCalledWith(auth, 'diagram-id', Permission.DiagramRead);
    expect(commentRepository.getThreadReadState).toHaveBeenCalledWith('thread-id', 'user-id');
  });

  it('marks a thread as read and returns the refreshed read state', async () => {
    commentRepository.getThreadById.mockResolvedValue(thread);
    commentRepository.markThreadRead.mockResolvedValue({
      lastReadAt: new Date('2026-07-30T08:05:00.000Z'),
      lastReadCommentId: 'comment-id',
      threadId: 'thread-id',
      updatedAt: new Date('2026-07-30T08:06:00.000Z'),
      userId: 'user-id',
    });
    commentRepository.getThreadReadState.mockResolvedValue({
      readState: {
        lastReadAt: new Date('2026-07-30T08:05:00.000Z'),
        lastReadCommentId: 'comment-id',
        threadId: 'thread-id',
        updatedAt: new Date('2026-07-30T08:06:00.000Z'),
        userId: 'user-id',
      },
      readers: [],
      totalReaderCount: 1,
      unreadCount: 0,
    });
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });

    await expect(service.markThreadRead(auth, 'thread-id')).resolves.toMatchObject({
      lastReadAt: '2026-07-30T08:05:00.000Z',
      lastReadCommentId: 'comment-id',
      threadId: 'thread-id',
      totalReaderCount: 1,
      unreadCount: 0,
    });

    expect(diagramService.requireDiagram).toHaveBeenCalledWith(auth, 'diagram-id', Permission.DiagramRead);
    expect(commentRepository.markThreadRead).toHaveBeenCalledWith('thread-id', 'user-id');
    expect(commentRepository.getThreadReadState).toHaveBeenCalledWith('thread-id', 'user-id');
  });

  it('creates a nested reply only after the parent comment is verified inside the same thread', async () => {
    commentRepository.getThreadById.mockResolvedValue(thread);
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });
    commentRepository.getCommentInThread.mockResolvedValue({
      deletedAt: null,
      id: 'parent-comment-id',
      parentCommentId: null,
      threadId: 'thread-id',
    });
    commentRepository.createCommentReply.mockResolvedValue({
      comment: {
        ...comment,
        id: 'nested-comment-id',
        parentCommentId: 'parent-comment-id',
      },
      thread,
    });

    await expect(
      service.replyToThread(auth, 'thread-id', {
        bodyJson: commentBody('Nested detail.'),
        parentCommentId: 'parent-comment-id',
      }),
    ).resolves.toMatchObject({
      comment: {
        id: 'nested-comment-id',
        parentCommentId: 'parent-comment-id',
      },
    });

    expect(commentRepository.getCommentInThread).toHaveBeenCalledWith('parent-comment-id', 'thread-id');
    expect(commentRepository.createCommentReply).toHaveBeenCalledWith({
      bodyJson: createPlainTextCommentLexicalDocument('Nested detail.'),
      bodyText: 'Nested detail.',
      createdById: 'user-id',
      mentionUserIds: [],
      parentCommentId: 'parent-comment-id',
      threadId: 'thread-id',
    });
  });

  it('creates a nested reply from a comment route and forces the route comment as the parent', async () => {
    commentRepository.getCommentWithThread.mockResolvedValue({
      createdById: 'teammate-id',
      deletedAt: null,
      diagramId: 'diagram-id',
      id: 'parent-comment-id',
      organizationId: 'organization-id',
      parentCommentId: null,
      projectId: 'project-id',
      threadId: 'thread-id',
    });
    commentRepository.getThreadById.mockResolvedValue(thread);
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });
    commentRepository.getCommentInThread.mockResolvedValue({
      deletedAt: null,
      id: 'parent-comment-id',
      parentCommentId: null,
      threadId: 'thread-id',
    });
    commentRepository.createCommentReply.mockResolvedValue({
      comment: {
        ...comment,
        id: 'nested-comment-id',
        parentCommentId: 'parent-comment-id',
      },
      thread,
    });

    await expect(
      service.replyToComment(auth, 'parent-comment-id', { bodyJson: commentBody('Reply from route.') }),
    ).resolves.toMatchObject({
      comment: {
        id: 'nested-comment-id',
        parentCommentId: 'parent-comment-id',
      },
    });

    expect(commentRepository.createCommentReply).toHaveBeenCalledWith({
      bodyJson: createPlainTextCommentLexicalDocument('Reply from route.'),
      bodyText: 'Reply from route.',
      createdById: 'user-id',
      mentionUserIds: [],
      parentCommentId: 'parent-comment-id',
      threadId: 'thread-id',
    });
  });

  it('rejects comment-route replies when the body points to a different parent', async () => {
    commentRepository.getCommentWithThread.mockResolvedValue({
      createdById: 'teammate-id',
      deletedAt: null,
      diagramId: 'diagram-id',
      id: 'parent-comment-id',
      organizationId: 'organization-id',
      parentCommentId: null,
      projectId: 'project-id',
      threadId: 'thread-id',
    });

    await expect(
      service.replyToComment(auth, 'parent-comment-id', {
        bodyJson: commentBody('Wrong route parent.'),
        parentCommentId: 'other-parent-id',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(commentRepository.getThreadById).not.toHaveBeenCalled();
    expect(commentRepository.createCommentReply).not.toHaveBeenCalled();
  });

  it('rejects nested replies when the parent comment is not inside the thread', async () => {
    commentRepository.getThreadById.mockResolvedValue(thread);
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });
    commentRepository.getCommentInThread.mockResolvedValue(undefined);

    await expect(
      service.replyToThread(auth, 'thread-id', {
        bodyJson: commentBody('Wrong parent.'),
        parentCommentId: 'other-thread-comment-id',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    // Parent validation prevents cross-thread nesting even when the caller already has comment permission on this thread.
    expect(commentRepository.createCommentReply).not.toHaveBeenCalled();
  });

  it('resolves an existing thread through diagram comment permission', async () => {
    const resolvedThread = {
      ...thread,
      resolvedAt: new Date('2026-07-30T08:02:00.000Z'),
      resolvedById: 'user-id',
      status: 'resolved' as const,
      updatedAt: new Date('2026-07-30T08:02:00.000Z'),
    };
    commentRepository.getThreadWithScope.mockResolvedValue(scopedThread);
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });
    commentRepository.resolveThread.mockResolvedValue(resolvedThread);

    await expect(service.resolveThread(auth, 'thread-id')).resolves.toMatchObject({
      id: 'thread-id',
      resolvedAt: '2026-07-30T08:02:00.000Z',
      resolvedById: 'user-id',
      status: 'resolved',
    });

    expect(commentRepository.resolveThread).toHaveBeenCalledWith('thread-id', 'user-id');
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CommentThreadResolved,
        actorId: 'user-id',
        diagramId: 'diagram-id',
        entityId: 'thread-id',
        entityType: 'comment_thread',
        metadata: {
          previousStatus: 'open',
          targetId: 'table-id',
          targetType: 'table',
        },
        organizationId: 'organization-id',
        projectId: 'project-id',
      }),
    );
  });

  it('reopens a resolved thread through diagram comment permission', async () => {
    const resolvedScopedThread = {
      ...scopedThread,
      resolvedAt: new Date('2026-07-30T08:02:00.000Z'),
      resolvedById: 'user-id',
      status: 'resolved' as const,
      updatedAt: new Date('2026-07-30T08:02:00.000Z'),
    };
    const reopenedThread = {
      ...thread,
      status: 'open' as const,
      updatedAt: new Date('2026-07-30T08:03:00.000Z'),
    };
    commentRepository.getThreadWithScope.mockResolvedValue(resolvedScopedThread);
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });
    commentRepository.unresolveThread.mockResolvedValue(reopenedThread);

    await expect(service.unresolveThread(auth, 'thread-id')).resolves.toMatchObject({
      id: 'thread-id',
      resolvedAt: null,
      resolvedById: null,
      status: 'open',
    });

    expect(commentRepository.unresolveThread).toHaveBeenCalledWith('thread-id');
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CommentThreadReopened,
        actorId: 'user-id',
        diagramId: 'diagram-id',
        entityId: 'thread-id',
        entityType: 'comment_thread',
        metadata: {
          previousStatus: 'resolved',
          targetId: 'table-id',
          targetType: 'table',
        },
        organizationId: 'organization-id',
        projectId: 'project-id',
      }),
    );
  });

  it('returns not found before checking diagram permission for missing threads', async () => {
    commentRepository.getThreadWithScope.mockResolvedValue(undefined);

    await expect(service.resolveThread(auth, 'missing-thread-id')).rejects.toBeInstanceOf(NotFoundException);

    expect(diagramService.requireDiagram).not.toHaveBeenCalled();
  });
});
