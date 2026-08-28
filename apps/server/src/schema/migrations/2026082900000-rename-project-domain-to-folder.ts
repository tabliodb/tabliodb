import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE OR REPLACE FUNCTION pg_temp.tabliodb_rename_table_if_needed(
      old_table text,
      new_table text
    ) RETURNS void AS $$
    BEGIN
      IF to_regclass(format('public.%I', old_table)) IS NOT NULL
      AND to_regclass(format('public.%I', new_table)) IS NULL THEN
        -- Existing development installs may already contain data under the old project domain.
        -- Renaming preserves rows, foreign keys, and timestamps instead of forcing a destructive reset.
        EXECUTE format('ALTER TABLE %I RENAME TO %I', old_table, new_table);
      END IF;
    END;
    $$ LANGUAGE plpgsql;

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
        -- Column renames keep existing FK/index bindings intact while exposing the new API vocabulary to Kysely.
        EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', target_table, old_column, new_column);
      END IF;
    END;
    $$ LANGUAGE plpgsql;

    CREATE OR REPLACE FUNCTION pg_temp.tabliodb_rename_constraint_if_needed(
      target_table text,
      old_constraint text,
      new_constraint text
    ) RETURNS void AS $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint constraint_row
        INNER JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
        INNER JOIN pg_namespace namespace_row ON namespace_row.oid = table_row.relnamespace
        WHERE namespace_row.nspname = 'public'
          AND table_row.relname = target_table
          AND constraint_row.conname = old_constraint
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_row
        INNER JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
        INNER JOIN pg_namespace namespace_row ON namespace_row.oid = table_row.relnamespace
        WHERE namespace_row.nspname = 'public'
          AND table_row.relname = target_table
          AND constraint_row.conname = new_constraint
      ) THEN
        -- Constraint names matter because service code maps duplicate slugs to friendly 409 errors by constraint name.
        EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', target_table, old_constraint, new_constraint);
      END IF;
    END;
    $$ LANGUAGE plpgsql;

    CREATE OR REPLACE FUNCTION pg_temp.tabliodb_rename_index_if_needed(
      old_index text,
      new_index text
    ) RETURNS void AS $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_class index_row
        INNER JOIN pg_namespace namespace_row ON namespace_row.oid = index_row.relnamespace
        WHERE namespace_row.nspname = 'public'
          AND index_row.relkind = 'i'
          AND index_row.relname = old_index
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_class index_row
        INNER JOIN pg_namespace namespace_row ON namespace_row.oid = index_row.relnamespace
        WHERE namespace_row.nspname = 'public'
          AND index_row.relkind = 'i'
          AND index_row.relname = new_index
      ) THEN
        -- Index renames are not required for runtime correctness, but they keep psql/adminer inspection readable.
        EXECUTE format('ALTER INDEX %I RENAME TO %I', old_index, new_index);
      END IF;
    END;
    $$ LANGUAGE plpgsql;

    SELECT pg_temp.tabliodb_rename_column_if_needed('organizations', 'default_project_role', 'default_folder_role');
    SELECT pg_temp.tabliodb_rename_column_if_needed('organizations', 'default_access_role', 'default_folder_role');
    SELECT pg_temp.tabliodb_rename_column_if_needed('organizations', 'allow_member_project_create', 'allow_member_folder_create');

    SELECT pg_temp.tabliodb_rename_table_if_needed('projects', 'folders');
    SELECT pg_temp.tabliodb_rename_table_if_needed('project_members', 'folder_access');
    SELECT pg_temp.tabliodb_rename_table_if_needed('project_team_access', 'folder_team_access');

    SELECT pg_temp.tabliodb_rename_column_if_needed('folder_access', 'project_id', 'folder_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('folder_team_access', 'project_id', 'folder_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('diagrams', 'project_id', 'folder_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('api_keys', 'project_id', 'folder_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('audit_logs', 'project_id', 'folder_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('invitations', 'project_id', 'folder_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('invitations', 'project_role', 'folder_role');
    SELECT pg_temp.tabliodb_rename_column_if_needed(
      'user_editor_preferences',
      'last_opened_project_id',
      'last_opened_folder_id'
    );

    SELECT pg_temp.tabliodb_rename_constraint_if_needed('folders', 'projects_pkey', 'folders_pkey');
    SELECT pg_temp.tabliodb_rename_constraint_if_needed(
      'folders',
      'projects_organization_id_slug_key',
      'folders_organization_id_slug_key'
    );
    SELECT pg_temp.tabliodb_rename_constraint_if_needed('folder_access', 'project_members_pkey', 'folder_access_pkey');
    SELECT pg_temp.tabliodb_rename_constraint_if_needed(
      'folder_team_access',
      'project_team_access_pkey',
      'folder_team_access_pkey'
    );
    SELECT pg_temp.tabliodb_rename_constraint_if_needed(
      'folder_access',
      'project_members_project_id_fkey',
      'folder_access_folder_id_fkey'
    );
    SELECT pg_temp.tabliodb_rename_constraint_if_needed(
      'folder_access',
      'project_members_user_id_fkey',
      'folder_access_user_id_fkey'
    );
    SELECT pg_temp.tabliodb_rename_constraint_if_needed(
      'folder_team_access',
      'project_team_access_project_id_fkey',
      'folder_team_access_folder_id_fkey'
    );
    SELECT pg_temp.tabliodb_rename_constraint_if_needed(
      'folder_team_access',
      'project_team_access_team_id_fkey',
      'folder_team_access_team_id_fkey'
    );
    SELECT pg_temp.tabliodb_rename_constraint_if_needed('diagrams', 'diagrams_project_id_fkey', 'diagrams_folder_id_fkey');
    SELECT pg_temp.tabliodb_rename_constraint_if_needed('api_keys', 'api_keys_project_id_fkey', 'api_keys_folder_id_fkey');
    SELECT pg_temp.tabliodb_rename_constraint_if_needed(
      'invitations',
      'invitations_project_id_fk',
      'invitations_folder_id_fk'
    );
    SELECT pg_temp.tabliodb_rename_constraint_if_needed(
      'user_editor_preferences',
      'user_editor_preferences_last_opened_project_id_fkey',
      'user_editor_preferences_last_opened_folder_id_fkey'
    );

    SELECT pg_temp.tabliodb_rename_index_if_needed('projects_organization_updated_at_idx', 'folders_organization_updated_at_idx');
    SELECT pg_temp.tabliodb_rename_index_if_needed('project_members_user_id_idx', 'folder_access_user_id_idx');
    SELECT pg_temp.tabliodb_rename_index_if_needed(
      'project_team_access_team_id_idx',
      'folder_team_access_team_id_idx'
    );
    SELECT pg_temp.tabliodb_rename_index_if_needed(
      'project_team_access_project_id_idx',
      'folder_team_access_folder_id_idx'
    );
    SELECT pg_temp.tabliodb_rename_index_if_needed('diagrams_project_updated_at_idx', 'diagrams_folder_updated_at_idx');
    SELECT pg_temp.tabliodb_rename_index_if_needed('api_keys_project_id_idx', 'api_keys_folder_id_idx');
    SELECT pg_temp.tabliodb_rename_index_if_needed(
      'user_editor_preferences_last_opened_project_id_idx',
      'user_editor_preferences_last_opened_folder_id_idx'
    );

    UPDATE audit_logs
    SET entity_type = CASE entity_type
      WHEN 'project' THEN 'folder'
      WHEN 'project_member' THEN 'folder_access'
      ELSE entity_type
    END
    WHERE entity_type IN ('project', 'project_member');

    UPDATE audit_logs
    SET action = CASE action
      WHEN 'project.created' THEN 'folder.created'
      WHEN 'project.archived' THEN 'folder.archived'
      WHEN 'project.member_added' THEN 'folder.access_added'
      WHEN 'project.member_removed' THEN 'folder.access_removed'
      WHEN 'project.member_role_updated' THEN 'folder.access_role_updated'
      ELSE action
    END
    WHERE action LIKE 'project.%';
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE OR REPLACE FUNCTION pg_temp.tabliodb_rename_table_if_needed(
      old_table text,
      new_table text
    ) RETURNS void AS $$
    BEGIN
      IF to_regclass(format('public.%I', old_table)) IS NOT NULL
      AND to_regclass(format('public.%I', new_table)) IS NULL THEN
        EXECUTE format('ALTER TABLE %I RENAME TO %I', old_table, new_table);
      END IF;
    END;
    $$ LANGUAGE plpgsql;

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

    SELECT pg_temp.tabliodb_rename_column_if_needed('organizations', 'default_folder_role', 'default_project_role');
    SELECT pg_temp.tabliodb_rename_column_if_needed('organizations', 'allow_member_folder_create', 'allow_member_project_create');
    SELECT pg_temp.tabliodb_rename_column_if_needed('folder_access', 'folder_id', 'project_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('folder_team_access', 'folder_id', 'project_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('diagrams', 'folder_id', 'project_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('api_keys', 'folder_id', 'project_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('audit_logs', 'folder_id', 'project_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('invitations', 'folder_id', 'project_id');
    SELECT pg_temp.tabliodb_rename_column_if_needed('invitations', 'folder_role', 'project_role');
    SELECT pg_temp.tabliodb_rename_column_if_needed(
      'user_editor_preferences',
      'last_opened_folder_id',
      'last_opened_project_id'
    );

    SELECT pg_temp.tabliodb_rename_table_if_needed('folders', 'projects');
    SELECT pg_temp.tabliodb_rename_table_if_needed('folder_access', 'project_members');
    SELECT pg_temp.tabliodb_rename_table_if_needed('folder_team_access', 'project_team_access');
  `.execute(db);
}
