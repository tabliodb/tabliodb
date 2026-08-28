import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS user_editor_preferences (
      user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      last_opened_organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
      last_opened_folder_id uuid REFERENCES folders(id) ON DELETE SET NULL,
      last_opened_diagram_id uuid REFERENCES diagrams(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT user_editor_preferences_target_hierarchy_check CHECK (
        last_opened_organization_id IS NOT NULL
        OR (last_opened_folder_id IS NULL AND last_opened_diagram_id IS NULL)
      ),
      CONSTRAINT user_editor_preferences_diagram_requires_folder_check CHECK (
        last_opened_diagram_id IS NULL OR last_opened_folder_id IS NOT NULL
      )
    );

    CREATE INDEX IF NOT EXISTS user_editor_preferences_last_opened_folder_id_idx
      ON user_editor_preferences(last_opened_folder_id)
      WHERE last_opened_folder_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS user_editor_preferences_last_opened_diagram_id_idx
      ON user_editor_preferences(last_opened_diagram_id)
      WHERE last_opened_diagram_id IS NOT NULL;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS user_editor_preferences_last_opened_diagram_id_idx;
    DROP INDEX IF EXISTS user_editor_preferences_last_opened_folder_id_idx;
    DROP TABLE IF EXISTS user_editor_preferences;
  `.execute(db);
}
