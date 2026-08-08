import type {
  BodyFormat,
  CommentDiagramSummaryDtoOutput,
  CommentListResponseDtoOutput,
  CommentResponseDtoOutput,
  CommentThreadListItemDtoOutput,
  CommentThreadListResponseDtoOutput,
  CommentThreadReadStateDtoOutput,
  CommentThreadResponseDtoOutput,
  CommentThreadStatusResponseDtoOutput,
  CommentThreadTargetSummaryDtoOutput,
  Status2,
  TargetType,
  Type,
  getThreadComments,
} from '@tabliodb/sdk';

export type CommentTargetType = `${TargetType}`;
export type CommentThreadStatus = `${Status2}`;
export type CommentBodyFormat = `${BodyFormat}`;
export type CommentRootNodeType = `${Type}`;

export type CommentAuthorDto = CommentResponseDtoOutput['author'];

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
  | CommentLexicalLineBreakNodeDto
  | CommentLexicalLinkNodeDto
  | CommentLexicalMentionNodeDto
  | CommentLexicalTextNodeDto;

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
    type: CommentRootNodeType;
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

export type CommentListQuery = Omit<Parameters<typeof getThreadComments>[0], 'parentCommentId' | 'threadId'> & {
  parentCommentId?: string | null;
};

export type CommentUpdateDto = {
  bodyJson: CommentLexicalDocumentDto;
};

export type CommentResponseDto = Omit<CommentResponseDtoOutput, 'bodyFormat' | 'bodyJson'> & {
  bodyFormat: CommentBodyFormat;
  bodyJson: CommentLexicalDocumentDto;
};

export type CommentThreadDto = Omit<CommentThreadStatusResponseDtoOutput, 'status' | 'targetType'> & {
  status: CommentThreadStatus;
  targetType: CommentTargetType;
};

export type CommentThreadTargetSummaryDto = Omit<CommentThreadTargetSummaryDtoOutput, 'targetType'> & {
  targetType: CommentTargetType;
};

export type CommentDiagramSummaryDto = Omit<CommentDiagramSummaryDtoOutput, 'targets'> & {
  targets: CommentThreadTargetSummaryDto[];
};

export type CommentThreadReaderDto = CommentThreadReadStateDtoOutput['readers'][number];

export type CommentThreadReadStateDto = CommentThreadReadStateDtoOutput;

export type CommentThreadResponseDto = Omit<CommentThreadResponseDtoOutput, 'comment' | 'thread'> & {
  comment: CommentResponseDto;
  thread: CommentThreadDto;
};

export type CommentThreadListItemDto = Omit<CommentThreadListItemDtoOutput, 'status' | 'targetType'> & {
  status: CommentThreadStatus;
  targetType: CommentTargetType;
};

export type CommentThreadListResponseDto = Omit<CommentThreadListResponseDtoOutput, 'items'> & {
  items: CommentThreadListItemDto[];
};

export type CommentListResponseDto = Omit<CommentListResponseDtoOutput, 'items'> & {
  items: CommentResponseDto[];
};
