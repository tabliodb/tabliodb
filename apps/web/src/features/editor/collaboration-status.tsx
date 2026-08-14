import type { SnapshotResponseDtoOutput } from '@tabliodb/sdk';
import type { AwarenessState } from '@tabliodb/shared';
import type { DiagramCollaborationStatus } from '@/features/collaboration/collaboration-client';
import { WithTooltip, cn } from '@tabliodb/ui';
import { UserAvatar } from './components/UserAvatar';

type SnapshotResponseDto = SnapshotResponseDtoOutput;

export type CollaboratorPresence = {
  clientIds: number[];
  cursor?: AwarenessState['cursor'];
  selection?: AwarenessState['selection'];
  user: AwarenessState['user'] & { email: string };
};

export function CollaborationPresence({
  collaborators,
  draftPersisted,
  latestSnapshot,
  snapshotSavePending,
  status,
}: {
  collaborators: CollaboratorPresence[];
  draftPersisted: boolean;
  latestSnapshot: SnapshotResponseDto | null;
  snapshotSavePending: boolean;
  status: DiagramCollaborationStatus;
}) {
  const visibleCollaborators = collaborators.slice(0, 4);
  const overflowCount = Math.max(0, collaborators.length - visibleCollaborators.length);
  const statusMeta = getCollaborationStatusMeta(status, collaborators.length, {
    draftPersisted,
    latestSnapshot,
    snapshotSavePending,
  });

  return (
    <WithTooltip
      content={
        <div className="grid gap-1.5">
          <div>{statusMeta.tooltipTitle}</div>
          <div className="text-[10px] font-bold leading-4 text-white/75">{statusMeta.tooltipDescription}</div>
          <div className="mt-1 grid gap-0.5 border-t border-white/15 pt-1 text-[10px] font-bold leading-4 text-white/75">
            <span>{statusMeta.snapshotLine}</span>
            <span>{statusMeta.autosaveLine}</span>
          </div>
        </div>
      }
      side="bottom"
    >
      <div
        className={cn(
          'hidden h-8 items-center gap-2 rounded-full border bg-white px-2.5 py-1 transition sm:flex',
          statusMeta.containerClassName,
        )}
      >
        <span className="relative grid size-2.5 place-items-center">
          {statusMeta.pulse ? (
            <span
              className={cn(
                'absolute inline-flex size-2.5 animate-ping rounded-full opacity-40',
                statusMeta.dotClassName,
              )}
            />
          ) : null}
          <span
            className={cn(
              'relative inline-flex size-2.5 rounded-full ring-2 ring-[rgb(var(--tabliodb-surface-raised))]',
              statusMeta.dotClassName,
            )}
          />
        </span>
        <span className="max-w-24 truncate text-xs font-extrabold">{statusMeta.label}</span>
        {visibleCollaborators.length > 0 ? (
          <div className="flex -space-x-2">
            {visibleCollaborators.map((collaborator) => (
              <UserAvatar
                className="size-7 rounded-[11px] bg-white text-[10px] ring-2 ring-white"
                key={collaborator.user.id}
                user={collaborator.user}
              />
            ))}
            {overflowCount > 0 ? (
              <div className="grid size-7 place-items-center rounded-[11px] border-2 border-white bg-[rgb(var(--tabliodb-ink))] text-[10px] font-extrabold text-white ring-2 ring-white">
                +{overflowCount}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </WithTooltip>
  );
}

function getCollaborationStatusMeta(
  status: DiagramCollaborationStatus,
  collaboratorCount: number,
  saveState: {
    draftPersisted: boolean;
    latestSnapshot: SnapshotResponseDto | null;
    snapshotSavePending: boolean;
  },
) {
  const collaboratorLabel =
    collaboratorCount === 0 ? 'No other users are viewing this diagram.' : `${collaboratorCount} other user(s) live.`;
  const snapshotLine = formatSnapshotStatusLine(saveState.latestSnapshot, saveState.draftPersisted);
  const autosaveLine = formatLiveAutosaveStatusLine(status);

  if (status.connection === 'authentication_failed') {
    return {
      containerClassName:
        'border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] text-[rgb(var(--tabliodb-danger-text))]',
      dotClassName: 'bg-[rgb(var(--tabliodb-danger))]',
      label: 'Auth failed',
      pulse: false,
      autosaveLine,
      snapshotLine,
      tooltipDescription: status.message ?? 'Refresh after signing in again.',
      tooltipTitle: 'Realtime authentication failed',
    };
  }

  if (saveState.snapshotSavePending) {
    return {
      containerClassName:
        'border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky-soft))] text-[rgb(var(--tabliodb-sky-text))]',
      dotClassName: 'bg-[rgb(var(--tabliodb-sky))]',
      label: 'Saving',
      pulse: true,
      autosaveLine,
      snapshotLine,
      tooltipDescription: `Creating a new manual snapshot. ${collaboratorLabel}`,
      tooltipTitle: 'Saving snapshot',
    };
  }

  if (status.connection === 'connecting') {
    return {
      containerClassName:
        'border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky-soft))] text-[rgb(var(--tabliodb-sky-text))]',
      dotClassName: 'bg-[rgb(var(--tabliodb-sky))]',
      label: 'Connecting',
      pulse: true,
      autosaveLine,
      snapshotLine,
      tooltipDescription: 'Connecting to the realtime collaboration room.',
      tooltipTitle: 'Preparing realtime',
    };
  }

  if (status.connection === 'disconnected') {
    return {
      containerClassName:
        'border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] text-[rgb(var(--tabliodb-gold-text))]',
      dotClassName: 'bg-[rgb(var(--tabliodb-gold))]',
      label: 'Reconnecting',
      pulse: true,
      autosaveLine,
      snapshotLine,
      tooltipDescription: 'Realtime is disconnected and will reconnect automatically.',
      tooltipTitle: 'Live draft not currently synced',
    };
  }

  if (status.connection === 'connected' && (!status.synced || status.unsyncedChanges > 0)) {
    return {
      containerClassName:
        'border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky-soft))] text-[rgb(var(--tabliodb-sky-text))]',
      dotClassName: 'bg-[rgb(var(--tabliodb-sky))]',
      label: 'Syncing',
      pulse: true,
      autosaveLine,
      snapshotLine,
      tooltipDescription: `Realtime is connected and syncing ${status.unsyncedChanges} pending change(s). ${collaboratorLabel}`,
      tooltipTitle: 'Syncing live changes',
    };
  }

  if (status.connection === 'connected' && status.pendingPersistence) {
    return {
      containerClassName:
        'border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky-soft))] text-[rgb(var(--tabliodb-sky-text))]',
      dotClassName: 'bg-[rgb(var(--tabliodb-sky))]',
      label: 'Saving',
      pulse: true,
      autosaveLine,
      snapshotLine,
      tooltipDescription: `Realtime is synced to collaborators and waiting for database persistence. ${collaboratorLabel}`,
      tooltipTitle: 'Persisting live draft',
    };
  }

  if (status.connection === 'connected') {
    return {
      containerClassName:
        'border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-selected-surface))] text-[rgb(var(--tabliodb-primary-text))]',
      dotClassName: 'bg-[rgb(var(--tabliodb-primary))]',
      label: status.persistedAt || saveState.draftPersisted ? 'Saved' : 'Live',
      pulse: collaboratorCount > 0,
      autosaveLine,
      snapshotLine,
      tooltipDescription: status.persistedAt
        ? `Realtime is connected, synced, and database persistence is acknowledged. ${collaboratorLabel}`
        : `Realtime is connected and synced. Waiting for the first database persistence acknowledgement. ${collaboratorLabel}`,
      tooltipTitle: status.persistedAt ? 'All changes saved' : 'Live draft connected',
    };
  }

  return {
    containerClassName:
      'border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] text-[rgb(var(--tabliodb-ink-muted))]',
    dotClassName: 'bg-[rgb(var(--tabliodb-ink-subtle))]',
    label: 'Realtime',
    pulse: false,
    autosaveLine,
    snapshotLine,
    tooltipDescription: 'Realtime collaboration is preparing.',
    tooltipTitle: 'Realtime preparing',
  };
}

function formatSnapshotStatusLine(snapshot: SnapshotResponseDto | null, draftPersisted: boolean): string {
  if (!snapshot) {
    return 'No snapshot yet';
  }

  const snapshotLabel = `Last snapshot ${formatRelativeDateTime(snapshot.createdAt)} (v${snapshot.version})`;

  return draftPersisted ? snapshotLabel : `${snapshotLabel}; current draft not checkpointed`;
}

function formatLiveAutosaveStatusLine(status: DiagramCollaborationStatus): string {
  if (status.connection === 'authentication_failed') {
    return 'Live draft autosave: Paused';
  }

  if (status.connection === 'disconnected') {
    return 'Live draft autosave: Waiting to reconnect';
  }

  if (status.connection === 'connected' && (!status.synced || status.unsyncedChanges > 0)) {
    return 'Live draft autosave: Syncing';
  }

  if (status.connection === 'connected' && status.pendingPersistence) {
    return 'Live draft autosave: Writing to database';
  }

  if (status.connection === 'connected' && status.persistedAt) {
    return `Live draft autosave: Last saved ${formatRelativeDateTime(status.persistedAt)}`;
  }

  return 'Live draft autosave: On';
}

function formatRelativeDateTime(value: string): string {
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const absoluteDiffMs = Math.abs(diffMs);
  const units = [
    { max: 60_000, name: 'second', size: 1000 },
    { max: 3_600_000, name: 'minute', size: 60_000 },
    { max: 86_400_000, name: 'hour', size: 3_600_000 },
    { max: 2_592_000_000, name: 'day', size: 86_400_000 },
  ] as const;
  const unit = units.find((candidate) => absoluteDiffMs < candidate.max) ?? {
    name: 'month',
    size: 2_592_000_000,
  };
  const valueForUnit = Math.round(diffMs / unit.size);

  // RelativeTimeFormat keeps the saved-status tooltip compact and familiar: "2 minutes ago", "yesterday", etc.
  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(valueForUnit, unit.name);
}
