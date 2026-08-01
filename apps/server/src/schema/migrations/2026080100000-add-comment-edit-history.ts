import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS comment_edit_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      edited_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      previous_body_json jsonb NOT NULL,
      previous_body_text text NOT NULL,
      next_body_json jsonb NOT NULL,
      next_body_text text NOT NULL,
      body_format text NOT NULL DEFAULT 'lexical' CHECK (body_format IN ('lexical')),
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS comment_edit_history_comment_created_idx
      ON comment_edit_history(comment_id, created_at DESC);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS comment_edit_history_comment_created_idx;
    DROP TABLE IF EXISTS comment_edit_history;
  `.execute(db);
}
