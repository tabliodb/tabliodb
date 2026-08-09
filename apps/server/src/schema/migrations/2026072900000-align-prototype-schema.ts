import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`.execute(db);
  await sql`CREATE EXTENSION IF NOT EXISTS citext`.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION pg_temp.tabliodb_rename_column_if_needed(
      target_table text,
      old_column text,
      new_column text
    ) RETURNS void AS $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = target_table
          AND column_name = old_column
      )
      AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = target_table
          AND column_name = new_column
      ) THEN
        EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', target_table, old_column, new_column);
      END IF;
    END;
    $$ LANGUAGE plpgsql;

    SELECT pg_temp.tabliodb_rename_column_if_needed('users', 'password', 'password_hash');
    SELECT pg_temp.tabliodb_rename_column_if_needed('users', 'avatarColor', 'cursor_color');
    SELECT pg_temp.tabliodb_rename_column_if_needed('users', 'avatar_color', 'cursor_color');
    SELECT pg_temp.tabliodb_rename_column_if_needed('users', 'cursorColor', 'cursor_color');
    SELECT pg_temp.tabliodb_rename_column_if_needed('users', 'createdAt', 'created_at');
    SELECT pg_temp.tabliodb_rename_column_if_needed('users', 'updatedAt', 'updated_at');
    SELECT pg_temp.tabliodb_rename_column_if_needed('users', 'deletedAt', 'deleted_at');

    SELECT pg_temp.tabliodb_rename_column_if_needed('sessions', 'token', 'token_hash');
    SELECT pg_temp.tabliodb_rename_column_if_needed('sessions', 'userId', 'user_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('sessions', 'deviceType', 'device_type');
    SELECT pg_temp.tabliodb_rename_column_if_needed('sessions', 'deviceOS', 'device_os');
    SELECT pg_temp.tabliodb_rename_column_if_needed('sessions', 'appVersion', 'app_version');
    SELECT pg_temp.tabliodb_rename_column_if_needed('sessions', 'expiresAt', 'expires_at');
    SELECT pg_temp.tabliodb_rename_column_if_needed('sessions', 'createdAt', 'created_at');
    SELECT pg_temp.tabliodb_rename_column_if_needed('sessions', 'updatedAt', 'updated_at');

    SELECT pg_temp.tabliodb_rename_column_if_needed('organizations', 'createdById', 'created_by_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('organizations', 'createdAt', 'created_at');
    SELECT pg_temp.tabliodb_rename_column_if_needed('organizations', 'updatedAt', 'updated_at');

    SELECT pg_temp.tabliodb_rename_column_if_needed('organization_members', 'organizationId', 'organization_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('organization_members', 'userId', 'user_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('organization_members', 'createdAt', 'created_at');

    SELECT pg_temp.tabliodb_rename_column_if_needed('projects', 'organizationId', 'organization_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('projects', 'createdById', 'created_by_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('projects', 'createdAt', 'created_at');
    SELECT pg_temp.tabliodb_rename_column_if_needed('projects', 'updatedAt', 'updated_at');

    SELECT pg_temp.tabliodb_rename_column_if_needed('project_members', 'projectId', 'project_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('project_members', 'userId', 'user_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('project_members', 'createdAt', 'created_at');

    SELECT pg_temp.tabliodb_rename_column_if_needed('api_keys', 'key', 'key_hash');
    SELECT pg_temp.tabliodb_rename_column_if_needed('api_keys', 'userId', 'user_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('api_keys', 'createdAt', 'created_at');
    SELECT pg_temp.tabliodb_rename_column_if_needed('api_keys', 'updatedAt', 'updated_at');

    SELECT pg_temp.tabliodb_rename_column_if_needed('diagrams', 'projectId', 'project_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('diagrams', 'createdById', 'created_by_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('diagrams', 'createdAt', 'created_at');
    SELECT pg_temp.tabliodb_rename_column_if_needed('diagrams', 'updatedAt', 'updated_at');

    SELECT pg_temp.tabliodb_rename_column_if_needed('diagram_documents', 'diagramId', 'diagram_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('diagram_documents', 'state', 'yjs_state');
    SELECT pg_temp.tabliodb_rename_column_if_needed('diagram_documents', 'updatedAt', 'updated_at');

    SELECT pg_temp.tabliodb_rename_column_if_needed('diagram_snapshots', 'diagramId', 'diagram_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('diagram_snapshots', 'createdById', 'created_by_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('diagram_snapshots', 'createdAt', 'created_at');

    SELECT pg_temp.tabliodb_rename_column_if_needed('comment_threads', 'diagramId', 'diagram_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('comment_threads', 'targetType', 'target_type');
    SELECT pg_temp.tabliodb_rename_column_if_needed('comment_threads', 'targetId', 'target_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('comment_threads', 'resolvedAt', 'resolved_at');
    SELECT pg_temp.tabliodb_rename_column_if_needed('comment_threads', 'createdById', 'created_by_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('comment_threads', 'createdAt', 'created_at');
    SELECT pg_temp.tabliodb_rename_column_if_needed('comment_threads', 'updatedAt', 'updated_at');

    SELECT pg_temp.tabliodb_rename_column_if_needed('comments', 'threadId', 'thread_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('comments', 'createdById', 'created_by_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('comments', 'createdAt', 'created_at');
    SELECT pg_temp.tabliodb_rename_column_if_needed('comments', 'updatedAt', 'updated_at');

    SELECT pg_temp.tabliodb_rename_column_if_needed('audit_logs', 'organizationId', 'organization_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('audit_logs', 'projectId', 'project_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('audit_logs', 'actorId', 'actor_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('audit_logs', 'entityType', 'entity_type');
    SELECT pg_temp.tabliodb_rename_column_if_needed('audit_logs', 'entityId', 'entity_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('audit_logs', 'createdAt', 'created_at');

    ALTER TABLE IF EXISTS users
      ADD COLUMN IF NOT EXISTS cursor_color text,
      ADD COLUMN IF NOT EXISTS locale text,
      ADD COLUMN IF NOT EXISTS timezone text,
      ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
      ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
      ADD COLUMN IF NOT EXISTS password_changed_at timestamptz,
      ADD COLUMN IF NOT EXISTS password_change_required boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';

    UPDATE users
    SET cursor_color = '#58cc02'
    WHERE cursor_color IS NULL;

    ALTER TABLE IF EXISTS users
      ALTER COLUMN cursor_color SET DEFAULT '#58cc02',
      ALTER COLUMN cursor_color SET NOT NULL;

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

    ALTER TABLE IF EXISTS users
      ADD COLUMN IF NOT EXISTS avatar_file_id uuid;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_avatar_file_id_fk'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_avatar_file_id_fk
          FOREIGN KEY (avatar_file_id) REFERENCES files(id) ON DELETE SET NULL;
      END IF;
    END $$;

    ALTER TABLE IF EXISTS sessions
      ADD COLUMN IF NOT EXISTS user_agent text,
      ADD COLUMN IF NOT EXISTS ip_address inet,
      ADD COLUMN IF NOT EXISTS app_version text,
      ADD COLUMN IF NOT EXISTS binding_algorithm text,
      ADD COLUMN IF NOT EXISTS binding_key_fingerprint text,
      ADD COLUMN IF NOT EXISTS binding_public_key_jwk jsonb,
      ADD COLUMN IF NOT EXISTS binding_required boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS risk_score integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
      ADD COLUMN IF NOT EXISTS last_ip_address inet,
      ADD COLUMN IF NOT EXISTS last_user_agent_hash text,
      ADD COLUMN IF NOT EXISTS expires_at timestamptz,
      ADD COLUMN IF NOT EXISTS revoked_reason text,
      ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

    ALTER TABLE IF EXISTS organizations
      ADD COLUMN IF NOT EXISTS default_project_role text,
      ADD COLUMN IF NOT EXISTS allow_member_project_create boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS archived_at timestamptz;

    ALTER TABLE IF EXISTS organization_members
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS joined_at timestamptz,
      ADD COLUMN IF NOT EXISTS created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

    ALTER TABLE IF EXISTS projects
      ADD COLUMN IF NOT EXISTS default_dialect text NOT NULL DEFAULT 'postgresql',
      ADD COLUMN IF NOT EXISTS review_settings jsonb NOT NULL DEFAULT '{"disabledRuleKeys":[]}'::jsonb,
      ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private',
      ADD COLUMN IF NOT EXISTS archived_at timestamptz;

    ALTER TABLE IF EXISTS project_members
      ADD COLUMN IF NOT EXISTS created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

    ALTER TABLE IF EXISTS api_keys
      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
      ADD COLUMN IF NOT EXISTS expires_at timestamptz,
      ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

    ALTER TABLE IF EXISTS diagrams
      ADD COLUMN IF NOT EXISTS slug text,
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS current_snapshot_id uuid,
      ADD COLUMN IF NOT EXISTS last_snapshot_version integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS review_settings jsonb NOT NULL DEFAULT '{"disabledRuleKeys":[]}'::jsonb,
      ADD COLUMN IF NOT EXISTS archived_at timestamptz;

    ALTER TABLE IF EXISTS diagram_documents
      ADD COLUMN IF NOT EXISTS state_vector bytea,
      ADD COLUMN IF NOT EXISTS checksum text,
      ADD COLUMN IF NOT EXISTS schema_cache jsonb,
      ADD COLUMN IF NOT EXISTS updated_by_id uuid REFERENCES users(id) ON DELETE SET NULL;

    ALTER TABLE IF EXISTS diagram_snapshots
      ADD COLUMN IF NOT EXISTS checksum text,
      ADD COLUMN IF NOT EXISTS restored_from_snapshot_id uuid REFERENCES diagram_snapshots(id) ON DELETE SET NULL;

    ALTER TABLE IF EXISTS comment_threads
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
      ADD COLUMN IF NOT EXISTS resolved_by_id uuid REFERENCES users(id) ON DELETE SET NULL;

    ALTER TABLE IF EXISTS comments
      ADD COLUMN IF NOT EXISTS body_format text NOT NULL DEFAULT 'markdown',
      ADD COLUMN IF NOT EXISTS edited_at timestamptz,
      ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

    ALTER TABLE IF EXISTS audit_logs
      ADD COLUMN IF NOT EXISTS diagram_id uuid REFERENCES diagrams(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS ip_address inet,
      ADD COLUMN IF NOT EXISTS user_agent text,
      ADD COLUMN IF NOT EXISTS request_id text;

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

    CREATE TABLE IF NOT EXISTS invitations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
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

    CREATE TABLE IF NOT EXISTS diagram_entity_index (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      diagram_id uuid NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
      entity_type text NOT NULL,
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
      severity text NOT NULL,
      target_type text NOT NULL,
      target_id text,
      message text NOT NULL,
      metadata jsonb NOT NULL DEFAULT '{}',
      ignored_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
      ignored_at timestamptz,
      generated_at timestamptz NOT NULL DEFAULT now()
    );

    INSERT INTO instance_members (user_id, role, created_by_id)
    SELECT users.id, 'owner', users.id
    FROM users
    WHERE NOT EXISTS (SELECT 1 FROM instance_members);

    INSERT INTO system_settings (key, value, updated_by_id)
    SELECT 'setup.completed_at', jsonb_build_object('completedAt', now()), users.id
    FROM users
    WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE key = 'setup.completed_at')
    LIMIT 1;

    INSERT INTO system_settings (key, value, updated_by_id)
    SELECT 'auth.signup_policy', '{"policy":"invite_only"}'::jsonb, users.id
    FROM users
    WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE key = 'auth.signup_policy')
    LIMIT 1;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'diagrams_current_snapshot_id_fk'
      ) THEN
        ALTER TABLE diagrams
          ADD CONSTRAINT diagrams_current_snapshot_id_fk
          FOREIGN KEY (current_snapshot_id) REFERENCES diagram_snapshots(id) ON DELETE SET NULL;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS files_owner_kind_created_at_idx ON files(owner_id, kind, created_at DESC);
    CREATE INDEX IF NOT EXISTS files_status_created_at_idx ON files(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS file_variants_file_id_idx ON file_variants(file_id);
    CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys(user_id);
    CREATE INDEX IF NOT EXISTS api_keys_project_id_idx ON api_keys(project_id);
    CREATE INDEX IF NOT EXISTS organization_members_user_id_idx ON organization_members(user_id);
    CREATE INDEX IF NOT EXISTS projects_organization_updated_at_idx ON projects(organization_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS project_members_user_id_idx ON project_members(user_id);
    CREATE INDEX IF NOT EXISTS diagrams_project_updated_at_idx ON diagrams(project_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS diagram_entity_index_diagram_type_idx ON diagram_entity_index(diagram_id, entity_type);
    CREATE INDEX IF NOT EXISTS diagram_entity_index_parent_idx ON diagram_entity_index(diagram_id, parent_entity_id);
    CREATE INDEX IF NOT EXISTS diagram_review_signals_diagram_idx ON diagram_review_signals(diagram_id, severity, generated_at DESC);
    CREATE INDEX IF NOT EXISTS comment_threads_diagram_target_idx ON comment_threads(diagram_id, target_type, target_id);
    CREATE INDEX IF NOT EXISTS comments_thread_created_at_idx ON comments(thread_id, created_at);
    CREATE INDEX IF NOT EXISTS audit_logs_scope_created_at_idx ON audit_logs(organization_id, project_id, created_at DESC);
  `.execute(db);
}

export async function down(): Promise<void> {
  // This migration intentionally has no destructive down path because it aligns old prototype databases with the current schema.
}
