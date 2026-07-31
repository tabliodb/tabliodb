import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS comment_mentions (
      comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      mentioned_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (comment_id, mentioned_user_id)
    );

    CREATE INDEX IF NOT EXISTS comment_mentions_user_created_idx
      ON comment_mentions(mentioned_user_id, created_at DESC);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS comment_mentions_user_created_idx;
    DROP TABLE IF EXISTS comment_mentions;
  `.execute(db);
}
