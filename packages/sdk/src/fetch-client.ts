import { TabliodbApiError } from './fetch-errors.js';

export type TabliodbClientOptions = {
  baseUrl?: string;
  accessToken?: string;
  apiKey?: string;
  fetch?: typeof globalThis.fetch;
};

export type RequestOptions = {
  body?: unknown;
  headers?: HeadersInit;
  method?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
};

export class TabliodbClient {
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly baseUrl: string;

  constructor(private readonly options: TabliodbClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? '/api';
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`, this.resolveBaseUrl());
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    const headers = new Headers(options.headers);
    if (options.body !== undefined) {
      headers.set('content-type', 'application/json');
    }

    if (this.options.accessToken) {
      headers.set('authorization', `Bearer ${this.options.accessToken}`);
    }

    if (this.options.apiKey) {
      headers.set('x-api-key', this.options.apiKey);
    }

    const response = await this.fetchImpl(url, {
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'include',
      headers,
      method: options.method ?? 'GET',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => undefined);
      throw new TabliodbApiError(error?.message ?? response.statusText, response.status, error);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  private resolveBaseUrl(): string {
    if (this.baseUrl.startsWith('http')) {
      return this.baseUrl;
    }

    // Browser builds can use relative /api, while Node/SSR callers should pass an absolute baseUrl.
    return typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  }
}
