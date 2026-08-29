import { Suspense, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { Button, cn } from '@tabliodb/ui';
import {
  Activity,
  Building2,
  Gauge,
  LayoutDashboard,
  LogOut,
  ServerCog,
  Settings,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { routes } from '@/app/routes';
import { InlineLoadingState } from '@/features/app/RouteStates';
import { useLogoutMutation } from '@/resources/auth';
import LOGO from '@/assets/logo.svg';

const adminNavigationItems = [
  { icon: <Gauge className="size-4" />, label: 'Overview', to: routes.adminOverview.to() },
  { icon: <Building2 className="size-4" />, label: 'Workspaces', to: routes.adminWorkspaces.to() },
  { icon: <Activity className="size-4" />, label: 'Activity', to: routes.adminActivity.to() },
  { icon: <ServerCog className="size-4" />, label: 'Jobs', to: routes.adminJobs.to() },
  { icon: <UsersRound className="size-4" />, label: 'Users', to: routes.adminUsers.to() },
  { icon: <Settings className="size-4" />, label: 'Settings', to: routes.adminSettings.to() },
] as const;

const adminUtilityItems = [
  { icon: <UserRound className="size-4" />, label: 'Profile', to: routes.profile.to() },
  { icon: <LayoutDashboard className="size-4" />, label: 'Editor', to: routes.home.to() },
] as const;

export function AdminLayout() {
  const navigate = useNavigate();
  const logoutMutation = useLogoutMutation({
    mutationConfig: {
      onSuccess: () => {
        // Logout dari admin shell menghapus cache global lewat mutation, lalu membawa user ke auth branch.
        navigate(routes.login.to(), { replace: true });
      },
    },
  });

  return (
    <main className="flex h-dvh min-h-0 overflow-hidden bg-[rgb(var(--tabliodb-surface))] text-[rgb(var(--tabliodb-ink))]">
      <aside className="hidden h-full w-[272px] shrink-0 flex-col overflow-hidden border-r border-[rgb(var(--tabliodb-border))] bg-white lg:flex">
        <AdminBrand />
        <AdminNavigation
          className="tabliodb-scrollbar min-h-0 flex-1 overflow-y-auto p-3"
          items={adminNavigationItems}
        />
        <div className="grid gap-2 border-t border-[rgb(var(--tabliodb-border))] p-3">
          <div className="px-3 text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-subtle))]">
            Account
          </div>
          <AdminNavigation className="grid gap-1" items={adminUtilityItems} />
        </div>
        <AdminLogoutButton disabled={logoutMutation.isPending} onLogout={() => logoutMutation.mutate(undefined)} />
      </aside>

      <section className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[rgb(var(--tabliodb-border))] bg-white">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-32 shrink-0 items-center overflow-hidden lg:hidden">
                <img src={LOGO} alt="Tabliodb" className="h-9 w-32 max-w-none" />
              </div>
              <div className="hidden h-9 w-px shrink-0 bg-[rgb(var(--tabliodb-border))] sm:block lg:hidden" />
              <div className="min-w-0">
                <h1 className="truncate text-base font-black">Administration</h1>
                <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">Instance management</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AdminNavigation className="hidden gap-2 md:flex lg:hidden" compact items={adminUtilityItems} />
              <Button
                className="hidden sm:inline-flex"
                disabled={logoutMutation.isPending}
                onClick={() => logoutMutation.mutate(undefined)}
                size="sm"
                variant="secondary"
              >
                <LogOut className="size-4" />
                Logout
              </Button>
              <Button
                aria-label="Logout"
                className="sm:hidden"
                disabled={logoutMutation.isPending}
                onClick={() => logoutMutation.mutate(undefined)}
                size="icon"
                variant="secondary"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>

          <AdminNavigation
            className="tabliodb-scrollbar flex gap-2 overflow-x-auto border-t border-[rgb(var(--tabliodb-border))] p-2 lg:hidden"
            compact
            items={adminNavigationItems}
          />
        </header>

        <div className="tabliodb-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {/* Outlet menjadi satu-satunya area scroll halaman admin, sehingga header dan sidebar tidak ikut bergerak saat daftar user/settings panjang. */}
          <Suspense fallback={<InlineLoadingState className="m-5" message="Loading admin console" />}>
            <Outlet />
          </Suspense>
        </div>
      </section>
    </main>
  );
}

function AdminBrand() {
  return (
    <div className="flex h-16 shrink-0 items-center gap-3 border-b border-[rgb(var(--tabliodb-border))] px-5">
      <div className="flex h-9 w-32 shrink-0 items-center overflow-hidden">
        <img src={LOGO} alt="Tabliodb" className="h-9 w-32 max-w-none" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Admin
        </div>
      </div>
    </div>
  );
}

function AdminNavigation({
  className,
  compact = false,
  items,
}: {
  className?: string;
  compact?: boolean;
  items: ReadonlyArray<{ icon: ReactNode; label: string; to: string }>;
}) {
  return (
    <nav aria-label="Admin navigation" className={className}>
      {items.map((item) => (
        <AdminNavLink compact={compact} icon={item.icon} key={item.to} label={item.label} to={item.to} />
      ))}
    </nav>
  );
}

function AdminLogoutButton({ disabled, onLogout }: { disabled: boolean; onLogout: () => void }) {
  return (
    <div className="shrink-0 border-t border-[rgb(var(--tabliodb-border))] p-3">
      <Button className="w-full justify-start" disabled={disabled} onClick={onLogout} variant="secondary">
        <LogOut className="size-4" />
        Logout
      </Button>
    </div>
  );
}

function AdminNavLink({
  compact = false,
  icon,
  label,
  to,
}: {
  compact?: boolean;
  icon: ReactNode;
  label: string;
  to: string;
}) {
  return (
    <NavLink
      className={({ isActive }) =>
        cn(
          'flex cursor-pointer items-center gap-2 border text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--tabliodb-focus-ring))]',
          compact
            ? 'h-10 shrink-0 rounded-[var(--tabliodb-radius-md)] px-3'
            : 'rounded-[var(--tabliodb-radius-lg)] px-3 py-2.5',
          isActive
            ? 'border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]'
            : 'border-transparent text-[rgb(var(--tabliodb-ink-muted))] hover:border-[rgb(var(--tabliodb-border))] hover:bg-[rgb(var(--tabliodb-surface-raised))] hover:text-[rgb(var(--tabliodb-ink))]',
        )
      }
      to={to}
    >
      {icon}
      {label}
    </NavLink>
  );
}
