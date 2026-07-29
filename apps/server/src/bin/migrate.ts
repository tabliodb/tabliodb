import { Kysely } from 'kysely';
import { loadEnv } from '../config/env.js';
import { DatabaseRepository } from '../repositories/database.repository.js';
import { getKyselyConfig } from '../utils/database.js';
import type { DB } from '../schema/index.js';

const env = loadEnv();
const db = new Kysely<DB>(getKyselyConfig(env.database.url));
const repository = new DatabaseRepository(db);

try {
  const result = await repository.migrateToLatest();
  for (const item of result.results ?? []) {
    console.log(`${item.status}: ${item.migrationName}`);
  }

  if (result.error) {
    // Migration failures must fail the CLI so local setup and CI do not continue with a half-created schema.
    throw result.error;
  }
} finally {
  await db.destroy();
}
