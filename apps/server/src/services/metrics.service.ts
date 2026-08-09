import { Injectable } from '@nestjs/common';
import type { ServerMetricsResponse } from '../dtos/server.dto.js';

export type HttpRequestMetricInput = {
  durationMs: number;
  method: string;
  path: string;
  statusCode: number;
};

type MutableRouteMetrics = {
  count: number;
  durationSamples: number[];
  errorCount: number;
  lastSeenAt: string;
  lastStatusCode: number;
  maxDurationMs: number;
  method: string;
  path: string;
  totalDurationMs: number;
};

const maxTrackedRoutes = 120;
const routeDurationSampleSize = 100;
const overflowRoutePath = '[other]';

@Injectable()
export class MetricsService {
  private readonly startedAt = new Date();
  private readonly methods = new Map<string, number>();
  private readonly routes = new Map<string, MutableRouteMetrics>();
  private readonly statusGroups = {
    clientError: 0,
    informational: 0,
    redirection: 0,
    serverError: 0,
    success: 0,
  };
  private totalRequests = 0;
  private errorRequests = 0;

  recordHttpRequest(input: HttpRequestMetricInput): void {
    const method = input.method.toUpperCase();
    const durationMs = Math.max(0, Math.round(input.durationMs));
    const statusCode = normalizeStatusCode(input.statusCode);
    const path = this.normalizeTrackedPath(method, input.path);
    const now = new Date().toISOString();

    this.totalRequests += 1;
    this.methods.set(method, (this.methods.get(method) ?? 0) + 1);
    this.statusGroups[readStatusGroup(statusCode)] += 1;

    if (statusCode >= 400) {
      this.errorRequests += 1;
    }

    const route = this.getOrCreateRouteMetrics(method, path, now, statusCode);
    route.count += 1;
    route.totalDurationMs += durationMs;
    route.maxDurationMs = Math.max(route.maxDurationMs, durationMs);
    route.lastSeenAt = now;
    route.lastStatusCode = statusCode;

    if (statusCode >= 400) {
      route.errorCount += 1;
    }

    route.durationSamples.push(durationMs);

    if (route.durationSamples.length > routeDurationSampleSize) {
      // The sample window gives a useful p95 without letting a busy self-hosted instance grow memory forever.
      route.durationSamples.shift();
    }
  }

  getSnapshot(): ServerMetricsResponse {
    const memory = process.memoryUsage();

    return {
      generatedAt: new Date().toISOString(),
      http: {
        errorRequests: this.errorRequests,
        methods: [...this.methods.entries()]
          .map(([method, count]) => ({ count, method }))
          .sort((left, right) => left.method.localeCompare(right.method)),
        routes: [...this.routes.values()]
          .map((route) => ({
            averageDurationMs: Math.round(route.totalDurationMs / Math.max(route.count, 1)),
            count: route.count,
            errorCount: route.errorCount,
            lastSeenAt: route.lastSeenAt,
            lastStatusCode: route.lastStatusCode,
            maxDurationMs: route.maxDurationMs,
            method: route.method,
            p95DurationMs: calculatePercentile(route.durationSamples, 0.95),
            path: route.path,
          }))
          .sort((left, right) => right.count - left.count || left.path.localeCompare(right.path)),
        statusGroups: { ...this.statusGroups },
        totalRequests: this.totalRequests,
      },
      process: {
        memoryBytes: {
          arrayBuffers: memory.arrayBuffers,
          external: memory.external,
          heapTotal: memory.heapTotal,
          heapUsed: memory.heapUsed,
          rss: memory.rss,
        },
        nodeVersion: process.version,
        pid: process.pid,
        uptimeSeconds: Math.floor(process.uptime()),
      },
      startedAt: this.startedAt.toISOString(),
      window: {
        maxTrackedRoutes,
        routeDurationSampleSize,
      },
    };
  }

  private normalizeTrackedPath(method: string, path: string): string {
    if (this.routes.has(createRouteKey(method, path)) || this.routes.size < maxTrackedRoutes) {
      return path;
    }

    return overflowRoutePath;
  }

  private getOrCreateRouteMetrics(method: string, path: string, now: string, statusCode: number): MutableRouteMetrics {
    const key = createRouteKey(method, path);
    const existing = this.routes.get(key);

    if (existing) {
      return existing;
    }

    const route: MutableRouteMetrics = {
      count: 0,
      durationSamples: [],
      errorCount: 0,
      lastSeenAt: now,
      lastStatusCode: statusCode,
      maxDurationMs: 0,
      method,
      path,
      totalDurationMs: 0,
    };

    this.routes.set(key, route);

    return route;
  }
}

function createRouteKey(method: string, path: string): string {
  return `${method} ${path}`;
}

function normalizeStatusCode(statusCode: number): number {
  return Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599 ? statusCode : 500;
}

function readStatusGroup(statusCode: number): keyof MetricsService['statusGroups'] {
  if (statusCode < 200) {
    return 'informational';
  }

  if (statusCode < 300) {
    return 'success';
  }

  if (statusCode < 400) {
    return 'redirection';
  }

  if (statusCode < 500) {
    return 'clientError';
  }

  return 'serverError';
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentile) - 1));

  return sorted[index] ?? 0;
}
