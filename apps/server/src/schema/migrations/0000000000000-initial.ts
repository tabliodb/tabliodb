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
      cursor_color text NOT NULL DEFAULT '#58cc02',
      locale text,
      timezone text,
      is_disabled boolean NOT NULL DEFAULT false,
      disabled_at timestamptz,
      last_login_at timestamptz,
      password_changed_at timestamptz,
      password_change_required boolean NOT NULL DEFAULT false,
      metadata jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );

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
      ADD COLUMN IF NOT EXISTS avatar_file_id uuid,
      ADD CONSTRAINT users_avatar_file_id_fk
      FOREIGN KEY (avatar_file_id) REFERENCES files(id) ON DELETE SET NULL;

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
      binding_algorithm text,
      binding_key_fingerprint text,
      binding_public_key_jwk jsonb,
      binding_required boolean NOT NULL DEFAULT false,
      risk_score integer NOT NULL DEFAULT 0,
      last_seen_at timestamptz,
      last_ip_address inet,
      last_user_agent_hash text,
      expires_at timestamptz,
      revoked_at timestamptz,
      revoked_reason text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      slug text NOT NULL UNIQUE,
      created_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      default_folder_role text,
      allow_member_folder_create boolean NOT NULL DEFAULT true,
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
      folder_id uuid,
      email citext NOT NULL,
      organization_role text NOT NULL DEFAULT 'member' CHECK (organization_role IN ('owner', 'admin', 'member', 'guest')),
      folder_role text CHECK (folder_role IN ('owner', 'editor', 'commenter', 'viewer')),
      token_hash bytea NOT NULL UNIQUE,
      message text,
      invited_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      accepted_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
      accepted_at timestamptz,
      revoked_at timestamptz,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS folders (
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
      ADD CONSTRAINT invitations_folder_id_fk
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE;

    CREATE TABLE IF NOT EXISTS folder_access (
      folder_id uuid NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role text NOT NULL CHECK (role IN ('owner', 'editor', 'commenter', 'viewer')),
      created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (folder_id, user_id)
    );

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

    CREATE TABLE IF NOT EXISTS api_keys (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      key_hash bytea NOT NULL UNIQUE,
      name text NOT NULL,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
      folder_id uuid REFERENCES folders(id) ON DELETE CASCADE,
      permissions text[] NOT NULL DEFAULT '{}',
      last_used_at timestamptz,
      expires_at timestamptz,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS diagrams (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      folder_id uuid NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
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
      UNIQUE (folder_id, slug)
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
      parent_comment_id uuid REFERENCES comments(id) ON DELETE SET NULL,
      body_json jsonb NOT NULL,
      body_text text NOT NULL,
      body_format text NOT NULL DEFAULT 'lexical' CHECK (body_format IN ('lexical')),
      created_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      edited_at timestamptz,
      deleted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS comment_edit_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      edited_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      previous_body_json jsonb NOT NULL,
      previous_body_text text NOT NULL,
      next_body_json jsonb NOT NULL,
      next_body_text text NOT NULL,
      body_format text NOT NULL DEFAULT 'lexical' CHECK (body_format IN ('lexical')),
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS comment_mentions (
      comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      mentioned_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (comment_id, mentioned_user_id)
    );

    CREATE TABLE IF NOT EXISTS comment_thread_reads (
      thread_id uuid NOT NULL REFERENCES comment_threads(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_read_comment_id uuid REFERENCES comments(id) ON DELETE SET NULL,
      last_read_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (thread_id, user_id)
    );

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

    CREATE TABLE IF NOT EXISTS audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
      folder_id uuid REFERENCES folders(id) ON DELETE SET NULL,
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
    CREATE INDEX IF NOT EXISTS files_owner_kind_created_at_idx ON files(owner_id, kind, created_at DESC);
    CREATE INDEX IF NOT EXISTS files_status_created_at_idx ON files(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS file_variants_file_id_idx ON file_variants(file_id);
    CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys(user_id);
    CREATE INDEX IF NOT EXISTS api_keys_folder_id_idx ON api_keys(folder_id);
    CREATE INDEX IF NOT EXISTS organization_members_user_id_idx ON organization_members(user_id);
    CREATE INDEX IF NOT EXISTS folders_organization_updated_at_idx ON folders(organization_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS folder_access_user_id_idx ON folder_access(user_id);
    CREATE INDEX IF NOT EXISTS teams_organization_id_idx ON teams(organization_id);
    CREATE INDEX IF NOT EXISTS team_members_user_id_idx ON team_members(user_id);
    CREATE INDEX IF NOT EXISTS folder_team_access_team_id_idx ON folder_team_access(team_id);
    CREATE INDEX IF NOT EXISTS folder_team_access_folder_id_idx ON folder_team_access(folder_id);
    CREATE INDEX IF NOT EXISTS diagrams_folder_updated_at_idx ON diagrams(folder_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS diagram_entity_index_diagram_type_idx ON diagram_entity_index(diagram_id, entity_type);
    CREATE INDEX IF NOT EXISTS diagram_entity_index_parent_idx ON diagram_entity_index(diagram_id, parent_entity_id);
    CREATE INDEX IF NOT EXISTS diagram_entity_index_search_idx ON diagram_entity_index USING gin(to_tsvector('simple', search_text));
    CREATE INDEX IF NOT EXISTS diagram_review_signals_diagram_idx ON diagram_review_signals(diagram_id, severity, generated_at DESC);
    CREATE INDEX IF NOT EXISTS comment_threads_diagram_target_idx ON comment_threads(diagram_id, target_type, target_id);
    CREATE INDEX IF NOT EXISTS comments_thread_created_at_idx ON comments(thread_id, created_at);
    CREATE INDEX IF NOT EXISTS comments_thread_parent_created_idx ON comments(thread_id, parent_comment_id, created_at);
    CREATE INDEX IF NOT EXISTS comment_edit_history_comment_created_idx ON comment_edit_history(comment_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS comment_mentions_user_created_idx ON comment_mentions(mentioned_user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS comment_thread_reads_user_updated_idx ON comment_thread_reads(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS background_jobs_poll_idx ON background_jobs(queue, status, priority DESC, scheduled_at ASC, created_at ASC);
    CREATE INDEX IF NOT EXISTS background_jobs_locked_idx ON background_jobs(status, locked_at) WHERE status = 'running';
    CREATE INDEX IF NOT EXISTS audit_logs_scope_created_at_idx ON audit_logs(organization_id, folder_id, created_at DESC);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE IF EXISTS diagrams DROP CONSTRAINT IF EXISTS diagrams_current_snapshot_id_fk;
    ALTER TABLE IF EXISTS invitations DROP CONSTRAINT IF EXISTS invitations_folder_id_fk;
    ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS users_avatar_file_id_fk;
    ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS avatar_file_id;

    DROP TABLE IF EXISTS audit_logs;
    DROP TABLE IF EXISTS comment_thread_reads;
    DROP TABLE IF EXISTS comment_mentions;
    DROP TABLE IF EXISTS comment_edit_history;
    DROP TABLE IF EXISTS comments;
    DROP TABLE IF EXISTS comment_threads;
    DROP TABLE IF EXISTS background_jobs;
    DROP TABLE IF EXISTS diagram_review_signals;
    DROP TABLE IF EXISTS diagram_entity_index;
    DROP TABLE IF EXISTS diagram_snapshots;
    DROP TABLE IF EXISTS diagram_documents;
    DROP TABLE IF EXISTS diagrams;
    DROP TABLE IF EXISTS api_keys;
    DROP TABLE IF EXISTS folder_team_access;
    DROP TABLE IF EXISTS team_members;
    DROP TABLE IF EXISTS teams;
    DROP TABLE IF EXISTS folder_access;
    DROP TABLE IF EXISTS folders;
    DROP TABLE IF EXISTS invitations;
    DROP TABLE IF EXISTS organization_members;
    DROP TABLE IF EXISTS organizations;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS instance_members;
    DROP TABLE IF EXISTS system_settings;
    DROP TABLE IF EXISTS file_variants;
    DROP TABLE IF EXISTS files;
    DROP TABLE IF EXISTS users;
  `.execute(db);
}
