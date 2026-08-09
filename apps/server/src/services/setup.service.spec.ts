import { BadRequestException } from '@nestjs/common';
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
      setupRepository as never,
      userRepository as never,
    );
  }

  it('requires a client secret before enabling OIDC', async () => {
    const service = createService();

    await expect(
      service.updateOidcProviderSettings(createAuthContext(), {
        autoCreateUsers: false,
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
