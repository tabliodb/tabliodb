import { describe, expect, it } from 'vitest';
import { MetricsService } from './metrics.service.js';

describe(MetricsService.name, () => {
  it('records grouped HTTP metrics without storing raw resource identifiers', () => {
    const service = new MetricsService();

    service.recordHttpRequest({
      durationMs: 12,
      method: 'get',
      path: '/api/folders/:folderId/diagrams',
      statusCode: 200,
    });
    service.recordHttpRequest({
      durationMs: 40,
      method: 'GET',
      path: '/api/folders/:folderId/diagrams',
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
        path: '/api/folders/:folderId/diagrams',
        p95DurationMs: 40,
      }),
    );
  });

  it('records active realtime connection and room counts without exposing room names', () => {
    const service = new MetricsService();

    service.recordRealtimeConnectionOpened({
      roomName: 'diagram:private-diagram-id-a',
      socketId: 'socket-1',
    });
    service.recordRealtimeConnectionOpened({
      roomName: 'diagram:private-diagram-id-a',
      socketId: 'socket-2',
    });
    service.recordRealtimeConnectionOpened({
      roomName: 'diagram:private-diagram-id-b',
      socketId: 'socket-3',
    });

    expect(service.getSnapshot().realtime).toEqual({
      activeConnections: 3,
      activeRooms: 2,
    });

    service.recordRealtimeConnectionClosed({ socketId: 'socket-1' });

    expect(service.getSnapshot().realtime).toEqual({
      activeConnections: 2,
      activeRooms: 2,
    });

    service.recordRealtimeConnectionClosed({ socketId: 'socket-2' });

    expect(service.getSnapshot().realtime).toEqual({
      activeConnections: 1,
      activeRooms: 1,
    });
  });

  it('moves a recycled realtime socket id between rooms without double counting', () => {
    const service = new MetricsService();

    service.recordRealtimeConnectionOpened({
      roomName: 'diagram:first-room',
      socketId: 'socket-1',
    });
    service.recordRealtimeConnectionOpened({
      roomName: 'diagram:second-room',
      socketId: 'socket-1',
    });

    expect(service.getSnapshot().realtime).toEqual({
      activeConnections: 1,
      activeRooms: 1,
    });
  });
});
