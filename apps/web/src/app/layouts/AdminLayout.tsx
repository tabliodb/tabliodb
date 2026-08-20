import { Suspense } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { Button } from '@tabliodb/ui';
import { LayoutDashboard, LogOut, Settings, UserRound, UsersRound } from 'lucide-react';
import { routes } from '@/app/routes';
import { LoadingState } from '@/features/app/RouteStates';
import { useLogoutMutation } from '@/resources/auth';
import LOGO from '@/assets/logo.svg';

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
    <main className="grid min-h-screen bg-[rgb(var(--tabliodb-surface))] text-[rgb(var(--tabliodb-ink))] lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="border-b-2 border-[rgb(var(--tabliodb-border))] bg-white lg:border-b-0 lg:border-r-2">
        <div className="flex h-16 items-center gap-3 border-b-2 border-[rgb(var(--tabliodb-border))] px-5">
          <div className="flex h-9 w-32 shrink-0 items-center overflow-hidden">
            <img src={LOGO} alt="Tabliodb" className="h-9 w-32 max-w-none" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">Admin</div>
          </div>
        </div>
        <nav className="grid gap-2 p-4">
          <AdminNavLink icon={<UsersRound className="size-4" />} label="Users" to={routes.adminUsers.to()} />
          <AdminNavLink icon={<Settings className="size-4" />} label="Settings" to={routes.adminSettings.to()} />
          <AdminNavLink icon={<UserRound className="size-4" />} label="Profile" to={routes.profile.to()} />
          <AdminNavLink icon={<LayoutDashboard className="size-4" />} label="Editor" to={routes.home.to()} />
        </nav>
        <div className="p-4 lg:absolute lg:bottom-0 lg:w-[264px]">
          <Button
            className="w-full justify-start"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate(undefined)}
            variant="secondary"
          >
            <LogOut className="size-4" />
            Logout
          </Button>
        </div>
      </aside>
      <section className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b-2 border-[rgb(var(--tabliodb-border))] bg-white px-5">
          <div>
            <h1 className="text-base font-extrabold">Admin</h1>
            <p className="text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">Instance management</p>
          </div>
        </header>
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </section>
    </main>
  );
}

function AdminNavLink({ icon, label, to }: { icon: React.ReactNode; label: string; to: string }) {
  return (
    <NavLink
      className={({ isActive }) =>
        [
          'flex cursor-pointer items-center gap-2 rounded-[14px] border-2 px-3 py-2.5 text-sm font-extrabold transition',
          isActive
            ? 'border-[rgb(var(--tabliodb-primary))] bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))] shadow-[0_3px_0_rgb(var(--tabliodb-primary-border))]'
            : 'border-transparent text-[rgb(var(--tabliodb-ink-muted))] hover:border-[rgb(var(--tabliodb-border))] hover:bg-[rgb(var(--tabliodb-surface))]',
        ].join(' ')
      }
      to={to}
    >
      {icon}
      {label}
    </NavLink>
  );
}
