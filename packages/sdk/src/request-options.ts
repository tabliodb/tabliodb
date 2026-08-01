import type { CustomHeaders, RequestOpts } from '@oazapfts/runtime';
import { defaults } from './fetch-client.js';

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
    // Bearer token tetap didukung untuk SDK server-side atau integrasi eksternal yang tidak memakai cookie browser.
    nextHeaders.Authorization = `Bearer ${accessToken}`;
  }

  if (apiKey) {
    // API key mengikuti header yang sama dengan guard server agar generated SDK bisa dipakai oleh automation.
    nextHeaders['x-api-key'] = apiKey;
  }

  return {
    baseUrl: requestOptions.baseUrl ?? defaults.baseUrl,
    // Cookie auth adalah jalur utama UI browser, jadi default SDK perlu mengirim credential same-origin.
    credentials: requestOptions.credentials ?? 'include',
    ...requestOptions,
    fetch: createCsrfAwareFetch(requestOptions.fetch, csrfProtection),
    headers: nextHeaders,
  };
}

export function configureTabliodbSdk(options: TabliodbClientOptions = {}): RequestOpts {
  const requestOptions = createTabliodbRequestOptions(options);

  // Oazapfts generated client membaca defaults secara live.
  Object.assign(defaults, requestOptions, {
    headers: requestOptions.headers ?? {},
  });

  return requestOptions;
}

function createCsrfAwareFetch(customFetch: typeof fetch | undefined, enabled: boolean): typeof fetch | undefined {
  if (!enabled) {
    return customFetch;
  }

  return async (input, init = {}) => {
    const method = (init.method ?? 'GET').toUpperCase();

    if (!unsafeMethods.has(method)) {
      return (customFetch ?? fetch)(input, init);
    }

    const headers = new Headers(init.headers);
    const csrfToken = readBrowserCookie(csrfCookieName);

    if (csrfToken && !hasExplicitNonCookieAuth(headers) && !headers.has(csrfHeaderName)) {
      // Browser UI memakai double-submit CSRF: cookie dibaca client, lalu dikirim balik via header state-changing request.
      headers.set(csrfHeaderName, csrfToken);
    }

    return (customFetch ?? fetch)(input, {
      ...init,
      headers,
    });
  };
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
