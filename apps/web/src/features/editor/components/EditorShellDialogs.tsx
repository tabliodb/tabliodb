import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@tabliodb/ui';
import { FileWarning, Keyboard, RotateCcw, Save, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SnapshotRealtimeGuard } from '../snapshot-realtime-guard';

export type EditorConfirmAction =
  | {
      tableId: string;
      tableName: string;
      type: 'table-delete';
    }
  | {
      snapshotId: string;
      type: 'snapshot-restore';
    }
  | {
      guard: SnapshotRealtimeGuard;
      type: 'snapshot-save-unsafe';
    };

export function KeyboardShortcutsDialog({
  canComment,
  canEdit,
  canSnapshot,
  onOpenChange,
  open,
}: {
  canComment: boolean;
  canEdit: boolean;
  canSnapshot: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const shortcutGroups = [
    {
      items: [
        { action: 'Open shortcut palette', keys: ['?'] },
        { action: 'Fit diagram', keys: ['F'] },
        { action: 'Toggle minimap', keys: ['M'] },
        { action: 'Toggle left sidebar', keys: ['['] },
        { action: 'Toggle right sidebar', keys: [']'] },
      ],
      title: 'Canvas',
    },
    {
      items: [
        ...(canEdit
          ? [
              { action: 'Undo last edit', keys: [getPrimaryModifierKey(), 'Z'] },
              { action: 'Redo last edit', keys: [getPrimaryModifierKey(), 'Shift', 'Z'] },
              { action: 'Delete selected table', keys: ['Delete'] },
            ]
          : []),
        ...(canComment ? [{ action: 'Open comments', keys: [getPrimaryModifierKey(), 'K'] }] : []),
        ...(canSnapshot ? [{ action: 'Create snapshot', keys: [getPrimaryModifierKey(), 'S'] }] : []),
      ],
      title: 'Editor',
    },
  ].filter((group) => group.items.length > 0);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="w-[min(94vw,620px)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-5 text-[rgb(var(--tabliodb-primary-text))]" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>Fast editor actions that stay disabled while typing in form fields.</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          {shortcutGroups.map((group) => (
            <section
              className="rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border))] bg-white p-3 shadow-[0_2px_0_rgb(var(--tabliodb-border))]"
              key={group.title}
            >
              <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                {group.title}
              </h3>
              <div className="grid gap-2">
                {group.items.map((item) => (
                  <div className="flex items-center justify-between gap-3" key={`${group.title}:${item.action}`}>
                    <span className="min-w-0 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))]">
                      {item.action}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map((key) => (
                        <ShortcutKey key={`${item.action}:${key}`}>{key}</ShortcutKey>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button" variant="secondary">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditorConfirmDialog({
  action,
  disabled,
  onCancel,
  onConfirm,
}: {
  action: EditorConfirmAction | null;
  disabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isTableDelete = action?.type === 'table-delete';
  const isSnapshotGuard = action?.type === 'snapshot-save-unsafe';
  const title = isTableDelete ? 'Delete table?' : isSnapshotGuard ? action.guard.title : 'Restore snapshot?';
  const description = isTableDelete
    ? `Table "${action.tableName}" and its relationships will be removed from this draft.`
    : isSnapshotGuard
      ? action.guard.description
      : 'Your current unsaved draft will be replaced by the selected snapshot.';
  const confirmIcon = isTableDelete ? (
    <Trash2 className="size-4" />
  ) : isSnapshotGuard ? (
    <Save className="size-4" />
  ) : (
    <RotateCcw className="size-4" />
  );
  const confirmLabel = isTableDelete ? 'Delete table' : isSnapshotGuard ? 'Save anyway' : 'Restore';

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
      open={Boolean(action)}
    >
      <DialogContent className="w-[min(92vw,420px)]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {isSnapshotGuard ? (
          <div className="rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] p-3 text-sm font-bold leading-6 text-[rgb(var(--tabliodb-gold-text))]">
            <div className="mb-1 flex items-center gap-2 text-[13px] font-extrabold">
              <FileWarning className="size-4" />
              Realtime guard
            </div>
            <p>{action.guard.detail}</p>
          </div>
        ) : null}
        <DialogFooter>
          <Button disabled={disabled} onClick={onCancel} type="button" variant="secondary">
            Cancel
          </Button>
          <Button
            className="gap-2"
            disabled={disabled}
            onClick={onConfirm}
            type="button"
            variant={isSnapshotGuard ? 'primary' : 'danger'}
          >
            {confirmIcon}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutKey({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-7 min-w-7 items-center justify-center rounded-[9px] border border-[rgb(var(--tabliodb-border-strong))] bg-[rgb(var(--tabliodb-surface-raised))] px-2 text-[11px] font-black text-[rgb(var(--tabliodb-ink))] shadow-[0_2px_0_rgb(var(--tabliodb-border-strong))]">
      {children}
    </kbd>
  );
}

function getPrimaryModifierKey(): string {
  if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)) {
    return 'Cmd';
  }

  return 'Ctrl';
}
