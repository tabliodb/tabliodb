import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      token_hash bytea NOT NULL UNIQUE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL,
      consumed_at timestamptz,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS password_reset_tokens_user_created_at_idx
      ON password_reset_tokens(user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS password_reset_tokens_active_idx
      ON password_reset_tokens(user_id, expires_at)
      WHERE consumed_at IS NULL AND revoked_at IS NULL;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS password_reset_tokens;
  `.execute(db);
}
