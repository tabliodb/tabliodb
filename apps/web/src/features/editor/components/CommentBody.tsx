import type { CommentLexicalDocumentDto, CommentLexicalInlineNodeDto, CommentLexicalTextNodeDto } from '@tabliodb/sdk';
import { cn } from '@tabliodb/ui';
import type { ReactNode } from 'react';

type CommentBodyProps = {
  bodyJson: CommentLexicalDocumentDto;
  className?: string;
  deleted?: boolean;
  fallbackText: string;
};

const textFormat = {
  bold: 1,
  italic: 2,
  strikethrough: 4,
  underline: 8,
  code: 16,
} as const;

export function CommentBody({ bodyJson, className, deleted = false, fallbackText }: CommentBodyProps) {
  if (deleted) {
    return (
      <p
        className={cn(
          'mt-1 whitespace-pre-wrap wrap-break-word text-[13px] font-semibold italic leading-6 text-[rgb(var(--tabliodb-ink-muted))]',
          className,
        )}
      >
        This comment was deleted.
      </p>
    );
  }

  const paragraphs = bodyJson.root.children.filter((node) => node.type === 'paragraph');

  if (paragraphs.length === 0) {
    return (
      <p
        className={cn(
          'mt-1 whitespace-pre-wrap wrap-break-word text-[13px] font-semibold leading-6 text-[rgb(var(--tabliodb-ink))]',
          className,
        )}
      >
        {fallbackText}
      </p>
    );
  }

  return (
    <div
      className={cn(
        'mt-1 space-y-1 whitespace-pre-wrap wrap-break-word text-[13px] font-semibold leading-6 text-[rgb(var(--tabliodb-ink))]',
        className,
      )}
    >
      {paragraphs.map((paragraph, paragraphIndex) => (
        <p className="m-0" dir={paragraph.direction ?? undefined} key={paragraphIndex}>
          {paragraph.children.length > 0
            ? paragraph.children.map((node, nodeIndex) => renderInlineNode(node, `${paragraphIndex}-${nodeIndex}`))
            : '\u00a0'}
        </p>
      ))}
    </div>
  );
}

function renderInlineNode(node: CommentLexicalInlineNodeDto, key: string): ReactNode {
  switch (node.type) {
    case 'linebreak':
      return <br key={key} />;
    case 'link':
      return renderLinkNode(node, key);
    case 'mention':
      return (
        <span
          className="mx-0.5 inline-flex max-w-full align-baseline rounded-full border border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky-soft))] px-1.5 py-0.5 text-[12px] font-extrabold leading-none text-[rgb(var(--tabliodb-sky-text))]"
          key={key}
        >
          @{node.name}
        </span>
      );
    case 'text':
      return renderTextNode(node, key);
    default:
      // Unknown nodes are ignored on the client too, keeping rendering defensive even if old data predates server sanitization.
      return null;
  }
}

function renderLinkNode(node: Extract<CommentLexicalInlineNodeDto, { type: 'link' }>, key: string): ReactNode {
  const href = normalizeSafeCommentHref(node.url);

  if (!href) {
    // Invalid links are rendered as their children text instead of clickable content.
    return node.children.map((child, childIndex) => renderInlineNode(child, `${key}-${childIndex}`));
  }

  return (
    <a
      className="cursor-pointer font-extrabold text-[rgb(var(--tabliodb-sky-text))] underline underline-offset-2 hover:text-[rgb(var(--tabliodb-sky))]"
      href={href}
      key={key}
      rel="noopener noreferrer"
      target={href.startsWith('mailto:') ? undefined : '_blank'}
    >
      {node.children.length > 0
        ? node.children.map((child, childIndex) => renderInlineNode(child, `${key}-${childIndex}`))
        : href}
    </a>
  );
}

function renderTextNode(node: CommentLexicalTextNodeDto, key: string): ReactNode {
  const format = node.format ?? 0;

  return (
    <span
      className={cn(
        format & textFormat.bold && 'font-extrabold',
        format & textFormat.italic && 'italic',
        format & textFormat.strikethrough && 'line-through',
        format & textFormat.underline && 'underline underline-offset-2',
        format & textFormat.code && 'rounded-[6px] bg-[rgb(var(--tabliodb-surface))] px-1 py-0.5 font-mono text-[12px]',
      )}
      key={key}
    >
      {node.text}
    </span>
  );
}

function normalizeSafeCommentHref(value: string): string | null {
  try {
    const url = new URL(value);

    // Server already sanitizes comment links, but the renderer repeats the allowlist because old/dev data can bypass new code.
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}
