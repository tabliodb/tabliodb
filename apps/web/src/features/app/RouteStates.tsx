import { TabliodbApiError } from '@tabliodb/sdk';
import { Button, Surface } from '@tabliodb/ui';
import { AlertCircle, Loader2 } from 'lucide-react';

export function LoadingState() {
  return (
    <main className="grid h-screen place-items-center bg-[rgb(var(--tabliodb-surface))] text-[rgb(var(--tabliodb-ink-muted))]">
      <Surface className="flex items-center gap-2 p-4 text-sm font-extrabold">
        <Loader2 className="size-4 animate-spin" />
        Loading workspace
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
        <Button onClick={onRetry} variant="secondary">
          Retry
        </Button>
      </Surface>
    </main>
  );
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof TabliodbApiError) {
    const apiMessage = getApiErrorDataMessage(error.data);

    if (apiMessage) {
      return apiMessage;
    }

    return getHttpStatusFallbackMessage(error.status);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === 'string' && error.trim() ? error : 'Something went wrong. Please try again.';
}

function getApiErrorDataMessage(data: unknown): string | null {
  if (typeof data === 'string') {
    return data.trim() || null;
  }

  if (!data || typeof data !== 'object') {
    return null;
  }

  const response = data as { error?: unknown; message?: unknown };
  const message = normalizeErrorMessage(response.message);

  if (message) {
    return message;
  }

  return normalizeErrorMessage(response.error);
}

function normalizeErrorMessage(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null;
  }

  if (Array.isArray(value)) {
    const messages = value.map((item) => normalizeErrorMessage(item)).filter((item): item is string => Boolean(item));

    return messages.length > 0 ? messages.join(' ') : null;
  }

  return null;
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
