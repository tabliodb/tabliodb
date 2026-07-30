import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS files (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind text NOT NULL CHECK (kind IN ('avatar', 'comment_attachment')),
      storage_key text NOT NULL UNIQUE,
      original_name text,
      mime_type text NOT NULL,
      byte_size bigint NOT NULL CHECK (byte_size >= 0),
      checksum_sha256 text,
      width integer,
      height integer,
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'rejected')),
      metadata jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS file_variants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      file_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      variant text NOT NULL,
      storage_key text NOT NULL UNIQUE,
      mime_type text NOT NULL,
      byte_size bigint NOT NULL CHECK (byte_size >= 0),
      width integer,
      height integer,
      metadata jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (file_id, variant)
    );

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS avatar_file_id uuid;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_avatar_file_id_fk'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_avatar_file_id_fk
          FOREIGN KEY (avatar_file_id) REFERENCES files(id) ON DELETE SET NULL;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS files_owner_kind_created_at_idx ON files(owner_id, kind, created_at DESC);
    CREATE INDEX IF NOT EXISTS files_status_created_at_idx ON files(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS file_variants_file_id_idx ON file_variants(file_id);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS users_avatar_file_id_fk;
    ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS avatar_file_id;
    DROP TABLE IF EXISTS file_variants;
    DROP TABLE IF EXISTS files;
  `.execute(db);
}
