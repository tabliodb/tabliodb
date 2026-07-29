import { Injectable } from '@nestjs/common';
import { OrganizationRole } from '@tabliodb/shared';
import { Kysely, sql, type Transaction } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, JsonValue } from '../schema/index.js';
import { slugify } from '../utils/slug.js';

export type SetupStatus = {
  completedAt: string | null;
  hasOrganization: boolean;
  hasOwner: boolean;
  isSetupComplete: boolean;
  signupPolicy: 'signup_disabled' | 'invite_only' | 'allowed_domains' | 'sso_only' | 'public_signup';
};

export type InitialSetupOptions = {
  ownerEmail: string;
  ownerName: string;
  ownerPasswordHash: string;
  publicUrl: string;
  workspaceName: string;
};

@Injectable()
export class SetupRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  getStatus(): Promise<SetupStatus> {
    return this.getStatusWith(this.db);
  }

  createInitialSetup(options: InitialSetupOptions) {
    return this.db.transaction().execute(async (tx) => {
      // A transaction-level advisory lock prevents two first-setup browser tabs from creating competing owners.
      await sql`SELECT pg_advisory_xact_lock(742036910251)`.execute(tx);

      const status = await this.getStatusWith(tx);
      if (status.isSetupComplete) {
        return { alreadyComplete: true as const, status };
      }

      const now = new Date();
      const completedAt = now.toISOString();
      const user = await tx
        .insertInto('users')
        .values({
          avatarColor: '#58cc02',
          email: options.ownerEmail,
          name: options.ownerName,
          passwordHash: options.ownerPasswordHash,
        })
        .returning(['id', 'email', 'name', 'avatarColor'])
        .executeTakeFirstOrThrow();

      await tx
        .insertInto('instance_members')
        .values({
          createdById: user.id,
          role: 'owner',
          userId: user.id,
        })
        .execute();

      const organization = await tx
        .insertInto('organizations')
        .values({
          createdById: user.id,
          name: options.workspaceName,
          slug: slugify(options.workspaceName),
        })
        .returning(['id'])
        .executeTakeFirstOrThrow();

      await tx
        .insertInto('organization_members')
        .values({
          createdById: user.id,
          joinedAt: now,
          organizationId: organization.id,
          role: OrganizationRole.Owner,
          status: 'active',
          userId: user.id,
        })
        .execute();

      await tx
        .insertInto('system_settings')
        .values([
          this.createSetting('setup.completed_at', { completedAt }, user.id),
          this.createSetting('auth.signup_policy', { policy: 'invite_only' }, user.id),
          this.createSetting('app.public_url', { url: options.publicUrl }, user.id),
        ])
        .execute();

      return {
        alreadyComplete: false as const,
        status: {
          completedAt,
          hasOrganization: true,
          hasOwner: true,
          isSetupComplete: true,
          signupPolicy: 'invite_only',
        } satisfies SetupStatus,
        user,
      };
    });
  }

  private createSetting(key: string, value: JsonValue, userId: string) {
    return {
      isSecret: false,
      key,
      updatedById: userId,
      value,
    };
  }

  private async getStatusWith(db: Kysely<DB> | Transaction<DB>): Promise<SetupStatus> {
    const completedSetting = await db
      .selectFrom('system_settings')
      .select(['value'])
      .where('key', '=', 'setup.completed_at')
      .executeTakeFirst();

    const signupPolicySetting = await db
      .selectFrom('system_settings')
      .select(['value'])
      .where('key', '=', 'auth.signup_policy')
      .executeTakeFirst();

    const ownerRow = await db
      .selectFrom('instance_members')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('role', '=', 'owner')
      .executeTakeFirstOrThrow();

    const organizationRow = await db
      .selectFrom('organizations')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow();

    const completedAt = this.readCompletedAt(completedSetting?.value ?? null);
    const signupPolicy = this.readSignupPolicy(signupPolicySetting?.value ?? null);
    const hasOwner = Number(ownerRow.count) > 0;
    const hasOrganization = Number(organizationRow.count) > 0;

    return {
      completedAt,
      hasOrganization,
      hasOwner,
      isSetupComplete: Boolean(completedAt && hasOwner && hasOrganization),
      signupPolicy,
    };
  }

  private readCompletedAt(value: JsonValue): string | null {
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.completedAt === 'string') {
      return value.completedAt;
    }

    return null;
  }

  private readSignupPolicy(value: JsonValue): SetupStatus['signupPolicy'] {
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.policy === 'string') {
      const policy = value.policy;
      if (
        policy === 'signup_disabled' ||
        policy === 'invite_only' ||
        policy === 'allowed_domains' ||
        policy === 'sso_only' ||
        policy === 'public_signup'
      ) {
        return policy;
      }
    }

    return 'invite_only';
  }
}
