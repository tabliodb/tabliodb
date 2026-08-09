import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Permission } from '@tabliodb/shared';
import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../database.js';
import { AuthService } from './auth.service.js';

const authWithLimitedApiKey: AuthContext = {
  apiKey: {
    id: 'api-key-id',
    permissions: [Permission.ApiKeyManage],
  },
  user: {
    avatarUrl: null,
    cursorColor: '#58cc02',
    email: 'automation@tabliodb.local',
    id: 'user-id',
    name: 'Automation User',
    passwordChangeRequired: false,
  },
};

describe(AuthService.name, () => {
  const apiKeyRepository = {
    create: vi.fn(),
    getByToken: vi.fn(),
  };
  const auditLogRepository = {
    create: vi.fn(),
  };
  const configRepository = {
    getEnv: vi.fn(),
  };
  const cryptoRepository = {
    compareBcrypt: vi.fn(),
    hashBcrypt: vi.fn(),
    hashSha256: vi.fn(),
    randomBytesAsText: vi.fn(),
  };
  const fileService = {
    clearUserAvatar: vi.fn(),
    uploadUserAvatar: vi.fn(),
  };
  const organizationRepository = {
    createPersonalOrganization: vi.fn(),
  };
  const passwordResetRepository = {
    consumeValidToken: vi.fn(),
    createForUser: vi.fn(),
  };
  const redisService = {
    getAndDelete: vi.fn(),
    setIfAbsent: vi.fn(),
  };
  const sessionRepository = {
    create: vi.fn(),
    delete: vi.fn(),
    getByToken: vi.fn(),
    revokeAllForUser: vi.fn(),
    updateActivity: vi.fn(),
  };
  const setupRepository = {
    getAuthSettings: vi.fn(),
    getOidcProviderSettings: vi.fn(),
    getSecretSettingValue: vi.fn(),
    getStatus: vi.fn(),
  };
  const userRepository = {
    create: vi.fn(),
    getAnyByEmail: vi.fn(),
    getAuthUserById: vi.fn(),
    getByEmail: vi.fn(),
    getPasswordAuthUserById: vi.fn(),
    updatePasswordHash: vi.fn(),
    updateProfile: vi.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new AuthService(
      apiKeyRepository as never,
      auditLogRepository as never,
      configRepository as never,
      cryptoRepository as never,
      fileService as never,
      organizationRepository as never,
      passwordResetRepository as never,
      redisService as never,
      sessionRepository as never,
      setupRepository as never,
      userRepository as never,
    );

    configRepository.getEnv.mockReturnValue({
      auth: {
        exposePasswordResetToken: true,
      },
      server: {
        publicUrl: 'https://tabliodb.test',
        webPublicUrl: 'https://app.tabliodb.test',
      },
    });
    setupRepository.getStatus.mockResolvedValue({
      isSetupComplete: true,
    });
    setupRepository.getAuthSettings.mockResolvedValue({
      allowedDomains: [],
      signupPolicy: 'invite_only',
    });
    setupRepository.getOidcProviderSettings.mockResolvedValue({
      autoCreateUsers: false,
      buttonLabel: 'Continue with SSO',
      clientId: null,
      clientSecretConfigured: false,
      enabled: false,
      issuerUrl: null,
      scopes: ['openid', 'email', 'profile'],
    });
    cryptoRepository.hashBcrypt.mockResolvedValue('hashed-password');
    cryptoRepository.hashSha256.mockReturnValue(Buffer.from('hashed-session-token'));
    cryptoRepository.randomBytesAsText.mockReturnValue('raw-session-token');
    redisService.setIfAbsent.mockResolvedValue(true);
    userRepository.getAnyByEmail.mockResolvedValue(undefined);
    userRepository.getByEmail.mockResolvedValue(undefined);
    userRepository.create.mockResolvedValue({
      avatarUrl: null,
      cursorColor: '#58cc02',
      email: 'new@company.test',
      id: 'created-user-id',
      name: 'New User',
    });
    userRepository.updatePasswordHash.mockResolvedValue({
      id: 'reset-user-id',
      email: 'reset@company.test',
      name: 'Reset User',
      organizations: [{ id: 'organization-id' }],
    });
    passwordResetRepository.createForUser.mockResolvedValue({
      expiresAt: new Date('2026-07-30T12:00:00.000Z'),
      id: 'reset-token-id',
    });
    sessionRepository.revokeAllForUser.mockResolvedValue(2);
    sessionRepository.create.mockResolvedValue({ id: 'session-id' });
  });

  it('prevents a limited API key from minting a broader key', async () => {
    await expect(
      service.createApiKey(authWithLimitedApiKey, {
        name: 'Too powerful',
        permissions: [Permission.All],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Secret generation happens only after authorization so rejected requests do not create throwaway credentials.
    expect(cryptoRepository.randomBytesAsText).not.toHaveBeenCalled();
    expect(apiKeyRepository.create).not.toHaveBeenCalled();
  });

  it('allows password sign-up when the email matches an allowed domain', async () => {
    setupRepository.getAuthSettings.mockResolvedValue({
      allowedDomains: ['company.test'],
      signupPolicy: 'allowed_domains',
    });

    const response = await service.signUp({
      email: ' New@Company.Test ',
      name: ' New User ',
      password: 'password-aman',
    });

    expect(userRepository.create).toHaveBeenCalledWith({
      cursorColor: '#58cc02',
      email: 'new@company.test',
      name: 'New User',
      passwordHash: 'hashed-password',
    });
    expect(organizationRepository.createPersonalOrganization).toHaveBeenCalledWith({
      name: "New User's Workspace",
      userId: 'created-user-id',
    });
    expect(response).toMatchObject({
      accessToken: 'raw-session-token',
      user: {
        email: 'new@company.test',
      },
    });
  });

  it('blocks password sign-up when the instance is invite only', async () => {
    await expect(
      service.signUp({
        email: 'new@company.test',
        name: 'New User',
        password: 'password-aman',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(userRepository.create).not.toHaveBeenCalled();
    expect(organizationRepository.createPersonalOrganization).not.toHaveBeenCalled();
  });

  it('exposes an OIDC login provider only when setup and provider config are complete', async () => {
    setupRepository.getOidcProviderSettings.mockResolvedValueOnce({
      autoCreateUsers: true,
      buttonLabel: 'Sign in with Company SSO',
      clientId: 'tabliodb',
      clientSecretConfigured: true,
      enabled: true,
      issuerUrl: 'https://idp.company.test',
      scopes: ['openid', 'email', 'profile'],
    });

    await expect(service.getOidcLoginProvider()).resolves.toEqual({
      buttonLabel: 'Sign in with Company SSO',
      enabled: true,
    });

    setupRepository.getStatus.mockResolvedValueOnce({
      isSetupComplete: false,
    });
    setupRepository.getOidcProviderSettings.mockResolvedValueOnce({
      autoCreateUsers: true,
      buttonLabel: 'Sign in with Company SSO',
      clientId: 'tabliodb',
      clientSecretConfigured: true,
      enabled: true,
      issuerUrl: 'https://idp.company.test',
      scopes: ['openid', 'email', 'profile'],
    });

    await expect(service.getOidcLoginProvider()).resolves.toEqual({
      buttonLabel: 'Sign in with Company SSO',
      enabled: false,
    });
  });

  it('keeps OIDC redirect failures on the configured web URL', () => {
    expect(service.createOidcFailureRedirect()).toBe('https://app.tabliodb.test/login?oidcError=failed');
  });

  it('updates the current user profile with normalized values', async () => {
    userRepository.updateProfile.mockResolvedValue({
      avatarUrl: null,
      cursorColor: '#1cb0f6',
      email: 'automation@tabliodb.local',
      id: 'user-id',
      name: 'Automation Lead',
    });

    const response = await service.updateProfile(authWithLimitedApiKey, {
      cursorColor: '#1CB0F6',
      name: ' Automation Lead ',
    });

    expect(userRepository.updateProfile).toHaveBeenCalledWith('user-id', {
      cursorColor: '#1cb0f6',
      name: 'Automation Lead',
    });
    expect(response).toMatchObject({
      cursorColor: '#1cb0f6',
      name: 'Automation Lead',
    });
  });

  it('keeps password reset request neutral when the email does not exist', async () => {
    const response = await service.requestPasswordReset({ email: 'missing@company.test' });

    expect(response).toEqual({
      expiresAt: null,
      resetToken: null,
      resetUrl: null,
      successful: true,
    });
    expect(passwordResetRepository.createForUser).not.toHaveBeenCalled();
    expect(auditLogRepository.create).not.toHaveBeenCalled();
  });

  it('creates an exposed reset URL for active password users when development exposure is enabled', async () => {
    userRepository.getByEmail.mockResolvedValue({
      email: 'reset@company.test',
      id: 'reset-user-id',
      passwordHash: 'old-hash',
    });
    cryptoRepository.randomBytesAsText.mockReturnValueOnce('raw-reset-token');
    cryptoRepository.hashSha256.mockReturnValueOnce(Buffer.from('hashed-reset-token'));

    const response = await service.requestPasswordReset({ email: ' Reset@Company.Test ' });

    expect(passwordResetRepository.createForUser).toHaveBeenCalledWith({
      expiresAt: expect.any(Date),
      tokenHash: Buffer.from('hashed-reset-token'),
      userId: 'reset-user-id',
    });
    expect(response).toMatchObject({
      expiresAt: '2026-07-30T12:00:00.000Z',
      resetToken: 'raw-reset-token',
      resetUrl: 'https://tabliodb.test/reset-password/raw-reset-token',
      successful: true,
    });
  });

  it('confirms password reset, updates the password hash, and revokes old sessions', async () => {
    cryptoRepository.hashBcrypt.mockResolvedValueOnce('new-password-hash');
    cryptoRepository.hashSha256.mockReturnValueOnce(Buffer.from('hashed-reset-token'));
    passwordResetRepository.consumeValidToken.mockResolvedValue({
      email: 'reset@company.test',
      id: 'reset-token-id',
      name: 'Reset User',
      userId: 'reset-user-id',
    });

    const response = await service.confirmPasswordReset({
      password: 'new-password',
      token: 'raw-reset-token',
    });

    expect(userRepository.updatePasswordHash).toHaveBeenCalledWith('reset-user-id', 'new-password-hash', {
      passwordChangeRequired: false,
    });
    expect(sessionRepository.revokeAllForUser).toHaveBeenCalledWith('reset-user-id');
    expect(response).toEqual({
      revokedSessions: 2,
      successful: true,
    });
  });

  it('changes the current user password with the current password and keeps the current session', async () => {
    userRepository.getPasswordAuthUserById.mockResolvedValue({
      email: 'automation@tabliodb.local',
      id: 'user-id',
      name: 'Automation User',
      passwordHash: 'current-password-hash',
    });
    cryptoRepository.compareBcrypt.mockReturnValueOnce(true).mockReturnValueOnce(false);
    cryptoRepository.hashBcrypt.mockResolvedValueOnce('new-password-hash');
    userRepository.updatePasswordHash.mockResolvedValueOnce({
      id: 'user-id',
      email: 'automation@tabliodb.local',
      name: 'Automation User',
      organizations: [{ id: 'organization-id' }],
    });
    userRepository.getAuthUserById.mockResolvedValueOnce({
      avatarUrl: null,
      cursorColor: '#58cc02',
      email: 'automation@tabliodb.local',
      id: 'user-id',
      name: 'Automation User',
      passwordChangeRequired: false,
    });

    const response = await service.updatePassword(
      {
        ...authWithLimitedApiKey,
        session: {
          bindingAlgorithm: null,
          bindingKeyFingerprint: null,
          bindingPublicKeyJwk: null,
          bindingRequired: false,
          id: 'current-session-id',
          source: 'cookie',
        },
        user: {
          ...authWithLimitedApiKey.user,
          passwordChangeRequired: false,
        },
      },
      {
        currentPassword: 'current-password',
        password: 'new-user-password',
      },
    );

    expect(userRepository.updatePasswordHash).toHaveBeenCalledWith('user-id', 'new-password-hash', {
      passwordChangeRequired: false,
    });
    expect(sessionRepository.revokeAllForUser).toHaveBeenCalledWith('user-id', {
      exceptSessionId: 'current-session-id',
    });
    expect(response).toMatchObject({
      passwordChangeRequired: false,
    });
  });

  it('replaces a temporary password without asking for the temporary password again', async () => {
    userRepository.getPasswordAuthUserById.mockResolvedValue({
      email: 'automation@tabliodb.local',
      id: 'user-id',
      name: 'Automation User',
      passwordHash: 'temporary-password-hash',
    });
    cryptoRepository.compareBcrypt.mockReturnValueOnce(false);
    cryptoRepository.hashBcrypt.mockResolvedValueOnce('new-password-hash');
    userRepository.updatePasswordHash.mockResolvedValueOnce({
      id: 'user-id',
      email: 'automation@tabliodb.local',
      name: 'Automation User',
      organizations: [{ id: 'organization-id' }],
    });
    userRepository.getAuthUserById.mockResolvedValueOnce({
      avatarUrl: null,
      cursorColor: '#58cc02',
      email: 'automation@tabliodb.local',
      id: 'user-id',
      name: 'Automation User',
      passwordChangeRequired: false,
    });

    const response = await service.updateTemporaryPassword(
      {
        ...authWithLimitedApiKey,
        session: {
          bindingAlgorithm: null,
          bindingKeyFingerprint: null,
          bindingPublicKeyJwk: null,
          bindingRequired: false,
          id: 'current-session-id',
          source: 'cookie',
        },
        user: {
          ...authWithLimitedApiKey.user,
          passwordChangeRequired: true,
        },
      },
      {
        password: 'new-user-password',
      },
    );

    expect(userRepository.updatePasswordHash).toHaveBeenCalledWith('user-id', 'new-password-hash', {
      passwordChangeRequired: false,
    });
    expect(sessionRepository.revokeAllForUser).toHaveBeenCalledWith('user-id', {
      exceptSessionId: 'current-session-id',
    });
    expect(response).toMatchObject({
      passwordChangeRequired: false,
    });
  });

  it('rejects temporary password completion for a regular account', async () => {
    await expect(
      service.updateTemporaryPassword(authWithLimitedApiKey, {
        password: 'new-user-password',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(userRepository.updatePasswordHash).not.toHaveBeenCalled();
  });

  it('accepts a browser-bound session proof once and rejects nonce replay', async () => {
    const keyPair = await webcrypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify'],
    );
    const publicKey = await webcrypto.subtle.exportKey('jwk', keyPair.publicKey);
    const timestamp = Date.now().toString();
    const nonce = 'nonce-satu';
    const path = '/api/auth/me';
    const signature = await webcrypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: 'SHA-256',
      },
      keyPair.privateKey,
      // This payload mirrors the SDK transport contract: method, path, timestamp, and nonce are signed together.
      new TextEncoder().encode(['GET', path, timestamp, nonce].join('\n')),
    );
    const auth: AuthContext = {
      ...authWithLimitedApiKey,
      session: {
        bindingAlgorithm: 'ecdsa-p256-sha256',
        bindingKeyFingerprint: 'fingerprint-browser',
        bindingPublicKeyJwk: publicKey as never,
        bindingRequired: true,
        id: 'session-id',
        source: 'cookie',
      },
    };
    const request = {
      headers: {
        'x-tabliodb-session-proof-alg': 'ecdsa-p256-sha256',
        'x-tabliodb-session-proof-key': 'fingerprint-browser',
        'x-tabliodb-session-proof-nonce': nonce,
        'x-tabliodb-session-proof-signature': Buffer.from(signature).toString('base64url'),
        'x-tabliodb-session-proof-timestamp': timestamp,
      },
      ipAddress: '127.0.0.1',
      method: 'GET',
      path,
      userAgent: 'Vitest Browser',
    };

    await service.verifySessionProof(auth, request);

    expect(redisService.setIfAbsent).toHaveBeenCalledWith('session-proof:session-id:nonce-satu', '1', 120_000);
    expect(sessionRepository.updateActivity).toHaveBeenCalledWith('session-id', {
      ipAddress: '127.0.0.1',
      userAgentHash: 'aGFzaGVkLXNlc3Npb24tdG9rZW4',
    });

    redisService.setIfAbsent.mockResolvedValueOnce(false);

    await expect(service.verifySessionProof(auth, request)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
