import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Permission } from '@tabliodb/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../database.js';
import { AuthService } from './auth.service.js';

const authWithLimitedApiKey: AuthContext = {
  apiKey: {
    id: 'api-key-id',
    permissions: [Permission.ApiKeyManage],
  },
  user: {
    cursorColor: '#58cc02',
    email: 'automation@tabliodb.local',
    id: 'user-id',
    name: 'Automation User',
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
  const organizationRepository = {
    createPersonalOrganization: vi.fn(),
  };
  const passwordResetRepository = {
    consumeValidToken: vi.fn(),
    createForUser: vi.fn(),
  };
  const sessionRepository = {
    create: vi.fn(),
    delete: vi.fn(),
    getByToken: vi.fn(),
    revokeAllForUser: vi.fn(),
  };
  const setupRepository = {
    getAuthSettings: vi.fn(),
    getStatus: vi.fn(),
  };
  const userRepository = {
    create: vi.fn(),
    getAnyByEmail: vi.fn(),
    getByEmail: vi.fn(),
    updatePasswordHash: vi.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new AuthService(
      apiKeyRepository as never,
      auditLogRepository as never,
      configRepository as never,
      cryptoRepository as never,
      organizationRepository as never,
      passwordResetRepository as never,
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
      },
    });
    setupRepository.getStatus.mockResolvedValue({
      isSetupComplete: true,
    });
    setupRepository.getAuthSettings.mockResolvedValue({
      allowedDomains: [],
      signupPolicy: 'invite_only',
    });
    cryptoRepository.hashBcrypt.mockResolvedValue('hashed-password');
    cryptoRepository.hashSha256.mockReturnValue(Buffer.from('hashed-session-token'));
    cryptoRepository.randomBytesAsText.mockReturnValue('raw-session-token');
    userRepository.getAnyByEmail.mockResolvedValue(undefined);
    userRepository.getByEmail.mockResolvedValue(undefined);
    userRepository.create.mockResolvedValue({
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

    expect(userRepository.updatePasswordHash).toHaveBeenCalledWith('reset-user-id', 'new-password-hash');
    expect(sessionRepository.revokeAllForUser).toHaveBeenCalledWith('reset-user-id');
    expect(response).toEqual({
      revokedSessions: 2,
      successful: true,
    });
  });
});
