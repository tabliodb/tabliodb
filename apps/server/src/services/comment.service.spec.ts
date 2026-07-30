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
  threadId: 'thread-id',
  updatedAt: new Date('2026-07-30T08:01:00.000Z'),
};

describe(CommentService.name, () => {
  const commentRepository = {
    createCommentReply: vi.fn(),
    createThreadWithComment: vi.fn(),
    getComments: vi.fn(),
    getThreadById: vi.fn(),
    getThreads: vi.fn(),
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
      threadId: 'thread-id',
    });
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
