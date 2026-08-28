import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { Permission, AccessRole, REALTIME_PERSISTED_ACK_TYPE, diagramDocumentName } from '@tabliodb/shared';
import type { AuthContext } from '../database.js';
import { CollaborationService } from './collaboration.service.js';

describe(CollaborationService.name, () => {
  const authService = {};
  const collaborationRepository = {
    loadDocument: vi.fn(),
    storeDocument: vi.fn(),
  };
  const configRepository = {
    getEnv: vi.fn(),
  };
  const metricsService = {
    recordRealtimeConnectionClosed: vi.fn(),
    recordRealtimeConnectionOpened: vi.fn(),
  };
  const folderRepository = {
    getDiagramRole: vi.fn(),
  };

  let service: CollaborationService;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    configRepository.getEnv.mockReturnValue({
      realtime: {
        enabled: true,
        persistDebounceMs: 1_000,
        port: 1234,
        shutdownTimeoutMs: 15_000,
      },
    });
    collaborationRepository.storeDocument.mockResolvedValue(createStoredDocumentReceipt());

    service = new CollaborationService(
      authService as never,
      collaborationRepository as never,
      configRepository as never,
      metricsService as never,
      folderRepository as never,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces realtime document persistence and stores the latest state only', async () => {
    const firstState = new Uint8Array([1, 1, 1]);
    const latestState = new Uint8Array([2, 2, 2]);

    // Rapid drag/move updates should collapse into one database write for the newest Yjs state.
    service['scheduleDocumentStore']('diagram-id', firstState);
    firstState[0] = 9;
    service['scheduleDocumentStore']('diagram-id', latestState);

    await vi.advanceTimersByTimeAsync(999);
    expect(collaborationRepository.storeDocument).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(collaborationRepository.storeDocument).toHaveBeenCalledTimes(1);
    expect(collaborationRepository.storeDocument).toHaveBeenCalledWith('diagram-id', latestState);
  });

  it('flushes pending realtime document persistence during shutdown', async () => {
    const state = new Uint8Array([7, 7, 7]);

    service['scheduleDocumentStore']('diagram-id', state);
    await service.onModuleDestroy();

    expect(collaborationRepository.storeDocument).toHaveBeenCalledTimes(1);
    expect(collaborationRepository.storeDocument).toHaveBeenCalledWith('diagram-id', state);

    await vi.runOnlyPendingTimersAsync();
    expect(collaborationRepository.storeDocument).toHaveBeenCalledTimes(1);
  });

  it('keeps shutdown-time realtime stores pending until the explicit final flush', async () => {
    const state = new Uint8Array([6, 6, 6]);

    service['isShuttingDown'] = true;
    service['scheduleDocumentStore']('diagram-id', state);

    await vi.runOnlyPendingTimersAsync();
    expect(collaborationRepository.storeDocument).not.toHaveBeenCalled();

    await service.onModuleDestroy();

    expect(collaborationRepository.storeDocument).toHaveBeenCalledTimes(1);
    expect(collaborationRepository.storeDocument).toHaveBeenCalledWith('diagram-id', state);
  });

  it('flushes realtime stores scheduled while the Hocuspocus server is being destroyed', async () => {
    const state = new Uint8Array([5, 5, 5]);
    const destroy = vi.fn().mockImplementation(() => {
      // Hocuspocus can invoke the database store hook while documents are closed during destroy.
      // Keeping this path covered prevents final socket-close persistence from being dropped.
      service['scheduleDocumentStore']('diagram-id', state);
      return Promise.resolve();
    });

    service['server'] = {
      destroy,
      hocuspocus: {
        documents: new Map(),
      },
    } as never;

    await service.onModuleDestroy();

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(collaborationRepository.storeDocument).toHaveBeenCalledTimes(1);
    expect(collaborationRepository.storeDocument).toHaveBeenCalledWith('diagram-id', state);
  });

  it('does not hang forever when realtime server destroy never resolves', async () => {
    const destroy = vi.fn(() => new Promise<void>(() => undefined));

    configRepository.getEnv.mockReturnValue({
      realtime: {
        enabled: true,
        persistDebounceMs: 1_000,
        port: 1234,
        shutdownTimeoutMs: 25,
      },
    });
    service['server'] = {
      destroy,
      hocuspocus: {
        documents: new Map(),
      },
    } as never;

    const destroyPromise = service.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(25);
    await destroyPromise;

    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('logs realtime server destroy failures without blocking pending store cleanup', async () => {
    const destroy = vi.fn().mockRejectedValue(new Error('destroy failed'));
    const state = new Uint8Array([4, 4, 4]);

    service['server'] = {
      destroy,
      hocuspocus: {
        documents: new Map(),
      },
    } as never;
    service['scheduleDocumentStore']('diagram-id', state);

    await service.onModuleDestroy();

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(collaborationRepository.storeDocument).toHaveBeenCalledTimes(1);
  });

  it('broadcasts realtime persistence acknowledgement after a document is stored', async () => {
    const broadcastStateless = vi.fn();

    service['server'] = {
      hocuspocus: {
        documents: new Map([[diagramDocumentName('diagram-id'), { broadcastStateless }]]),
      },
    } as never;
    collaborationRepository.storeDocument.mockResolvedValue(
      createStoredDocumentReceipt({
        persistenceTokens: { 'client-1': 'token-1' },
        version: 9,
      }),
    );

    service['scheduleDocumentStore']('diagram-id', new Uint8Array([8, 8, 8]));
    await vi.advanceTimersByTimeAsync(1_000);

    expect(broadcastStateless).toHaveBeenCalledTimes(1);
    expect(JSON.parse(broadcastStateless.mock.calls[0][0])).toEqual({
      diagramId: 'diagram-id',
      modelUpdatedAt: '2026-08-12T06:00:00.000Z',
      persistedAt: '2026-08-12T06:00:01.000Z',
      // Ack payload carries the newest per-client persistence tokens so browsers can clear only their own confirmed writes.
      persistenceTokens: { 'client-1': 'token-1' },
      type: REALTIME_PERSISTED_ACK_TYPE,
      version: 9,
    });
  });

  it('allows editor realtime connections to mutate the shared document', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Editor });

    const context = await service['createConnectionContext'](createAuthContext(), 'diagram-id');

    expect(context).toMatchObject({
      diagramId: 'diagram-id',
      readOnly: false,
      role: AccessRole.Editor,
      userId: 'user-id',
    });
  });

  it('marks viewer realtime connections as read-only', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Viewer });

    const context = await service['createConnectionContext'](createAuthContext(), 'diagram-id');

    expect(context.readOnly).toBe(true);
    expect(context.role).toBe(AccessRole.Viewer);
  });

  it('keeps API key realtime connections read-only when the key lacks diagram update scope', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Editor });

    const context = await service['createConnectionContext'](
      createAuthContext({
        apiKey: {
          id: 'api-key-id',
          permissions: [Permission.DiagramRead],
        },
      }),
      'diagram-id',
    );

    expect(context.readOnly).toBe(true);
  });

  it('rejects API key realtime connections when the key lacks diagram read scope', async () => {
    folderRepository.getDiagramRole.mockResolvedValue({ role: AccessRole.Editor });

    await expect(
      service['createConnectionContext'](
        createAuthContext({
          apiKey: {
            id: 'api-key-id',
            permissions: [],
          },
        }),
        'diagram-id',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('records realtime connection metrics without depending on diagram ids in the metrics response', () => {
    const socketId = 'socket-id';
    const documentName = diagramDocumentName('diagram-id');

    service['recordRealtimeConnectionOpened'](documentName, socketId);
    service['recordRealtimeConnectionClosed'](socketId);

    expect(metricsService.recordRealtimeConnectionOpened).toHaveBeenCalledWith({
      roomName: documentName,
      socketId,
    });
    expect(metricsService.recordRealtimeConnectionClosed).toHaveBeenCalledWith({ socketId });
  });
});

function createStoredDocumentReceipt(
  overrides: Partial<{
    modelUpdatedAt: string;
    persistedAt: string;
    persistenceTokens: Record<string, string>;
    version: number;
  }> = {},
) {
  return {
    modelUpdatedAt: '2026-08-12T06:00:00.000Z',
    persistedAt: '2026-08-12T06:00:01.000Z',
    persistenceTokens: {},
    version: 1,
    ...overrides,
  };
}

function createAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    user: {
      avatarUrl: null,
      cursorColor: '#58cc02',
      email: 'user@tabliodb.local',
      id: 'user-id',
      name: 'Tabliodb User',
      passwordChangeRequired: false,
    },
    ...overrides,
  };
}
