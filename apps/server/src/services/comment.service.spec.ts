import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Permission } from '@tabliodb/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../database.js';
import { CommentService } from './comment.service.js';

const auth: AuthContext = {
  user: {
    avatarUrl: null,
    cursorColor: '#58cc02',
    email: 'commenter@tabliodb.local',
    id: 'user-id',
    name: 'Commenter User',
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

const comment = {
  body: 'Please review this table.',
  bodyFormat: 'markdown' as const,
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
  const commentRepository = {
    createCommentReply: vi.fn(),
    createThreadWithComment: vi.fn(),
    getCommentInThread: vi.fn(),
    getComments: vi.fn(),
    getThreadReadState: vi.fn(),
    getThreadById: vi.fn(),
    getThreads: vi.fn(),
    markThreadRead: vi.fn(),
    resolveThread: vi.fn(),
    unresolveThread: vi.fn(),
  };
  const diagramService = {
    requireDiagram: vi.fn(),
  };

  let service: CommentService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new CommentService(commentRepository as never, diagramService as never);
  });

  it('rejects replies when the user cannot comment on the thread diagram', async () => {
    commentRepository.getThreadById.mockResolvedValue(thread);
    diagramService.requireDiagram.mockRejectedValue(new ForbiddenException());

    await expect(service.replyToThread(auth, 'thread-id', { body: 'Readonly reply' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    // Route berbasis thread harus resolve diagramId dulu, lalu permission comment dicek sebelum insert reply.
    expect(diagramService.requireDiagram).toHaveBeenCalledWith(auth, 'diagram-id', Permission.DiagramComment);
    expect(commentRepository.createCommentReply).not.toHaveBeenCalled();
  });

  it('creates a reply and serializes the current user as the author', async () => {
    commentRepository.getThreadById.mockResolvedValue(thread);
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });
    commentRepository.createCommentReply.mockResolvedValue({ comment, thread });

    await expect(service.replyToThread(auth, 'thread-id', { body: 'Looks good.' })).resolves.toMatchObject({
      comment: {
        author: {
          email: 'commenter@tabliodb.local',
          id: 'user-id',
          name: 'Commenter User',
        },
        body: 'Please review this table.',
        createdAt: '2026-07-30T08:01:00.000Z',
      },
      thread: {
        id: 'thread-id',
        status: 'open',
        targetType: 'table',
      },
    });

    expect(commentRepository.createCommentReply).toHaveBeenCalledWith({
      body: 'Looks good.',
      createdById: 'user-id',
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
      service.replyToThread(auth, 'thread-id', { body: 'Nested detail.', parentCommentId: 'parent-comment-id' }),
    ).resolves.toMatchObject({
      comment: {
        id: 'nested-comment-id',
        parentCommentId: 'parent-comment-id',
      },
    });

    expect(commentRepository.getCommentInThread).toHaveBeenCalledWith('parent-comment-id', 'thread-id');
    expect(commentRepository.createCommentReply).toHaveBeenCalledWith({
      body: 'Nested detail.',
      createdById: 'user-id',
      parentCommentId: 'parent-comment-id',
      threadId: 'thread-id',
    });
  });

  it('rejects nested replies when the parent comment is not inside the thread', async () => {
    commentRepository.getThreadById.mockResolvedValue(thread);
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });
    commentRepository.getCommentInThread.mockResolvedValue(undefined);

    await expect(
      service.replyToThread(auth, 'thread-id', { body: 'Wrong parent.', parentCommentId: 'other-thread-comment-id' }),
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
    commentRepository.getThreadById.mockResolvedValue(thread);
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });
    commentRepository.resolveThread.mockResolvedValue(resolvedThread);

    await expect(service.resolveThread(auth, 'thread-id')).resolves.toMatchObject({
      id: 'thread-id',
      resolvedAt: '2026-07-30T08:02:00.000Z',
      resolvedById: 'user-id',
      status: 'resolved',
    });

    expect(commentRepository.resolveThread).toHaveBeenCalledWith('thread-id', 'user-id');
  });

  it('returns not found before checking diagram permission for missing threads', async () => {
    commentRepository.getThreadById.mockResolvedValue(undefined);

    await expect(service.resolveThread(auth, 'missing-thread-id')).rejects.toBeInstanceOf(NotFoundException);

    expect(diagramService.requireDiagram).not.toHaveBeenCalled();
  });
});
