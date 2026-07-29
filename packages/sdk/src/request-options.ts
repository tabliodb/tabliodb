import type { CustomHeaders, RequestOpts } from '@oazapfts/runtime';
import { defaults } from './fetch-client.js';

export type TabliodbClientOptions = Omit<RequestOpts, 'headers'> & {
  accessToken?: string;
  apiKey?: string;
  headers?: CustomHeaders;
};

export function createTabliodbRequestOptions(options: TabliodbClientOptions = {}): RequestOpts {
  const { accessToken, apiKey, headers, ...requestOptions } = options;
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
    headers: nextHeaders,
  };
}

export function configureTabliodbSdk(options: TabliodbClientOptions = {}): RequestOpts {
  const requestOptions = createTabliodbRequestOptions(options);

  // Oazapfts generated client membaca defaults secara live; mutasi terkendali ini meniru pola SDK generated Immich.
  Object.assign(defaults, requestOptions, {
    headers: requestOptions.headers ?? {},
  });

  return requestOptions;
}
