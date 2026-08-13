import { describe, expect, it } from 'vitest';
import { TabliodbHeader } from '../constants.js';
import { createDevelopmentCorsOptions, createProductionCorsOptions, exposedResponseHeaders } from './cors.js';

type CorsOriginCallback = (error: Error | null, allowed?: boolean) => void;
type CorsOriginDelegate = (origin: string | undefined, callback: CorsOriginCallback) => void;

describe('cors options', () => {
  it('exposes operational response headers to browser clients', () => {
    expect(exposedResponseHeaders).toEqual([
      TabliodbHeader.RequestId,
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
      'Retry-After',
    ]);
  });

  it('keeps development CORS permissive but still exposes diagnostics headers', () => {
    const options = createDevelopmentCorsOptions();

    expect(options).toMatchObject({
      credentials: true,
      exposedHeaders: [...exposedResponseHeaders],
      origin: true,
    });
  });

  it('allows configured production origins', async () => {
    const options = createProductionCorsOptions(['https://app.example.com']);

    await expect(checkOrigin(options.origin as CorsOriginDelegate, 'https://app.example.com')).resolves.toEqual({
      allowed: true,
      error: null,
    });
  });

  it('allows requests without an Origin header for same-origin and server-to-server calls', async () => {
    const options = createProductionCorsOptions(['https://app.example.com']);

    await expect(checkOrigin(options.origin as CorsOriginDelegate, undefined)).resolves.toEqual({
      allowed: true,
      error: null,
    });
  });

  it('rejects unexpected production origins', async () => {
    const options = createProductionCorsOptions(['https://app.example.com']);

    await expect(checkOrigin(options.origin as CorsOriginDelegate, 'https://evil.example.com')).resolves.toEqual({
      allowed: false,
      error: 'Origin https://evil.example.com is not allowed by TABLIODB_CORS_ORIGINS',
    });
  });
});

function checkOrigin(
  origin: CorsOriginDelegate,
  value: string | undefined,
): Promise<{ allowed?: boolean; error: string | null }> {
  return new Promise((resolve) => {
    origin(value, (error, allowed) => {
      resolve({
        allowed,
        // Tests assert the operator-facing error string without throwing through the CORS middleware.
        error: error?.message ?? null,
      });
    });
  });
}
