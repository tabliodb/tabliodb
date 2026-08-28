import type { DiagramCollaborationStatus } from '@/features/collaboration/collaboration-client';

export type SnapshotRealtimeGuard = {
  description: string;
  detail: string;
  title: string;
};

export function getSnapshotRealtimeGuard(status: DiagramCollaborationStatus): SnapshotRealtimeGuard | null {
  if (status.connection === 'connected' && status.synced && status.unsyncedChanges === 0) {
    return null;
  }

  if (status.connection === 'authentication_failed') {
    return {
      description: 'Realtime authentication failed, so the editor cannot confirm that your live draft is synced.',
      detail:
        status.message ??
        'Refresh after signing in again. Saving anyway may create a version that misses recent collaborative changes.',
      title: 'Save while realtime auth failed?',
    };
  }

  if (status.connection === 'disconnected') {
    return {
      description: 'Realtime is currently disconnected and waiting to reconnect.',
      detail:
        'Wait until the status changes back to Saved when possible. Saving anyway can checkpoint a local draft before remote changes arrive.',
      title: 'Save while reconnecting?',
    };
  }

  if (status.connection === 'connected') {
    return {
      description: 'Realtime is connected but still syncing pending changes.',
      detail: `There are ${status.unsyncedChanges} pending change(s). Wait for Saved if this version needs to become the official checkpoint for the team.`,
      title: 'Save before sync finishes?',
    };
  }

  return {
    description: 'Realtime collaboration is still preparing for this diagram.',
    detail:
      'Wait until the status becomes Saved when possible. Saving anyway creates a manual checkpoint from the current local draft.',
    title: 'Save before realtime is ready?',
  };
}
