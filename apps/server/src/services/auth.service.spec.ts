import { ForbiddenException } from '@nestjs/common';
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
    hashSha256: vi.fn(),
    randomBytesAsText: vi.fn(),
  };
  const sessionRepository = {
    create: vi.fn(),
    delete: vi.fn(),
    getByToken: vi.fn(),
  };
  const setupRepository = {
    getStatus: vi.fn(),
  };
  const userRepository = {
    getByEmail: vi.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new AuthService(
      apiKeyRepository as never,
      configRepository as never,
      cryptoRepository as never,
      sessionRepository as never,
      setupRepository as never,
      userRepository as never,
    );
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
});
