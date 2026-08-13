import { TabliodbApiError, getTabliodbApiErrorMessage, getTabliodbApiErrorRequestId } from '@tabliodb/sdk';
import { Button, Surface, cn } from '@tabliodb/ui';
import { AlertCircle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { isRouteErrorResponse } from 'react-router';

type StateIcon = ComponentType<{ className?: string }>;

export function LoadingState({ message = 'Loading workspace' }: { message?: string }) {
  return (
    <main className="grid h-screen place-items-center bg-[rgb(var(--tabliodb-surface))] text-[rgb(var(--tabliodb-ink-muted))]">
      <Surface className="flex items-center gap-2 p-4 text-sm font-extrabold">
        <Loader2 className="size-4 animate-spin" />
        {message}
      </Surface>
    </main>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = 'Application error',
}: {
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
        <Button className="gap-2" onClick={onRetry} variant="secondary">
          <RefreshCw className="size-4" />
          Retry
        </Button>
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
