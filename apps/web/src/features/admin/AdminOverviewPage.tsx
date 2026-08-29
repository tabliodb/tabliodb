import { useQuery } from '@tanstack/react-query';
import {
  TabliodbApiError,
  type ServerHealthResponseDtoOutput,
  type ServerHttpRouteMetricsDtoOutput,
  type ServerMetricsResponseDtoOutput,
} from '@tabliodb/sdk';
import { Badge, Button, Surface, cn } from '@tabliodb/ui';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  HardDrive,
  RadioTower,
  RefreshCw,
  Route,
  Server,
  TimerReset,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { InlineErrorState, InlineLoadingState } from '@/features/app/RouteStates';
import { serverQueries } from '@/resources/server';

type DependencyHealth = ServerHealthResponseDtoOutput['dependencies']['database'];
type StatusTone = 'disabled' | 'error' | 'ok';
type MetricTone = 'blue' | 'green' | 'neutral' | 'yellow';

const statusGroupRows = [
  { colorClassName: 'bg-[rgb(var(--tabliodb-primary))]', key: 'success', label: '2xx success' },
  { colorClassName: 'bg-[rgb(var(--tabliodb-sky))]', key: 'redirection', label: '3xx redirect' },
  { colorClassName: 'bg-[rgb(var(--tabliodb-gold))]', key: 'clientError', label: '4xx client' },
  { colorClassName: 'bg-[rgb(var(--tabliodb-danger))]', key: 'serverError', label: '5xx server' },
] as const;

export function AdminOverviewPage() {
  const readinessQuery = useQuery(serverQueries.readiness());
  const metricsQuery = useQuery(serverQueries.metrics());
  const readiness = readinessQuery.data ?? null;
  const metrics = metricsQuery.data ?? null;
  const metricsDisabled = metricsQuery.error instanceof TabliodbApiError && metricsQuery.error.status === 404;
  const isRefreshing = readinessQuery.isFetching || metricsQuery.isFetching;

  function handleRefresh() {
    void readinessQuery.refetch();
    void metricsQuery.refetch();
  }

  return (
    <div className="mx-auto grid min-w-0 w-full max-w-7xl gap-5 px-4 py-4 sm:px-5 sm:py-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-normal text-[rgb(var(--tabliodb-ink))]">Overview</h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
            Monitor instance readiness, runtime metrics, and realtime collaboration activity from one admin surface.
          </p>
        </div>
        <Button
          className="gap-2 self-start lg:self-auto"
          disabled={isRefreshing}
          onClick={handleRefresh}
          variant="secondary"
        >
          <RefreshCw className={cn('size-4', isRefreshing && 'animate-spin')} />
          Refresh
        </Button>
      </section>

      {readinessQuery.isPending ? <InlineLoadingState message="Loading server readiness" /> : null}
      {readinessQuery.error && !readiness ? (
        <InlineErrorState
          error={readinessQuery.error}
          onRetry={() => void readinessQuery.refetch()}
          title="Could not load server readiness"
        />
      ) : null}
      {readiness ? <ReadinessPanel readiness={readiness} /> : null}

      {metricsQuery.isPending && !metrics ? <InlineLoadingState message="Loading server metrics" /> : null}
      {metricsDisabled ? <MetricsDisabledPanel /> : null}
      {metricsQuery.error && !metrics && !metricsDisabled ? (
        <InlineErrorState
          error={metricsQuery.error}
          onRetry={() => void metricsQuery.refetch()}
          title="Could not load server metrics"
        />
      ) : null}
      {metrics ? <MetricsPanel metrics={metrics} /> : null}
    </div>
  );
}

