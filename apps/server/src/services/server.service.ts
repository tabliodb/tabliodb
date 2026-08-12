import { Injectable, NotFoundException } from '@nestjs/common';
import { constants as fsConstants } from 'node:fs';
import { access, mkdir, stat } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import type { ServerHealthResponse, ServerMetricsResponse } from '../dtos/server.dto.js';
import { ConfigRepository } from '../repositories/config.repository.js';
import { DatabaseRepository } from '../repositories/database.repository.js';
import { MetricsService } from './metrics.service.js';
import { RedisService } from './redis.service.js';

type DependencyHealth = ServerHealthResponse['dependencies']['database'];

@Injectable()
export class ServerService {
  constructor(
    private readonly configRepository: ConfigRepository,
    private readonly databaseRepository: DatabaseRepository,
    private readonly metricsService: MetricsService,
    private readonly redisService: RedisService,
  ) {}

  async getHealth(): Promise<ServerHealthResponse> {
    const { redis, storage } = this.configRepository.getEnv();
    const [databaseHealth, redisHealth, storageHealth] = await Promise.all([
      this.checkDependency(() => this.databaseRepository.ping()),
      redis.url
        ? this.checkDependency(() => this.redisService.ping())
        : Promise.resolve({
            message: 'Redis URL is not configured; optional ephemeral features use in-memory fallback.',
            status: 'disabled' as const,
          }),
      this.checkDependency(() => this.checkStorage(storage.localPath)),
    ]);

    return {
      checkedAt: new Date().toISOString(),
      dependencies: {
        database: databaseHealth,
        redis: redisHealth,
        storage: storageHealth,
      },
      name: 'tabliodb-server',
      // Docker/Kubernetes readiness should fail when a configured dependency is unavailable.
      ok: databaseHealth.status === 'ok' && redisHealth.status !== 'error' && storageHealth.status === 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      version: '0.1.0',
    };
  }

  getMetrics(): ServerMetricsResponse {
    if (!this.configRepository.getEnv().metrics.enabled) {
      throw new NotFoundException('Metrics endpoint is disabled');
    }

    return this.metricsService.getSnapshot();
  }

  private async checkDependency(task: () => Promise<void>): Promise<DependencyHealth> {
    const startedAt = performance.now();

    try {
      await task();

      return {
        latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
        status: 'ok',
      };
    } catch (error) {
      return {
        latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
        message: toSafeDependencyMessage(error),
        status: 'error',
      };
    }
  }

  private async checkStorage(localPath: string): Promise<void> {
    try {
      await mkdir(localPath, { recursive: true });

      const storageStat = await stat(localPath);
      if (!storageStat.isDirectory()) {
        throw new Error('not_directory');
      }

      // Avatar uploads and future exports require read/write access to the configured local storage directory.
      await access(localPath, fsConstants.R_OK | fsConstants.W_OK);
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : null;

      // Health responses should not leak the host filesystem path, especially in public self-host diagnostics.
      throw new Error(code ? `Storage path is not ready (${code}).` : 'Storage path is not ready.');
    }
  }
}

function toSafeDependencyMessage(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error);

  // Health responses boleh membantu operator, tetapi jangan pernah memantulkan connection URL atau token ke HTTP response.
  return rawMessage
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '[redacted-url]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}
