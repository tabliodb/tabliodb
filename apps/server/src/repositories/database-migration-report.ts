export type DatabaseMigrationResultItem = {
  migrationName?: string;
  status: string;
};

export type DatabaseMigrationResultLike = {
  error?: unknown;
  results?: readonly DatabaseMigrationResultItem[];
};

export type DatabaseMigrationSummary = {
  appliedCount: number;
  error: unknown | null;
  lines: string[];
  noop: boolean;
  results: readonly DatabaseMigrationResultItem[];
};

export function createDatabaseMigrationSummary(result: DatabaseMigrationResultLike): DatabaseMigrationSummary {
  const results = result.results ?? [];
  const lines = results.map((item) => `${item.status}: ${item.migrationName ?? 'unknown'}`);

  return {
    // Kysely returns an empty result list when every migration has already been applied, so the CLI can explain the safe no-op rerun.
    appliedCount: results.filter((item) => item.status === 'Success').length,
    error: result.error ?? null,
    lines,
    noop: results.length === 0 && !result.error,
    results,
  };
}

export function assertDatabaseMigrationSucceeded(summary: DatabaseMigrationSummary): void {
  if (summary.error) {
    // Migration failures must fail the process after the report is printed so CI/local setup never continues with a partial schema.
    throw summary.error;
  }
}
