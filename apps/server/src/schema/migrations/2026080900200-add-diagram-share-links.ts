import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS diagram_share_links (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      diagram_id uuid NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
      snapshot_id uuid REFERENCES diagram_snapshots(id) ON DELETE CASCADE,
      token_hash bytea NOT NULL UNIQUE,
      target_type text NOT NULL DEFAULT 'diagram' CHECK (target_type IN ('diagram', 'snapshot')),
      label text,
      expires_at timestamptz,
      revoked_at timestamptz,
      created_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      access_count integer NOT NULL DEFAULT 0 CHECK (access_count >= 0),
      last_used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT diagram_share_links_snapshot_target_check CHECK (
        (target_type = 'diagram' AND snapshot_id IS NULL)
        OR (target_type = 'snapshot' AND snapshot_id IS NOT NULL)
      )
    );

    CREATE INDEX IF NOT EXISTS diagram_share_links_diagram_id_created_at_idx
      ON diagram_share_links(diagram_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS diagram_share_links_active_lookup_idx
      ON diagram_share_links(token_hash)
      WHERE revoked_at IS NULL;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS diagram_share_links_active_lookup_idx;
    DROP INDEX IF EXISTS diagram_share_links_diagram_id_created_at_idx;
    DROP TABLE IF EXISTS diagram_share_links;
  `.execute(db);
}