function ReadinessPanel({ readiness }: { readiness: ServerHealthResponseDtoOutput }) {
  const dependencies = [
    { health: readiness.dependencies.database, icon: Database, label: 'Database' },
    { health: readiness.dependencies.redis, icon: RadioTower, label: 'Redis' },
    { health: readiness.dependencies.storage, icon: HardDrive, label: 'Storage' },
  ] as const;

  return (
    <section className="grid gap-4">
      <Surface
        className={cn(
          'grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center',
          readiness.ok
            ? 'border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-selected-surface))]'
            : 'border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))]',
        )}
        depth="md"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              'grid size-11 shrink-0 place-items-center rounded-[var(--tabliodb-radius-md)] border',
              readiness.ok
                ? 'border-[rgb(var(--tabliodb-primary-border))] bg-white text-[rgb(var(--tabliodb-primary-text))]'
                : 'border-[rgb(var(--tabliodb-danger-border))] bg-white text-[rgb(var(--tabliodb-danger-text))]',
            )}
          >
            {readiness.ok ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-extrabold">{readiness.ok ? 'Instance ready' : 'Instance degraded'}</h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-[rgb(var(--tabliodb-ink-muted))]">
              {readiness.name} v{readiness.version} checked {formatDateTime(readiness.checkedAt)}.
            </p>
          </div>
        </div>
        <StatusPill status={readiness.ok ? 'ok' : 'error'} />
      </Surface>

      <div className="grid gap-3 md:grid-cols-3">
        {dependencies.map((dependency) => (
          <DependencyCard
            health={dependency.health}
            icon={dependency.icon}
            key={dependency.label}
            label={dependency.label}
          />
        ))}
      </div>
    </section>
  );
}

function DependencyCard({
  health,
  icon: Icon,
  label,
}: {
  health: DependencyHealth;
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  const tone = getDependencyTone(health.status);

  return (
    <Surface className={cn('grid gap-3 p-4', tone.cardClassName)} depth="sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-[var(--tabliodb-radius-md)]',
              tone.iconClassName,
            )}
          >
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-extrabold">{label}</h3>
            <p className="mt-0.5 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
              {health.latencyMs != null ? `${health.latencyMs} ms latency` : 'No latency sample'}
            </p>
          </div>
        </div>
        <StatusPill status={health.status} />
      </div>
      {health.message ? (
        <p className="rounded-[var(--tabliodb-radius-md)] border border-current/20 bg-white/70 px-3 py-2 text-xs font-bold leading-5">
          {health.message}
        </p>
      ) : null}
    </Surface>
  );
}

function MetricsDisabledPanel() {
  return (
    <Surface className="grid gap-2 border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] p-4 text-[rgb(var(--tabliodb-gold-text))]">
      <div className="flex items-center gap-2 text-sm font-extrabold">
        <Gauge className="size-4" />
        Metrics disabled
      </div>
      <p className="text-xs font-bold leading-5">
        Enable the metrics endpoint in server configuration when this self-hosted instance needs operator telemetry.
      </p>
    </Surface>
  );
}

