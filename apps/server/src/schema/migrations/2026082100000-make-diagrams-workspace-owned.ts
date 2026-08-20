import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE diagrams
      ADD COLUMN IF NOT EXISTS organization_id uuid;

    UPDATE diagrams
    SET organization_id = projects.organization_id
    FROM projects
    WHERE diagrams.project_id = projects.id
      AND diagrams.organization_id IS NULL;

    ALTER TABLE diagrams
      ALTER COLUMN organization_id SET NOT NULL;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'diagrams_organization_id_fk'
      ) THEN
        ALTER TABLE diagrams
          ADD CONSTRAINT diagrams_organization_id_fk
          FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
      END IF;
    END $$;

    ALTER TABLE diagrams
      DROP CONSTRAINT IF EXISTS diagrams_project_id_fkey;

    ALTER TABLE diagrams
      ALTER COLUMN project_id DROP NOT NULL;

    ALTER TABLE diagrams
      ADD CONSTRAINT diagrams_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

    ALTER TABLE diagrams
      DROP CONSTRAINT IF EXISTS diagrams_project_id_slug_key;

    CREATE UNIQUE INDEX IF NOT EXISTS diagrams_project_slug_unique_idx
      ON diagrams(project_id, slug)
      WHERE project_id IS NOT NULL AND slug IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS diagrams_workspace_root_slug_unique_idx
      ON diagrams(organization_id, slug)
      WHERE project_id IS NULL AND slug IS NOT NULL;

    CREATE INDEX IF NOT EXISTS diagrams_organization_updated_at_idx
      ON diagrams(organization_id, updated_at DESC);

    ALTER TABLE user_editor_preferences
      DROP CONSTRAINT IF EXISTS user_editor_preferences_diagram_requires_project_check;
  `.execute(db);
}

export async function down(): Promise<void> {
  // This migration intentionally has no destructive down path because diagrams can now exist outside folders.
}
