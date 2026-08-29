import { useQuery } from '@tanstack/react-query';
import type { AdminBackgroundJobDtoOutput } from '@tabliodb/sdk';
import { Badge, Button, Input, Select, Surface, cn } from '@tabliodb/ui';
import { AlertTriangle, CheckCircle2, Clock3, FilterX, Loader2, Search, ServerCog, TimerReset } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, InlineErrorState, InlineLoadingState } from '@/features/app/RouteStates';
import { adminQueries, type AdminBackgroundJobListQuery } from '@/resources/admin';

const jobsPageSize = 20;
const allStatusFilterValue = 'all-statuses';
type JobStatus = AdminBackgroundJobDtoOutput['status'];
type JobTone = 'blue' | 'green' | 'neutral' | 'yellow';

const statusOptions = [
  { label: 'All statuses', value: allStatusFilterValue },
  { label: 'Queued', value: 'queued' },
  { label: 'Running', value: 'running' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Dead', value: 'dead' },
] as const;

export function AdminJobsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [queueFilter, setQueueFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(allStatusFilterValue);
  const [pageCursor, setPageCursor] = useState<string | undefined>();
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([]);
  const jobsQueryInput = useMemo<AdminBackgroundJobListQuery>(
    () => ({
      cursor: pageCursor,
      limit: jobsPageSize,
      queue: queueFilter.trim() || undefined,
      search: searchTerm.trim() || undefined,
      status:
        statusFilter === allStatusFilterValue ? undefined : (statusFilter as AdminBackgroundJobDtoOutput['status']),
      type: typeFilter.trim() || undefined,
    }),
    [pageCursor, queueFilter, searchTerm, statusFilter, typeFilter],
  );
  const jobsQuery = useQuery(adminQueries.backgroundJobs(jobsQueryInput));
  const jobs = jobsQuery.data?.items ?? [];
  const totalCount = jobsQuery.data?.totalCount ?? 0;
  const nextCursor = jobsQuery.data?.nextCursor ?? null;
  const stats = useMemo(() => getJobStats(jobs), [jobs]);
  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    Boolean(queueFilter.trim()) ||
    Boolean(typeFilter.trim()) ||
    statusFilter !== allStatusFilterValue;

  function resetPagination() {
    // Job filters are server-side; reset offset pagination whenever the filtered dataset changes.
    setPageCursor(undefined);
    setCursorHistory([]);
  }

  function clearFilters() {
    setSearchTerm('');
    setQueueFilter('');
    setTypeFilter('');
    setStatusFilter(allStatusFilterValue);
    resetPagination();
  }

  return (
    <div className="mx-auto grid min-w-0 w-full max-w-7xl gap-5 px-4 py-4 sm:px-5 sm:py-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-normal text-[rgb(var(--tabliodb-ink))]">Jobs</h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
            Monitor background work such as comment notification delivery. Failed jobs often point to SMTP or worker
            configuration issues.
          </p>
        </div>
        <Badge variant="neutral">{totalCount} matching jobs</Badge>
      </section>

      <section className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <JobStatCard icon={Clock3} label="Queued on page" value={stats.queued} />
        <JobStatCard icon={Loader2} label="Running on page" tone="blue" value={stats.running} />
        <JobStatCard icon={CheckCircle2} label="Completed on page" tone="green" value={stats.completed} />
        <JobStatCard icon={AlertTriangle} label="Needs attention" tone="yellow" value={stats.failed + stats.dead} />
      </section>

      <Surface className="min-w-0 overflow-hidden" depth="md">
        <div className="grid gap-3 border-b-2 border-[rgb(var(--tabliodb-border))] p-4 xl:grid-cols-[minmax(220px,1fr)_minmax(160px,210px)_minmax(160px,210px)_minmax(150px,190px)_auto] xl:items-end">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Search jobs
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--tabliodb-ink-subtle))]" />
              <Input
                className="pl-9"
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  resetPagination();
                }}
                placeholder="Id, queue, type, worker"
                value={searchTerm}
              />
            </div>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Status
            </span>
            <Select
              onValueChange={(value) => {
                setStatusFilter(value);
                resetPagination();
              }}
              options={[...statusOptions]}
              value={statusFilter}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Queue
            </span>
            <Input
              onChange={(event) => {
                setQueueFilter(event.target.value);
                resetPagination();
              }}
              placeholder="notifications"
              value={queueFilter}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Type
            </span>
            <Input
              onChange={(event) => {
                setTypeFilter(event.target.value);
                resetPagination();
              }}
              placeholder="comment.notification_delivery"
              value={typeFilter}
            />
          </label>

          <Button disabled={!hasActiveFilters} onClick={clearFilters} variant="secondary">
            <FilterX className="size-4" />
            Clear
          </Button>
        </div>

        {jobsQuery.isPending ? (
          <InlineLoadingState className="m-4" message="Loading jobs" />
        ) : jobsQuery.error ? (
          <InlineErrorState
            className="m-4"
            error={jobsQuery.error}
            onRetry={() => void jobsQuery.refetch()}
            title="Could not load jobs"
          />
        ) : jobs.length === 0 ? (
          <EmptyState
            description={
              hasActiveFilters
                ? 'Try clearing filters to see more jobs.'
                : 'Background jobs will appear here when async work is queued.'
            }
            icon={ServerCog}
            title="No jobs found"
          />
        ) : (
          <div className="divide-y divide-[rgb(var(--tabliodb-border))]">
            {jobs.map((job) => (
              <JobRow job={job} key={job.id} />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t-2 border-[rgb(var(--tabliodb-border))] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
            Showing {jobs.length} of {totalCount} matching jobs
          </p>
          <div className="flex gap-2">
            <Button
              disabled={cursorHistory.length === 0 || jobsQuery.isFetching}
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
              disabled={!nextCursor || jobsQuery.isFetching}
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

function JobRow({ job }: { job: AdminBackgroundJobDtoOutput }) {
  return (
    <article className="grid min-w-0 gap-4 p-4 transition hover:bg-[rgb(var(--tabliodb-surface))] xl:grid-cols-[minmax(0,1fr)_minmax(180px,240px)_minmax(160px,220px)]">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-[var(--tabliodb-radius-md)]',
            getJobIconClassName(job.status),
          )}
        >
          <ServerCog className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-extrabold">{job.type}</h3>
            <Badge variant={getJobBadgeTone(job.status)}>{job.status}</Badge>
          </div>
          <p className="mt-1 truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
            {job.queue} queue / priority {job.priority} / attempts {job.attempts}/{job.maxAttempts}
          </p>
          <details className="mt-2 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
            <summary className="cursor-pointer select-none text-[rgb(var(--tabliodb-ink))]">Payload and result</summary>
            <pre className="tabliodb-scrollbar mt-2 max-h-44 overflow-auto rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] p-3 text-[11px] leading-5">
              {stringifyJobDetails(job)}
            </pre>
          </details>
        </div>
      </div>

      <div className="min-w-0 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
        <div className="text-[rgb(var(--tabliodb-ink))]">Scheduled {formatDateTime(job.scheduledAt)}</div>
        <div className="mt-1">Created {formatDateTime(job.createdAt)}</div>
        {job.startedAt ? <div className="mt-1">Started {formatDateTime(job.startedAt)}</div> : null}
        {job.completedAt ? <div className="mt-1">Completed {formatDateTime(job.completedAt)}</div> : null}
      </div>

      <div className="min-w-0 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))] xl:text-right">
        {job.lockedBy ? <div className="truncate">Worker {job.lockedBy}</div> : <div>No active worker lock</div>}
        {job.lockedAt ? <div className="mt-1">Locked {formatDateTime(job.lockedAt)}</div> : null}
        {job.failedAt ? (
          <div className="mt-1 text-[rgb(var(--tabliodb-gold-text))]">Failed {formatDateTime(job.failedAt)}</div>
        ) : null}
      </div>
    </article>
  );
}

function JobStatCard({
  icon: Icon,
  label,
  tone = 'neutral',
  value,
}: {
  icon: typeof Clock3;
  label: string;
  tone?: JobTone;
  value: number;
}) {
  return (
    <Surface className={cn('grid gap-3 p-4', getStatToneClassName(tone))} depth="sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-extrabold uppercase tracking-wide opacity-75">{label}</span>
        <Icon className="size-4 opacity-75" />
      </div>
      <div className="truncate text-2xl font-extrabold">{formatNumber(value)}</div>
    </Surface>
  );
}

function getJobStats(jobs: AdminBackgroundJobDtoOutput[]) {
  return jobs.reduce(
    (stats, job) => ({
      completed: stats.completed + (job.status === 'completed' ? 1 : 0),
      dead: stats.dead + (job.status === 'dead' ? 1 : 0),
      failed: stats.failed + (job.status === 'failed' ? 1 : 0),
      queued: stats.queued + (job.status === 'queued' ? 1 : 0),
      running: stats.running + (job.status === 'running' ? 1 : 0),
    }),
    { completed: 0, dead: 0, failed: 0, queued: 0, running: 0 },
  );
}

const jobBadgeToneByStatus: Record<JobStatus, JobTone> = {
  completed: 'green',
  dead: 'yellow',
  failed: 'yellow',
  queued: 'neutral',
  running: 'blue',
};

const jobIconClassNameByStatus: Record<JobStatus, string> = {
  completed: 'bg-[rgb(var(--tabliodb-selected-surface))] text-[rgb(var(--tabliodb-primary-text))]',
  dead: 'bg-[rgb(var(--tabliodb-gold-soft))] text-[rgb(var(--tabliodb-gold-text))]',
  failed: 'bg-[rgb(var(--tabliodb-gold-soft))] text-[rgb(var(--tabliodb-gold-text))]',
  queued: 'bg-[rgb(var(--tabliodb-surface-raised))] text-[rgb(var(--tabliodb-ink-muted))]',
  running: 'bg-[rgb(var(--tabliodb-sky-soft))] text-[rgb(var(--tabliodb-sky-text))]',
};

function getJobBadgeTone(status: JobStatus): JobTone {
  return jobBadgeToneByStatus[status];
}

function getJobIconClassName(status: JobStatus): string {
  return jobIconClassNameByStatus[status];
}

function getStatToneClassName(tone: JobTone): string {
  return {
    blue: 'border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky-soft))] text-[rgb(var(--tabliodb-sky-text))]',
    green:
      'border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-selected-surface))] text-[rgb(var(--tabliodb-primary-text))]',
    neutral: 'border-[rgb(var(--tabliodb-border))] bg-white text-[rgb(var(--tabliodb-ink))]',
    yellow:
      'border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] text-[rgb(var(--tabliodb-gold-text))]',
  }[tone];
}

function stringifyJobDetails(job: AdminBackgroundJobDtoOutput): string {
  return JSON.stringify(
    {
      error: job.error,
      payload: job.payload,
      result: job.result,
    },
    null,
    2,
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
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
