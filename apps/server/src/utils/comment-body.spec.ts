import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  createPlainTextCommentLexicalDocument,
  extractCommentMentionUserIds,
  normalizeCommentLexicalBody,
} from './comment-body.js';

const teammateUserId = '11111111-1111-4111-8111-111111111111';
const reviewerUserId = '22222222-2222-4222-8222-222222222222';

describe('comment body sanitizer', () => {
  it('normalizes plain text Lexical documents into canonical body JSON and searchable text', () => {
    expect(normalizeCommentLexicalBody(createPlainTextCommentLexicalDocument('Please review this table.'))).toEqual({
      bodyJson: createPlainTextCommentLexicalDocument('Please review this table.'),
      bodyText: 'Please review this table.',
    });
  });

  it('strips unsupported nodes, unsafe link URLs, and client-provided render attributes', () => {
    const result = normalizeCommentLexicalBody({
      root: {
        children: [
          {
            children: [
              {
                detail: 7,
                format: 1,
                mode: 'token',
                style: 'color: red; position: fixed',
                text: 'Read ',
                type: 'text',
                version: 1,
              },
              {
                children: [{ style: 'font-size:999px', text: 'docs', type: 'text', version: 1 }],
                rel: 'opener',
                target: '_self',
                type: 'link',
                url: 'https://example.com/docs',
                version: 1,
              },
              { text: ' with ', type: 'text', version: 1 },
              {
                children: [{ text: 'unsafe link text', type: 'text', version: 1 }],
                type: 'link',
                url: 'javascript:alert(1)',
                version: 1,
              },
              {
                html: '<img src=x onerror=alert(1)>',
                type: 'unsafe-html',
                version: 1,
              },
              {
                name: ' Team Mate ',
                type: 'mention',
                userId: teammateUserId,
                version: 1,
              },
            ],
            direction: 'ltr',
            format: 'left',
            indent: 4,
            type: 'paragraph',
            version: 1,
          },
        ],
        type: 'root',
        version: 1,
      },
    });

    expect(result.bodyText).toBe('Read docs with @Team Mate');
    expect(JSON.stringify(result.bodyJson)).not.toContain('unsafe-html');
    expect(JSON.stringify(result.bodyJson)).not.toContain('javascript:');
    expect(JSON.stringify(result.bodyJson)).not.toContain('position: fixed');
    expect(result.bodyJson).toMatchObject({
      root: {
        children: [
          {
            children: [
              {
                detail: 7,
                format: 1,
                mode: 'token',
                style: '',
                text: 'Read ',
                type: 'text',
                version: 1,
              },
              {
                children: [
                  {
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: 'docs',
                    type: 'text',
                    version: 1,
                  },
                ],
                rel: 'noopener noreferrer',
                target: '_blank',
                type: 'link',
                url: 'https://example.com/docs',
                version: 1,
              },
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: ' with ',
                type: 'text',
                version: 1,
              },
              {
                name: 'Team Mate',
                type: 'mention',
                userId: teammateUserId,
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'paragraph',
            version: 1,
          },
        ],
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    });
  });

  it('rejects documents that become empty after unsafe nodes are stripped', () => {
    expect(() =>
      normalizeCommentLexicalBody({
        root: {
          children: [
            {
              children: [{ html: '<script>alert(1)</script>', type: 'unsafe-html', version: 1 }],
              type: 'paragraph',
              version: 1,
            },
          ],
          type: 'root',
          version: 1,
        },
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects overlong visible text before the body can be persisted', () => {
    expect(() => normalizeCommentLexicalBody(createPlainTextCommentLexicalDocument('x'.repeat(4001)))).toThrow(
      BadRequestException,
    );
  });

  it('rejects payloads with too many nested Lexical nodes', () => {
    expect(() =>
      normalizeCommentLexicalBody({
        root: {
          children: [
            {
              children: Array.from({ length: 201 }, (_, index) => ({
                text: String(index % 10),
                type: 'text',
                version: 1,
              })),
              type: 'paragraph',
              version: 1,
            },
          ],
          type: 'root',
          version: 1,
        },
      }),
    ).toThrow(BadRequestException);
  });

  it('deduplicates valid mention user ids and ignores invalid mention payloads', () => {
    expect(
      extractCommentMentionUserIds({
        root: {
          children: [
            {
              children: [
                { name: 'Team Mate', type: 'mention', userId: teammateUserId, version: 1 },
                { name: 'Duplicate Team Mate', type: 'mention', userId: teammateUserId, version: 1 },
                { name: 'Reviewer', type: 'mention', userId: reviewerUserId, version: 1 },
                { name: 'Invalid', type: 'mention', userId: 'not-a-uuid', version: 1 },
              ],
              type: 'paragraph',
              version: 1,
            },
          ],
          type: 'root',
          version: 1,
        },
      }),
    ).toEqual([teammateUserId, reviewerUserId]);
  });

  it('wraps non-serializable payloads in a user-facing bad request error', () => {
    const bodyJson: Record<string, unknown> = {
      root: {
        children: [],
        type: 'root',
      },
    };
    bodyJson.self = bodyJson;

    expect(() => normalizeCommentLexicalBody(bodyJson)).toThrow(BadRequestException);
  });
});
