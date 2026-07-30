import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE comments
      ADD COLUMN IF NOT EXISTS parent_comment_id uuid;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'comments_parent_comment_id_fk'
      ) THEN
        ALTER TABLE comments
          ADD CONSTRAINT comments_parent_comment_id_fk
          FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE SET NULL;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS comments_thread_parent_created_idx
      ON comments(thread_id, parent_comment_id, created_at);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS comments_thread_parent_created_idx;
    ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_parent_comment_id_fk;
    ALTER TABLE comments DROP COLUMN IF EXISTS parent_comment_id;
  `.execute(db);
}
