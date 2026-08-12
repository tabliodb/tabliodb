import { describe, expect, it } from 'vitest';
import { REALTIME_PERSISTED_ACK_TYPE, parseRealtimePersistedAckPayload } from './realtime.js';

describe(parseRealtimePersistedAckPayload.name, () => {
  it('accepts a valid realtime persistence acknowledgement', () => {
    const payload = JSON.stringify({
      diagramId: 'diagram-id',
      modelUpdatedAt: '2026-08-12T06:00:00.000Z',
      persistedAt: '2026-08-12T06:00:01.000Z',
      persistenceTokens: {
        'client-1': 'token-1',
        'client-2': 'token-2',
        ignored: 42,
      },
      type: REALTIME_PERSISTED_ACK_TYPE,
      version: 7,
    });

    expect(parseRealtimePersistedAckPayload(payload)).toEqual({
      diagramId: 'diagram-id',
      modelUpdatedAt: '2026-08-12T06:00:00.000Z',
      persistedAt: '2026-08-12T06:00:01.000Z',
      // Non-string token values are dropped so stateless payloads cannot smuggle arbitrary JSON into collaboration status.
      persistenceTokens: {
        'client-1': 'token-1',
        'client-2': 'token-2',
      },
      type: REALTIME_PERSISTED_ACK_TYPE,
      version: 7,
    });
  });

  it('ignores malformed stateless payloads', () => {
    expect(parseRealtimePersistedAckPayload('not-json')).toBeNull();
    expect(parseRealtimePersistedAckPayload(JSON.stringify({ type: 'other' }))).toBeNull();
  });
});
