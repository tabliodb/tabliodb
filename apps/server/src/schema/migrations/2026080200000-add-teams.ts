import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS teams (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name text NOT NULL,
      slug text NOT NULL,
      description text,
      created_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      archived_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, slug)
    );

    CREATE TABLE IF NOT EXISTS team_members (
      team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (team_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS folder_team_access (
      folder_id uuid NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      role text NOT NULL CHECK (role IN ('editor', 'commenter', 'viewer')),
      created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (folder_id, team_id)
    );

    CREATE INDEX IF NOT EXISTS teams_organization_id_idx ON teams(organization_id);
    CREATE INDEX IF NOT EXISTS team_members_user_id_idx ON team_members(user_id);
    CREATE INDEX IF NOT EXISTS folder_team_access_team_id_idx ON folder_team_access(team_id);
    CREATE INDEX IF NOT EXISTS folder_team_access_folder_id_idx ON folder_team_access(folder_id);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS folder_team_access;
    DROP TABLE IF EXISTS team_members;
    DROP TABLE IF EXISTS teams;
  `.execute(db);
}
