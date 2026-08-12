import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StructuredLogger } from './structured-logger.js';

describe(StructuredLogger.name, () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T12:00:00.000Z'));
    consoleErrorSpy.mockClear();
    consoleLogSpy.mockClear();
    consoleWarnSpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('writes structured records as JSON and protects canonical logger fields', () => {
    const logger = new StructuredLogger();

    logger.log({
      event: 'server.started',
      level: 'fake-level',
      nestLevel: 'fake-nest-level',
      pid: 0,
      port: 4000,
      requestId: 'request-id',
      timestamp: '1999-01-01T00:00:00.000Z',
    });

    expect(parseLogLine(consoleLogSpy)).toMatchObject({
      event: 'server.started',
      level: 'info',
      nestLevel: 'log',
      pid: process.pid,
      port: 4000,
      requestId: 'request-id',
      timestamp: '2026-08-12T12:00:00.000Z',
    });
  });

  it('routes warnings and errors to the expected console streams', () => {
    const logger = new StructuredLogger();

    logger.warn({ event: 'redis.unavailable', message: 'fallback active' });
    logger.error({ event: 'http.exception', requestId: 'request-id' }, 'Error: boom\n    at request handler');

    expect(parseLogLine(consoleWarnSpy)).toMatchObject({
      event: 'redis.unavailable',
      level: 'warn',
      message: 'fallback active',
      nestLevel: 'warn',
    });
    expect(parseLogLine(consoleErrorSpy)).toMatchObject({
      event: 'http.exception',
      level: 'error',
      nestLevel: 'error',
      requestId: 'request-id',
      stack: 'Error: boom\n    at request handler',
    });
  });

  it('serializes Error objects with name, message, and stack details', () => {
    const logger = new StructuredLogger();
    const error = new Error('database failed');

    logger.error(error);

    expect(parseLogLine(consoleErrorSpy)).toMatchObject({
      errorName: 'Error',
      level: 'error',
      message: 'database failed',
      nestLevel: 'error',
      stack: expect.stringContaining('database failed'),
    });
  });

  it('keeps circular payloads parseable instead of crashing the logger', () => {
    const logger = new StructuredLogger();
    const payload: Record<string, unknown> = { event: 'circular.payload' };
    payload.self = payload;

    logger.log(payload);

    expect(parseLogLine(consoleLogSpy)).toMatchObject({
      event: 'circular.payload',
      self: {
        event: 'circular.payload',
        self: '[Circular]',
      },
    });
  });

  it('respects Nest log level filtering', () => {
    const logger = new StructuredLogger();
    logger.setLogLevels(['error']);

    logger.log({ event: 'hidden.info' });
    logger.error({ event: 'visible.error' });

    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(parseLogLine(consoleErrorSpy)).toMatchObject({
      event: 'visible.error',
      level: 'error',
    });
  });
});

function parseLogLine(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const line = spy.mock.calls.at(-1)?.[0];

  expect(typeof line).toBe('string');

  // Log output is consumed by Docker/stdout collectors, so tests assert the exact wire format: one JSON object per line.
  return JSON.parse(line as string) as Record<string, unknown>;
}
