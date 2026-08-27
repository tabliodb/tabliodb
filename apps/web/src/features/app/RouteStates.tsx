import { TabliodbApiError, getTabliodbApiErrorMessage, getTabliodbApiErrorRequestId } from '@tabliodb/sdk';
import { Button, Surface, cn } from '@tabliodb/ui';
import { AlertCircle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { isRouteErrorResponse } from 'react-router';
import LOGO from '@/assets/logo.svg';

type StateIcon = ComponentType<{ className?: string }>;

export type LoadingProgress = {
  detail?: string;
  label: string;
  value: number;
};

export function LoadingState({
  message = 'Loading workspace',
  progress,
}: {
  message?: string;
  progress?: LoadingProgress;
}) {
  const loadingProgress = progress ?? getFallbackLoadingProgress(message);
  const progressValue = clampProgressValue(loadingProgress.value);

  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="flex h-dvh flex-col overflow-hidden bg-[rgb(var(--tabliodb-surface))] text-[rgb(var(--tabliodb-ink))]"
      role="status"
    >
      <span className="sr-only">{message}</span>

      {/* The shell follows TablioDB's editor layout instead of a generic app skeleton, so loading keeps the same spatial model as the real canvas. */}
      <header className="flex h-[var(--tabliodb-header-height)] shrink-0 items-center gap-3 border-b border-[rgb(var(--tabliodb-border))] bg-white px-3 sm:px-4">
        <div className="flex h-9 w-32 shrink-0 items-center overflow-hidden max-[560px]:w-9">
          <img alt="Tabliodb" className="h-9 w-32 max-w-none" src={LOGO} />
        </div>
        <div className="h-10 w-px shrink-0 bg-[rgb(var(--tabliodb-border))]" />
        <div className="min-w-0 flex-1 space-y-2">
          <LoadingSkeletonBlock className="h-4 w-[min(42vw,220px)] rounded-[6px]" />
          <LoadingSkeletonBlock className="h-3 w-[min(52vw,320px)] rounded-[5px]" />
        </div>
        <div className="hidden min-w-0 shrink-0 items-center gap-2 lg:flex">
          {Array.from({ length: 5 }, (_, index) => (
            <LoadingSkeletonBlock className="size-10 rounded-[var(--tabliodb-radius-md)]" key={index} />
          ))}
          <LoadingSkeletonBlock className="h-11 w-32 rounded-[var(--tabliodb-radius-lg)]" />
          <LoadingSkeletonBlock className="h-11 w-24 rounded-[var(--tabliodb-radius-lg)]" />
          <LoadingSkeletonBlock className="h-11 w-44 rounded-[var(--tabliodb-radius-lg)]" />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(300px,400px)_minmax(0,1fr)] xl:grid-cols-[minmax(300px,400px)_minmax(0,1fr)_400px]">
        <aside className="hidden min-h-0 border-r border-[rgb(var(--tabliodb-border))] bg-white md:flex md:flex-col">
          <div className="flex h-18 shrink-0 items-center gap-3 border-b border-[rgb(var(--tabliodb-border))] px-4">
            <LoadingSkeletonBlock className="size-11 rounded-[16px]" />
            <div className="min-w-0 flex-1 space-y-2">
              <LoadingSkeletonBlock className="h-4 w-24 rounded-[6px]" />
              <LoadingSkeletonBlock className="h-3 w-16 rounded-[5px]" />
            </div>
            <LoadingSkeletonBlock className="size-9 rounded-[var(--tabliodb-radius-md)]" />
          </div>
          <div className="shrink-0 border-b border-[rgb(var(--tabliodb-border))] p-4">
            <LoadingSkeletonBlock className="h-11 rounded-[var(--tabliodb-radius-md)]" />
          </div>
          <div className="tabliodb-scrollbar min-h-0 flex-1 space-y-2 overflow-hidden p-3">
            {Array.from({ length: 8 }, (_, index) => (
              <div
                className="rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] p-3"
                key={index}
              >
                <div className="flex items-center gap-3">
                  <LoadingSkeletonBlock className="size-3 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <LoadingSkeletonBlock className="h-4 w-[70%] rounded-[6px]" />
                    <LoadingSkeletonBlock className="h-3 w-[48%] rounded-[5px]" />
                  </div>
                  <LoadingSkeletonBlock className="h-6 w-10 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="relative min-w-0 overflow-hidden bg-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgb(203_213_225)_1px,transparent_0)] [background-size:16px_16px]" />
          <div className="absolute left-5 top-5 flex rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border-strong))] bg-white p-2 shadow-[0_3px_0_rgb(var(--tabliodb-border-strong))]">
            <LoadingSkeletonBlock className="h-10 w-28 rounded-[var(--tabliodb-radius-md)]" />
            <LoadingSkeletonBlock className="ml-2 h-10 w-24 rounded-[var(--tabliodb-radius-md)]" />
          </div>
          <div className="absolute left-1/2 top-1/2 grid w-[min(72vw,360px)] -translate-x-1/2 -translate-y-1/2 justify-items-center gap-4 text-center">
            <img alt="" className="h-12 w-auto" src={LOGO} />
            <p className="text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">{message}</p>
            <div className="w-full max-w-xs text-left">
              <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                <span className="truncate">{loadingProgress.label}</span>
                <span>{progressValue}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full border border-[rgb(var(--tabliodb-primary-border))] bg-white">
                <div
                  className="h-full rounded-full bg-[rgb(var(--tabliodb-primary))] transition-[width] duration-300 ease-out"
                  style={{ width: `${progressValue}%` }}
                />
              </div>
              {loadingProgress.detail ? (
                <p className="mt-2 text-center text-xs font-semibold text-[rgb(var(--tabliodb-ink-subtle))]">
                  {loadingProgress.detail}
                </p>
              ) : null}
            </div>
          </div>
          <LoadingTableCard className="left-[18%] top-[24%] hidden lg:block" />
          <LoadingTableCard className="right-[16%] top-[28%] hidden lg:block" />
          <LoadingTableCard className="bottom-[18%] left-[38%] hidden lg:block" />
        </section>

        <aside className="hidden min-h-0 border-l border-[rgb(var(--tabliodb-border))] bg-white xl:flex xl:flex-col">
          <div className="flex h-18 shrink-0 items-center border-b border-[rgb(var(--tabliodb-border))] px-5">
            <LoadingSkeletonBlock className="h-5 w-24 rounded-[6px]" />
            <LoadingSkeletonBlock className="ml-auto size-8 rounded-[var(--tabliodb-radius-md)]" />
          </div>
          <div className="space-y-5 p-5">
            <div className="flex gap-2">
              <LoadingSkeletonBlock className="h-7 w-24 rounded-full" />
              <LoadingSkeletonBlock className="h-7 w-14 rounded-full" />
            </div>
            {Array.from({ length: 3 }, (_, index) => (
              <div
                className="rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] p-4"
                key={index}
              >
                <LoadingSkeletonBlock className="h-4 w-28 rounded-[6px]" />
                <LoadingSkeletonBlock className="mt-3 h-3 w-44 rounded-[5px]" />
                <LoadingSkeletonBlock className="mt-4 h-11 rounded-[var(--tabliodb-radius-md)]" />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}

function LoadingTableCard({ className }: { className: string }) {
  return (
    <div
      className={cn(
        'absolute w-72 overflow-hidden rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border))] bg-white shadow-[0_4px_0_rgb(var(--tabliodb-border))]',
        className,
      )}
    >
      <div className="flex h-11 items-center gap-2 border-b border-[rgb(var(--tabliodb-border))] px-3">
        <LoadingSkeletonBlock className="size-3 rounded-full" />
        <LoadingSkeletonBlock className="h-4 w-28 rounded-[6px]" />
        <LoadingSkeletonBlock className="ml-auto h-4 w-6 rounded-[5px]" />
      </div>
      <div className="divide-y divide-[rgb(var(--tabliodb-border))]">
        {Array.from({ length: 3 }, (_, index) => (
          <div className="grid h-9 grid-cols-[1fr_92px] items-center px-3" key={index}>
            <LoadingSkeletonBlock className="h-3 w-24 rounded-[5px]" />
            <LoadingSkeletonBlock className="h-3 w-16 justify-self-end rounded-[5px]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingSkeletonBlock({ className }: { className: string }) {
  return <div className={cn('animate-pulse bg-[rgb(var(--tabliodb-skeleton))]', className)} />;
}

function getFallbackLoadingProgress(message: string): LoadingProgress {
  if (/sso|sign-in/i.test(message)) {
    return {
      detail: 'Waiting for the identity provider callback.',
      label: 'Authenticating',
      value: 35,
    };
  }

  if (/preparing/i.test(message)) {
    return {
      detail: 'Preparing the editor canvas.',
      label: 'Preparing editor',
      value: 88,
    };
  }

  return {
    detail: 'Loading the application shell.',
    label: 'Loading shell',
    value: 24,
  };
}

function clampProgressValue(value: number): number {
  return Math.max(0, Math.min(99, Math.round(value)));
}

export function ErrorState({
  actions,
  error,
  onRetry,
  title = 'Application error',
}: {
  actions?: ReactNode;
  error: unknown;
  onRetry: () => void;
  title?: string;
}) {
  return (
    <main className="grid h-screen place-items-center bg-[rgb(var(--tabliodb-surface))] px-6 text-[rgb(var(--tabliodb-ink))]">
      <Surface className="w-full max-w-md border-[rgb(var(--tabliodb-danger-border))] p-5">
        <div className="mb-3 flex items-center gap-2 text-[rgb(var(--tabliodb-danger-text))]">
          <AlertCircle className="size-5" />
          <h1 className="text-sm font-extrabold">{title}</h1>
        </div>
        <p className="mb-4 text-sm font-semibold text-[rgb(var(--tabliodb-ink-muted))]">{getErrorMessage(error)}</p>
        <div className="flex flex-wrap gap-2">
          <Button className="gap-2" onClick={onRetry} variant="secondary">
            <RefreshCw className="size-4" />
            Retry
          </Button>
          {actions}
        </div>
      </Surface>
    </main>
  );
}

export function InlineLoadingState({ className, message = 'Loading data' }: { className?: string; message?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-[var(--tabliodb-radius-md)] bg-[rgb(var(--tabliodb-surface-raised))] p-4 text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]',
        className,
      )}
    >
      <Loader2 className="size-4 animate-spin text-[rgb(var(--tabliodb-primary-text))]" />
      {message}
    </div>
  );
}

export function InlineErrorState({
  className,
  error,
  onRetry,
  title = 'Could not load data',
}: {
  className?: string;
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--tabliodb-radius-md)] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-4 text-sm text-[rgb(var(--tabliodb-danger-text))]',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-extrabold">{title}</p>
          <p className="mt-1 font-bold leading-5">{getErrorMessage(error)}</p>
        </div>
      </div>
      {onRetry ? (
        <Button className="mt-3 gap-2" onClick={onRetry} size="sm" variant="secondary">
          <RefreshCw className="size-3.5" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  action,
  className,
  description,
  icon: Icon = Inbox,
  title,
}: {
  action?: ReactNode;
  className?: string;
  description?: string;
  icon?: StateIcon;
  title: string;
}) {
  return (
    <div className={cn('grid justify-items-center px-5 py-8 text-center', className)}>
      <div className="mb-3 grid size-12 place-items-center rounded-[18px] border-2 border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))] shadow-[0_3px_0_rgb(var(--tabliodb-primary-border))]">
        <Icon className="size-6" />
      </div>
      <p className="text-sm font-extrabold text-[rgb(var(--tabliodb-ink))]">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-xs font-bold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof TabliodbApiError) {
    return appendRequestIdForServerError(
      getBestHttpErrorMessage(error.status, getTabliodbApiErrorMessage(error)),
      error.status,
      getTabliodbApiErrorRequestId(error),
    );
  }

  if (isRouteErrorResponse(error)) {
    // React Router converts thrown Response objects into ErrorResponse instances; read their data before falling back to status text.
    return appendRequestIdForServerError(
      getBestHttpErrorMessage(
        error.status,
        getErrorEnvelopeMessage(error.data) ?? normalizeErrorText(error.statusText),
      ),
      error.status,
      getErrorEnvelopeRequestId(error.data),
    );
  }

  if (error instanceof Error) {
    const status = extractHttpStatusFromMessage(error.message);

    if (status) {
      return getHttpStatusFallbackMessage(status);
    }

    return error.message;
  }

  return typeof error === 'string' && error.trim() ? error : 'Something went wrong. Please try again.';
}

function extractHttpStatusFromMessage(message: string): number | null {
  const normalizedMessage = message.trim();
  const statusMatch = /^(?:error:\s*)?(?:http\s*)?(?:status\s*)?([1-5]\d{2})(?:\s*[:\-]?\s*[a-z ]+)?$/i.exec(
    normalizedMessage,
  );

  // Some client adapters surface only "Error: 404" or "HTTP 403 Forbidden"; the UI should still show a useful product message.
  return statusMatch ? Number(statusMatch[1]) : null;
}

function appendRequestIdForServerError(message: string, status: number, requestId: string | null): string {
  if (requestId && status >= 500) {
    // Request id is most useful on server-side failures, where the user cannot fix the issue from the current form.
    return `${message} Request id: ${requestId}.`;
  }

  return message;
}

function getBestHttpErrorMessage(status: number, rawMessage: string | null): string {
  const message = normalizeErrorText(rawMessage);

  if (!message || isGenericHttpStatusMessage(status, message)) {
    return getHttpStatusFallbackMessage(status);
  }

  return message;
}

function getErrorEnvelopeMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return normalizeErrorText(data);
  }

  const envelope = data as {
    details?: unknown;
    error?: unknown;
    message?: unknown;
  };

  // Backend validation can send either `message` or `details`; both are user-facing, unlike raw stack/error titles.
  return (
    normalizeErrorText(envelope.message) ?? normalizeErrorText(envelope.details) ?? normalizeErrorText(envelope.error)
  );
}

function getErrorEnvelopeRequestId(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const requestId = (data as { requestId?: unknown }).requestId;

  return typeof requestId === 'string' && requestId.trim() ? requestId.trim() : null;
}

function normalizeErrorText(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null;
  }

  if (Array.isArray(value)) {
    const messages = value.map((item) => normalizeErrorText(item)).filter((item): item is string => Boolean(item));

    return messages.length > 0 ? messages.join(' ') : null;
  }

  if (value instanceof Error) {
    return value.message.trim() || null;
  }

  return null;
}

function isGenericHttpStatusMessage(status: number, message: string): boolean {
  const normalizedMessage = message
    .trim()
    .toLowerCase()
    .replace(/^error:\s*/, '')
    .replace(/[.]+$/, '');
  const statusText = getGenericHttpStatusText(status);

  return (
    normalizedMessage === String(status) ||
    normalizedMessage === `http ${status}` ||
    normalizedMessage === `status ${status}` ||
    normalizedMessage === statusText ||
    normalizedMessage === `${status} ${statusText}`
  );
}

function getGenericHttpStatusText(status: number): string {
  const statusTexts: Record<number, string> = {
    400: 'bad request',
    401: 'unauthorized',
    403: 'forbidden',
    404: 'not found',
    409: 'conflict',
    422: 'unprocessable entity',
    429: 'too many requests',
    500: 'internal server error',
  };

  return statusTexts[status] ?? 'error';
}

function getHttpStatusFallbackMessage(status: number): string {
  const fallbackMessages: Record<number, string> = {
    400: 'The request could not be processed. Please review the entered data.',
    401: 'Your session has expired. Please sign in again.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested data was not found. It may have been deleted or moved.',
    409: 'This action conflicts with existing data. Please refresh and try again.',
    422: 'Some fields are invalid. Please review the form and try again.',
    429: 'Too many requests. Please wait a moment and try again.',
  };

  return fallbackMessages[status] ?? 'The server could not complete this request. Please try again.';
}
