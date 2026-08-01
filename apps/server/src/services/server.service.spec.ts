import { describe, expect, it, vi } from 'vitest';
import { ServerService } from './server.service.js';

describe(ServerService.name, () => {
  const configRepository = {
    getEnv: vi.fn(),
  };
  const databaseRepository = {
    ping: vi.fn(),
  };
  const redisService = {
    ping: vi.fn(),
  };

  function createService(redisUrl?: string) {
    vi.resetAllMocks();
    configRepository.getEnv.mockReturnValue({
      redis: {
        url: redisUrl,
      },
    });
    databaseRepository.ping.mockResolvedValue(undefined);
    redisService.ping.mockResolvedValue(undefined);

    return new ServerService(configRepository as never, databaseRepository as never, redisService as never);
  }

  it('keeps the server healthy when PostgreSQL works and Redis is intentionally disabled', async () => {
    const service = createService();

    await expect(service.getHealth()).resolves.toMatchObject({
      dependencies: {
        database: {
          status: 'ok',
        },
        redis: {
          status: 'disabled',
        },
      },
      ok: true,
    });
    expect(databaseRepository.ping).toHaveBeenCalledTimes(1);
    expect(redisService.ping).not.toHaveBeenCalled();
  });

  it('marks the server unhealthy when configured Redis is unavailable', async () => {
    const service = createService('redis://localhost:6379');

    redisService.ping.mockRejectedValue(new Error('connect ECONNREFUSED redis://:secret@localhost:6379'));

    const health = await service.getHealth();

    expect(health.ok).toBe(false);
    expect(health.dependencies.redis).toMatchObject({
      message: 'connect ECONNREFUSED [redacted-url]',
      status: 'error',
    });
  });

  it('marks the server unhealthy when PostgreSQL is unavailable', async () => {
    const service = createService('redis://localhost:6379');

    databaseRepository.ping.mockRejectedValue(new Error('database connection failed'));

    const health = await service.getHealth();

    expect(health.ok).toBe(false);
    expect(health.dependencies.database).toMatchObject({
      message: 'database connection failed',
      status: 'error',
    });
  });
});
