import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE IF EXISTS api_keys
      ADD COLUMN IF NOT EXISTS key_prefix text;

    UPDATE api_keys
    SET key_prefix = concat('legacy_', substring(encode(key_hash, 'hex') from 1 for 8))
    WHERE key_prefix IS NULL;

    ALTER TABLE IF EXISTS api_keys
      ALTER COLUMN key_prefix SET NOT NULL;

    CREATE INDEX IF NOT EXISTS api_keys_user_id_created_at_idx
      ON api_keys(user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS api_keys_active_lookup_idx
      ON api_keys(key_hash)
      WHERE revoked_at IS NULL;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS api_keys_active_lookup_idx;
    DROP INDEX IF EXISTS api_keys_user_id_created_at_idx;

    ALTER TABLE IF EXISTS api_keys
      DROP COLUMN IF EXISTS key_prefix;
  `.execute(db);
}
