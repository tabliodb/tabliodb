import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    -- Folder/project is an organizational boundary now; review rules live only on diagrams.
    ALTER TABLE projects
      DROP COLUMN IF EXISTS review_settings;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    -- Rollback restores the legacy column shape for older code that expected folder-level review defaults.
    ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS review_settings jsonb NOT NULL DEFAULT '{"disabledRuleKeys":[]}'::jsonb;
  `.execute(db);
}
