import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS password_change_required boolean NOT NULL DEFAULT false;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE users
      DROP COLUMN IF EXISTS password_change_required;
  `.execute(db);
}
