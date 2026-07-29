import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Surface } from '@tabliodb/ui';
import { Database, Loader2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { routes } from '@/app/routes';
import { ErrorState, LoadingState, getErrorMessage } from '@/features/app/RouteStates';
import { sdk } from '@/services/sdk';

type SetupFormState = {
  ownerEmail: string;
  ownerName: string;
  ownerPassword: string;
  publicUrl: string;
  workspaceName: string;
};

export function SetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SetupFormState>({
    ownerEmail: 'owner@tabliodb.local',
    ownerName: 'Tabliodb Owner',
    ownerPassword: 'tabliodb-dev',
    publicUrl: typeof window === 'undefined' ? '' : window.location.origin,
    workspaceName: 'Personal Workspace',
  });

  const setupQuery = useQuery({
    queryKey: ['setup'],
    queryFn: sdk.setup.getStatus,
    retry: false,
  });

  const setupMutation = useMutation({
    mutationFn: (body: SetupFormState) =>
      sdk.setup.complete({
        ownerEmail: body.ownerEmail,
        ownerName: body.ownerName,
        ownerPassword: body.ownerPassword,
        publicUrl: body.publicUrl.trim() || undefined,
        workspaceName: body.workspaceName,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['setup'] });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate(routes.home.to(), { replace: true });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setupMutation.mutate(form);
  }

  if (setupQuery.isPending) {
    return <LoadingState />;
  }

  if (setupQuery.error) {
    return (
      <ErrorState error={setupQuery.error} onRetry={() => queryClient.invalidateQueries({ queryKey: ['setup'] })} />
    );
  }

  if (setupQuery.data.isSetupComplete) {
    return <Navigate replace to={routes.home.to()} />;
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[rgb(var(--tabliodb-surface))] px-6 py-10 text-[rgb(var(--tabliodb-ink))]">
      <Surface className="w-full max-w-lg p-5" depth="md">
        <form onSubmit={handleSubmit}>
          <div className="mb-5 flex items-center gap-2">
            <div className="grid size-10 place-items-center rounded-2xl bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]">
              <Database className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold">Tabliodb</h1>
              <p className="text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">Set up this instance</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Owner name
              </span>
              <Input
                onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))}
                value={form.ownerName}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Owner email
              </span>
              <Input
                onChange={(event) => setForm((current) => ({ ...current, ownerEmail: event.target.value }))}
                type="email"
                value={form.ownerEmail}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Password
              </span>
              <Input
                onChange={(event) => setForm((current) => ({ ...current, ownerPassword: event.target.value }))}
                type="password"
                value={form.ownerPassword}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Workspace
              </span>
              <Input
                onChange={(event) => setForm((current) => ({ ...current, workspaceName: event.target.value }))}
                value={form.workspaceName}
              />
            </label>
          </div>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Public URL
            </span>
            <Input
              onChange={(event) => setForm((current) => ({ ...current, publicUrl: event.target.value }))}
              type="url"
              value={form.publicUrl}
            />
          </label>
          {setupMutation.error ? (
            <div className="mt-4 rounded-[14px] border-2 border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              {getErrorMessage(setupMutation.error)}
            </div>
          ) : null}
          <Button className="mt-5 w-full gap-2" disabled={setupMutation.isPending} type="submit">
            {setupMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
            Create owner and workspace
          </Button>
        </form>
      </Surface>
    </main>
  );
}
