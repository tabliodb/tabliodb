import { BadRequestException } from '@nestjs/common';
import { OrganizationRole } from '@tabliodb/shared';
import { describe, expect, it, vi } from 'vitest';
import { AuditAction } from '../constants.js';
import type { AuthContext } from '../database.js';
import { SetupService } from './setup.service.js';

describe(SetupService.name, () => {
  const auditLogRepository = {
    create: vi.fn(),
  };
  const authService = {
    createLoginResponse: vi.fn(),
    getCookieSecureDefault: vi.fn(),
  };
  const configRepository = {
    getEnv: vi.fn(),
  };
  const cryptoRepository = {
    hashBcrypt: vi.fn(),
  };
  const organizationRepository = {
    getActiveById: vi.fn(),
  };
  const setupRepository = {
    deleteSecretSetting: vi.fn(),
    getAuthSettings: vi.fn(),
    getOidcProviderSettings: vi.fn(),
    getSmtpSettings: vi.fn(),
    getStatus: vi.fn(),
    updateAuthSettings: vi.fn(),
    updateOidcProviderPublicSettings: vi.fn(),
    updateSmtpPublicSettings: vi.fn(),
    upsertSecretSetting: vi.fn(),
  };
  const userRepository = {
    getInstanceRole: vi.fn(),
  };

  function createService() {
    vi.resetAllMocks();
    userRepository.getInstanceRole.mockResolvedValue({ role: 'owner' });
    setupRepository.getOidcProviderSettings.mockResolvedValue({
      autoCreateUsers: false,
      autoJoinOrganizationId: null,
      autoJoinOrganizationRole: null,
      buttonLabel: 'Continue with SSO',
      clientId: null,
      clientSecretConfigured: false,
      clientSecretKeyId: null,
      clientSecretUpdatedAt: null,
      enabled: false,
      issuerUrl: null,
      scopes: ['openid', 'email', 'profile'],
    });
    setupRepository.updateOidcProviderPublicSettings.mockImplementation(async (settings) => ({
      autoCreateUsers: settings.autoCreateUsers,
      autoJoinOrganizationId: settings.autoJoinOrganizationId,
      autoJoinOrganizationRole: settings.autoJoinOrganizationRole,
      buttonLabel: settings.buttonLabel,
      clientId: settings.clientId,
      clientSecretConfigured: Boolean(setupRepository.upsertSecretSetting.mock.calls.length),
      clientSecretKeyId: 'key-id',
      clientSecretUpdatedAt: '2026-08-09T03:00:00.000Z',
      enabled: settings.enabled,
      issuerUrl: settings.issuerUrl,
      scopes: settings.scopes,
    }));
    setupRepository.getSmtpSettings.mockResolvedValue({
      enabled: false,
      fromEmail: null,
      fromName: 'Tabliodb',
      host: null,
      passwordConfigured: false,
      passwordKeyId: null,
      passwordUpdatedAt: null,
      port: 587,
      replyToEmail: null,
      security: 'starttls',
      username: null,
    });
    setupRepository.updateSmtpPublicSettings.mockImplementation(async (settings) => ({
      enabled: settings.enabled,
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
      host: settings.host,
      passwordConfigured: Boolean(setupRepository.upsertSecretSetting.mock.calls.length),
      passwordKeyId: 'key-id',
      passwordUpdatedAt: '2026-08-09T03:00:00.000Z',
      port: settings.port,
      replyToEmail: settings.replyToEmail,
      security: settings.security,
      username: settings.username,
    }));

    return new SetupService(
      auditLogRepository as never,
      authService as never,
      configRepository as never,
      cryptoRepository as never,
      organizationRepository as never,
      setupRepository as never,
      userRepository as never,
    );
  }

  it('requires a client secret before enabling OIDC', async () => {
    const service = createService();

    await expect(
      service.updateOidcProviderSettings(createAuthContext(), {
        autoCreateUsers: false,
        autoJoinOrganizationId: null,
        autoJoinOrganizationRole: null,
        buttonLabel: 'Company SSO',
        clientId: 'tabliodb',
        enabled: true,
        issuerUrl: 'https://id.company.test',
        scopes: ['openid', 'email', 'profile'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(setupRepository.updateOidcProviderPublicSettings).not.toHaveBeenCalled();
  });

  it('stores the OIDC client secret through the encrypted secret boundary and keeps it out of audit metadata', async () => {
    const service = createService();

    await service.updateOidcProviderSettings(createAuthContext(), {
      autoCreateUsers: true,
      autoJoinOrganizationId: null,
      autoJoinOrganizationRole: null,
      buttonLabel: 'Company SSO',
      clientId: 'tabliodb',
      clientSecret: 'raw-secret',
      enabled: true,
      issuerUrl: 'https://id.company.test/',
      scopes: ['email', 'profile'],
    });

    expect(setupRepository.upsertSecretSetting).toHaveBeenCalledWith(
      'auth.oidc.client_secret',
      { clientSecret: 'raw-secret' },
      'actor-id',
    );
    expect(setupRepository.updateOidcProviderPublicSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'tabliodb',
        enabled: true,
        issuerUrl: 'https://id.company.test',
        scopes: ['email', 'profile', 'openid'],
      }),
    );
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.InstanceOidcSettingsUpdated,
        metadata: expect.not.stringContaining('raw-secret'),
      }),
    );
  });

  it('validates the OIDC auto-join workspace before saving provider settings', async () => {
    const service = createService();
    organizationRepository.getActiveById.mockResolvedValueOnce({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Company Workspace',
      slug: 'company-workspace',
    });

    await service.updateOidcProviderSettings(createAuthContext(), {
      autoCreateUsers: true,
      autoJoinOrganizationId: '11111111-1111-4111-8111-111111111111',
      autoJoinOrganizationRole: OrganizationRole.Member,
      buttonLabel: 'Company SSO',
      clientId: 'tabliodb',
      clientSecret: 'raw-secret',
      enabled: true,
      issuerUrl: 'https://id.company.test',
      scopes: ['openid', 'email', 'profile'],
    });

    expect(organizationRepository.getActiveById).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
    expect(setupRepository.updateOidcProviderPublicSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        autoJoinOrganizationId: '11111111-1111-4111-8111-111111111111',
        autoJoinOrganizationRole: 'member',
      }),
    );
  });

  it('requires a stored SMTP password before enabling authenticated SMTP', async () => {
    const service = createService();

    await expect(
      service.updateSmtpSettings(createAuthContext(), {
        enabled: true,
        fromEmail: 'noreply@company.test',
        fromName: 'Tabliodb',
        host: 'smtp.company.test',
        port: 587,
        replyToEmail: null,
        security: 'starttls',
        username: 'mailer',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(setupRepository.updateSmtpPublicSettings).not.toHaveBeenCalled();
  });

  it('stores the SMTP password through the encrypted secret boundary and keeps it out of audit metadata', async () => {
    const service = createService();

    await service.updateSmtpSettings(createAuthContext(), {
      enabled: true,
      fromEmail: 'NoReply@Company.test',
      fromName: ' Tabliodb Mail ',
      host: ' smtp.company.test ',
      password: 'smtp-raw-secret',
      port: 587,
      replyToEmail: 'Help@Company.test',
      security: 'starttls',
      username: ' mailer ',
    });

    expect(setupRepository.upsertSecretSetting).toHaveBeenCalledWith(
      'mail.smtp.password',
      { password: 'smtp-raw-secret' },
      'actor-id',
    );
    expect(setupRepository.updateSmtpPublicSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        fromEmail: 'noreply@company.test',
        fromName: 'Tabliodb Mail',
        host: 'smtp.company.test',
        port: 587,
        replyToEmail: 'help@company.test',
        security: 'starttls',
        username: 'mailer',
      }),
    );
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.InstanceSmtpSettingsUpdated,
        metadata: expect.not.stringContaining('smtp-raw-secret'),
      }),
    );
  });
});

function createAuthContext(): AuthContext {
  return {
    request: {
      ipAddress: '127.0.0.1',
      requestId: 'request-id',
      userAgent: 'vitest',
    },
    user: {
      avatarUrl: null,
      cursorColor: '#58cc02',
      email: 'owner@tabliodb.local',
      id: 'actor-id',
      name: 'Owner',
      passwordChangeRequired: false,
    },
  };
}
