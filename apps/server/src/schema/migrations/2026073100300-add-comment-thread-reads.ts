import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS comment_thread_reads (
      thread_id uuid NOT NULL REFERENCES comment_threads(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_read_comment_id uuid REFERENCES comments(id) ON DELETE SET NULL,
      last_read_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (thread_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS comment_thread_reads_user_updated_idx
      ON comment_thread_reads(user_id, updated_at DESC);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS comment_thread_reads_user_updated_idx;
    DROP TABLE IF EXISTS comment_thread_reads;
  `.execute(db);
}
