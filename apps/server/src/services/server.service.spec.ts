import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServerService } from './server.service.js';

describe(ServerService.name, () => {
  const configRepository = {
    getEnv: vi.fn(),
  };
  const databaseRepository = {
    ping: vi.fn(),
  };
  const metricsService = {
    getSnapshot: vi.fn(),
  };
  const redisService = {
    ping: vi.fn(),
  };

  let storageRoot: string;

  beforeEach(async () => {
    storageRoot = await mkdtemp(path.join(tmpdir(), 'tabliodb-health-storage-'));
  });

  afterEach(async () => {
    await rm(storageRoot, { force: true, recursive: true });
  });

  function createService(options: { metricsEnabled?: boolean; redisUrl?: string; storagePath?: string } = {}) {
    vi.resetAllMocks();
    configRepository.getEnv.mockReturnValue({
      metrics: {
        enabled: options.metricsEnabled ?? true,
      },
      redis: {
        url: options.redisUrl,
      },
      storage: {
        localPath: options.storagePath ?? storageRoot,
      },
    });
    databaseRepository.ping.mockResolvedValue(undefined);
    metricsService.getSnapshot.mockReturnValue({
      generatedAt: '2026-08-09T03:00:00.000Z',
      http: {
        errorRequests: 0,
        methods: [],
        routes: [],
        statusGroups: {
          clientError: 0,
          informational: 0,
          redirection: 0,
          serverError: 0,
          success: 0,
        },
        totalRequests: 0,
      },
      process: {
        memoryBytes: {
          arrayBuffers: 0,
          external: 0,
          heapTotal: 0,
          heapUsed: 0,
          rss: 0,
        },
        nodeVersion: 'v22.0.0',
        pid: 1,
        uptimeSeconds: 1,
      },
      startedAt: '2026-08-09T03:00:00.000Z',
      window: {
        maxTrackedRoutes: 120,
        routeDurationSampleSize: 100,
      },
    });
    redisService.ping.mockResolvedValue(undefined);

    return new ServerService(
      configRepository as never,
      databaseRepository as never,
      metricsService as never,
      redisService as never,
    );
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
        storage: {
          status: 'ok',
        },
      },
      ok: true,
    });
    expect(databaseRepository.ping).toHaveBeenCalledTimes(1);
    expect(redisService.ping).not.toHaveBeenCalled();
  });

  it('marks the server unhealthy when configured Redis is unavailable', async () => {
    const service = createService({ redisUrl: 'redis://localhost:6379' });

    redisService.ping.mockRejectedValue(new Error('connect ECONNREFUSED redis://:secret@localhost:6379'));

    const health = await service.getHealth();

    expect(health.ok).toBe(false);
    expect(health.dependencies.redis).toMatchObject({
      message: 'connect ECONNREFUSED [redacted-url]',
      status: 'error',
    });
  });

  it('marks the server unhealthy when PostgreSQL is unavailable', async () => {
    const service = createService({ redisUrl: 'redis://localhost:6379' });

    databaseRepository.ping.mockRejectedValue(new Error('database connection failed'));

    const health = await service.getHealth();

    expect(health.ok).toBe(false);
    expect(health.dependencies.database).toMatchObject({
      message: 'database connection failed',
      status: 'error',
    });
  });

  it('marks the server unhealthy when local storage is not a directory', async () => {
    const blockedStoragePath = path.join(storageRoot, 'storage-file');
    await writeFile(blockedStoragePath, 'not a directory');
    const service = createService({ storagePath: blockedStoragePath });

    const health = await service.getHealth();

    expect(health.ok).toBe(false);
    expect(health.dependencies.storage).toMatchObject({
      message: 'Storage path is not ready (EEXIST).',
      status: 'error',
    });
    expect(health.dependencies.storage.message).not.toContain(blockedStoragePath);
  });

  it('returns metrics when the optional endpoint is enabled', () => {
    const service = createService({ metricsEnabled: true });

    expect(service.getMetrics()).toMatchObject({
      http: {
        totalRequests: 0,
      },
    });
    expect(metricsService.getSnapshot).toHaveBeenCalledTimes(1);
  });

  it('hides metrics when the optional endpoint is disabled', () => {
    const service = createService({ metricsEnabled: false });

    expect(() => service.getMetrics()).toThrow('Metrics endpoint is disabled');
    expect(metricsService.getSnapshot).not.toHaveBeenCalled();
  });
});
