import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type TabliodbEnv = {
  server: {
    host?: string;
    port: number;
    publicUrl: string;
  };
  database: {
    url: string;
  };
  realtime: {
    enabled: boolean;
    port: number;
    redisUrl?: string;
  };
  auth: {
    cookieSecure: boolean;
    exposePasswordResetToken: boolean;
  };
  storage: {
    localPath: string;
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

export function loadEnv(): TabliodbEnv {
  return {
    server: {
      host: process.env.TABLIODB_HOST || undefined,
      port: numberFromEnv('TABLIODB_PORT', 4000),
      publicUrl: process.env.TABLIODB_PUBLIC_URL || 'http://localhost:4000',
    },
    database: {
      url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tabliodb',
    },
    realtime: {
      enabled: process.env.TABLIODB_REALTIME_ENABLED !== 'false',
      port: numberFromEnv('TABLIODB_REALTIME_PORT', 1234),
      redisUrl: process.env.REDIS_URL || undefined,
    },
    auth: {
      cookieSecure: process.env.TABLIODB_COOKIE_SECURE === 'true',
      exposePasswordResetToken:
        process.env.TABLIODB_EXPOSE_PASSWORD_RESET_TOKEN === 'true' ||
        (process.env.TABLIODB_EXPOSE_PASSWORD_RESET_TOKEN !== 'false' && process.env.NODE_ENV !== 'production'),
    },
    storage: {
      localPath: path.resolve(process.env.TABLIODB_STORAGE_PATH || path.join(process.cwd(), 'data', 'uploads')),
    },
  };
}
