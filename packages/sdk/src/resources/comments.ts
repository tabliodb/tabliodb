import type { Paginated, PaginationQuery } from '@tabliodb/shared';
import type { RequestOpts } from '@oazapfts/runtime';
import type {
  CommentReplyCreateDto as GeneratedCommentReplyCreateDto,
  CommentThreadCreateDto as GeneratedCommentThreadCreateDto,
  CommentUpdateDto as GeneratedCommentUpdateDto,
} from '../fetch-client.js';
import {
  createCommentThread as createCommentThreadRequest,
  deleteComment as deleteCommentRequest,
  getCommentDiagramSummary as getCommentDiagramSummaryRequest,
  getCommentThreadReadState,
  getCommentThreads,
  getThreadComments,
  markCommentThreadRead,
  replyToCommentThread,
  resolveCommentThread,
  unresolveCommentThread,
  updateComment as updateCommentRequest,
} from '../fetch-client.js';

export type CommentTargetType =
  'check' | 'column' | 'diagram' | 'enum' | 'group' | 'index' | 'note' | 'relationship' | 'table';

export type CommentAuthorDto = {
  avatarUrl: string | null;
  cursorColor: string;
  email: string;
  id: string;
  name: string;
};

export type CommentLexicalTextNodeDto = {
  detail?: number;
  format?: number;
  mode?: 'normal' | 'segmented' | 'token';
  style?: string;
  text: string;
  type: 'text';
  version?: number;
};

export type CommentLexicalLineBreakNodeDto = {
  type: 'linebreak';
  version?: number;
};

export type CommentLexicalMentionNodeDto = {
  name: string;
  type: 'mention';
  userId: string;
  version?: number;
};

export type CommentLexicalLinkNodeDto = {
  children: CommentLexicalInlineNodeDto[];
  rel?: string;
  target?: string;
  type: 'link';
  url: string;
  version?: number;
};

export type CommentLexicalInlineNodeDto =
  CommentLexicalLineBreakNodeDto | CommentLexicalLinkNodeDto | CommentLexicalMentionNodeDto | CommentLexicalTextNodeDto;

export type CommentLexicalParagraphNodeDto = {
  children: CommentLexicalInlineNodeDto[];
  direction?: 'ltr' | 'rtl' | null;
  format?: string;
  indent?: number;
  type: 'paragraph';
  version?: number;
};

export type CommentLexicalDocumentDto = {
  root: {
    children: CommentLexicalParagraphNodeDto[];
    direction?: 'ltr' | 'rtl' | null;
    format?: string;
    indent?: number;
    type: 'root';
    version?: number;
  };
};

export type CommentThreadCreateDto = {
  bodyJson: CommentLexicalDocumentDto;
  diagramId: string;
  targetId: string | null;
  targetType: CommentTargetType;
};

export type CommentReplyCreateDto = {
  bodyJson: CommentLexicalDocumentDto;
  parentCommentId?: string | null;
};

export type CommentUpdateDto = {
  bodyJson: CommentLexicalDocumentDto;
};

export type CommentResponseDto = {
  author: CommentAuthorDto;
  body: string;
  bodyFormat: 'lexical';
  bodyJson: CommentLexicalDocumentDto;
  bodyText: string;
  createdAt: string;
  createdById: string;
  deletedAt: string | null;
  editedAt: string | null;
  id: string;
  mentionedUserIds: string[];
  parentCommentId: string | null;
  replyCount: number;
  threadId: string;
  updatedAt: string;
};

export type CommentThreadDto = {
  createdAt: string;
  createdById: string;
  diagramId: string;
  id: string;
  resolvedAt: string | null;
  resolvedById: string | null;
  status: 'open' | 'resolved';
  targetId: string | null;
  targetType: CommentTargetType;
  unreadCount: number;
  updatedAt: string;
};

export type CommentThreadTargetSummaryDto = {
  openCount: number;
  resolvedCount: number;
  targetId: string | null;
  targetType: CommentTargetType;
  totalCount: number;
  unreadCount: number;
  updatedAt: string | null;
};

export type CommentDiagramSummaryDto = {
  diagramId: string;
  openCount: number;
  resolvedCount: number;
  targets: CommentThreadTargetSummaryDto[];
  totalCount: number;
  unreadCount: number;
  updatedAt: string | null;
};

