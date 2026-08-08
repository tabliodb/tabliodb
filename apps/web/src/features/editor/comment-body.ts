import type { CommentLexicalDocumentDto } from '@/resources/comments';

export function createPlainTextCommentLexicalDocument(text: string): CommentLexicalDocumentDto {
  const children =
    text.length > 0
      ? [
          {
            detail: 0,
            format: 0,
            mode: 'normal' as const,
            style: '',
            text,
            type: 'text' as const,
            version: 1,
          },
        ]
      : [];

  return {
    root: {
      children: [
        {
          children,
          direction: null,
          format: '',
          indent: 0,
          type: 'paragraph',
          version: 1,
        },
      ],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  };
}

export function createEmptyCommentFormBody(): { body: string; bodyJson: CommentLexicalDocumentDto } {
  return {
    body: '',
    bodyJson: createPlainTextCommentLexicalDocument(''),
  };
}