function MetricsPanel({ metrics }: { metrics: ServerMetricsResponseDtoOutput }) {
  const errorRate =
    metrics.http.totalRequests > 0 ? Math.round((metrics.http.errorRequests / metrics.http.totalRequests) * 100) : 0;
  const topRoutes = metrics.http.routes.slice(0, 8);

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-extrabold">Runtime metrics</h3>
          <p className="text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
            Generated {formatDateTime(metrics.generatedAt)}. Started {formatDateTime(metrics.startedAt)}.
          </p>
        </div>
        <Badge variant="neutral">Window: {metrics.window.maxTrackedRoutes} routes</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Activity}
          label="Total requests"
          tone="green"
          value={formatNumber(metrics.http.totalRequests)}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Error rate"
          tone={errorRate > 0 ? 'yellow' : 'neutral'}
          value={`${errorRate}%`}
        />
        <MetricCard
          icon={RadioTower}
          label="Realtime"
          tone={metrics.realtime.activeConnections > 0 ? 'blue' : 'neutral'}
          value={`${metrics.realtime.activeConnections} connections`}
        />
        <MetricCard icon={Clock3} label="Process uptime" value={formatDuration(metrics.process.uptimeSeconds)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Surface className="grid gap-4 p-4" depth="md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold">Process</h3>
              <p className="text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                Node {metrics.process.nodeVersion}, PID {metrics.process.pid}
              </p>
            </div>
            <Server className="size-5 text-[rgb(var(--tabliodb-ink-subtle))]" />
          </div>
          <MetricProgress
            label="Heap usage"
            max={metrics.process.memoryBytes.heapTotal}
            value={metrics.process.memoryBytes.heapUsed}
          />
          <div className="grid gap-2 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
            <MetricLine label="RSS" value={formatBytes(metrics.process.memoryBytes.rss)} />
            <MetricLine label="External" value={formatBytes(metrics.process.memoryBytes.external)} />
            <MetricLine label="Array buffers" value={formatBytes(metrics.process.memoryBytes.arrayBuffers)} />
            <MetricLine label="Active rooms" value={formatNumber(metrics.realtime.activeRooms)} />
          </div>
        </Surface>

        <Surface className="grid gap-4 p-4" depth="md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold">HTTP traffic</h3>
              <p className="text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                Requests grouped by status and method.
              </p>
            </div>
            <TimerReset className="size-5 text-[rgb(var(--tabliodb-ink-subtle))]" />
          </div>
          <StatusGroupBars metrics={metrics} />
          <div className="flex flex-wrap gap-2">
            {metrics.http.methods.length === 0 ? <Badge variant="neutral">No requests yet</Badge> : null}
            {metrics.http.methods.map((method) => (
              <Badge key={method.method} variant="blue">
                {method.method} {formatNumber(method.count)}
              </Badge>
            ))}
          </div>
        </Surface>
      </div>

      <Surface className="min-w-0 overflow-hidden" depth="md">
        <div className="flex items-center justify-between gap-3 border-b border-[rgb(var(--tabliodb-border))] p-4">
          <div>
            <h3 className="text-sm font-extrabold">Busiest routes</h3>
            <p className="text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">Sorted by request count.</p>
          </div>
          <Route className="size-5 text-[rgb(var(--tabliodb-ink-subtle))]" />
        </div>
        {topRoutes.length > 0 ? <RouteMetricsTable routes={topRoutes} /> : <EmptyRoutesState />}
      </Surface>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  tone = 'neutral',
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  tone?: MetricTone;
  value: string;
}) {
  return (
    <Surface className={cn('grid gap-3 p-4', getMetricToneClassName(tone))} depth="sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-extrabold uppercase tracking-wide opacity-75">{label}</span>
        <Icon className="size-4 opacity-75" />
      </div>
      <div className="truncate text-2xl font-extrabold">{value}</div>
    </Surface>
  );
}

