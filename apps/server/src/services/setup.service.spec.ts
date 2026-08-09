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
    getStatus: vi.fn(),
    updateAuthSettings: vi.fn(),
    updateOidcProviderPublicSettings: vi.fn(),
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
