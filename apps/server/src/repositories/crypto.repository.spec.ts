import { describe, expect, it } from 'vitest';
import { CryptoRepository } from './crypto.repository.js';
import type { ConfigRepository } from './config.repository.js';

describe(CryptoRepository.name, () => {
  it('encrypts JSON secrets and decrypts them with the same associated data', () => {
    const repository = new CryptoRepository(createConfigRepository('base64url:01234567890123456789012345678901'));
    const envelope = repository.encryptJsonSecret({ clientSecret: 'super-secret' }, 'tabliodb:test:oidc');

    expect(envelope).not.toEqual({ clientSecret: 'super-secret' });
    expect(repository.isEncryptedJsonSecret(envelope)).toBe(true);
    expect(repository.decryptJsonSecret(envelope, 'tabliodb:test:oidc')).toEqual({ clientSecret: 'super-secret' });
  });

  it('rejects encrypted secrets when associated data does not match', () => {
    const repository = new CryptoRepository(createConfigRepository('base64url:01234567890123456789012345678901'));
    const envelope = repository.encryptJsonSecret({ password: 'smtp-password' }, 'tabliodb:test:smtp');

    expect(() => repository.decryptJsonSecret(envelope, 'tabliodb:test:other')).toThrow();
  });
});

function createConfigRepository(encryptionKey: string): ConfigRepository {
  return {
    getEnv: () => ({
      auth: {
        cookieSecure: false,
        exposePasswordResetToken: false,
      },
      backgroundJobs: {
        batchSize: 10,
        enabled: true,
        lockTtlMs: 120_000,
        pollIntervalMs: 2_500,
      },
      database: {
        url: 'postgres://postgres:postgres@localhost:5432/tabliodb',
      },
      realtime: {
        enabled: true,
        persistDebounceMs: 1_000,
        port: 1234,
      },
      redis: {},
      secrets: {
        encryptionKey,
      },
      server: {
        port: 4000,
        publicUrl: 'http://localhost:4000',
        webDistPath: 'public',
      },
      storage: {
        localPath: 'data/uploads',
      },
    }),
    isDevelopment: () => false,
  } as ConfigRepository;
}