function StatusGroupBars({ metrics }: { metrics: ServerMetricsResponseDtoOutput }) {
  const total = Math.max(metrics.http.totalRequests, 1);

  return (
    <div className="grid gap-3">
      {statusGroupRows.map((row) => {
        const count = metrics.http.statusGroups[row.key];
        const width = Math.round((count / total) * 100);

        return (
          <div className="grid gap-1.5" key={row.key}>
            <div className="flex items-center justify-between gap-2 text-xs font-bold">
              <span>{row.label}</span>
              <span className="text-[rgb(var(--tabliodb-ink-muted))]">{formatNumber(count)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[rgb(var(--tabliodb-surface-raised))]">
              <div
                className={cn('h-full rounded-full transition-[width] duration-500', row.colorClassName)}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RouteMetricsTable({ routes }: { routes: ServerHttpRouteMetricsDtoOutput[] }) {
  return (
    <div className="tabliodb-scrollbar overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-[rgb(var(--tabliodb-surface-raised))] text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          <tr>
            <th className="px-4 py-3">Route</th>
            <th className="px-4 py-3">Count</th>
            <th className="px-4 py-3">Errors</th>
            <th className="px-4 py-3">Avg</th>
            <th className="px-4 py-3">P95</th>
            <th className="px-4 py-3">Last seen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[rgb(var(--tabliodb-border))]">
          {routes.map((route) => (
            <tr className="transition hover:bg-[rgb(var(--tabliodb-surface))]" key={`${route.method}:${route.path}`}>
              <td className="max-w-[340px] px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge variant="neutral">{route.method}</Badge>
                  <span className="truncate font-bold text-[rgb(var(--tabliodb-ink))]">{route.path}</span>
                </div>
              </td>
              <td className="px-4 py-3 font-bold">{formatNumber(route.count)}</td>
              <td className="px-4 py-3 font-bold">
                <span className={route.errorCount > 0 ? 'text-[rgb(var(--tabliodb-danger-text))]' : undefined}>
                  {formatNumber(route.errorCount)}
                </span>
              </td>
              <td className="px-4 py-3 font-bold">{route.averageDurationMs} ms</td>
              <td className="px-4 py-3 font-bold">{route.p95DurationMs} ms</td>
              <td className="px-4 py-3 font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                {formatDateTime(route.lastSeenAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyRoutesState() {
  return (
    <div className="grid justify-items-center gap-2 px-5 py-8 text-center">
      <div className="grid size-12 place-items-center rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] text-[rgb(var(--tabliodb-ink-muted))]">
        <Route className="size-5" />
      </div>
      <p className="text-sm font-extrabold">No route metrics yet</p>
      <p className="max-w-sm text-xs font-bold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
        Open the editor or admin pages again and this table will start collecting route activity.
      </p>
    </div>
  );
}

function MetricProgress({ label, max, value }: { label: string; max: number; value: number }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs font-bold">
        <span>{label}</span>
        <span className="text-[rgb(var(--tabliodb-ink-muted))]">
          {formatBytes(value)} / {formatBytes(max)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[rgb(var(--tabliodb-surface-raised))]">
        <div className="h-full rounded-full bg-[rgb(var(--tabliodb-primary))]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span>{label}</span>
      <span className="truncate text-[rgb(var(--tabliodb-ink))]">{value}</span>
    </div>
  );
}

function StatusPill({ status }: { status: StatusTone }) {
  const label = {
    disabled: 'Disabled',
    error: 'Error',
    ok: 'OK',
  }[status];
  const className = {
    disabled:
      'border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] text-[rgb(var(--tabliodb-gold-text))]',
    error:
      'border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] text-[rgb(var(--tabliodb-danger-text))]',
    ok: 'border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-selected-surface))] text-[rgb(var(--tabliodb-primary-text))]',
  }[status];

  return (
    <span
      className={cn(
        'inline-flex h-7 shrink-0 items-center rounded-full border px-3 text-xs font-extrabold leading-none',
        className,
      )}
    >
      {label}
    </span>
  );
}

function getDependencyTone(status: DependencyHealth['status']) {
  return {
    disabled: {
      cardClassName: 'border-[rgb(var(--tabliodb-gold-border))] text-[rgb(var(--tabliodb-gold-text))]',
      iconClassName: 'bg-[rgb(var(--tabliodb-gold-soft))] text-[rgb(var(--tabliodb-gold-text))]',
    },
    error: {
      cardClassName: 'border-[rgb(var(--tabliodb-danger-border))] text-[rgb(var(--tabliodb-danger-text))]',
      iconClassName: 'bg-[rgb(var(--tabliodb-danger-soft))] text-[rgb(var(--tabliodb-danger-text))]',
    },
    ok: {
      cardClassName: 'border-[rgb(var(--tabliodb-primary-border))] text-[rgb(var(--tabliodb-primary-text))]',
      iconClassName: 'bg-[rgb(var(--tabliodb-selected-surface))] text-[rgb(var(--tabliodb-primary-text))]',
    },
  }[status];
}

function getMetricToneClassName(tone: MetricTone): string {
  return {
    blue: 'border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky-soft))] text-[rgb(var(--tabliodb-sky-text))]',
    green:
      'border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-selected-surface))] text-[rgb(var(--tabliodb-primary-text))]',
    neutral: 'border-[rgb(var(--tabliodb-border))] bg-white text-[rgb(var(--tabliodb-ink))]',
    yellow:
      'border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] text-[rgb(var(--tabliodb-gold-text))]',
  }[tone];
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'] as const;
  const unitIndex = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** unitIndex;

  return `${value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
}

function formatDuration(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${Math.max(1, minutes)}m`;
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
