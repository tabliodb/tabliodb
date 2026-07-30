import { Suspense } from 'react';
import { Link, Outlet, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@tabliodb/ui';
import { Database, LayoutDashboard, LogOut, UserRound } from 'lucide-react';
import { routes } from '@/app/routes';
import { LoadingState } from '@/features/app/RouteStates';
import { authQueries, useLogoutMutation } from '@/resources/auth';

export function AccountLayout() {
  const navigate = useNavigate();
  const currentUserQuery = useQuery(authQueries.me());
  const logoutMutation = useLogoutMutation({
    mutationConfig: {
      onSuccess: () => {
        // Logout dari account shell memakai mutation global yang membersihkan semua cache session.
        navigate(routes.login.to(), { replace: true });
      },
    },
  });
  const currentUser = currentUserQuery.data;

  return (
    <main className="min-h-screen bg-[rgb(var(--tabliodb-surface))] text-[rgb(var(--tabliodb-ink))]">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b-2 border-[rgb(var(--tabliodb-border))] bg-white px-5">
        <Link className="flex min-w-0 cursor-pointer items-center gap-3" to={routes.home.to()}>
          <div className="grid size-9 place-items-center rounded-2xl bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]">
            <Database className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-extrabold">Tabliodb</div>
            <div className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">Account settings</div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Button asChild className="hidden sm:inline-flex" variant="secondary">
            <Link to={routes.home.to()}>
              <LayoutDashboard className="size-4" />
              Editor
            </Link>
          </Button>
          <div className="hidden items-center gap-2 rounded-full border border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface))] px-2 py-1 sm:flex">
            <AccountAvatar avatarUrl={currentUser?.avatarUrl ?? null} cursorColor={currentUser?.cursorColor} />
            <span className="max-w-40 truncate text-xs font-extrabold">{currentUser?.name ?? 'Account'}</span>
          </div>
          <Button
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate(undefined)}
            variant="secondary"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>
      <Suspense fallback={<LoadingState />}>
        <Outlet />
      </Suspense>
    </main>
  );
}

function AccountAvatar({ avatarUrl, cursorColor }: { avatarUrl: string | null; cursorColor?: string }) {
  return (
    <span
      className="grid size-8 place-items-center overflow-hidden rounded-[13px] border-2 border-white bg-[rgb(var(--tabliodb-primary))] text-xs font-extrabold text-white shadow-[0_2px_0_rgb(var(--tabliodb-border-strong))]"
      style={cursorColor ? { backgroundColor: cursorColor } : undefined}
    >
      {avatarUrl ? <img alt="" className="size-full object-cover" src={avatarUrl} /> : <UserRound className="size-4" />}
    </span>
  );
}
