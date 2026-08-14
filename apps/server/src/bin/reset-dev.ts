import { Kysely, sql } from 'kysely';
import { loadEnv } from '../config/env.js';
import {
  assertDatabaseMigrationSucceeded,
  createDatabaseMigrationSummary,
} from '../repositories/database-migration-report.js';
import { DatabaseRepository } from '../repositories/database.repository.js';
import type { DB } from '../schema/index.js';
import { getKyselyConfig } from '../utils/database.js';

const env = loadEnv();
const db = new Kysely<DB>(getKyselyConfig(env.database.url));
const repository = new DatabaseRepository(db);

try {
  assertDevelopmentResetAllowed(env.database.url);

  console.log('Resetting development database schema...');

  // Dropping the public schema clears app tables, Kysely migration metadata, and stale prototype objects in one explicit step.
  await sql`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO public;
  `.execute(db);

  console.log('Running migrations...');

  const result = await repository.migrateToLatest();
  const summary = createDatabaseMigrationSummary(result);

  for (const line of summary.lines) {
    console.log(line);
  }

  if (summary.noop) {
    // This is unlikely after a schema drop, but keeping the output path shared prevents reset/migrate CLI behavior from drifting.
    console.log('No pending migrations.');
  }

  assertDatabaseMigrationSucceeded(summary);
  console.log('Development database reset complete.');
} finally {
  await db.destroy();
}

function assertDevelopmentResetAllowed(databaseUrl: string): void {
  if (process.env.TABLIODB_ALLOW_DB_RESET === 'true') {
    return;
  }

  const parsedUrl = new URL(databaseUrl);
  const host = parsedUrl.hostname.toLowerCase();
  const databaseName = parsedUrl.pathname.replace(/^\//, '').toLowerCase();
  const safeLocalHosts = new Set(['localhost', '127.0.0.1', '::1']);
  const looksLikeTabliodbDevDatabase = databaseName === 'tabliodb' || databaseName.endsWith('_dev');

  if (safeLocalHosts.has(host) && looksLikeTabliodbDevDatabase) {
    return;
  }

  throw new Error(
    [
      'Refusing to reset a database that does not look local/development.',
      `DATABASE_URL host="${host}" database="${databaseName}"`,
      'Set TABLIODB_ALLOW_DB_RESET=true only when you are certain this is disposable development data.',
    ].join('\n'),
  );
}
