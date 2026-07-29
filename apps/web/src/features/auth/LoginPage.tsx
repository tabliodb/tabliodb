import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Surface } from '@tabliodb/ui';
import { Database, Loader2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { routes } from '@/app/routes';
import { ErrorState, LoadingState, getErrorMessage } from '@/features/app/RouteStates';
import { sdk } from '@/services/sdk';

type LoginFormState = {
  email: string;
  password: string;
};

const loginDefaults: LoginFormState = {
  email: 'owner@tabliodb.local',
  password: 'tabliodb-dev',
};

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<LoginFormState>(loginDefaults);

  const setupQuery = useQuery({
    queryKey: ['setup'],
    queryFn: sdk.setup.getStatus,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: (body: LoginFormState) => sdk.auth.login(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate(routes.home.to(), { replace: true });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loginMutation.mutate(form);
  }

  if (setupQuery.isPending) {
    return <LoadingState />;
  }

  if (setupQuery.error) {
    return (
      <ErrorState error={setupQuery.error} onRetry={() => queryClient.invalidateQueries({ queryKey: ['setup'] })} />
    );
  }

  if (!setupQuery.data.isSetupComplete) {
    return <Navigate replace to={routes.setup.to()} />;
  }

  return (
    <main className="grid h-screen place-items-center bg-[rgb(var(--tabliodb-surface))] px-6 text-[rgb(var(--tabliodb-ink))]">
      <Surface className="w-full max-w-sm p-5" depth="md">
        <form onSubmit={handleSubmit}>
          <div className="mb-5 flex items-center gap-2">
            <div className="grid size-10 place-items-center rounded-2xl bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]">
              <Database className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold">Tabliodb</h1>
              <p className="text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">Sign in to your workspace</p>
            </div>
          </div>
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Email
            </span>
            <Input
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              type="email"
              value={form.email}
            />
          </label>
          <label className="mb-4 block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Password
            </span>
            <Input
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              type="password"
              value={form.password}
            />
          </label>
          {loginMutation.error ? (
            <div className="mb-4 rounded-[14px] border-2 border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              {getErrorMessage(loginMutation.error)}
            </div>
          ) : null}
          <Button className="w-full gap-2" disabled={loginMutation.isPending} type="submit">
            {loginMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
            Continue
          </Button>
        </form>
      </Surface>
    </main>
  );
}
