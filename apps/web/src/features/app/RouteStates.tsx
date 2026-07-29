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

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <main className="grid h-screen place-items-center bg-[rgb(var(--tabliodb-surface))] px-6 text-[rgb(var(--tabliodb-ink))]">
      <Surface className="w-full max-w-md border-red-200 p-5">
        <div className="mb-3 flex items-center gap-2 text-red-700">
          <AlertCircle className="size-5" />
          <h1 className="text-sm font-extrabold">Workspace error</h1>
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
  return error instanceof Error ? error.message : 'Unknown error';
}
