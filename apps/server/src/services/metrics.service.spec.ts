import { describe, expect, it } from 'vitest';
import { MetricsService } from './metrics.service.js';

describe(MetricsService.name, () => {
  it('records grouped HTTP metrics without storing raw resource identifiers', () => {
    const service = new MetricsService();

    service.recordHttpRequest({
      durationMs: 12,
      method: 'get',
      path: '/api/projects/:projectId/diagrams',
      statusCode: 200,
    });
    service.recordHttpRequest({
      durationMs: 40,
      method: 'GET',
      path: '/api/projects/:projectId/diagrams',
      statusCode: 500,
    });

    const snapshot = service.getSnapshot();

    expect(snapshot.http.totalRequests).toBe(2);
    expect(snapshot.http.errorRequests).toBe(1);
    expect(snapshot.http.statusGroups.success).toBe(1);
    expect(snapshot.http.statusGroups.serverError).toBe(1);
    expect(snapshot.http.methods).toContainEqual({ count: 2, method: 'GET' });
    expect(snapshot.http.routes).toContainEqual(
      expect.objectContaining({
        averageDurationMs: 26,
        count: 2,
        errorCount: 1,
        method: 'GET',
        path: '/api/projects/:projectId/diagrams',
        p95DurationMs: 40,
      }),
    );
  });
});
