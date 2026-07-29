import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, FieldError, Input, Surface } from '@tabliodb/ui';
import { Database, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router';
import { z } from 'zod';
import { routes } from '@/app/routes';
import { ErrorState, LoadingState, getErrorMessage } from '@/features/app/RouteStates';
import { sdk } from '@/services/sdk';

const loginFormSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
  password: z.string().min(1, 'Password is required.'),
});

type LoginFormState = z.infer<typeof loginFormSchema>;

const loginDefaults: LoginFormState = {
  email: 'owner@tabliodb.local',
  password: 'tabliodb-dev',
};

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<LoginFormState>({
    defaultValues: loginDefaults,
    mode: 'onBlur',
    resolver: zodResolver(loginFormSchema),
  });
  const { errors } = form.formState;

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
        <form onSubmit={form.handleSubmit((values) => loginMutation.mutate(values))}>
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
              aria-invalid={Boolean(errors.email)}
              autoComplete="email"
              disabled={loginMutation.isPending}
              type="email"
              {...form.register('email')}
            />
            <FieldError>{errors.email?.message}</FieldError>
          </label>
          <label className="mb-4 block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Password
            </span>
            <Input
              aria-invalid={Boolean(errors.password)}
              autoComplete="current-password"
              disabled={loginMutation.isPending}
              type="password"
              {...form.register('password')}
            />
            <FieldError>{errors.password?.message}</FieldError>
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
