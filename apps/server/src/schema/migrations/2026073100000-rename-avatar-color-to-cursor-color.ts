import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'avatarColor'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'cursor_color'
      ) THEN
        ALTER TABLE users RENAME COLUMN "avatarColor" TO cursor_color;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'avatar_color'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'cursor_color'
      ) THEN
        ALTER TABLE users RENAME COLUMN avatar_color TO cursor_color;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'cursorColor'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'cursor_color'
      ) THEN
        ALTER TABLE users RENAME COLUMN "cursorColor" TO cursor_color;
      END IF;

      ALTER TABLE users ADD COLUMN IF NOT EXISTS cursor_color text;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'avatar_color'
      ) THEN
        UPDATE users
        SET cursor_color = COALESCE(cursor_color, avatar_color);

        ALTER TABLE users DROP COLUMN avatar_color;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'avatarColor'
      ) THEN
        UPDATE users
        SET cursor_color = COALESCE(cursor_color, "avatarColor");

        ALTER TABLE users DROP COLUMN "avatarColor";
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'cursorColor'
      ) THEN
        UPDATE users
        SET cursor_color = COALESCE(cursor_color, "cursorColor");

        ALTER TABLE users DROP COLUMN "cursorColor";
      END IF;

      UPDATE users
      SET cursor_color = '#58cc02'
      WHERE cursor_color IS NULL;

      ALTER TABLE users
        ALTER COLUMN cursor_color SET DEFAULT '#58cc02',
        ALTER COLUMN cursor_color SET NOT NULL;
    END $$;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'cursor_color'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'avatar_color'
      ) THEN
        ALTER TABLE users RENAME COLUMN cursor_color TO avatar_color;
      END IF;
    END $$;
  `.execute(db);
}
