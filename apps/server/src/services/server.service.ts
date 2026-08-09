import { Injectable, NotFoundException } from '@nestjs/common';
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
    const { redis } = this.configRepository.getEnv();
    const [databaseHealth, redisHealth] = await Promise.all([
      this.checkDependency(() => this.databaseRepository.ping()),
      redis.url
        ? this.checkDependency(() => this.redisService.ping())
        : Promise.resolve({
            message: 'Redis URL is not configured; optional ephemeral features use in-memory fallback.',
            status: 'disabled' as const,
          }),
    ]);

    return {
      checkedAt: new Date().toISOString(),
      dependencies: {
        database: databaseHealth,
        redis: redisHealth,
      },
      name: 'tabliodb-server',
      // Docker/Kubernetes readiness should fail when a configured dependency is unavailable.
      ok: databaseHealth.status === 'ok' && redisHealth.status !== 'error',
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
