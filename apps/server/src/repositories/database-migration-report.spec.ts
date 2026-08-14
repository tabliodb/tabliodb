import { describe, expect, it } from 'vitest';
import { assertDatabaseMigrationSucceeded, createDatabaseMigrationSummary } from './database-migration-report.js';

describe('database migration report', () => {
  it('summarizes successful migration rows for CLI output', () => {
    const summary = createDatabaseMigrationSummary({
      results: [
        { migrationName: '0000000000000-initial', status: 'Success' },
        { migrationName: '2026072900000-align-prototype-schema', status: 'Success' },
      ],
    });

    expect(summary.appliedCount).toBe(2);
    expect(summary.lines).toEqual(['Success: 0000000000000-initial', 'Success: 2026072900000-align-prototype-schema']);
    expect(summary.noop).toBe(false);
    expect(() => assertDatabaseMigrationSucceeded(summary)).not.toThrow();
  });

  it('treats an empty result as an explicit no-op rerun', () => {
    const summary = createDatabaseMigrationSummary({});

    // Running db:migrate twice should be boring and clear: no pending rows means Kysely has already recorded every migration.
    expect(summary.appliedCount).toBe(0);
    expect(summary.lines).toEqual([]);
    expect(summary.noop).toBe(true);
    expect(() => assertDatabaseMigrationSucceeded(summary)).not.toThrow();
  });

  it('throws migration errors after the summary has been created', () => {
    const error = new Error('column body does not exist');
    const summary = createDatabaseMigrationSummary({
      error,
      results: [{ migrationName: '2026073100400-secure-comment-lexical-body', status: 'Error' }],
    });

    expect(summary.noop).toBe(false);
    expect(summary.lines).toEqual(['Error: 2026073100400-secure-comment-lexical-body']);
    expect(() => assertDatabaseMigrationSucceeded(summary)).toThrow(error);
  });
});
