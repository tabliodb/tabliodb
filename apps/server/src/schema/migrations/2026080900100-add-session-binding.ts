import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE sessions
      ADD COLUMN IF NOT EXISTS binding_algorithm text,
      ADD COLUMN IF NOT EXISTS binding_key_fingerprint text,
      ADD COLUMN IF NOT EXISTS binding_public_key_jwk jsonb,
      ADD COLUMN IF NOT EXISTS binding_required boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS risk_score integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
      ADD COLUMN IF NOT EXISTS last_ip_address inet,
      ADD COLUMN IF NOT EXISTS last_user_agent_hash text,
      ADD COLUMN IF NOT EXISTS revoked_reason text;

    CREATE INDEX IF NOT EXISTS sessions_binding_key_fingerprint_idx
      ON sessions(binding_key_fingerprint)
      WHERE binding_key_fingerprint IS NOT NULL;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS sessions_binding_key_fingerprint_idx;

    ALTER TABLE sessions
      DROP COLUMN IF EXISTS revoked_reason,
      DROP COLUMN IF EXISTS last_user_agent_hash,
      DROP COLUMN IF EXISTS last_ip_address,
      DROP COLUMN IF EXISTS last_seen_at,
      DROP COLUMN IF EXISTS risk_score,
      DROP COLUMN IF EXISTS binding_required,
      DROP COLUMN IF EXISTS binding_public_key_jwk,
      DROP COLUMN IF EXISTS binding_key_fingerprint,
      DROP COLUMN IF EXISTS binding_algorithm;
  `.execute(db);
}
