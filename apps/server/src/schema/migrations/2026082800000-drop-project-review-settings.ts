import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    -- Folder is only an organizational boundary now; review rules live only on diagrams.
    ALTER TABLE folders
      DROP COLUMN IF EXISTS review_settings;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    -- Rollback restores the legacy column shape for older code that expected folder-level review defaults.
    ALTER TABLE folders
      ADD COLUMN IF NOT EXISTS review_settings jsonb NOT NULL DEFAULT '{"disabledRuleKeys":[]}'::jsonb;
  `.execute(db);
}
