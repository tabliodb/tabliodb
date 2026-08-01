import type { CommentLexicalDocumentDto } from '@tabliodb/sdk';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CommentBody } from './CommentBody';

function commentDocument(
  children: CommentLexicalDocumentDto['root']['children'][number]['children'],
): CommentLexicalDocumentDto {
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

describe('CommentBody', () => {
  it('escapes text content instead of injecting HTML', () => {
    const html = renderToStaticMarkup(
      <CommentBody
        bodyJson={commentDocument([
          {
            text: '<img src=x onerror=alert(1)>',
            type: 'text',
          },
        ])}
        fallbackText=""
      />,
    );

    // React text rendering must escape user text, so browser never sees an executable img tag from comment content.
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x');
  });

  it('renders safe links with noopener metadata', () => {
    const html = renderToStaticMarkup(
      <CommentBody
        bodyJson={commentDocument([
          {
            children: [
              {
                text: 'documentation',
                type: 'text',
              },
            ],
            type: 'link',
            url: 'https://example.com/docs',
          },
        ])}
        fallbackText=""
      />,
    );

    expect(html).toContain('href="https://example.com/docs"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });

  it('drops unsafe links but keeps readable child text', () => {
    const html = renderToStaticMarkup(
      <CommentBody
        bodyJson={commentDocument([
          {
            children: [
              {
                text: 'bad link',
                type: 'text',
              },
            ],
            type: 'link',
            url: 'javascript:alert(1)',
          },
        ])}
        fallbackText=""
      />,
    );

    // Old/dev data can contain unsafe URLs; the renderer keeps the label readable without creating a clickable href.
    expect(html).toContain('bad link');
    expect(html).not.toContain('href=');
    expect(html).not.toContain('javascript:');
  });
});
