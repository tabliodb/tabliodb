import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS background_jobs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      type text NOT NULL,
      queue text NOT NULL DEFAULT 'default',
      status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'dead')),
      payload jsonb NOT NULL DEFAULT '{}',
      result jsonb,
      error jsonb,
      attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
      priority integer NOT NULL DEFAULT 0,
      scheduled_at timestamptz NOT NULL DEFAULT now(),
      locked_at timestamptz,
      locked_by text,
      started_at timestamptz,
      completed_at timestamptz,
      failed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS background_jobs_poll_idx
      ON background_jobs(queue, status, priority DESC, scheduled_at ASC, created_at ASC);

    CREATE INDEX IF NOT EXISTS background_jobs_locked_idx
      ON background_jobs(status, locked_at)
      WHERE status = 'running';
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS background_jobs_locked_idx;
    DROP INDEX IF EXISTS background_jobs_poll_idx;
    DROP TABLE IF EXISTS background_jobs;
  `.execute(db);
}
