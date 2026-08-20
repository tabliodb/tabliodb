import type { NotificationInboxItemDtoOutput } from '@tabliodb/sdk';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparatorItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from '@tabliodb/ui';
import { AtSign, Bell, ChevronsUpDown, LogOut, Reply, UserRound, Wrench } from 'lucide-react';
import { EmptyState, InlineErrorState, InlineLoadingState } from '@/features/app/RouteStates';
import { formatCommentTargetType } from '../comments/comment-targets';
import { UserAvatar, type AvatarIdentity } from './UserAvatar';

export type NotificationInboxItem = NotificationInboxItemDtoOutput;

export function NotificationInboxMenu({
  error,
  hasNextPage,
  isLoading,
  notifications,
  onOpenChange,
  onRetry,
  onSelect,
  open,
  unreadCount,
}: {
  error: Error | null;
  hasNextPage: boolean;
  isLoading: boolean;
  notifications: NotificationInboxItem[];
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  onSelect: (notification: NotificationInboxItem) => void;
  open: boolean;
  unreadCount: number;
}) {
  const unreadLabel = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button aria-label="Notifications" className="relative" size="icon" type="button" variant="ghost">
              {/* Dropdown trigger dibuat sebagai button langsung agar Radix bisa mengelola focus, keyboard open, dan aria-expanded tanpa wrapper tambahan. */}
              <Bell aria-hidden="true" className="size-4" />
              {unreadCount > 0 ? (
                <span className="pointer-events-none absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-[rgb(var(--tabliodb-red))] px-1 text-[9px] font-extrabold leading-4 text-white [text-shadow:var(--tabliodb-solid-text-shadow)]">
                  {unreadLabel}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Notifications</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-[min(92vw,380px)] p-2">
        <div className="flex items-start justify-between gap-3 px-2 py-1.5">
          <div className="min-w-0">
            <div className="text-[13px] font-extrabold">Notifications</div>
            <p className="mt-0.5 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
              Mentions and direct replies across your diagrams
            </p>
          </div>
          <Badge variant={unreadCount > 0 ? 'yellow' : 'neutral'}>{unreadLabel} unread</Badge>
        </div>
        <DropdownMenuSeparatorItem />
        {isLoading ? (
          <InlineLoadingState className="mx-1 my-2 px-3 py-3 text-xs" message="Loading inbox" />
        ) : error ? (
          <InlineErrorState
            className="mx-1 my-2 px-3 py-3 text-xs"
            error={error}
            onRetry={onRetry}
            title="Could not load notifications"
          />
        ) : notifications.length === 0 ? (
          <EmptyState
            className="mx-1 my-2 rounded-[var(--tabliodb-radius-md)] border border-dashed border-[rgb(var(--tabliodb-border))] px-3 py-5"
            description="Mentions, replies, and review updates will land here."
            title="No notifications yet"
          />
        ) : (
          <div className="tabliodb-scrollbar grid max-h-[min(60dvh,420px)] gap-1 overflow-y-auto pr-1">
            {notifications.map((notification) => (
              <NotificationInboxMenuItem key={notification.id} notification={notification} onSelect={onSelect} />
            ))}
          </div>
        )}
        {hasNextPage ? (
          <>
            <DropdownMenuSeparatorItem />
            <div className="px-2 py-1 text-center text-[11px] font-extrabold text-[rgb(var(--tabliodb-ink-subtle))]">
              Showing latest {notifications.length} notifications
            </div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationInboxMenuItem({
  notification,
  onSelect,
}: {
  notification: NotificationInboxItem;
  onSelect: (notification: NotificationInboxItem) => void;
}) {
  const Icon = notification.type === 'mention' ? AtSign : Reply;
  const targetLabel = formatCommentTargetType(notification.thread.targetType);
  const actionLabel = notification.type === 'mention' ? 'mentioned you' : 'replied to you';
  const locationLabel = notification.project?.name ?? notification.workspace.name;

  return (
    <DropdownMenuItem
      className={cn('items-start gap-2.5 p-2.5', notification.isUnread && 'bg-[rgb(var(--tabliodb-selected-surface))]')}
      onSelect={() => onSelect(notification)}
    >
      <span
        className={cn(
          'mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl border text-white shadow-[0_2px_0_rgb(var(--tabliodb-border-strong))]',
          notification.type === 'mention'
            ? 'border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky))]'
            : 'border-[rgb(var(--tabliodb-lavender-border))] bg-[rgb(var(--tabliodb-lavender))]',
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[13px] font-extrabold">
            {notification.comment.author.name} {actionLabel}
          </span>
          {notification.isUnread ? <Badge variant="yellow">New</Badge> : null}
        </span>
        <span className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs font-semibold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
          {notification.comment.bodyText || 'No preview available.'}
        </span>
        <span className="mt-1 block truncate text-[11px] font-extrabold text-[rgb(var(--tabliodb-ink-subtle))]">
          {locationLabel} / {notification.diagram.name} / {targetLabel} / {formatDateTime(notification.createdAt)}
        </span>
      </span>
    </DropdownMenuItem>
  );
}

export function UserAccountMenu({
  canOpenAdmin,
  isLoggingOut,
  onAdmin,
  onLogout,
  onProfile,
  user,
}: {
  canOpenAdmin: boolean;
  isLoggingOut: boolean;
  onAdmin: () => void;
  onLogout: () => void;
  onProfile: () => void;
  user: AvatarIdentity & { email: string };
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="ml-1 flex h-[var(--tabliodb-control-lg)] max-w-54 cursor-pointer items-center gap-2 rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border-strong))] bg-white px-2 pr-3 text-left shadow-[0_3px_0_rgb(var(--tabliodb-border-strong))] transition hover:bg-[rgb(var(--tabliodb-surface-raised))] active:translate-y-0.5 active:shadow-[0_1px_0_rgb(var(--tabliodb-border-strong))] max-[640px]:ml-0 max-[640px]:w-10 max-[640px]:justify-center max-[640px]:px-0"
          type="button"
        >
          {/* Header hanya menampilkan identitas ringkas; detail account tetap ada di menu agar ruang toolbar tidak terasa penuh. */}
          <UserAvatar className="size-8 rounded-full text-[11px]" user={user} />
          <ChevronsUpDown className="hidden size-4 shrink-0 text-[rgb(var(--tabliodb-ink-muted))] sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,288px)] p-2">
        <div className="flex items-center gap-3 px-2 py-2">
          <UserAvatar className="size-10 rounded-[14px] text-xs" user={user} />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-extrabold">{user.name}</div>
            <div className="truncate text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">{user.email}</div>
          </div>
        </div>
        <DropdownMenuSeparatorItem />
        <DropdownMenuItem onSelect={onProfile}>
          <UserRound className="size-4" />
          Profile
        </DropdownMenuItem>
        {canOpenAdmin ? (
          <DropdownMenuItem onSelect={onAdmin}>
            <Wrench className="size-4" />
            Administration
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparatorItem />
        <DropdownMenuItem disabled={isLoggingOut} onSelect={onLogout}>
          <LogOut className="size-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}
