import { zodResolver } from '@hookform/resolvers/zod';
import { Button, FieldError, Surface } from '@tabliodb/ui';
import { Database, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { routes } from '@/app/routes';
import { ControlledInput } from '@/features/app/FormControls';
import { getErrorMessage } from '@/features/app/RouteStates';
import { useLoginMutation } from '@/resources/auth';

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
  const form = useForm<LoginFormState>({
    defaultValues: loginDefaults,
    mode: 'onBlur',
    resolver: zodResolver(loginFormSchema),
  });
  const { errors } = form.formState;

  const loginMutation = useLoginMutation({
    mutationConfig: {
      onSuccess: () => {
        // Redirect login diputuskan di mutation success karena user sudah eksplisit menyelesaikan submit form.
        navigate(routes.home.to(), { replace: true });
      },
    },
  });

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
            <ControlledInput
              aria-invalid={Boolean(errors.email)}
              autoComplete="email"
              control={form.control}
              disabled={loginMutation.isPending}
              name="email"
              type="email"
            />
            <FieldError>{errors.email?.message}</FieldError>
          </label>
          <label className="mb-4 block text-sm">
            <span className="mb-1 flex items-center justify-between gap-3 text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              <span>Password</span>
              <Link
                className="cursor-pointer normal-case tracking-normal text-[rgb(var(--tabliodb-sky-text))] hover:underline"
                to={routes.forgotPassword.to()}
              >
                Forgot?
              </Link>
            </span>
            <ControlledInput
              aria-invalid={Boolean(errors.password)}
              autoComplete="current-password"
              control={form.control}
              disabled={loginMutation.isPending}
              name="password"
              type="password"
            />
            <FieldError>{errors.password?.message}</FieldError>
          </label>
          {loginMutation.error ? (
            <div className="mb-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
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
