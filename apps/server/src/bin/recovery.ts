import { OrganizationRole } from '@tabliodb/shared';
import { hash } from 'bcrypt';
import { Kysely, sql, type Transaction } from 'kysely';
import { loadEnv } from '../config/env.js';
import { SALT_ROUNDS } from '../constants.js';
import type { DB, JsonValue } from '../schema/index.js';
import { getKyselyConfig } from '../utils/database.js';
import { slugify } from '../utils/slug.js';

type RecoveryCommand = 'create-owner' | 'promote-owner' | 'reset-password';

type ParsedArgs = {
  command: RecoveryCommand | null;
  options: Map<string, string>;
};

const env = loadEnv();
const db = new Kysely<DB>(getKyselyConfig(env.database.url));

try {
  const args = parseArgs(process.argv.slice(2));

  if (!args.command) {
    printHelp();
    process.exitCode = 1;
  } else {
    await runRecoveryCommand(args.command, args.options);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.destroy();
}

async function runRecoveryCommand(command: RecoveryCommand, options: Map<string, string>): Promise<void> {
  const email = readRequiredOption(options, 'email', 'TABLIODB_RECOVERY_EMAIL').trim().toLowerCase();

  if (command === 'create-owner') {
    const password = readRequiredOption(options, 'password', 'TABLIODB_RECOVERY_PASSWORD');
    const name = readOptionalOption(options, 'name', 'TABLIODB_RECOVERY_NAME') ?? inferNameFromEmail(email);
    const workspaceName =
      readOptionalOption(options, 'workspace', 'TABLIODB_RECOVERY_WORKSPACE') ?? `${name}'s Workspace`;

    const result = await db.transaction().execute((tx) =>
      createOrRepairOwner(tx, {
        email,
        name,
        password,
        workspaceName,
      }),
    );

    console.log(`Owner ready: ${result.email}`);
    console.log(`Workspace ready: ${result.workspaceName}`);
    console.log(`Password written: yes`);
    return;
  }

  if (command === 'reset-password') {
    const password = readRequiredOption(options, 'password', 'TABLIODB_RECOVERY_PASSWORD');
    const result = await resetPassword(email, password);

    console.log(`Password reset: ${result.email}`);
    console.log(`Revoked sessions: ${result.revokedSessions}`);
    return;
  }

  const result = await db.transaction().execute((tx) => promoteOwner(tx, email));

  console.log(`Promoted owner: ${result.email}`);
  console.log(`Workspace ready: ${result.workspaceName}`);
}

async function createOrRepairOwner(
  tx: Transaction<DB>,
  options: { email: string; name: string; password: string; workspaceName: string },
) {
  await sql`SELECT pg_advisory_xact_lock(742036910253)`.execute(tx);

  const now = new Date();
  const passwordHash = await hash(options.password, SALT_ROUNDS);
  const existingUser = await tx
    .selectFrom('users')
    .select(['id', 'email', 'name'])
    .where('email', '=', options.email)
    .where('deletedAt', 'is', null)
    .executeTakeFirst();

  const user =
    existingUser ??
    (await tx
      .insertInto('users')
      .values({
        cursorColor: '#58cc02',
        email: options.email,
        name: options.name,
        passwordChangeRequired: false,
        passwordHash,
      })
      .returning(['id', 'email', 'name'])
      .executeTakeFirstOrThrow());

  if (existingUser) {
    await tx
      .updateTable('users')
      .set({
        disabledAt: null,
        isDisabled: false,
        name: options.name || existingUser.name,
        passwordChangeRequired: false,
        passwordChangedAt: now,
        passwordHash,
        updatedAt: now,
      })
      .where('id', '=', existingUser.id)
      .execute();
  }

  await upsertInstanceOwner(tx, user.id);
  const organization = await ensureOwnerWorkspace(tx, {
    ownerId: user.id,
    workspaceName: options.workspaceName,
  });
  await ensureSetupSettings(tx, user.id);

  return {
    email: options.email,
    workspaceName: organization.name,
  };
}

async function promoteOwner(tx: Transaction<DB>, email: string) {
  await sql`SELECT pg_advisory_xact_lock(742036910254)`.execute(tx);

  const user = await tx
    .selectFrom('users')
    .select(['id', 'email', 'name'])
    .where('email', '=', email)
    .where('deletedAt', 'is', null)
    .executeTakeFirst();

  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  await tx
    .updateTable('users')
    .set({
      disabledAt: null,
      isDisabled: false,
      updatedAt: new Date(),
    })
    .where('id', '=', user.id)
    .execute();
  await upsertInstanceOwner(tx, user.id);
  const organization = await ensureOwnerWorkspace(tx, {
    ownerId: user.id,
    workspaceName: `${user.name}'s Workspace`,
  });
  await ensureSetupSettings(tx, user.id);

  return {
    email: user.email,
    workspaceName: organization.name,
  };
}

async function resetPassword(email: string, password: string) {
  const now = new Date();
  const passwordHash = await hash(password, SALT_ROUNDS);
  const result = await db.transaction().execute(async (tx) => {
    const user = await tx
      .selectFrom('users')
      .select(['id', 'email'])
      .where('email', '=', email)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    if (!user) {
      throw new Error(`User not found: ${email}`);
    }

    await tx
      .updateTable('users')
      .set({
        disabledAt: null,
        isDisabled: false,
        passwordChangeRequired: false,
        passwordChangedAt: now,
        passwordHash,
        updatedAt: now,
      })
      .where('id', '=', user.id)
      .execute();

    const revoked = await tx
      .updateTable('sessions')
      .set({
        revokedAt: now,
        updatedAt: now,
      })
      .where('userId', '=', user.id)
      .where('revokedAt', 'is', null)
      .executeTakeFirst();

    return {
      email: user.email,
      revokedSessions: Number(revoked.numUpdatedRows),
    };
  });

  return result;
}

async function upsertInstanceOwner(tx: Transaction<DB>, userId: string): Promise<void> {
  await tx
    .insertInto('instance_members')
    .values({
      createdById: userId,
      role: 'owner',
      userId,
    })
    .onConflict((oc) =>
      oc.column('userId').doUpdateSet({
        role: 'owner',
      }),
    )
    .execute();
}

async function ensureOwnerWorkspace(
  tx: Transaction<DB>,
  options: { ownerId: string; workspaceName: string },
): Promise<{ id: string; name: string }> {
  const existingMembership = await tx
    .selectFrom('organization_members')
    .innerJoin('organizations', 'organizations.id', 'organization_members.organizationId')
    .select(['organizations.id', 'organizations.name'])
    .where('organization_members.userId', '=', options.ownerId)
    .where('organization_members.role', '=', OrganizationRole.Owner)
    .where('organizations.archivedAt', 'is', null)
    .executeTakeFirst();

  if (existingMembership) {
    return existingMembership;
  }

  const organization = await tx
    .insertInto('organizations')
    .values({
      createdById: options.ownerId,
      name: options.workspaceName,
      slug: await createAvailableOrganizationSlug(tx, options.workspaceName),
    })
    .returning(['id', 'name'])
    .executeTakeFirstOrThrow();

  await tx
    .insertInto('organization_members')
    .values({
      createdById: options.ownerId,
      joinedAt: new Date(),
      organizationId: organization.id,
      role: OrganizationRole.Owner,
      status: 'active',
      userId: options.ownerId,
    })
    .execute();

  return organization;
}

async function createAvailableOrganizationSlug(tx: Transaction<DB>, name: string): Promise<string> {
  const baseSlug = slugify(name) || 'workspace';

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const existing = await tx.selectFrom('organizations').select('id').where('slug', '=', slug).executeTakeFirst();

    if (!existing) {
      return slug;
    }
  }

  throw new Error(`Could not find an available workspace slug for "${name}"`);
}

