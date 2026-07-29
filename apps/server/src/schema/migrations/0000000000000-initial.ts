import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // pgcrypto gives us gen_random_uuid(), which keeps IDs database-native without adding a UUID service dependency.
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL UNIQUE,
      name text NOT NULL,
      password text,
      "avatarColor" text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "deletedAt" timestamptz
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      token bytea NOT NULL UNIQUE,
      "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "deviceType" text NOT NULL DEFAULT '',
      "deviceOS" text NOT NULL DEFAULT '',
      "appVersion" text,
      "expiresAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token);

    CREATE TABLE IF NOT EXISTS api_keys (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      key bytea NOT NULL UNIQUE,
      name text NOT NULL,
      "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permissions text[] NOT NULL DEFAULT '{}',
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS api_keys_key_idx ON api_keys(key);

    CREATE TABLE IF NOT EXISTS organizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      slug text NOT NULL UNIQUE,
      "createdById" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS organization_members (
      "organizationId" uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role text NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("organizationId", "userId")
    );

    CREATE TABLE IF NOT EXISTS projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name text NOT NULL,
      slug text NOT NULL,
      description text,
      "createdById" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      UNIQUE ("organizationId", slug)
    );

    CREATE TABLE IF NOT EXISTS project_members (
      "projectId" uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role text NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("projectId", "userId")
    );

    CREATE TABLE IF NOT EXISTS diagrams (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name text NOT NULL,
      dialect text NOT NULL DEFAULT 'postgresql',
      "createdById" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS diagram_documents (
      "diagramId" uuid PRIMARY KEY REFERENCES diagrams(id) ON DELETE CASCADE,
      state bytea,
      version integer NOT NULL DEFAULT 0,
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS diagram_snapshots (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "diagramId" uuid NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
      version integer NOT NULL,
      message text,
      snapshot jsonb NOT NULL,
      "createdById" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      UNIQUE ("diagramId", version)
    );

    CREATE TABLE IF NOT EXISTS comment_threads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "diagramId" uuid NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
      "targetType" text NOT NULL,
      "targetId" text NOT NULL,
      "resolvedAt" timestamptz,
      "createdById" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "threadId" uuid NOT NULL REFERENCES comment_threads(id) ON DELETE CASCADE,
      body text NOT NULL,
      "createdById" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" uuid REFERENCES organizations(id) ON DELETE SET NULL,
      "projectId" uuid REFERENCES projects(id) ON DELETE SET NULL,
      "actorId" uuid REFERENCES users(id) ON DELETE SET NULL,
      action text NOT NULL,
      "entityType" text NOT NULL,
      "entityId" text NOT NULL,
      metadata jsonb NOT NULL DEFAULT '{}',
      "createdAt" timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS audit_logs;
    DROP TABLE IF EXISTS comments;
    DROP TABLE IF EXISTS comment_threads;
    DROP TABLE IF EXISTS diagram_snapshots;
    DROP TABLE IF EXISTS diagram_documents;
    DROP TABLE IF EXISTS diagrams;
    DROP TABLE IF EXISTS project_members;
    DROP TABLE IF EXISTS projects;
    DROP TABLE IF EXISTS organization_members;
    DROP TABLE IF EXISTS organizations;
    DROP TABLE IF EXISTS api_keys;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS users;
  `.execute(db);
}
