import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  const projectRepository = {};

  let service: CollaborationService;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    configRepository.getEnv.mockReturnValue({
      realtime: {
        enabled: true,
        persistDebounceMs: 1_000,
        port: 1234,
      },
    });
    collaborationRepository.storeDocument.mockResolvedValue(undefined);

    service = new CollaborationService(
      authService as never,
      collaborationRepository as never,
      configRepository as never,
      projectRepository as never,
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
});
