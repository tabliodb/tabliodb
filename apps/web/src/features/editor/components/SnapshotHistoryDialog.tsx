import { useQuery } from '@tanstack/react-query';
import type { DatabaseDialect } from '@tabliodb/schema-core';
import type { SnapshotDiffResponseDtoOutput, SnapshotResponseDtoOutput } from '@tabliodb/sdk';
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from '@tabliodb/ui';
import { Check, Code2, Copy, FileWarning, History, Loader2, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getErrorMessage } from '@/features/app/RouteStates';
import { snapshotsQueries } from '@/resources/snapshots';
import { formatDiagramDialect } from '../diagram-formatters';

type SnapshotResponseDto = SnapshotResponseDtoOutput;
type SnapshotDiffResponseDto = SnapshotDiffResponseDtoOutput;

export function SnapshotHistoryDialog({
  canRestore,
  isRestoring,
  latestSnapshot,
  onOpenChange,
  onRestore,
  open,
  restoreError,
  snapshots,
}: {
  canRestore: boolean;
  isRestoring: boolean;
  latestSnapshot: SnapshotResponseDto | null;
  onOpenChange: (open: boolean) => void;
  onRestore: (snapshotId: string) => void;
  open: boolean;
  restoreError: unknown;
  snapshots: SnapshotResponseDto[];
}) {
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const defaultCompareSnapshotId = snapshots.find((snapshot) => snapshot.id !== latestSnapshot?.id)?.id ?? null;
  const selectedSnapshot = selectedSnapshotId
    ? (snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ?? null)
    : null;
  const canCompareSnapshots = Boolean(
    open && selectedSnapshot && latestSnapshot && selectedSnapshot.id !== latestSnapshot.id,
  );
  const diffQueryOptions = snapshotsQueries.diff(
    canCompareSnapshots ? (selectedSnapshot?.id ?? null) : null,
    canCompareSnapshots ? (latestSnapshot?.id ?? null) : null,
  );
  const diffQuery = useQuery({
    ...diffQueryOptions,
    // Diff cukup dimuat saat dialog terbuka dan user memilih versi lama; ini menjaga editor initial render tetap ringan.
    enabled: canCompareSnapshots && diffQueryOptions.enabled !== false,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!selectedSnapshotId || !snapshots.some((snapshot) => snapshot.id === selectedSnapshotId)) {
      setSelectedSnapshotId(defaultCompareSnapshotId ?? latestSnapshot?.id ?? null);
    }
  }, [defaultCompareSnapshotId, latestSnapshot?.id, open, selectedSnapshotId, snapshots]);

  const restoreDisabled = !canRestore || !selectedSnapshot || selectedSnapshot.id === latestSnapshot?.id || isRestoring;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="h-[min(86dvh,760px)] w-[min(96vw,1120px)] max-w-none max-[640px]:h-[100dvh] max-[640px]:max-h-screen max-[640px]:w-screen max-[640px]:rounded-none max-[640px]:border-0">
        <DialogHeader className="border-b border-[rgb(var(--tabliodb-border))] pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2">
                <History className="size-5 text-[rgb(var(--tabliodb-lavender-text))]" />
                Snapshot history
              </DialogTitle>
              <DialogDescription>
                Restore an older checkpoint or compare it with the latest saved snapshot.
              </DialogDescription>
            </div>
            <Badge variant={snapshots.length > 1 ? 'purple' : 'neutral'}>{snapshots.length} versions</Badge>
          </div>
        </DialogHeader>

        <DialogBody className="grid min-h-0 flex-1 grid-rows-[minmax(160px,0.32fr)_minmax(0,1fr)] gap-3 overflow-hidden px-3 py-3 sm:gap-4 sm:px-4 sm:py-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-none">
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-[18px] border border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))]">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[rgb(var(--tabliodb-border))] px-4 py-3">
              <div>
                <h3 className="text-[13px] font-extrabold">Versions</h3>
                <p className="text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">Newest first</p>
              </div>
              <Badge variant="neutral">{snapshots.length}</Badge>
            </div>
            <div className="tabliodb-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
              {snapshots.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[rgb(var(--tabliodb-border))] bg-white p-4 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                  No snapshots yet
                </div>
              ) : (
                <div className="grid gap-2">
                  {snapshots.map((snapshot) => {
                    const isSelected = snapshot.id === selectedSnapshot?.id;
                    const isLatest = snapshot.id === latestSnapshot?.id;

                    return (
                      <button
                        className={cn(
                          'w-full cursor-pointer rounded-2xl border bg-white px-3 py-3 text-left transition',
                          isSelected
                            ? 'border-[rgb(var(--tabliodb-lavender-border))] bg-[rgb(var(--tabliodb-lavender-soft))] shadow-[0_3px_0_rgb(var(--tabliodb-lavender-border))]'
                            : 'border-[rgb(var(--tabliodb-border))] shadow-[0_2px_0_rgb(var(--tabliodb-border))] hover:border-[rgb(var(--tabliodb-primary-border))] hover:bg-[rgb(var(--tabliodb-primary-soft))]',
                        )}
                        key={snapshot.id}
                        onClick={() => setSelectedSnapshotId(snapshot.id)}
                        type="button"
                      >
                        <span className="mb-2 flex min-w-0 items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2">
                            <Badge variant={isLatest ? 'green' : 'neutral'}>v{snapshot.version}</Badge>
                            <span className="truncate text-[13px] font-extrabold">
                              {snapshot.message ?? `Snapshot v${snapshot.version}`}
                            </span>
                          </span>
                          {isLatest ? <Badge variant="green">Current</Badge> : null}
                        </span>
                        <span className="block text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                          {formatDateTime(snapshot.createdAt)}
                        </span>
                        {snapshot.restoredFromSnapshotId ? (
                          <span className="mt-2 inline-flex rounded-full border border-[rgb(var(--tabliodb-lavender-border))] bg-white px-2 py-1 text-[10px] font-extrabold text-[rgb(var(--tabliodb-lavender-text))]">
                            Restored checkpoint
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-[18px] border border-[rgb(var(--tabliodb-border))] bg-white">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[rgb(var(--tabliodb-border))] px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-extrabold">
                  {selectedSnapshot ? `Snapshot v${selectedSnapshot.version}` : 'Select a snapshot'}
                </h3>
                <p className="text-[13px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                  {latestSnapshot && selectedSnapshot && selectedSnapshot.id !== latestSnapshot.id
                    ? `Compared with v${latestSnapshot.version}`
                    : 'Latest snapshot is already active'}
                </p>
              </div>
              <Button
                disabled={restoreDisabled}
                onClick={() => selectedSnapshot && onRestore(selectedSnapshot.id)}
                variant="purple"
              >
                {isRestoring ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                Restore
              </Button>
            </div>

            <div className="tabliodb-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {restoreError ? (
                <div className="mb-4 rounded-2xl border border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] px-4 py-3 text-sm font-extrabold text-[rgb(var(--tabliodb-danger-text))]">
                  {getErrorMessage(restoreError)}
                </div>
              ) : null}

              {!selectedSnapshot ? (
                <SnapshotHistoryEmptyState message="Choose a saved version from the list." />
              ) : selectedSnapshot.id === latestSnapshot?.id ? (
                <SnapshotHistoryEmptyState message="This is the current saved snapshot." />
              ) : diffQuery.isPending ? (
                <div className="flex h-full min-h-65 items-center justify-center gap-2 text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                  <Loader2 className="size-4 animate-spin" />
                  Loading diff
                </div>
              ) : diffQuery.error ? (
                <div className="rounded-2xl border border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] px-4 py-3 text-sm font-extrabold text-[rgb(var(--tabliodb-danger-text))]">
                  {getErrorMessage(diffQuery.error)}
                </div>
              ) : diffQuery.data ? (
                <SnapshotDiffPanel diff={diffQuery.data} />
              ) : (
                <SnapshotHistoryEmptyState message="No diff available for this selection." />
              )}
            </div>
          </section>
        </DialogBody>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="secondary">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SnapshotHistoryEmptyState({ message }: { message: string }) {
  return (
    <div className="grid h-full min-h-65 place-items-center rounded-[18px] border border-dashed border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] p-6 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
      {message}
    </div>
  );
}

function SnapshotDiffPanel({ diff }: { diff: SnapshotDiffResponseDto }) {
  const changedTotal = getSnapshotDiffTotal(diff);
  const renamedTables = diff.tables.renamed;
  const [migrationCopied, setMigrationCopied] = useState(false);

  async function handleCopyMigrationSql() {
    await navigator.clipboard.writeText(diff.migrationSql.sql);
    setMigrationCopied(true);
    window.setTimeout(() => setMigrationCopied(false), 1400);
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-[18px] border border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-[14px] font-extrabold">Change summary</h4>
            <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
              v{diff.fromSnapshot.version} to v{diff.toSnapshot.version}
            </p>
          </div>
          <Badge variant={changedTotal > 0 ? 'purple' : 'green'}>
            {changedTotal > 0 ? `${changedTotal} changes` : 'No changes'}
          </Badge>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <SnapshotDiffMetric label="Tables" summary={diff.tables} />
          <SnapshotDiffMetric label="Columns" summary={diff.columns} />
          <SnapshotDiffMetric label="Relationships" summary={diff.relationships} />
          <SnapshotDiffMetric label="Indexes" summary={diff.indexes} />
          <SnapshotDiffMetric label="Enums" summary={diff.enums} />
          <SnapshotDiffMetric label="Checks" summary={diff.checks} />
          <SnapshotDiffMetric label="Notes" summary={diff.notes} />
          <SnapshotDiffMetric label="Groups" summary={diff.groups} />
          <SnapshotBooleanMetric changed={diff.dialectChanged} label="Dialect" />
          <SnapshotBooleanMetric changed={diff.metadataChanged} label="Metadata" />
          <SnapshotBooleanMetric changed={diff.schemaVersionChanged} label="Schema version" />
        </div>
      </div>

      {renamedTables.length > 0 ? (
        <div className="rounded-[18px] border border-[rgb(var(--tabliodb-lavender-border))] bg-[rgb(var(--tabliodb-lavender-soft))] p-4">
          <h4 className="mb-3 text-[13px] font-extrabold text-[rgb(var(--tabliodb-lavender-text))]">Renamed tables</h4>
          <div className="grid gap-2">
            {renamedTables.map((table) => (
              <div
                className="flex flex-wrap items-center gap-2 rounded-[14px] border border-[rgb(var(--tabliodb-border))] bg-white px-3 py-2 text-[13px] font-bold"
                key={table.id}
              >
                <span className="text-[rgb(var(--tabliodb-ink-muted))]">{table.fromName}</span>
                <span className="text-[rgb(var(--tabliodb-lavender-text))]">to</span>
                <span>{table.toName}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-[18px] border border-[rgb(var(--tabliodb-border))] bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-2 text-[14px] font-extrabold">
              <Code2 className="size-4 text-[rgb(var(--tabliodb-sky-text))]" />
              Migration SQL preview
            </h4>
            <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
              Generated for {formatDiagramDialect(diff.migrationSql.dialect)}
            </p>
          </div>
          <Button className="gap-2" onClick={handleCopyMigrationSql} size="sm" type="button" variant="secondary">
            {migrationCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {migrationCopied ? 'Copied' : 'Copy SQL'}
          </Button>
        </div>

        {diff.migrationSql.warnings.length > 0 ? (
          <section className="mt-3 rounded-2xl border border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] p-3 text-[12px] font-bold text-[rgb(var(--tabliodb-gold-text))]">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-extrabold text-[rgb(var(--tabliodb-ink))]">
              <FileWarning className="size-4 text-[rgb(var(--tabliodb-gold-text))]" />
              Review before applying
            </div>
            <ul className="grid gap-1.5">
              {diff.migrationSql.warnings.map((warning) => (
                <li className="leading-5" key={`${warning.code}:${warning.message}`}>
                  {warning.message}
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="mt-3 rounded-2xl border border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] p-3 text-[12px] font-extrabold text-[rgb(var(--tabliodb-primary-text))]">
            No migration warnings for this preview.
          </section>
        )}

        <pre className="tabliodb-scrollbar mt-3 max-h-72 overflow-auto rounded-2xl border-2 border-[rgb(var(--tabliodb-ink))] bg-[rgb(var(--tabliodb-ink))] p-4 text-[12px] font-semibold leading-5 text-white shadow-[0_3px_0_rgb(var(--tabliodb-border-strong))]">
          <code>{diff.migrationSql.sql}</code>
        </pre>
      </div>
    </div>
  );
}

function SnapshotDiffMetric({
  label,
  summary,
}: {
  label: string;
  summary: { added: number; changed: number; removed: number };
}) {
  const total = summary.added + summary.changed + summary.removed;

  return (
    <div className="rounded-2xl border border-[rgb(var(--tabliodb-border))] bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[12px] font-extrabold uppercase text-[rgb(var(--tabliodb-ink-muted))]">{label}</span>
        <Badge variant={total > 0 ? 'yellow' : 'neutral'}>{total}</Badge>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <SnapshotDiffPill label="Added" value={summary.added} />
        <SnapshotDiffPill label="Changed" value={summary.changed} />
        <SnapshotDiffPill label="Removed" value={summary.removed} />
      </div>
    </div>
  );
}

function SnapshotBooleanMetric({ changed, label }: { changed: boolean; label: string }) {
  return (
    <div className="rounded-2xl border border-[rgb(var(--tabliodb-border))] bg-white p-3">
      <div className="mb-2 text-[12px] font-extrabold uppercase text-[rgb(var(--tabliodb-ink-muted))]">{label}</div>
      <Badge variant={changed ? 'yellow' : 'neutral'}>{changed ? 'Changed' : 'Same'}</Badge>
    </div>
  );
}

function SnapshotDiffPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] px-2 py-1 text-[10px] font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
      {label}: {value}
    </span>
  );
}

function getSnapshotDiffTotal(diff: SnapshotDiffResponseDto): number {
  const countableSummaries = [
    diff.tables,
    diff.columns,
    diff.relationships,
    diff.indexes,
    diff.enums,
    diff.checks,
    diff.notes,
    diff.groups,
  ];

  return (
    countableSummaries.reduce((total, summary) => total + summary.added + summary.changed + summary.removed, 0) +
    Number(diff.dialectChanged) +
    Number(diff.metadataChanged) +
    Number(diff.schemaVersionChanged)
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}