export type CommentThreadReaderDto = {
  lastReadAt: string;
  lastReadCommentId: string | null;
  user: CommentAuthorDto;
};

export type CommentThreadReadStateDto = {
  lastReadAt: string | null;
  lastReadCommentId: string | null;
  readers: CommentThreadReaderDto[];
  threadId: string;
  totalReaderCount: number;
  unreadCount: number;
  updatedAt: string | null;
};

export type CommentThreadResponseDto = {
  comment: CommentResponseDto;
  thread: CommentThreadDto;
};

export type CommentThreadListItemDto = CommentThreadDto;
export type CommentThreadListResponseDto = Paginated<CommentThreadListItemDto>;
export type CommentListResponseDto = Paginated<CommentResponseDto>;

export type CommentsResource = {
  createThread: (body: CommentThreadCreateDto) => Promise<CommentThreadResponseDto>;
  deleteComment: (commentId: string) => Promise<CommentResponseDto>;
  getDiagramSummary: (diagramId: string) => Promise<CommentDiagramSummaryDto>;
  getThreadReadState: (threadId: string) => Promise<CommentThreadReadStateDto>;
  listThreadComments: (threadId: string, query?: PaginationQuery) => Promise<CommentListResponseDto>;
  listThreads: (diagramId: string, query?: PaginationQuery) => Promise<CommentThreadListResponseDto>;
  markThreadRead: (threadId: string) => Promise<CommentThreadReadStateDto>;
  replyToThread: (threadId: string, body: CommentReplyCreateDto) => Promise<CommentThreadResponseDto>;
  resolveThread: (threadId: string) => Promise<CommentThreadDto>;
  unresolveThread: (threadId: string) => Promise<CommentThreadDto>;
  updateComment: (commentId: string, body: CommentUpdateDto) => Promise<CommentResponseDto>;
};

export function createCommentsResource(opts?: RequestOpts): CommentsResource {
  return {
    createThread: (body: CommentThreadCreateDto) =>
      // Boundary generated-client tetap privat agar enum OpenAPI tidak bocor ke public SDK surface.
      createCommentThreadRequest(
        { commentThreadCreateDto: body as unknown as GeneratedCommentThreadCreateDto },
        opts,
      ) as unknown as Promise<CommentThreadResponseDto>,
    getThreadReadState: (threadId: string) =>
      getCommentThreadReadState({ threadId }, opts) as unknown as Promise<CommentThreadReadStateDto>,
    deleteComment: (commentId: string) =>
      deleteCommentRequest({ commentId }, opts) as unknown as Promise<CommentResponseDto>,
    getDiagramSummary: (diagramId: string) =>
      getCommentDiagramSummaryRequest({ diagramId }, opts) as unknown as Promise<CommentDiagramSummaryDto>,
    listThreadComments: (threadId: string, query: PaginationQuery = {}) =>
      getThreadComments({ threadId, ...query }, opts) as unknown as Promise<CommentListResponseDto>,
    listThreads: (diagramId: string, query: PaginationQuery = {}) =>
      getCommentThreads({ diagramId, ...query }, opts) as unknown as Promise<CommentThreadListResponseDto>,
    markThreadRead: (threadId: string) =>
      markCommentThreadRead({ threadId }, opts) as unknown as Promise<CommentThreadReadStateDto>,
    replyToThread: (threadId: string, body: CommentReplyCreateDto) =>
      // Reply body tetap memakai tipe public SDK agar web tidak perlu import enum/DTO dari generated fetch-client.
      replyToCommentThread(
        { threadId, commentReplyCreateDto: body as unknown as GeneratedCommentReplyCreateDto },
        opts,
      ) as unknown as Promise<CommentThreadResponseDto>,
    resolveThread: (threadId: string) =>
      resolveCommentThread({ threadId }, opts) as unknown as Promise<CommentThreadDto>,
    unresolveThread: (threadId: string) =>
      unresolveCommentThread({ threadId }, opts) as unknown as Promise<CommentThreadDto>,
    updateComment: (commentId: string, body: CommentUpdateDto) =>
      updateCommentRequest(
        { commentId, commentUpdateDto: body as unknown as GeneratedCommentUpdateDto },
        opts,
      ) as unknown as Promise<CommentResponseDto>,
  };
}
