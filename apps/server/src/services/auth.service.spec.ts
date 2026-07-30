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
    avatarColor: null,
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
  const sessionRepository = {
    create: vi.fn(),
    delete: vi.fn(),
    getByToken: vi.fn(),
  };
  const setupRepository = {
    getAuthSettings: vi.fn(),
    getStatus: vi.fn(),
  };
  const userRepository = {
    create: vi.fn(),
    getAnyByEmail: vi.fn(),
    getByEmail: vi.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new AuthService(
      apiKeyRepository as never,
      configRepository as never,
      cryptoRepository as never,
      organizationRepository as never,
      sessionRepository as never,
      setupRepository as never,
      userRepository as never,
    );

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
    userRepository.create.mockResolvedValue({
      avatarColor: '#58cc02',
      email: 'new@company.test',
      id: 'created-user-id',
      name: 'New User',
    });
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
      avatarColor: '#58cc02',
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
});
