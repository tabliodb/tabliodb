import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from './Button.js';
import { cn } from '../lib/utils.js';

const defaultToastDurationMs = 4_500;
const maxVisibleToasts = 5;

export type ToastVariant = 'danger' | 'info' | 'success' | 'warning';

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastInput = {
  action?: ToastAction;
  description?: ReactNode;
  durationMs?: number;
  id?: string;
  title: ReactNode;
  variant?: ToastVariant;
};

export type ToastRecord = Required<Pick<ToastInput, 'id' | 'title' | 'variant'>> &
  Pick<ToastInput, 'action' | 'description'> & {
    createdAt: number;
  };

type ToastListener = (toasts: ToastRecord[]) => void;

const listeners = new Set<ToastListener>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let toastRecords: ToastRecord[] = [];
let toastSequence = 0;

type ToastFn = {
  (input: ToastInput): string;
  danger: (input: Omit<ToastInput, 'variant'>) => string;
  info: (input: Omit<ToastInput, 'variant'>) => string;
  success: (input: Omit<ToastInput, 'variant'>) => string;
  warning: (input: Omit<ToastInput, 'variant'>) => string;
};

function createToast(input: ToastInput): string {
  const id = input.id ?? `toast-${Date.now()}-${toastSequence++}`;
  const record: ToastRecord = {
    action: input.action,
    createdAt: Date.now(),
    description: input.description,
    id,
    title: input.title,
    variant: input.variant ?? 'info',
  };

  toastRecords = [record, ...toastRecords.filter((toastRecord) => toastRecord.id !== id)].slice(0, maxVisibleToasts);
  scheduleDismiss(id, input.durationMs ?? defaultToastDurationMs);
  emitToasts();

  return id;
}

export const toast: ToastFn = Object.assign(createToast, {
  danger: (input: Omit<ToastInput, 'variant'>) => createToast({ ...input, variant: 'danger' }),
  info: (input: Omit<ToastInput, 'variant'>) => createToast({ ...input, variant: 'info' }),
  success: (input: Omit<ToastInput, 'variant'>) => createToast({ ...input, variant: 'success' }),
  warning: (input: Omit<ToastInput, 'variant'>) => createToast({ ...input, variant: 'warning' }),
});

export function dismissToast(id: string): void {
  const timer = timers.get(id);

  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }

  toastRecords = toastRecords.filter((toastRecord) => toastRecord.id !== id);
  emitToasts();
}

export function ToastProvider({
  children,
  position = 'bottom-right',
}: {
  children: ReactNode;
  position?: 'bottom-left' | 'bottom-right' | 'top-right';
}) {
  const [mounted, setMounted] = useState(false);
  const [toasts, setToasts] = useState<ToastRecord[]>(() => toastRecords);
  const viewportClassName = useMemo(() => getToastViewportClassName(position), [position]);

  useEffect(() => {
    setMounted(true);

    return subscribeToasts(setToasts);
  }, []);

  return (
    <>
      {children}
      {mounted
        ? createPortal(
            <div aria-live="polite" className={viewportClassName}>
              {toasts.map((toastRecord) => (
                <ToastItem key={toastRecord.id} toast={toastRecord} />
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function ToastItem({ toast: toastRecord }: { toast: ToastRecord }) {
  const Icon = toastIconByVariant[toastRecord.variant];

  return (
    <div
      className={cn(
        'pointer-events-auto grid w-[min(380px,calc(100vw-24px))] grid-cols-[auto_1fr_auto] gap-3 rounded-[var(--tabliodb-radius-lg)] border-2 bg-white p-3 text-[rgb(var(--tabliodb-ink))] shadow-[0_4px_0_rgb(var(--tabliodb-border-strong)),0_18px_45px_rgb(15_23_42/0.18)]',
        toastVariantClassName[toastRecord.variant],
      )}
      role={toastRecord.variant === 'danger' ? 'alert' : 'status'}
    >
      <div className="grid size-9 shrink-0 place-items-center rounded-[var(--tabliodb-radius-md)] bg-white shadow-[inset_0_0_0_2px_currentColor]">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 py-0.5">
        <p className="text-sm font-extrabold leading-5 text-[rgb(var(--tabliodb-ink))]">{toastRecord.title}</p>
        {toastRecord.description ? (
          <div className="mt-1 text-xs font-bold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
            {toastRecord.description}
          </div>
        ) : null}
        {toastRecord.action ? (
          <Button
            className="mt-3"
            onClick={() => {
              // Action toasts dismiss after firing so the viewport does not keep stale task prompts around.
              toastRecord.action?.onClick();
              dismissToast(toastRecord.id);
            }}
            size="sm"
            variant="secondary"
          >
            {toastRecord.action.label}
          </Button>
        ) : null}
      </div>
      <button
        aria-label="Dismiss notification"
        className="grid size-8 cursor-pointer place-items-center rounded-[var(--tabliodb-radius-sm)] text-[rgb(var(--tabliodb-ink-muted))] transition-colors hover:bg-[rgb(var(--tabliodb-surface-raised))] hover:text-[rgb(var(--tabliodb-ink))] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--tabliodb-focus-ring))]"
        onClick={() => dismissToast(toastRecord.id)}
        type="button"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function subscribeToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  listener(toastRecords);

  return () => {
    listeners.delete(listener);
  };
}

function scheduleDismiss(id: string, durationMs: number): void {
  const currentTimer = timers.get(id);

  if (currentTimer) {
    clearTimeout(currentTimer);
  }

  if (durationMs <= 0) {
    return;
  }

  timers.set(
    id,
    setTimeout(() => {
      dismissToast(id);
    }, durationMs),
  );
}

function emitToasts(): void {
  for (const listener of listeners) {
    listener(toastRecords);
  }
}

function getToastViewportClassName(position: 'bottom-left' | 'bottom-right' | 'top-right'): string {
  const baseClassName = 'pointer-events-none fixed z-[1000] flex max-h-screen flex-col gap-3 p-3 sm:p-4';

  if (position === 'bottom-left') {
    return cn(baseClassName, 'bottom-0 left-0 items-start');
  }

  if (position === 'top-right') {
    return cn(baseClassName, 'right-0 top-0 items-end');
  }

  return cn(baseClassName, 'bottom-0 right-0 items-end');
}

const toastIconByVariant = {
  danger: XCircle,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
} satisfies Record<ToastVariant, typeof Info>;

const toastVariantClassName: Record<ToastVariant, string> = {
  danger: 'border-[rgb(var(--tabliodb-danger-border))] text-[rgb(var(--tabliodb-danger-text))]',
  info: 'border-[rgb(var(--tabliodb-sky-border))] text-[rgb(var(--tabliodb-sky-text))]',
  success: 'border-[rgb(var(--tabliodb-primary-border))] text-[rgb(var(--tabliodb-primary-text))]',
  warning: 'border-[rgb(var(--tabliodb-gold-border))] text-[rgb(var(--tabliodb-gold-text))]',
};
