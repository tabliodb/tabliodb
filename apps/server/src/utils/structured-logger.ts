import type { LogLevel, LoggerService } from '@nestjs/common';

type JsonLogLevel = 'debug' | 'error' | 'fatal' | 'info' | 'verbose' | 'warn';

type StructuredLogRecord = {
  context?: string;
  event?: string;
  level: JsonLogLevel;
  message?: string;
  nestLevel: LogLevel;
  pid: number;
  stack?: string;
  timestamp: string;
};

const defaultLogLevels = new Set<LogLevel>(['log', 'error', 'warn', 'debug', 'verbose', 'fatal']);

export class StructuredLogger implements LoggerService {
  private enabledLogLevels = new Set(defaultLogLevels);

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', 'log', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', 'error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', 'warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', 'debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', 'verbose', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', 'fatal', message, optionalParams);
  }

  setLogLevels(levels: LogLevel[]): void {
    this.enabledLogLevels = new Set(levels);
  }

  private write(level: JsonLogLevel, nestLevel: LogLevel, message: unknown, optionalParams: unknown[]): void {
    if (!this.enabledLogLevels.has(nestLevel)) {
      return;
    }

    const context = readLogContext(optionalParams);
    const stack = readLogStack(optionalParams);
    const record: StructuredLogRecord & Record<string, unknown> = {
      ...normalizeLogMessage(message),
      ...(context ? { context } : {}),
      ...(stack ? { stack } : {}),
      // Canonical logger fields are assigned last so application log payloads cannot accidentally overwrite severity, pid, or timestamp.
      timestamp: new Date().toISOString(),
      level,
      nestLevel,
      pid: process.pid,
    };

    writeJsonLine(level, record);
  }
}

function normalizeLogMessage(message: unknown): Record<string, unknown> {
  if (message instanceof Error) {
    return {
      errorName: message.name,
      message: message.message,
      stack: message.stack,
    };
  }

  if (message && typeof message === 'object' && !Array.isArray(message)) {
    // Structured call sites can pass objects directly; this keeps request id, event name, and timing fields queryable in Docker logs.
    return message as Record<string, unknown>;
  }

  return { message: String(message) };
}

function readLogContext(optionalParams: unknown[]): string | undefined {
  const context = [...optionalParams].reverse().find((value) => typeof value === 'string' && !looksLikeStack(value));

  return typeof context === 'string' && context.trim() ? context : undefined;
}

function readLogStack(optionalParams: unknown[]): string | undefined {
  const stack = optionalParams.find((value) => typeof value === 'string' && looksLikeStack(value));

  return typeof stack === 'string' ? stack : undefined;
}

function looksLikeStack(value: string): boolean {
  return value.includes('\n') || value.includes('    at ');
}

function writeJsonLine(level: JsonLogLevel, record: Record<string, unknown>): void {
  const line = stringifyLogRecord(record);

  if (level === 'error' || level === 'fatal') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

function stringifyLogRecord(record: Record<string, unknown>): string {
  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(record, (_key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }

      if (value && typeof value === 'object') {
        if (seen.has(value)) {
          return '[Circular]';
        }

        seen.add(value);
      }

      return value;
    });
  } catch {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      event: 'logger.serialization_failed',
      message: 'A log record could not be serialized.',
      pid: process.pid,
    });
  }
}
