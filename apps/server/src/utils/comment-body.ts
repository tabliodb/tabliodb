import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import type { JsonValue } from '../schema/index.js';

const maxCommentBodyJsonBytes = 32000;
const maxCommentBodyTextLength = 4000;
const maxCommentBodyDepth = 8;
const maxCommentBodyNodes = 200;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const CommentLexicalDocumentSchema = z
  .object({
    root: z
      .object({
        children: z.array(z.unknown()).max(maxCommentBodyNodes),
        type: z.literal('root'),
      })
      .passthrough(),
  })
  .passthrough()
  .meta({ id: 'CommentLexicalDocumentDto' });

export type CommentLexicalDocument = z.infer<typeof CommentLexicalDocumentSchema>;

type SanitizedNodeResult = {
  node: JsonValue | null;
  text: string;
};

type CommentBodyNormalizationResult = {
  bodyJson: JsonValue;
  bodyText: string;
};

export function createPlainTextCommentLexicalDocument(bodyText: string): JsonValue {
  const children =
    bodyText.length > 0
      ? [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: bodyText,
            type: 'text',
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

export function normalizeCommentLexicalBody(input: unknown): CommentBodyNormalizationResult {
  assertJsonPayloadSize(input);

  const parsed = CommentLexicalDocumentSchema.safeParse(input);

  if (!parsed.success) {
    throw new BadRequestException('Comment body must be a valid Lexical document.');
  }

  let nodeCount = 0;
  const paragraphResults = parsed.data.root.children.map((child) =>
    sanitizeCommentLexicalNode(child, {
      depth: 1,
      nodeCountRef: {
        get value() {
          return nodeCount;
        },
        set value(nextValue: number) {
          nodeCount = nextValue;
        },
      },
      parentType: 'root',
    }),
  );
  const sanitizedParagraphs = paragraphResults
    .map((result) => result.node)
    .filter((node): node is JsonValue => Boolean(node));
  const bodyText = paragraphResults
    .map((result) => result.text)
    .join('\n')
    .trim();

  if (bodyText.length === 0) {
    throw new BadRequestException('Comment body cannot be empty.');
  }

  if (bodyText.length > maxCommentBodyTextLength) {
    throw new BadRequestException(`Comment body must be ${maxCommentBodyTextLength} characters or fewer.`);
  }

  return {
    bodyJson: {
      root: {
        children: sanitizedParagraphs,
        direction: readDirection(parsed.data.root.direction),
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    },
    bodyText,
  };
}

function sanitizeCommentLexicalNode(
  value: unknown,
  context: {
    depth: number;
    nodeCountRef: { value: number };
    parentType: 'link' | 'paragraph' | 'root';
  },
): SanitizedNodeResult {
  if (!isRecord(value)) {
    return { node: null, text: '' };
  }

  context.nodeCountRef.value += 1;

  if (context.nodeCountRef.value > maxCommentBodyNodes) {
    throw new BadRequestException(`Comment body can contain at most ${maxCommentBodyNodes} nodes.`);
  }

  if (context.depth > maxCommentBodyDepth) {
    throw new BadRequestException(`Comment body nesting can be at most ${maxCommentBodyDepth} levels.`);
  }

  switch (value.type) {
    case 'paragraph':
      return sanitizeParagraphNode(value, context);
    case 'text':
      return sanitizeTextNode(value);
    case 'linebreak':
      return { node: { type: 'linebreak', version: 1 }, text: '\n' };
    case 'mention':
      return sanitizeMentionNode(value);
    case 'link':
      return sanitizeLinkNode(value, context);
    default:
      // Unknown Lexical nodes are stripped instead of stored so client plugins cannot smuggle unsafe render data.
      return { node: null, text: '' };
  }
}

function sanitizeParagraphNode(
  value: Record<string, unknown>,
  context: {
    depth: number;
    nodeCountRef: { value: number };
    parentType: 'link' | 'paragraph' | 'root';
  },
): SanitizedNodeResult {
  if (context.parentType !== 'root') {
    return { node: null, text: '' };
  }

  const childResults = Array.isArray(value.children)
    ? value.children.map((child) =>
        sanitizeCommentLexicalNode(child, {
          depth: context.depth + 1,
          nodeCountRef: context.nodeCountRef,
          parentType: 'paragraph',
        }),
      )
    : [];
  const children = childResults.map((result) => result.node).filter((node): node is JsonValue => Boolean(node));

  return {
    node: {
      children,
      direction: readDirection(value.direction),
      format: '',
      indent: 0,
      type: 'paragraph',
      version: 1,
    },
    text: childResults.map((result) => result.text).join(''),
  };
}

function sanitizeTextNode(value: Record<string, unknown>): SanitizedNodeResult {
  const text = typeof value.text === 'string' ? value.text : '';

  return {
    node: {
      detail: readNumber(value.detail, 0),
      format: readNumber(value.format, 0),
      mode: readTextMode(value.mode),
      style: '',
      text,
      type: 'text',
      version: 1,
    },
    text,
  };
}

function sanitizeMentionNode(value: Record<string, unknown>): SanitizedNodeResult {
  const userId = typeof value.userId === 'string' && uuidPattern.test(value.userId) ? value.userId : null;
  const name = typeof value.name === 'string' ? value.name.trim().slice(0, 80) : '';

  if (!userId || name.length === 0) {
    return { node: null, text: '' };
  }

  return {
    node: {
      name,
      type: 'mention',
      userId,
      version: 1,
    },
    text: `@${name}`,
  };
}

function sanitizeLinkNode(
  value: Record<string, unknown>,
  context: {
    depth: number;
    nodeCountRef: { value: number };
    parentType: 'link' | 'paragraph' | 'root';
  },
): SanitizedNodeResult {
  if (context.parentType !== 'paragraph') {
    return { node: null, text: '' };
  }

  const url = typeof value.url === 'string' ? sanitizeCommentLinkUrl(value.url) : null;

  if (!url) {
    return { node: null, text: '' };
  }

  const childResults = Array.isArray(value.children)
    ? value.children.map((child) =>
        sanitizeCommentLexicalNode(child, {
          depth: context.depth + 1,
          nodeCountRef: context.nodeCountRef,
          parentType: 'link',
        }),
      )
    : [];
  const children = childResults.map((result) => result.node).filter((node): node is JsonValue => Boolean(node));

  return {
    node: {
      children,
      rel: 'noopener noreferrer',
      target: '_blank',
      type: 'link',
      url,
      version: 1,
    },
    text: childResults.map((result) => result.text).join(''),
  };
}

function sanitizeCommentLinkUrl(value: string): string | null {
  try {
    const url = new URL(value);

    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function assertJsonPayloadSize(input: unknown) {
  const json = JSON.stringify(input);

  if (!json) {
    throw new BadRequestException('Comment body must be valid JSON.');
  }

  if (new TextEncoder().encode(json).length > maxCommentBodyJsonBytes) {
    throw new BadRequestException(`Comment body JSON must be ${maxCommentBodyJsonBytes} bytes or fewer.`);
  }
}

function readDirection(value: unknown): 'ltr' | 'rtl' | null {
  return value === 'ltr' || value === 'rtl' ? value : null;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readTextMode(value: unknown): 'normal' | 'segmented' | 'token' {
  return value === 'segmented' || value === 'token' ? value : 'normal';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
