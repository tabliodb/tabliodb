import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS diagram_review_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      diagram_id uuid NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
      snapshot_id uuid REFERENCES diagram_snapshots(id) ON DELETE SET NULL,
      action text NOT NULL CHECK (action IN ('commented', 'approved', 'changes_requested')),
      previous_status text NOT NULL CHECK (previous_status IN ('draft', 'reviewed', 'approved', 'changes_requested')),
      next_status text NOT NULL CHECK (next_status IN ('draft', 'reviewed', 'approved', 'changes_requested')),
      message text,
      created_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS diagram_review_events_diagram_created_idx
      ON diagram_review_events(diagram_id, created_at DESC, id DESC);

    CREATE INDEX IF NOT EXISTS diagram_review_events_actor_created_idx
      ON diagram_review_events(created_by_id, created_at DESC);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS diagram_review_events;
  `.execute(db);
}
