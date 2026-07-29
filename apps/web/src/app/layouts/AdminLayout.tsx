import { Suspense } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { Button } from '@tabliodb/ui';
import { Database, LayoutDashboard, LogOut, ShieldCheck, UsersRound } from 'lucide-react';
import { routes } from '@/app/routes';
import { LoadingState } from '@/features/app/RouteStates';
import { useLogoutMutation } from '@/resources/auth';

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
          <div className="grid size-9 place-items-center rounded-2xl bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]">
            <Database className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-extrabold">Tabliodb</div>
            <div className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">Admin console</div>
          </div>
        </div>
        <nav className="grid gap-2 p-4">
          <AdminNavLink icon={<UsersRound className="size-4" />} label="Users" to={routes.adminUsers.to()} />
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
            <p className="text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">Instance user management</p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border-2 border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] px-3 py-1 text-xs font-extrabold text-[rgb(var(--tabliodb-primary-text))] sm:flex">
            <ShieldCheck className="size-4" />
            Protected
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
