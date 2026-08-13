import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const managedEnvKeys = [
  'NODE_ENV',
  'TABLIODB_BACKGROUND_JOB_SHUTDOWN_TIMEOUT_MS',
  'TABLIODB_CONTENT_SECURITY_POLICY',
  'TABLIODB_CORS_ORIGINS',
  'TABLIODB_CSP_CONNECT_SOURCES',
  'TABLIODB_PUBLIC_URL',
  'TABLIODB_REALTIME_PORT',
  'TABLIODB_REALTIME_PUBLIC_URL',
  'TABLIODB_TRUST_PROXY',
  'TABLIODB_WEB_PUBLIC_URL',
] as const;

const originalEnv = new Map<string, string | undefined>();

describe(loadEnv.name, () => {
  beforeEach(() => {
    for (const key of managedEnvKeys) {
      originalEnv.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of managedEnvKeys) {
      const value = originalEnv.get(key);

      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    originalEnv.clear();
  });

  it('builds production CORS and CSP sources from public URLs plus explicit allowlists', () => {
    process.env.NODE_ENV = 'production';
    process.env.TABLIODB_PUBLIC_URL = 'https://api.example.com';
    process.env.TABLIODB_WEB_PUBLIC_URL = 'https://app.example.com/workspace';
    process.env.TABLIODB_REALTIME_PORT = '9443';
    process.env.TABLIODB_REALTIME_PUBLIC_URL = 'wss://realtime.example.com/live';
    process.env.TABLIODB_CORS_ORIGINS = 'https://admin.example.com,not-a-url';
    process.env.TABLIODB_CSP_CONNECT_SOURCES = 'https://metrics.example.com/collect,wss://presence.example.com/socket';

    const env = loadEnv();

    expect(env.security.corsOrigins).toEqual([
      'https://api.example.com',
      'https://app.example.com',
      'https://admin.example.com',
    ]);
    expect(env.security.cspConnectSources).toEqual([
      'https://api.example.com',
      'https://app.example.com',
      'wss://realtime.example.com',
      'wss://app.example.com:9443',
      'https://metrics.example.com',
      'wss://presence.example.com',
    ]);
  });

  it('parses trusted proxy values for common reverse proxy deployments', () => {
    process.env.TABLIODB_TRUST_PROXY = '1';

    expect(loadEnv().security.trustedProxy).toBe(1);

    // Express supports named proxy presets, so non-boolean strings are intentionally preserved.
    process.env.TABLIODB_TRUST_PROXY = 'loopback';

    expect(loadEnv().security.trustedProxy).toBe('loopback');
  });

  it('can disable CSP explicitly for unusual proxy or plugin deployments', () => {
    process.env.TABLIODB_CONTENT_SECURITY_POLICY = 'false';

    expect(loadEnv().security.contentSecurityPolicy).toBe(false);
  });

  it('parses the background job shutdown timeout for graceful container stops', () => {
    process.env.TABLIODB_BACKGROUND_JOB_SHUTDOWN_TIMEOUT_MS = '7500';

    // A bounded wait keeps SIGTERM graceful without letting a broken email/import dependency hang the container forever.
    expect(loadEnv().backgroundJobs.shutdownTimeoutMs).toBe(7_500);
  });
});
