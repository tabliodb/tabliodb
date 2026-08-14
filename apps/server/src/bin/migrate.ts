import { Kysely } from 'kysely';
import { loadEnv } from '../config/env.js';
import {
  assertDatabaseMigrationSucceeded,
  createDatabaseMigrationSummary,
} from '../repositories/database-migration-report.js';
import { DatabaseRepository } from '../repositories/database.repository.js';
import { getKyselyConfig } from '../utils/database.js';
import type { DB } from '../schema/index.js';

const env = loadEnv();
const db = new Kysely<DB>(getKyselyConfig(env.database.url));
const repository = new DatabaseRepository(db);

try {
  const result = await repository.migrateToLatest();
  const summary = createDatabaseMigrationSummary(result);

  for (const line of summary.lines) {
    console.log(line);
  }

  if (summary.noop) {
    // A second db:migrate should be explicit for self-hosters and CI logs: the schema is already at the latest known version.
    console.log('No pending migrations.');
  }

  assertDatabaseMigrationSucceeded(summary);
} finally {
  await db.destroy();
}
