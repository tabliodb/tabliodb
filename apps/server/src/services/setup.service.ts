import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { OrganizationRole } from '@tabliodb/shared';
import { AuditAction, SALT_ROUNDS } from '../constants.js';
import type { AuthContext } from '../database.js';
import {
  InstanceAuthSettingsDto,
  InstanceAuthSettingsUpdateDto,
  OidcProviderSettingsDto,
  OidcProviderSettingsUpdateDto,
  SetupCreateDto,
  SetupCreateResponseDto,
  SetupStatusResponseDto,
  SmtpSettingsDto,
  SmtpSettingsUpdateDto,
} from '../dtos/setup.dto.js';
import { AuditLogRepository } from '../repositories/audit-log.repository.js';
import { ConfigRepository } from '../repositories/config.repository.js';
import { CryptoRepository } from '../repositories/crypto.repository.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { SetupRepository, type SmtpPublicSettings } from '../repositories/setup.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { JsonValue } from '../schema/index.js';
import { AuthService } from './auth.service.js';

@Injectable()
export class SetupService {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly authService: AuthService,
    private readonly configRepository: ConfigRepository,
    private readonly cryptoRepository: CryptoRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly setupRepository: SetupRepository,
    private readonly userRepository: UserRepository,
  ) {}

  getStatus(): Promise<SetupStatusResponseDto> {
    return this.setupRepository.getStatus();
  }

  async getAuthSettings(auth: AuthContext): Promise<InstanceAuthSettingsDto> {
    await this.requireInstanceManager(auth);

    return this.setupRepository.getAuthSettings();
  }

  async updateAuthSettings(auth: AuthContext, dto: InstanceAuthSettingsUpdateDto): Promise<InstanceAuthSettingsDto> {
    await this.requireInstanceManager(auth);

    const before = await this.setupRepository.getAuthSettings();
    const allowedDomains = this.normalizeAllowedDomains(dto.allowedDomains);

    if (dto.signupPolicy === 'allowed_domains' && allowedDomains.length === 0) {
      throw new BadRequestException('Allowed domain signup requires at least one email domain');
    }

    const after = await this.setupRepository.updateAuthSettings({
      allowedDomains,
      signupPolicy: dto.signupPolicy,
      updatedById: auth.user.id,
    });

    await this.auditLogRepository.create({
      action: AuditAction.InstanceAuthSettingsUpdated,
      actorId: auth.user.id,
      entityId: 'auth.signup_policy',
      entityType: 'system_setting',
      ipAddress: auth.request?.ipAddress ?? null,
      metadata: {
        allowedDomains: {
          after: after.allowedDomains,
          before: before.allowedDomains,
        },
        signupPolicy: {
          after: after.signupPolicy,
          before: before.signupPolicy,
        },
      } satisfies Record<string, JsonValue>,
      organizationId: null,
      folderId: null,
      requestId: auth.request?.requestId ?? null,
      userAgent: auth.request?.userAgent ?? null,
    });

    return after;
  }

  async getOidcProviderSettings(auth: AuthContext): Promise<OidcProviderSettingsDto> {
    await this.requireInstanceManager(auth);

    return this.setupRepository.getOidcProviderSettings();
  }

  async updateOidcProviderSettings(
    auth: AuthContext,
    dto: OidcProviderSettingsUpdateDto,
  ): Promise<OidcProviderSettingsDto> {
    await this.requireInstanceManager(auth);

    const before = await this.setupRepository.getOidcProviderSettings();
    const scopes = this.normalizeOidcScopes(dto.scopes);
    const clientSecret = dto.clientSecret?.trim();
    const willClearClientSecret = dto.clearClientSecret === true && !clientSecret;
    const clientSecretConfigured = Boolean(clientSecret || (before.clientSecretConfigured && !willClearClientSecret));
    const publicSettings = {
      autoCreateUsers: dto.autoCreateUsers,
      autoJoinOrganizationId: dto.autoJoinOrganizationId,
      autoJoinOrganizationRole: dto.autoJoinOrganizationId
        ? (dto.autoJoinOrganizationRole ?? OrganizationRole.Member)
        : null,
      buttonLabel: dto.buttonLabel.trim(),
      clientId: dto.clientId?.trim() || null,
      enabled: dto.enabled,
      issuerUrl: dto.issuerUrl?.trim().replace(/\/+$/, '') || null,
      scopes,
    };

    if (publicSettings.enabled) {
      this.assertOidcProviderIsComplete(publicSettings, clientSecretConfigured);
    }

    await this.assertOidcAutoJoinOrganizationExists(publicSettings.autoJoinOrganizationId);

    if (clientSecret) {
      await this.setupRepository.upsertSecretSetting('auth.oidc.client_secret', { clientSecret }, auth.user.id);
    } else if (willClearClientSecret) {
      await this.setupRepository.deleteSecretSetting('auth.oidc.client_secret');
    }

    const after = await this.setupRepository.updateOidcProviderPublicSettings({
      ...publicSettings,
      updatedById: auth.user.id,
    });

    await this.auditLogRepository.create({
      action: AuditAction.InstanceOidcSettingsUpdated,
      actorId: auth.user.id,
      entityId: 'auth.oidc.provider',
      entityType: 'system_setting',
      ipAddress: auth.request?.ipAddress ?? null,
      metadata: {
        autoCreateUsers: {
          after: after.autoCreateUsers,
          before: before.autoCreateUsers,
        },
        autoJoinOrganizationId: {
          after: after.autoJoinOrganizationId,
          before: before.autoJoinOrganizationId,
        },
        autoJoinOrganizationRole: {
          after: after.autoJoinOrganizationRole,
          before: before.autoJoinOrganizationRole,
        },
        buttonLabel: {
          after: after.buttonLabel,
          before: before.buttonLabel,
        },
        clientId: {
          after: after.clientId,
          before: before.clientId,
        },
        clientSecretConfigured: {
          after: after.clientSecretConfigured,
          before: before.clientSecretConfigured,
        },
        clientSecretUpdated: Boolean(clientSecret || willClearClientSecret),
        enabled: {
          after: after.enabled,
          before: before.enabled,
        },
        issuerUrl: {
          after: after.issuerUrl,
          before: before.issuerUrl,
        },
        scopes: {
          after: after.scopes,
          before: before.scopes,
        },
      } satisfies Record<string, JsonValue>,
      organizationId: null,
      folderId: null,
      requestId: auth.request?.requestId ?? null,
      userAgent: auth.request?.userAgent ?? null,
    });

    return after;
  }

  async getSmtpSettings(auth: AuthContext): Promise<SmtpSettingsDto> {
    await this.requireInstanceManager(auth);

    return this.setupRepository.getSmtpSettings();
  }

  async updateSmtpSettings(auth: AuthContext, dto: SmtpSettingsUpdateDto): Promise<SmtpSettingsDto> {
    await this.requireInstanceManager(auth);

    const before = await this.setupRepository.getSmtpSettings();
    const smtpPassword = dto.password;
    const willClearPassword = dto.clearPassword === true && !smtpPassword;
    const passwordConfigured = Boolean(smtpPassword || (before.passwordConfigured && !willClearPassword));
    const publicSettings = this.normalizeSmtpPublicSettings(dto);

    if (publicSettings.enabled) {
      this.assertSmtpSettingsAreComplete(publicSettings, passwordConfigured);
    }

    if (smtpPassword) {
      // Password SMTP tetap write-only dan disimpan sebagai encrypted system setting, bukan ikut payload public mail.smtp.
      await this.setupRepository.upsertSecretSetting('mail.smtp.password', { password: smtpPassword }, auth.user.id);
    } else if (willClearPassword) {
      await this.setupRepository.deleteSecretSetting('mail.smtp.password');
    }

    const after = await this.setupRepository.updateSmtpPublicSettings({
      ...publicSettings,
      updatedById: auth.user.id,
    });

    await this.auditLogRepository.create({
      action: AuditAction.InstanceSmtpSettingsUpdated,
      actorId: auth.user.id,
      entityId: 'mail.smtp',
      entityType: 'system_setting',
      ipAddress: auth.request?.ipAddress ?? null,
      metadata: {
        enabled: {
          after: after.enabled,
          before: before.enabled,
        },
        fromEmail: {
          after: after.fromEmail,
          before: before.fromEmail,
        },
        fromName: {
          after: after.fromName,
          before: before.fromName,
        },
        host: {
          after: after.host,
          before: before.host,
        },
        passwordConfigured: {
          after: after.passwordConfigured,
          before: before.passwordConfigured,
        },
        passwordUpdated: Boolean(smtpPassword || willClearPassword),
        port: {
          after: after.port,
          before: before.port,
        },
        replyToEmail: {
          after: after.replyToEmail,
          before: before.replyToEmail,
        },
        security: {
          after: after.security,
          before: before.security,
        },
        username: {
          after: after.username,
          before: before.username,
        },
      } satisfies Record<string, JsonValue>,
      organizationId: null,
      folderId: null,
      requestId: auth.request?.requestId ?? null,
      userAgent: auth.request?.userAgent ?? null,
    });

    return after;
  }

  async complete(dto: SetupCreateDto): Promise<SetupCreateResponseDto> {
    const passwordHash = await this.cryptoRepository.hashBcrypt(dto.ownerPassword, SALT_ROUNDS);
    const result = await this.setupRepository.createInitialSetup({
      ownerEmail: dto.ownerEmail.trim().toLowerCase(),
      ownerName: dto.ownerName.trim(),
      ownerPasswordHash: passwordHash,
      publicUrl: dto.publicUrl ?? this.configRepository.getEnv().server.publicUrl,
      workspaceName: dto.workspaceName.trim(),
    });

    if (result.alreadyComplete) {
      throw new BadRequestException('Tabliodb has already been set up');
    }

    const login = await this.authService.createLoginResponse(result.user, {
      sessionBinding: dto.sessionBinding,
    });

    return {
      ...login,
      setup: result.status,
    };
  }

  getCookieSecureDefault(): boolean {
    return this.authService.getCookieSecureDefault();
  }

  private async requireInstanceManager(auth: AuthContext) {
    const instanceMember = await this.userRepository.getInstanceRole(auth.user.id);

    if (!instanceMember) {
      throw new ForbiddenException('Instance admin access is required');
    }

    return instanceMember.role;
  }

  private normalizeAllowedDomains(input: string[]): string[] {
    const domains = new Set<string>();

    for (const value of input) {
      const domain = value.trim().toLowerCase().replace(/^@+/, '');

      if (!domain) {
        continue;
      }

      if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/.test(domain)) {
        throw new BadRequestException(`Invalid allowed email domain "${value}"`);
      }

      domains.add(domain);
    }

    return [...domains].sort();
  }

  private normalizeOidcScopes(input: string[]): string[] {
    const scopes = new Set<string>();

    for (const value of input) {
      const scope = value.trim();

      if (!scope) {
        continue;
      }

      if (!/^[A-Za-z0-9:._/-]+$/.test(scope)) {
        throw new BadRequestException(`Invalid OIDC scope "${value}"`);
      }

      scopes.add(scope);
    }

    scopes.add('openid');

    return [...scopes];
  }

  private assertOidcProviderIsComplete(
    settings: {
      clientId: string | null;
      issuerUrl: string | null;
      scopes: string[];
    },
    clientSecretConfigured: boolean,
  ): void {
    if (!settings.issuerUrl) {
      throw new BadRequestException('OIDC issuer URL is required when OIDC is enabled');
    }

    if (!settings.clientId) {
      throw new BadRequestException('OIDC client id is required when OIDC is enabled');
    }

    if (!clientSecretConfigured) {
      throw new BadRequestException('OIDC client secret is required when OIDC is enabled');
    }

    if (!settings.scopes.includes('openid')) {
      throw new BadRequestException('OIDC scope must include openid');
    }
  }

  private async assertOidcAutoJoinOrganizationExists(organizationId: string | null): Promise<void> {
    if (!organizationId) {
      return;
    }

    const organization = await this.organizationRepository.getActiveById(organizationId);

    if (!organization) {
      throw new BadRequestException('OIDC auto-join workspace does not exist or has been archived');
    }
  }

  private normalizeSmtpPublicSettings(dto: SmtpSettingsUpdateDto): SmtpPublicSettings {
    return {
      enabled: dto.enabled,
      fromEmail: dto.fromEmail?.trim().toLowerCase() || null,
      fromName: dto.fromName?.trim() || null,
      host: dto.host?.trim() || null,
      port: dto.port,
      replyToEmail: dto.replyToEmail?.trim().toLowerCase() || null,
      security: dto.security,
      username: dto.username?.trim() || null,
    };
  }

  private assertSmtpSettingsAreComplete(settings: SmtpPublicSettings, passwordConfigured: boolean): void {
    if (!settings.host) {
      throw new BadRequestException('SMTP host is required when SMTP is enabled');
    }

    if (!settings.port) {
      throw new BadRequestException('SMTP port is required when SMTP is enabled');
    }

    if (!settings.fromEmail) {
      throw new BadRequestException('SMTP from email is required when SMTP is enabled');
    }

    if (settings.username && !passwordConfigured) {
      throw new BadRequestException('SMTP password is required when SMTP username is configured');
    }
  }
}
