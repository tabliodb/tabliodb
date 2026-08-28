import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Permission } from '@tabliodb/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../database.js';
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
  const userRepository = {
    getInstanceRole: vi.fn(),
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
    userRepository.getInstanceRole.mockResolvedValue({ role: 'owner' });

    return new ServerService(
      configRepository as never,
      databaseRepository as never,
      metricsService as never,
      redisService as never,
      userRepository as never,
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

  it('keeps liveness cheap and independent from external dependencies', () => {
    const service = createService({ redisUrl: 'redis://localhost:6379' });

    expect(service.getLiveness()).toMatchObject({
      name: 'tabliodb-server',
      ok: true,
      version: '0.1.0',
    });
    expect(databaseRepository.ping).not.toHaveBeenCalled();
    expect(redisService.ping).not.toHaveBeenCalled();
  });

  it('keeps health as a compatibility alias for readiness', async () => {
    const service = createService();

    const [health, readiness] = await Promise.all([service.getHealth(), service.getReadiness()]);

    expect(health.ok).toBe(readiness.ok);
    expect(health.dependencies.database.status).toBe(readiness.dependencies.database.status);
    expect(health.dependencies.redis.status).toBe(readiness.dependencies.redis.status);
    expect(health.dependencies.storage.status).toBe(readiness.dependencies.storage.status);
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

  it('returns metrics for instance managers when the optional endpoint is enabled', async () => {
    const service = createService({ metricsEnabled: true });

    await expect(service.getMetrics(createAuth())).resolves.toMatchObject({
      http: {
        totalRequests: 0,
      },
    });
    expect(metricsService.getSnapshot).toHaveBeenCalledTimes(1);
    expect(userRepository.getInstanceRole).toHaveBeenCalledWith('user-id');
  });

  it('hides metrics before checking admin role when the optional endpoint is disabled', async () => {
    const service = createService({ metricsEnabled: false });

    await expect(service.getMetrics(createAuth())).rejects.toBeInstanceOf(NotFoundException);
    expect(metricsService.getSnapshot).not.toHaveBeenCalled();
    expect(userRepository.getInstanceRole).not.toHaveBeenCalled();
  });

  it('rejects metrics for authenticated non-admin users', async () => {
    const service = createService({ metricsEnabled: true });

    userRepository.getInstanceRole.mockResolvedValue(undefined);

    await expect(service.getMetrics(createAuth())).rejects.toBeInstanceOf(ForbiddenException);
    expect(metricsService.getSnapshot).not.toHaveBeenCalled();
  });

  it('rejects metrics for low-scope API keys before checking instance role', async () => {
    const service = createService({ metricsEnabled: true });

    await expect(
      service.getMetrics(
        createAuth({
          apiKey: {
            id: 'api-key-id',
            permissions: [Permission.FolderRead],
          },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(userRepository.getInstanceRole).not.toHaveBeenCalled();
    expect(metricsService.getSnapshot).not.toHaveBeenCalled();
  });
});

function createAuth(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    user: {
      avatarUrl: null,
      cursorColor: '#58cc02',
      email: 'owner@tabliodb.local',
      id: 'user-id',
      name: 'Tabliodb Owner',
      passwordChangeRequired: false,
    },
    ...overrides,
  };
}
