import { ProjectRole, OrganizationRole } from '@tabliodb/shared';
import { createStarterDiagramModel, encodeDiagramModelAsYjsUpdate } from '@tabliodb/schema-core';
import { hash } from 'bcrypt';
import { Kysely, sql, type Transaction } from 'kysely';
import { loadEnv } from '../config/env.js';
import { SALT_ROUNDS } from '../constants.js';
import type { DB, JsonValue } from '../schema/index.js';
import { getKyselyConfig } from '../utils/database.js';
import { slugify } from '../utils/slug.js';

const seedOwnerEmail = process.env.TABLIODB_DEV_OWNER_EMAIL ?? 'owner@tabliodb.local';
const seedOwnerName = process.env.TABLIODB_DEV_OWNER_NAME ?? 'Tabliodb Owner';
const seedOwnerPassword = process.env.TABLIODB_DEV_OWNER_PASSWORD ?? 'tabliodb-dev';
const seedWorkspaceName = process.env.TABLIODB_DEV_WORKSPACE_NAME ?? 'Personal Workspace';
const seedProjectName = process.env.TABLIODB_DEV_PROJECT_NAME ?? 'Library System';
const seedDiagramName = process.env.TABLIODB_DEV_DIAGRAM_NAME ?? 'Main schema';

const env = loadEnv();
const db = new Kysely<DB>(getKyselyConfig(env.database.url));

try {
  const result = await db.transaction().execute(async (tx) => seedDevelopmentData(tx));

  console.log(`Seed owner: ${result.owner.email}`);
  console.log(`Seed password: ${result.passwordWasWritten ? seedOwnerPassword : '(kept existing password)'}`);
  console.log(`Workspace: ${result.organization.name}`);
  console.log(`Project: ${result.project.name}`);
  console.log(`Diagram: ${result.diagram.name}`);
  console.log(`Snapshot: v${result.snapshotVersion}`);
} finally {
  await db.destroy();
}

async function seedDevelopmentData(tx: Transaction<DB>) {
  // A seed-specific advisory lock keeps repeated npm scripts or two terminals from racing duplicate starter rows.
  await sql`SELECT pg_advisory_xact_lock(742036910252)`.execute(tx);

  const owner = await upsertSeedOwner(tx);
  const organization = await upsertSeedOrganization(tx, owner.id);
  const project = await upsertSeedProject(tx, owner.id, organization.id);
  const diagram = await upsertSeedDiagram(tx, owner.id, project.id);
  const snapshotVersion = await ensureInitialDiagramState(tx, {
    createdById: owner.id,
    diagramId: diagram.id,
    diagramName: diagram.name,
  });

  return {
    owner,
    passwordWasWritten: owner.passwordWasWritten,
    organization,
    project,
    diagram,
    snapshotVersion,
  };
}

async function upsertSeedOwner(tx: Transaction<DB>) {
  const email = seedOwnerEmail.trim().toLowerCase();
  const existingOwner = await tx
    .selectFrom('users')
    .select(['id', 'email', 'name', 'passwordHash'])
    .where('email', '=', email)
    .where('deletedAt', 'is', null)
    .executeTakeFirst();

  if (existingOwner) {
    const shouldWritePassword =
      !existingOwner.passwordHash || process.env.TABLIODB_DEV_SEED_OVERWRITE_PASSWORD === 'true';

    if (shouldWritePassword) {
      const passwordHash = await hash(seedOwnerPassword, SALT_ROUNDS);

      // Password overwrite is opt-in for existing users so running seed does not unexpectedly change local credentials.
      await tx
        .updateTable('users')
        .set({ isDisabled: false, passwordHash, updatedAt: new Date() })
        .where('id', '=', existingOwner.id)
        .execute();
    }

    await upsertInstanceOwner(tx, existingOwner.id);

    return {
      id: existingOwner.id,
      email: existingOwner.email,
      name: existingOwner.name,
      passwordWasWritten: shouldWritePassword,
    };
  }

  const passwordHash = await hash(seedOwnerPassword, SALT_ROUNDS);
  const owner = await tx
    .insertInto('users')
    .values({
      avatarColor: '#58cc02',
      email,
      name: seedOwnerName,
      passwordHash,
    })
    .returning(['id', 'email', 'name'])
    .executeTakeFirstOrThrow();

  await upsertInstanceOwner(tx, owner.id);

  return {
    ...owner,
    passwordWasWritten: true,
  };
}

async function upsertInstanceOwner(tx: Transaction<DB>, ownerId: string): Promise<void> {
  await tx
    .insertInto('instance_members')
    .values({
      createdById: ownerId,
      role: 'owner',
      userId: ownerId,
    })
    .onConflict((oc) =>
      oc.column('userId').doUpdateSet({
        role: 'owner',
      }),
    )
    .execute();
}