async function ensureSetupSettings(tx: Transaction<DB>, userId: string): Promise<void> {
  const now = new Date();

  await upsertMissingSystemSetting(tx, 'setup.completed_at', { completedAt: now.toISOString() }, userId);
  await upsertMissingSystemSetting(tx, 'auth.signup_policy', { policy: 'invite_only' }, userId);
  await upsertMissingSystemSetting(tx, 'app.public_url', { url: env.server.publicUrl }, userId);
}

async function upsertMissingSystemSetting(
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
    .onConflict((oc) => oc.column('key').doNothing())
    .execute();
}

function parseArgs(argv: string[]): ParsedArgs {
  const [rawCommand, ...rest] = argv;
  const command = isRecoveryCommand(rawCommand) ? rawCommand : null;
  const options = new Map<string, string>();

  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];

    if (!item.startsWith('--')) {
      continue;
    }

    const [rawKey, inlineValue] = item.slice(2).split('=', 2);
    const nextValue = inlineValue ?? rest[index + 1];

    if (!rawKey || !nextValue || nextValue.startsWith('--')) {
      throw new Error(`Missing value for --${rawKey}`);
    }

    options.set(rawKey, nextValue);

    if (inlineValue === undefined) {
      index += 1;
    }
  }

  return { command, options };
}

function readRequiredOption(options: Map<string, string>, optionName: string, envName: string): string {
  const value = readOptionalOption(options, optionName, envName);

  if (!value) {
    throw new Error(`Missing --${optionName} or ${envName}`);
  }

  return value;
}

function readOptionalOption(options: Map<string, string>, optionName: string, envName: string): string | undefined {
  const value = options.get(optionName) ?? process.env[envName];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function isRecoveryCommand(value: string | undefined): value is RecoveryCommand {
  return value === 'create-owner' || value === 'promote-owner' || value === 'reset-password';
}

function inferNameFromEmail(email: string): string {
  return (
    email
      .split('@')[0]
      ?.replace(/[._-]+/g, ' ')
      .trim() || 'Tabliodb Owner'
  );
}

function printHelp(): void {
  console.log(`Tabliodb recovery CLI

Usage:
  bun run recovery -- create-owner --email owner@example.com --password "new-password" --name "Owner Name" --workspace "Main Workspace"
  bun run recovery -- reset-password --email owner@example.com --password "new-password"
  bun run recovery -- promote-owner --email existing@example.com

Env fallback:
  TABLIODB_RECOVERY_EMAIL
  TABLIODB_RECOVERY_PASSWORD
  TABLIODB_RECOVERY_NAME
  TABLIODB_RECOVERY_WORKSPACE`);
}
