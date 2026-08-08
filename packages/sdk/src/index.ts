import type { CustomHeaders } from '@oazapfts/runtime';
import { defaults } from './fetch-client.js';
import { configureTabliodbSdk, type TabliodbClientOptions } from './request-options.js';

export * from './fetch-client.js';
export * from './fetch-errors.js';
export * from './request-options.js';

export type InitOptions = TabliodbClientOptions;

export function init(options: InitOptions = {}) {
  configureTabliodbSdk(options);
}

export function getBaseUrl() {
  return defaults.baseUrl;
}

export function setBaseUrl(baseUrl: string) {
  defaults.baseUrl = baseUrl;
}

export function setApiKey(apiKey: string) {
  setHeader('x-api-key', apiKey);
}

export function setAccessToken(accessToken: string) {
  setHeader('authorization', `Bearer ${accessToken}`);
}

export function setHeader(key: string, value: string) {
  assertMutableHeader(key);
  defaults.headers = {
    ...(defaults.headers ?? {}),
    [key]: value,
  };
}

export function setHeaders(headers: CustomHeaders) {
  for (const key of Object.keys(headers)) {
    assertMutableHeader(key);
  }

  defaults.headers = {
    ...(defaults.headers ?? {}),
    ...headers,
  };
}

function assertMutableHeader(key: string) {
  const normalizedKey = key.toLowerCase();

  if (normalizedKey === 'x-csrf-token') {
    throw new Error('The x-csrf-token header is managed automatically by the SDK fetch configuration.');
  }
}