async function upsertSeedOrganization(tx: Transaction<DB>, ownerId: string) {
  const now = new Date();
  const slug = slugify(seedWorkspaceName);
  const existingOrganization = await tx
    .selectFrom('organizations')
    .select(['id', 'name', 'slug'])
    .where('slug', '=', slug)
    .where('archivedAt', 'is', null)
    .executeTakeFirst();

  const organization =
    existingOrganization ??
    (await tx
      .insertInto('organizations')
      .values({
        createdById: ownerId,
        name: seedWorkspaceName,
        slug,
      })
      .returning(['id', 'name', 'slug'])
      .executeTakeFirstOrThrow());

  await tx
    .insertInto('organization_members')
    .values({
      createdById: ownerId,
      joinedAt: now,
      organizationId: organization.id,
      role: OrganizationRole.Owner,
      status: 'active',
      userId: ownerId,
    })
    .onConflict((oc) =>
      oc.columns(['organizationId', 'userId']).doUpdateSet({
        role: OrganizationRole.Owner,
        status: 'active',
        updatedAt: now,
      }),
    )
    .execute();

  await upsertSystemSetting(tx, 'setup.completed_at', { completedAt: now.toISOString() }, ownerId);
  await upsertSystemSetting(tx, 'auth.signup_policy', { policy: 'invite_only' }, ownerId);
  await upsertSystemSetting(tx, 'app.public_url', { url: env.server.publicUrl }, ownerId);

  return organization;
}

async function upsertSystemSetting(
  tx: Transaction<DB>,
  key: string,
  value: JsonValue,
  updatedById: string,
): Promise<void> {
  await tx
    .insertInto('system_settings')
    .values({
      isSecret: false,
      key,
      updatedById,
      value,
    })
    .onConflict((oc) =>
      oc.column('key').doUpdateSet({
        updatedAt: new Date(),
        updatedById,
        value,
      }),
    )
    .execute();
}

async function upsertSeedProject(tx: Transaction<DB>, ownerId: string, organizationId: string) {
  const slug = slugify(seedProjectName);
  const existingProject = await tx
    .selectFrom('projects')
    .select(['id', 'name', 'slug'])
    .where('organizationId', '=', organizationId)
    .where('slug', '=', slug)
    .where('archivedAt', 'is', null)
    .executeTakeFirst();

  const project =
    existingProject ??
    (await tx
      .insertInto('projects')
      .values({
        createdById: ownerId,
        defaultDialect: 'postgresql',
        description: 'Starter schema workspace',
        name: seedProjectName,
        organizationId,
        slug,
      })
      .returning(['id', 'name', 'slug'])
      .executeTakeFirstOrThrow());

  await tx
    .insertInto('project_members')
    .values({
      createdById: ownerId,
      projectId: project.id,
      role: ProjectRole.Owner,
      userId: ownerId,
    })
    .onConflict((oc) =>
      oc.columns(['projectId', 'userId']).doUpdateSet({
        role: ProjectRole.Owner,
        updatedAt: new Date(),
      }),
    )
    .execute();

  return project;
}

async function upsertSeedDiagram(tx: Transaction<DB>, ownerId: string, projectId: string) {
  const slug = slugify(seedDiagramName);
  const existingDiagram = await tx
    .selectFrom('diagrams')
    .select(['id', 'name', 'slug'])
    .where('projectId', '=', projectId)
    .where('slug', '=', slug)
    .where('archivedAt', 'is', null)
    .executeTakeFirst();

  return (
    existingDiagram ??
    (await tx
      .insertInto('diagrams')
      .values({
        createdById: ownerId,
        dialect: 'postgresql',
        name: seedDiagramName,
        projectId,
        slug,
      })
      .returning(['id', 'name', 'slug'])
      .executeTakeFirstOrThrow())
  );
}

async function ensureInitialDiagramState(
  tx: Transaction<DB>,
  options: { createdById: string; diagramId: string; diagramName: string },
): Promise<number> {
  const model = createStarterDiagramModel(options.diagramName);
  const snapshotJson = model as unknown as JsonValue;
  const yjsState = Buffer.from(encodeDiagramModelAsYjsUpdate(model));
  const currentSnapshot = await tx
    .selectFrom('diagram_snapshots')
    .select(['id', 'version'])
    .where('diagramId', '=', options.diagramId)
    .orderBy('version', 'desc')
    .executeTakeFirst();

  const snapshot =
    currentSnapshot ??
    (await tx
      .insertInto('diagram_snapshots')
      .values({
        createdById: options.createdById,
        diagramId: options.diagramId,
        message: 'Initial development seed',
        snapshot: snapshotJson,
        version: 1,
      })
      .returning(['id', 'version'])
      .executeTakeFirstOrThrow());

  await tx
    .updateTable('diagrams')
    .set({
      currentSnapshotId: snapshot.id,
      lastSnapshotVersion: snapshot.version,
      updatedAt: new Date(),
    })
    .where('id', '=', options.diagramId)
    .execute();

  const document = await tx
    .selectFrom('diagram_documents')
    .select(['diagramId', 'schemaCache', 'yjsState'])
    .where('diagramId', '=', options.diagramId)
    .executeTakeFirst();

  if (!document) {
    await tx
      .insertInto('diagram_documents')
      .values({
        diagramId: options.diagramId,
        schemaCache: snapshotJson,
        updatedById: options.createdById,
        yjsState,
      })
      .execute();
  } else if (!document.schemaCache && !document.yjsState) {
    // Existing edited documents are preserved; only an empty placeholder row receives starter content.
    await tx
      .updateTable('diagram_documents')
      .set({
        schemaCache: snapshotJson,
        updatedAt: new Date(),
        updatedById: options.createdById,
        yjsState,
      })
      .where('diagramId', '=', options.diagramId)
      .execute();
  }

  return snapshot.version;
}
