import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';
import { TabliodbHeader } from '../constants.js';

export const exposedResponseHeaders = [
  TabliodbHeader.RequestId,
  'RateLimit-Limit',
  'RateLimit-Remaining',
  'RateLimit-Reset',
  'Retry-After',
] as const;

export function createDevelopmentCorsOptions(): CorsOptions {
  return {
    credentials: true,
    // Development often runs Vite and Nest on different origins, so expose diagnostics headers there too.
    exposedHeaders: [...exposedResponseHeaders],
    origin: true,
  };
}

export function createProductionCorsOptions(allowedOrigins: string[]): CorsOptions {
  const origins = new Set(allowedOrigins);

  return {
    credentials: true,
    // Browser clients cannot read non-simple response headers unless the API explicitly exposes them through CORS.
    exposedHeaders: [...exposedResponseHeaders],
    origin: (origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) => {
      if (!origin || origins.has(origin)) {
        // Same-origin browser requests and server-to-server calls can omit Origin, so they should not be rejected by CORS.
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by TABLIODB_CORS_ORIGINS`), false);
    },
  };
}
