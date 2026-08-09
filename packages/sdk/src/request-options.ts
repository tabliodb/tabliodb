import type { CustomHeaders, RequestOpts } from '@oazapfts/runtime';
import { defaults } from './fetch-client.js';
import { createSessionProofHeaders } from './session-binding.js';

export type TabliodbClientOptions = Omit<RequestOpts, 'headers'> & {
  accessToken?: string;
  apiKey?: string;
  csrfProtection?: boolean;
  headers?: CustomHeaders;
};

const csrfCookieName = 'tabliodb_csrf_token';
const csrfHeaderName = 'x-csrf-token';
const unsafeMethods = new Set(['DELETE', 'PATCH', 'POST', 'PUT']);

export function createTabliodbRequestOptions(options: TabliodbClientOptions = {}): RequestOpts {
  const { accessToken, apiKey, csrfProtection = true, headers, ...requestOptions } = options;
  const nextHeaders: CustomHeaders = { ...(headers ?? {}) };

  if (accessToken) {
    nextHeaders.Authorization = `Bearer ${accessToken}`;
  }

  if (apiKey) {
    nextHeaders['x-api-key'] = apiKey;
  }

  return {
    baseUrl: requestOptions.baseUrl ?? defaults.baseUrl,
    credentials: requestOptions.credentials ?? 'include',
    ...requestOptions,
    fetch: createSecurityAwareFetch(requestOptions.fetch, csrfProtection),
    headers: nextHeaders,
  };
}

export function configureTabliodbSdk(options: TabliodbClientOptions = {}): RequestOpts {
  const requestOptions = createTabliodbRequestOptions(options);

  Object.assign(defaults, requestOptions, {
    headers: requestOptions.headers ?? {},
  });

  return requestOptions;
}

function createSecurityAwareFetch(
  customFetch: typeof fetch | undefined,
  csrfEnabled: boolean,
): typeof fetch | undefined {
  return async (input, init = {}) => {
    const method = (init.method ?? (isRequest(input) ? input.method : 'GET')).toUpperCase();
    const headers = new Headers(init.headers);

    if (csrfEnabled && unsafeMethods.has(method)) {
      const csrfToken = readBrowserCookie(csrfCookieName);

      if (csrfToken && !hasExplicitNonCookieAuth(headers) && !headers.has(csrfHeaderName)) {
        headers.set(csrfHeaderName, csrfToken);
      }
    }

    const proofHeaders = await createSessionProofHeaders(input, {
      ...init,
      headers,
      method,
    });

    for (const [key, value] of Object.entries(proofHeaders)) {
      // Proof headers are derived per request because nonce and timestamp must never be reused.
      headers.set(key, value);
    }

    return (customFetch ?? fetch)(input, {
      ...init,
      headers,
      method,
    });
  };
}

function isRequest(input: RequestInfo | URL): input is Request {
  return typeof Request !== 'undefined' && input instanceof Request;
}

function hasExplicitNonCookieAuth(headers: Headers): boolean {
  return (
    headers.has('authorization') ||
    headers.has('x-api-key') ||
    headers.has('x-tabliodb-session-token') ||
    headers.has('x-tabliodb-user-token')
  );
}

function readBrowserCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.slice(prefix.length));
}
