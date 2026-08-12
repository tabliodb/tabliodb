import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type TabliodbEnv = {
  server: {
    host?: string;
    port: number;
    publicUrl: string;
    webPublicUrl: string;
    webDistPath: string;
  };
  database: {
    url: string;
  };
  redis: {
    url?: string;
  };
  realtime: {
    enabled: boolean;
    persistDebounceMs: number;
    port: number;
    redisUrl?: string;
  };
  auth: {
    cookieSecure: boolean;
    exposePasswordResetToken: boolean;
  };
  security: {
    contentSecurityPolicy: boolean;
    corsOrigins: string[];
    cspConnectSources: string[];
    trustedProxy: boolean | number | string;
  };
  backgroundJobs: {
    batchSize: number;
    enabled: boolean;
    lockTtlMs: number;
    pollIntervalMs: number;
  };
  storage: {
    localPath: string;
  };
  secrets: {
    encryptionKey?: string;
  };
  metrics: {
    enabled: boolean;
  };
};

function findUp(filename: string, startDirectory: string): string | null {
  let currentDirectory = startDirectory;

  while (true) {
    const candidate = path.join(currentDirectory, filename);

    if (existsSync(candidate)) {
      return candidate;
    }

    const parentDirectory = path.dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      return null;
    }

    currentDirectory = parentDirectory;
  }
}

function loadRootEnvFile(): void {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const explicitEnvFile = process.env.TABLIODB_ENV_FILE
    ? path.resolve(process.cwd(), process.env.TABLIODB_ENV_FILE)
    : null;
  const envFile = explicitEnvFile ?? findUp('.env', process.cwd()) ?? findUp('.env', moduleDirectory);

  if (envFile) {
    // Load the repository-local env file before parsing values so dev, migration, and compiled runtime commands share one config source.
    loadDotenv({ path: envFile, override: false });
  }
}

loadRootEnvFile();

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw ? Number(raw) : fallback;
  return Number.isFinite(value) ? value : fallback;
}

function booleanFromEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();

  if (!raw) {
    return fallback;
  }

  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
}

function stringListFromEnv(name: string): string[] {
  return (process.env[name] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function normalizeConnectSource(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed === "'self'" || /^[a-z][a-z\d+.-]*:$/.test(trimmed)) {
    return trimmed;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function realtimeWebSocketOrigin(publicUrl: string, realtimePort: number): string | null {
  try {
    const url = new URL(publicUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.port = String(realtimePort);
    return url.origin;
  } catch {
    return null;
  }
}

function trustProxyFromEnv(): boolean | number | string {
  const raw = process.env.TABLIODB_TRUST_PROXY?.trim();

  if (!raw || raw.toLowerCase() === 'false') {
    return false;
  }

  if (raw.toLowerCase() === 'true') {
    return true;
  }

  const numeric = Number(raw);

  if (Number.isInteger(numeric) && numeric >= 0) {
    return numeric;
  }

  // Express accepts named presets such as "loopback" and comma-separated subnet lists for reverse proxy deployments.
  return raw;
}

export function loadEnv(): TabliodbEnv {
  const server = {
    host: process.env.TABLIODB_HOST || undefined,
    port: numberFromEnv('TABLIODB_PORT', 4000),
    publicUrl: process.env.TABLIODB_PUBLIC_URL || 'http://localhost:4000',
    webPublicUrl: process.env.TABLIODB_WEB_PUBLIC_URL || process.env.TABLIODB_PUBLIC_URL || 'http://localhost:4000',
    webDistPath: path.resolve(
      process.env.TABLIODB_WEB_DIST_PATH || path.join(process.cwd(), 'apps', 'server', 'public'),
    ),
  };
  const realtime = {
    enabled: process.env.TABLIODB_REALTIME_ENABLED !== 'false',
    persistDebounceMs: numberFromEnv('TABLIODB_REALTIME_PERSIST_DEBOUNCE_MS', 1_000),
    port: numberFromEnv('TABLIODB_REALTIME_PORT', 1234),
    redisUrl: process.env.TABLIODB_REALTIME_REDIS_URL || process.env.REDIS_URL || undefined,
  };

  return {
    server,
    database: {
      url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tabliodb',
    },
    redis: {
      url: process.env.REDIS_URL || undefined,
    },
    realtime,
    auth: {
      cookieSecure: process.env.TABLIODB_COOKIE_SECURE === 'true',
      exposePasswordResetToken:
        process.env.TABLIODB_EXPOSE_PASSWORD_RESET_TOKEN === 'true' ||
        (process.env.TABLIODB_EXPOSE_PASSWORD_RESET_TOKEN !== 'false' && process.env.NODE_ENV !== 'production'),
    },
    security: {
      contentSecurityPolicy: booleanFromEnv('TABLIODB_CONTENT_SECURITY_POLICY', true),
      corsOrigins: uniqueValues([
        normalizeOrigin(server.publicUrl),
        normalizeOrigin(server.webPublicUrl),
        ...stringListFromEnv('TABLIODB_CORS_ORIGINS').map(normalizeOrigin),
      ]),
      cspConnectSources: uniqueValues([
        normalizeConnectSource(server.publicUrl),
        normalizeConnectSource(server.webPublicUrl),
        normalizeConnectSource(process.env.TABLIODB_REALTIME_PUBLIC_URL || ''),
        realtimeWebSocketOrigin(server.webPublicUrl, realtime.port),
        ...stringListFromEnv('TABLIODB_CSP_CONNECT_SOURCES').map(normalizeConnectSource),
      ]),
      trustedProxy: trustProxyFromEnv(),
    },
    backgroundJobs: {
      batchSize: numberFromEnv('TABLIODB_BACKGROUND_JOB_BATCH_SIZE', 10),
      enabled: process.env.TABLIODB_BACKGROUND_JOBS_ENABLED !== 'false',
      lockTtlMs: numberFromEnv('TABLIODB_BACKGROUND_JOB_LOCK_TTL_MS', 120_000),
      pollIntervalMs: numberFromEnv('TABLIODB_BACKGROUND_JOB_POLL_INTERVAL_MS', 2_500),
    },
    storage: {
      localPath: path.resolve(process.env.TABLIODB_STORAGE_PATH || path.join(process.cwd(), 'data', 'uploads')),
    },
    secrets: {
      encryptionKey: process.env.TABLIODB_SECRET_KEY || undefined,
    },
    metrics: {
      enabled:
        process.env.TABLIODB_METRICS_ENABLED === 'true' ||
        (process.env.TABLIODB_METRICS_ENABLED !== 'false' && process.env.NODE_ENV !== 'production'),
    },
  };
}
