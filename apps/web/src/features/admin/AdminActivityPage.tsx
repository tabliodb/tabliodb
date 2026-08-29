import { useQuery } from '@tanstack/react-query';
import type { AuditLogDtoOutput } from '@tabliodb/sdk';
import { Badge, Button, Input, Select, Surface, cn } from '@tabliodb/ui';
import { Activity, Building2, FileClock, FilterX, Search, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, InlineErrorState, InlineLoadingState } from '@/features/app/RouteStates';
import { adminQueries, type AdminAuditLogListQuery } from '@/resources/admin';
import { organizationsQueries } from '@/resources/organizations';

const activityPageSize = 20;
const allWorkspaceFilterValue = 'all-workspaces';

export function AdminActivityPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [workspaceFilter, setWorkspaceFilter] = useState(allWorkspaceFilterValue);
  const [pageCursor, setPageCursor] = useState<string | undefined>();
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([]);
  const activityQuery = useMemo<AdminAuditLogListQuery>(
    () => ({
      action: actionFilter.trim() || undefined,
      cursor: pageCursor,
      limit: activityPageSize,
      organizationId: workspaceFilter === allWorkspaceFilterValue ? undefined : workspaceFilter,
      search: searchTerm.trim() || undefined,
    }),
    [actionFilter, pageCursor, searchTerm, workspaceFilter],
  );
  const auditLogsQuery = useQuery(adminQueries.auditLogs(activityQuery));
  const workspacesQuery = useQuery(organizationsQueries.adminWorkspaces({ limit: 100 }));
  const auditLogs = auditLogsQuery.data?.items ?? [];
  const totalCount = auditLogsQuery.data?.totalCount ?? 0;
  const nextCursor = auditLogsQuery.data?.nextCursor ?? null;
  const workspaceOptions = useMemo(
    () => [
      { label: 'All workspaces', value: allWorkspaceFilterValue },
      ...(workspacesQuery.data?.items.map((workspace) => ({
        label: workspace.name,
        textValue: workspace.name,
        value: workspace.id,
      })) ?? []),
    ],
    [workspacesQuery.data?.items],
  );
  const hasActiveFilters =
    Boolean(searchTerm.trim()) || Boolean(actionFilter.trim()) || workspaceFilter !== allWorkspaceFilterValue;

  function resetPagination() {
    // Filter activity mengubah hasil query server, sehingga cursor offset lama harus dibuang.
    setPageCursor(undefined);
    setCursorHistory([]);
  }

  function clearFilters() {
    setSearchTerm('');
    setActionFilter('');
    setWorkspaceFilter(allWorkspaceFilterValue);
    resetPagination();
  }

  return (
    <div className="mx-auto grid min-w-0 w-full max-w-7xl gap-5 px-4 py-4 sm:px-5 sm:py-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-normal text-[rgb(var(--tabliodb-ink))]">Activity</h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
            Inspect cross-workspace audit events for support, security review, and self-hosted troubleshooting.
          </p>
        </div>
        <Badge variant="neutral">{totalCount} matching events</Badge>
      </section>

      <Surface className="min-w-0 overflow-hidden" depth="md">
        <div className="grid gap-3 border-b-2 border-[rgb(var(--tabliodb-border))] p-4 xl:grid-cols-[minmax(220px,1fr)_minmax(180px,260px)_minmax(180px,260px)_auto] xl:items-end">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Search activity
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--tabliodb-ink-subtle))]" />
              <Input
                className="pl-9"
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  resetPagination();
                }}
                placeholder="Actor, action, entity, request id"
                value={searchTerm}
              />
            </div>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Workspace
            </span>
            <Select
              onValueChange={(value) => {
                setWorkspaceFilter(value);
                resetPagination();
              }}
              options={workspaceOptions}
              value={workspaceFilter}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Action
            </span>
            <Input
              onChange={(event) => {
                setActionFilter(event.target.value);
                resetPagination();
              }}
              placeholder="diagram.updated"
              value={actionFilter}
            />
          </label>

          <Button disabled={!hasActiveFilters} onClick={clearFilters} variant="secondary">
            <FilterX className="size-4" />
            Clear
          </Button>
        </div>

        {auditLogsQuery.isPending ? (
          <InlineLoadingState className="m-4" message="Loading activity" />
        ) : auditLogsQuery.error ? (
          <InlineErrorState
            className="m-4"
            error={auditLogsQuery.error}
            onRetry={() => void auditLogsQuery.refetch()}
            title="Could not load activity"
          />
        ) : auditLogs.length === 0 ? (
          <EmptyState
            description={
              hasActiveFilters
                ? 'Try clearing filters to see more events.'
                : 'Audit events will appear here after admin or editor actions.'
            }
            icon={FileClock}
            title="No activity found"
          />
        ) : (
          <div className="divide-y divide-[rgb(var(--tabliodb-border))]">
            {auditLogs.map((auditLog) => (
              <AuditLogRow auditLog={auditLog} key={auditLog.id} />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t-2 border-[rgb(var(--tabliodb-border))] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
            Showing {auditLogs.length} of {totalCount} matching events
          </p>
          <div className="flex gap-2">
            <Button
              disabled={cursorHistory.length === 0 || auditLogsQuery.isFetching}
              onClick={() => {
                const previousCursor = cursorHistory[cursorHistory.length - 1];
                setCursorHistory((history) => history.slice(0, -1));
                setPageCursor(previousCursor);
              }}
              size="sm"
              variant="secondary"
            >
              Previous
            </Button>
            <Button
              disabled={!nextCursor || auditLogsQuery.isFetching}
              onClick={() => {
                setCursorHistory((history) => [...history, pageCursor]);
                setPageCursor(nextCursor ?? undefined);
              }}
              size="sm"
            >
              Next
            </Button>
          </div>
        </div>
      </Surface>
    </div>
  );
}

function AuditLogRow({ auditLog }: { auditLog: AuditLogDtoOutput }) {
  return (
    <article className="grid min-w-0 gap-4 p-4 transition hover:bg-[rgb(var(--tabliodb-surface))] xl:grid-cols-[minmax(0,1fr)_minmax(180px,260px)_minmax(150px,220px)]">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-[var(--tabliodb-radius-md)]',
            getActionIconClassName(auditLog.action),
          )}
        >
          <Activity className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-extrabold">{formatAuditAction(auditLog.action)}</h3>
            <Badge variant={getActionTone(auditLog.action)}>{auditLog.entityType}</Badge>
          </div>
          <p className="mt-1 break-all text-xs font-bold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
            {auditLog.entityId}
          </p>
          {auditLog.requestId ? (
            <p className="mt-1 truncate text-[11px] font-bold text-[rgb(var(--tabliodb-ink-subtle))]">
              Request {auditLog.requestId}
            </p>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 text-sm">
        <div className="flex min-w-0 items-center gap-2 font-extrabold">
          <UserRound className="size-4 shrink-0 text-[rgb(var(--tabliodb-ink-subtle))]" />
          <span className="truncate">{auditLog.actorName ?? 'System'}</span>
        </div>
        <p className="mt-1 truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
          {auditLog.actorEmail ?? 'No actor email'}
        </p>
      </div>

      <div className="min-w-0 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))] xl:text-right">
        <div>{formatDateTime(auditLog.createdAt)}</div>
        {auditLog.organizationId ? <div className="mt-1 truncate">Workspace {auditLog.organizationId}</div> : null}
        {auditLog.ipAddress ? <div className="mt-1 truncate">{auditLog.ipAddress}</div> : null}
      </div>
    </article>
  );
}

function getActionIconClassName(action: string): string {
  const tone = getActionTone(action);

  return {
    blue: 'bg-[rgb(var(--tabliodb-sky-soft))] text-[rgb(var(--tabliodb-sky-text))]',
    green: 'bg-[rgb(var(--tabliodb-selected-surface))] text-[rgb(var(--tabliodb-primary-text))]',
    neutral: 'bg-[rgb(var(--tabliodb-surface-raised))] text-[rgb(var(--tabliodb-ink-muted))]',
    purple: 'bg-[rgb(var(--tabliodb-lavender-soft))] text-[rgb(var(--tabliodb-lavender-text))]',
    yellow: 'bg-[rgb(var(--tabliodb-gold-soft))] text-[rgb(var(--tabliodb-gold-text))]',
  }[tone];
}

function getActionTone(action: string): 'blue' | 'green' | 'neutral' | 'purple' | 'yellow' {
  if (action.includes('created') || action.includes('added') || action.includes('enabled')) {
    return 'green';
  }

  if (action.includes('removed') || action.includes('revoked') || action.includes('disabled')) {
    return 'yellow';
  }

  if (action.includes('share') || action.includes('invitation')) {
    return 'blue';
  }

  if (action.includes('review') || action.includes('comment')) {
    return 'purple';
  }

  return 'neutral';
}

function formatAuditAction(action: string): string {
  return action
    .split(/[._]/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(date);
}
