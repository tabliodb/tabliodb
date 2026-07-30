import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // pgcrypto provides gen_random_uuid(); citext keeps user emails unique without case-sensitive duplicates.
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`.execute(db);
  await sql`CREATE EXTENSION IF NOT EXISTS citext`.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email citext NOT NULL UNIQUE,
      name text NOT NULL,
      password_hash text,
      avatar_color text,
      locale text,
      timezone text,
      is_disabled boolean NOT NULL DEFAULT false,
      disabled_at timestamptz,
      last_login_at timestamptz,
      password_changed_at timestamptz,
      metadata jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      is_secret boolean NOT NULL DEFAULT false,
      updated_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS instance_members (
      user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      role text NOT NULL CHECK (role IN ('owner', 'admin')),
      created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      token_hash bytea NOT NULL UNIQUE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_type text NOT NULL DEFAULT '',
      device_os text NOT NULL DEFAULT '',
      user_agent text,
      ip_address inet,
      app_version text,
      expires_at timestamptz,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      slug text NOT NULL UNIQUE,
      created_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      default_project_role text,
      allow_member_project_create boolean NOT NULL DEFAULT true,
      metadata jsonb NOT NULL DEFAULT '{}',
      archived_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS organization_members (
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role text NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'guest')),
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended')),
      joined_at timestamptz,
      created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (organization_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      project_id uuid,
      email citext NOT NULL,
      organization_role text NOT NULL DEFAULT 'member' CHECK (organization_role IN ('owner', 'admin', 'member', 'guest')),
      project_role text CHECK (project_role IN ('owner', 'editor', 'commenter', 'viewer')),
      token_hash bytea NOT NULL UNIQUE,
      message text,
      invited_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      accepted_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
      accepted_at timestamptz,
      revoked_at timestamptz,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name text NOT NULL,
      slug text NOT NULL,
      description text,
      default_dialect text NOT NULL DEFAULT 'postgresql',
      review_settings jsonb NOT NULL DEFAULT '{"disabledRuleKeys":[]}'::jsonb,
      visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'organization')),
      created_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      archived_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, slug)
    );

    ALTER TABLE invitations
      ADD CONSTRAINT invitations_project_id_fk
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

    CREATE TABLE IF NOT EXISTS project_members (
      project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role text NOT NULL CHECK (role IN ('owner', 'editor', 'commenter', 'viewer')),
      created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      key_hash bytea NOT NULL UNIQUE,
      name text NOT NULL,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
      project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
      permissions text[] NOT NULL DEFAULT '{}',
      last_used_at timestamptz,
      expires_at timestamptz,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS diagrams (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name text NOT NULL,
      slug text,
      dialect text NOT NULL DEFAULT 'postgresql' CHECK (dialect IN ('postgresql', 'mysql', 'sqlite', 'mariadb', 'sqlserver')),
      status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'approved', 'changes_requested')),
      current_snapshot_id uuid,
      last_snapshot_version integer NOT NULL DEFAULT 0,
      review_settings jsonb NOT NULL DEFAULT '{"disabledRuleKeys":[]}'::jsonb,
      created_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      archived_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (project_id, slug)
    );

    CREATE TABLE IF NOT EXISTS diagram_documents (
      diagram_id uuid PRIMARY KEY REFERENCES diagrams(id) ON DELETE CASCADE,
      yjs_state bytea,
      state_vector bytea,
      version integer NOT NULL DEFAULT 0,
      checksum text,
      schema_cache jsonb,
      updated_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS diagram_snapshots (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      diagram_id uuid NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
      version integer NOT NULL,
      message text,
      snapshot jsonb NOT NULL,
      checksum text,
      created_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      restored_from_snapshot_id uuid REFERENCES diagram_snapshots(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (diagram_id, version)
    );

    ALTER TABLE diagrams
      ADD CONSTRAINT diagrams_current_snapshot_id_fk
      FOREIGN KEY (current_snapshot_id) REFERENCES diagram_snapshots(id) ON DELETE SET NULL;

    CREATE TABLE IF NOT EXISTS diagram_entity_index (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      diagram_id uuid NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
      entity_type text NOT NULL CHECK (entity_type IN ('table', 'column', 'relationship', 'index', 'enum', 'check', 'note', 'group')),
      entity_id text NOT NULL,
      parent_entity_id text,
      name text NOT NULL,
      path text NOT NULL,
      search_text text NOT NULL,
      metadata jsonb NOT NULL DEFAULT '{}',
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (diagram_id, entity_type, entity_id)
    );

    CREATE TABLE IF NOT EXISTS diagram_review_signals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      diagram_id uuid NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
      rule_key text NOT NULL,
      severity text NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'success')),
      target_type text NOT NULL CHECK (target_type IN ('diagram', 'table', 'column', 'relationship', 'index', 'enum', 'check', 'note', 'group')),
      target_id text,
      message text NOT NULL,
      metadata jsonb NOT NULL DEFAULT '{}',
      ignored_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
      ignored_at timestamptz,
      generated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS comment_threads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      diagram_id uuid NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
      target_type text NOT NULL CHECK (target_type IN ('diagram', 'table', 'column', 'relationship', 'index', 'enum', 'check', 'note', 'group')),
      target_id text,
      status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
      resolved_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
      resolved_at timestamptz,
      created_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      thread_id uuid NOT NULL REFERENCES comment_threads(id) ON DELETE CASCADE,
      body text NOT NULL,
      body_format text NOT NULL DEFAULT 'markdown',
      created_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      edited_at timestamptz,
      deleted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
      project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
      diagram_id uuid REFERENCES diagrams(id) ON DELETE SET NULL,
      actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
      action text NOT NULL,
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      metadata jsonb NOT NULL DEFAULT '{}',
      ip_address inet,
      user_agent text,
      request_id text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys(user_id);
    CREATE INDEX IF NOT EXISTS api_keys_project_id_idx ON api_keys(project_id);
    CREATE INDEX IF NOT EXISTS organization_members_user_id_idx ON organization_members(user_id);
    CREATE INDEX IF NOT EXISTS projects_organization_updated_at_idx ON projects(organization_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS project_members_user_id_idx ON project_members(user_id);
    CREATE INDEX IF NOT EXISTS diagrams_project_updated_at_idx ON diagrams(project_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS diagram_entity_index_diagram_type_idx ON diagram_entity_index(diagram_id, entity_type);
    CREATE INDEX IF NOT EXISTS diagram_entity_index_parent_idx ON diagram_entity_index(diagram_id, parent_entity_id);
    CREATE INDEX IF NOT EXISTS diagram_entity_index_search_idx ON diagram_entity_index USING gin(to_tsvector('simple', search_text));
    CREATE INDEX IF NOT EXISTS diagram_review_signals_diagram_idx ON diagram_review_signals(diagram_id, severity, generated_at DESC);
    CREATE INDEX IF NOT EXISTS comment_threads_diagram_target_idx ON comment_threads(diagram_id, target_type, target_id);
    CREATE INDEX IF NOT EXISTS comments_thread_created_at_idx ON comments(thread_id, created_at);
    CREATE INDEX IF NOT EXISTS audit_logs_scope_created_at_idx ON audit_logs(organization_id, project_id, created_at DESC);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE IF EXISTS diagrams DROP CONSTRAINT IF EXISTS diagrams_current_snapshot_id_fk;
    ALTER TABLE IF EXISTS invitations DROP CONSTRAINT IF EXISTS invitations_project_id_fk;

    DROP TABLE IF EXISTS audit_logs;
    DROP TABLE IF EXISTS comments;
    DROP TABLE IF EXISTS comment_threads;
    DROP TABLE IF EXISTS diagram_review_signals;
    DROP TABLE IF EXISTS diagram_entity_index;
    DROP TABLE IF EXISTS diagram_snapshots;
    DROP TABLE IF EXISTS diagram_documents;
    DROP TABLE IF EXISTS diagrams;
    DROP TABLE IF EXISTS api_keys;
    DROP TABLE IF EXISTS project_members;
    DROP TABLE IF EXISTS projects;
    DROP TABLE IF EXISTS invitations;
    DROP TABLE IF EXISTS organization_members;
    DROP TABLE IF EXISTS organizations;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS instance_members;
    DROP TABLE IF EXISTS system_settings;
    DROP TABLE IF EXISTS users;
  `.execute(db);
}
