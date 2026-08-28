import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE IF EXISTS folders
      ADD COLUMN IF NOT EXISTS review_settings jsonb NOT NULL DEFAULT '{"disabledRuleKeys":[]}'::jsonb;

    ALTER TABLE IF EXISTS diagrams
      ADD COLUMN IF NOT EXISTS review_settings jsonb NOT NULL DEFAULT '{"disabledRuleKeys":[]}'::jsonb;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE IF EXISTS diagrams
      DROP COLUMN IF EXISTS review_settings;

    ALTER TABLE IF EXISTS folders
      DROP COLUMN IF EXISTS review_settings;
  `.execute(db);
}
