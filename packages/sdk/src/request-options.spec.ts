import { afterEach, describe, expect, it } from 'vitest';
import { createTabliodbRequestOptions } from './request-options.js';

describe(createTabliodbRequestOptions.name, () => {
  afterEach(() => {
    delete (globalThis as { document?: unknown }).document;
  });

  it('adds the CSRF header to unsafe browser-cookie requests', async () => {
    setDocumentCookie('tabliodb_csrf_token=csrf-token');
    const calls: RequestInit[] = [];
    const fetchSpy: typeof fetch = async (_input, init = {}) => {
      calls.push(init);
      return new Response('{}');
    };
    const options = createTabliodbRequestOptions({ fetch: fetchSpy });

    await options.fetch?.('/api/comments/threads', { method: 'POST' });

    const init = calls[0] ?? {};
    const headers = new Headers(init.headers);

    expect(headers.get('x-csrf-token')).toBe('csrf-token');
  });

  it('does not add a CSRF header to safe requests', async () => {
    setDocumentCookie('tabliodb_csrf_token=csrf-token');
    const calls: RequestInit[] = [];
    const fetchSpy: typeof fetch = async (_input, init = {}) => {
      calls.push(init);
      return new Response('{}');
    };
    const options = createTabliodbRequestOptions({ fetch: fetchSpy });

    await options.fetch?.('/api/auth/me', { method: 'GET' });

    const init = calls[0] ?? {};
    const headers = new Headers(init.headers);

    expect(headers.has('x-csrf-token')).toBe(false);
  });

  it('does not add a CSRF header when explicit bearer auth is used', async () => {
    setDocumentCookie('tabliodb_csrf_token=csrf-token');
    const calls: RequestInit[] = [];
    const fetchSpy: typeof fetch = async (_input, init = {}) => {
      calls.push(init);
      return new Response('{}');
    };
    const options = createTabliodbRequestOptions({
      accessToken: 'server-token',
      fetch: fetchSpy,
    });

    await options.fetch?.('/api/comments/threads', {
      headers: options.headers as unknown as HeadersInit,
      method: 'POST',
    });

    const init = calls[0] ?? {};
    const headers = new Headers(init.headers);

    expect(headers.get('authorization')).toBe('Bearer server-token');
    expect(headers.has('x-csrf-token')).toBe(false);
  });

  it('sends API key automation requests without browser-only CSRF or session proof headers', async () => {
    setDocumentCookie('tabliodb_csrf_token=csrf-token');
    const calls: RequestInit[] = [];
    const fetchSpy: typeof fetch = async (_input, init = {}) => {
      calls.push(init);
      return new Response('{}');
    };
    const options = createTabliodbRequestOptions({
      apiKey: 'tabliodb_api_key_secret',
      fetch: fetchSpy,
    });

    await options.fetch?.('/api/projects', {
      headers: options.headers as unknown as HeadersInit,
      method: 'POST',
    });

    const init = calls[0] ?? {};
    const headers = new Headers(init.headers);

    expect(headers.get('x-api-key')).toBe('tabliodb_api_key_secret');
    expect(headers.has('x-csrf-token')).toBe(false);
    expect(headers.has('x-tabliodb-session-proof-signature')).toBe(false);
  });
});

function setDocumentCookie(cookie: string) {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      cookie,
    },
  });
}
