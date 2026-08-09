import { Injectable } from '@nestjs/common';
import { OrganizationRole } from '@tabliodb/shared';
import { Kysely, sql, type Transaction } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, JsonValue } from '../schema/index.js';
import { slugify } from '../utils/slug.js';
import { CryptoRepository } from './crypto.repository.js';

export type SetupStatus = {
  completedAt: string | null;
  hasOrganization: boolean;
  hasOwner: boolean;
  isSetupComplete: boolean;
  signupPolicy: SignupPolicy;
};

export type SignupPolicy = 'signup_disabled' | 'invite_only' | 'allowed_domains' | 'sso_only' | 'public_signup';

export type InstanceAuthSettings = {
  allowedDomains: string[];
  signupPolicy: SignupPolicy;
};

export type InitialSetupOptions = {
  ownerEmail: string;
  ownerName: string;
  ownerPasswordHash: string;
  publicUrl: string;
  workspaceName: string;
};

export type SecretSettingKey = 'auth.oidc.client_secret' | 'mail.smtp.password';

export type SecretSettingState = {
  isConfigured: boolean;
  key: SecretSettingKey;
  keyId: string | null;
  updatedAt: string | null;
};

@Injectable()
export class SetupRepository {
  constructor(
    @InjectKysely() private readonly db: Kysely<DB>,
    private readonly cryptoRepository: CryptoRepository,
  ) {}

  getStatus(): Promise<SetupStatus> {
    return this.getStatusWith(this.db);
  }

  async getAuthSettings(): Promise<InstanceAuthSettings> {
    const [signupPolicySetting, allowedDomainsSetting] = await Promise.all([
      this.getSettingValue('auth.signup_policy'),
      this.getSettingValue('auth.allowed_domains'),
    ]);

    return {
      allowedDomains: this.readAllowedDomains(allowedDomainsSetting),
      signupPolicy: this.readSignupPolicy(signupPolicySetting),
    };
  }

  async updateAuthSettings(options: InstanceAuthSettings & { updatedById: string }): Promise<InstanceAuthSettings> {
    await this.upsertSettings([
      {
        key: 'auth.signup_policy',
        updatedById: options.updatedById,
        value: { policy: options.signupPolicy },
      },
      {
        key: 'auth.allowed_domains',
        updatedById: options.updatedById,
        value: { domains: options.allowedDomains },
      },
    ]);

    return this.getAuthSettings();
  }

  async getSecretSettingState(key: SecretSettingKey): Promise<SecretSettingState> {
    const setting = await this.db
      .selectFrom('system_settings')
      .select(['isSecret', 'updatedAt', 'value'])
      .where('key', '=', key)
      .executeTakeFirst();

    return {
      isConfigured: Boolean(setting?.isSecret && this.cryptoRepository.isEncryptedJsonSecret(setting.value)),
      key,
      keyId: readSecretKeyId(setting?.value ?? null),
      updatedAt: setting?.updatedAt.toISOString() ?? null,
    };
  }

  async getSecretSettingValue(key: SecretSettingKey): Promise<JsonValue | null> {
    const setting = await this.db
      .selectFrom('system_settings')
      .select(['isSecret', 'value'])
      .where('key', '=', key)
      .executeTakeFirst();

    if (!setting) {
      return null;
    }

    if (!setting.isSecret) {
      throw new Error(`System setting "${key}" is not stored as an encrypted secret.`);
    }

    return this.cryptoRepository.decryptJsonSecret(setting.value, createSecretAssociatedData(key));
  }

  async upsertSecretSetting(key: SecretSettingKey, value: JsonValue, updatedById: string): Promise<SecretSettingState> {
    const now = new Date();
    const encryptedValue = this.cryptoRepository.encryptJsonSecret(value, createSecretAssociatedData(key));

    await this.db
      .insertInto('system_settings')
      .values({
        isSecret: true,
        key,
        updatedAt: now,
        updatedById,
        value: encryptedValue,
      })
      .onConflict((oc) =>
        oc.column('key').doUpdateSet((eb) => ({
          isSecret: true,
          updatedAt: now,
          updatedById: eb.ref('excluded.updatedById'),
          value: eb.ref('excluded.value'),
        })),
      )
      .execute();

    return this.getSecretSettingState(key);
  }

  async deleteSecretSetting(key: SecretSettingKey): Promise<void> {
    await this.db.deleteFrom('system_settings').where('key', '=', key).where('isSecret', '=', true).execute();
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
          cursorColor: '#58cc02',
          email: options.ownerEmail,
          name: options.ownerName,
          passwordHash: options.ownerPasswordHash,
        })
        .returning(['id', 'email', 'name', 'cursorColor'])
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

  private async getSettingValue(key: string): Promise<JsonValue | null> {
    const setting = await this.db
      .selectFrom('system_settings')
      .select(['isSecret', 'value'])
      .where('key', '=', key)
      .executeTakeFirst();

    if (setting?.isSecret) {
      throw new Error(`System setting "${key}" is secret and must be read through getSecretSettingValue().`);
    }

    return setting?.value ?? null;
  }

  private async upsertSettings(
    settings: Array<{
      key: string;
      updatedById: string;
      value: JsonValue;
    }>,
  ): Promise<void> {
    const now = new Date();

    await this.db
      .insertInto('system_settings')
      .values(
        settings.map((setting) => ({
          isSecret: false,
          key: setting.key,
          updatedAt: now,
          updatedById: setting.updatedById,
          value: setting.value,
        })),
      )
      .onConflict((oc) =>
        oc.column('key').doUpdateSet((eb) => ({
          updatedAt: now,
          updatedById: eb.ref('excluded.updatedById'),
          value: eb.ref('excluded.value'),
        })),
      )
      .execute();
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

  private readAllowedDomains(value: JsonValue): string[] {
    if (value && typeof value === 'object' && !Array.isArray(value) && Array.isArray(value.domains)) {
      return value.domains.filter((domain): domain is string => typeof domain === 'string');
    }

    return [];
  }

  private readSignupPolicy(value: JsonValue): SignupPolicy {
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

function createSecretAssociatedData(key: SecretSettingKey): string {
  return `tabliodb:system_settings:${key}`;
}

function readSecretKeyId(value: JsonValue): string | null {
  if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.keyId === 'string') {
    return value.keyId;
  }

  return null;
}
