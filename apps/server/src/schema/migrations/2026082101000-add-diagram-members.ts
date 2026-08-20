import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS diagram_members (
      diagram_id uuid NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role text NOT NULL CHECK (role IN ('owner', 'editor', 'commenter', 'viewer')),
      created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (diagram_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS diagram_team_access (
      diagram_id uuid NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
      team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      role text NOT NULL CHECK (role IN ('editor', 'commenter', 'viewer')),
      created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (diagram_id, team_id)
    );

    ALTER TABLE invitations
      ADD COLUMN IF NOT EXISTS diagram_id uuid;

    ALTER TABLE invitations
      ADD COLUMN IF NOT EXISTS diagram_role text;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'invitations_diagram_id_fk'
      ) THEN
        ALTER TABLE invitations
          ADD CONSTRAINT invitations_diagram_id_fk
          FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'invitations_diagram_role_check'
      ) THEN
        ALTER TABLE invitations
          ADD CONSTRAINT invitations_diagram_role_check
          CHECK (diagram_role IS NULL OR diagram_role IN ('owner', 'editor', 'commenter', 'viewer'));
      END IF;
    END $$;

    INSERT INTO diagram_members (diagram_id, user_id, role, created_by_id)
    SELECT diagrams.id, diagrams.created_by_id, 'owner', diagrams.created_by_id
    FROM diagrams
    WHERE diagrams.created_by_id IS NOT NULL
    ON CONFLICT (diagram_id, user_id) DO NOTHING;

    CREATE INDEX IF NOT EXISTS diagram_members_user_id_idx
      ON diagram_members(user_id);

    CREATE INDEX IF NOT EXISTS diagram_team_access_team_id_idx
      ON diagram_team_access(team_id);

    CREATE INDEX IF NOT EXISTS diagram_team_access_diagram_id_idx
      ON diagram_team_access(diagram_id);

    CREATE INDEX IF NOT EXISTS invitations_diagram_id_idx
      ON invitations(diagram_id);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS invitations_diagram_id_idx;
    DROP INDEX IF EXISTS diagram_team_access_diagram_id_idx;
    DROP INDEX IF EXISTS diagram_team_access_team_id_idx;
    DROP INDEX IF EXISTS diagram_members_user_id_idx;
    ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_diagram_role_check;
    ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_diagram_id_fk;
    ALTER TABLE invitations DROP COLUMN IF EXISTS diagram_role;
    ALTER TABLE invitations DROP COLUMN IF EXISTS diagram_id;
    DROP TABLE IF EXISTS diagram_team_access;
    DROP TABLE IF EXISTS diagram_members;
  `.execute(db);
}
