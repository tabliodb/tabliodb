import { zodResolver } from '@hookform/resolvers/zod';
import { Button, FieldError, Surface } from '@tabliodb/ui';
import { Database, KeyRound, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLoaderData, useNavigate } from 'react-router';
import { z } from 'zod';
import { routes } from '@/app/routes';
import { ControlledInput } from '@/features/app/FormControls';
import { getErrorMessage } from '@/features/app/RouteStates';
import { useLoginMutation, useLogoutMutation, useUpdateCurrentUserTemporaryPasswordMutation } from '@/resources/auth';
import type { LoginLoaderData } from './loaders/loginLoader';

const loginFormSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
  password: z.string().min(1, 'Password is required.'),
});

type LoginFormState = z.infer<typeof loginFormSchema>;

const temporaryPasswordFormSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    passwordConfirmation: z.string().min(8, 'Password confirmation is required.'),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    message: 'Passwords do not match.',
    path: ['passwordConfirmation'],
  });

type TemporaryPasswordFormState = z.infer<typeof temporaryPasswordFormSchema>;

const loginDefaults: LoginFormState = {
  email: 'owner@tabliodb.local',
  password: 'tabliodb-dev',
};

export function LoginPage() {
  const navigate = useNavigate();
  const loaderData = useLoaderData() as LoginLoaderData;
  const [temporaryUser, setTemporaryUser] = useState(loaderData.temporaryUser);
  const loginForm = useForm<LoginFormState>({
    defaultValues: loginDefaults,
    mode: 'onBlur',
    resolver: zodResolver(loginFormSchema),
  });
  const temporaryPasswordForm = useForm<TemporaryPasswordFormState>({
    defaultValues: {
      password: '',
      passwordConfirmation: '',
    },
    mode: 'onBlur',
    resolver: zodResolver(temporaryPasswordFormSchema),
  });
  const { errors: loginErrors } = loginForm.formState;
  const { errors: temporaryPasswordErrors } = temporaryPasswordForm.formState;

  useEffect(() => {
    setTemporaryUser(loaderData.temporaryUser);
  }, [loaderData.temporaryUser]);

  const loginMutation = useLoginMutation({
    mutationConfig: {
      onSuccess: (data) => {
        if (data.user.passwordChangeRequired) {
          // Login temporary tetap membuat session, tetapi UX lanjut di kartu yang sama agar user tidak merasa terkena error.
          setTemporaryUser(data.user);
          temporaryPasswordForm.reset();
          return;
        }

        // Redirect login diputuskan di mutation success karena user sudah eksplisit menyelesaikan submit form.
        navigate(routes.home.to(), { replace: true });
      },
    },
  });
  const temporaryPasswordMutation = useUpdateCurrentUserTemporaryPasswordMutation({
    mutationConfig: {
      onSuccess: () => {
        navigate(routes.home.to(), { replace: true });
      },
    },
  });
  const logoutMutation = useLogoutMutation({
    mutationConfig: {
      onSuccess: () => {
        setTemporaryUser(null);
        loginForm.reset(loginDefaults);
        temporaryPasswordForm.reset();
      },
    },
  });
  const isTemporaryMode = Boolean(temporaryUser);
  const isTemporaryPending = temporaryPasswordMutation.isPending || logoutMutation.isPending;

  return (
    <main className="grid h-screen place-items-center bg-[rgb(var(--tabliodb-surface))] px-6 text-[rgb(var(--tabliodb-ink))]">
      <Surface className="w-full max-w-sm p-5" depth="md">
        {isTemporaryMode ? (
          <form
            onSubmit={temporaryPasswordForm.handleSubmit((values) =>
              temporaryPasswordMutation.mutate({
                password: values.password,
              }),
            )}
          >
            <div className="mb-5 flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]">
                <ShieldCheck className="size-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-extrabold">Create your password</h1>
                <p className="mt-1 text-xs font-bold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
                  Your admin gave you a temporary password. Choose a private password to continue.
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-[16px] border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] p-3">
              <p className="truncate text-sm font-extrabold">{temporaryUser?.name ?? 'Temporary user'}</p>
              <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                {temporaryUser?.email ?? 'Signed in with temporary access'}
              </p>
            </div>

            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                New password
              </span>
              <ControlledInput
                aria-invalid={Boolean(temporaryPasswordErrors.password)}
                autoComplete="new-password"
                control={temporaryPasswordForm.control}
                disabled={isTemporaryPending}
                name="password"
                type="password"
              />
              <FieldError>{temporaryPasswordErrors.password?.message}</FieldError>
            </label>

            <label className="mb-4 block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Confirm password
              </span>
              <ControlledInput
                aria-invalid={Boolean(temporaryPasswordErrors.passwordConfirmation)}
                autoComplete="new-password"
                control={temporaryPasswordForm.control}
                disabled={isTemporaryPending}
                name="passwordConfirmation"
                type="password"
              />
              <FieldError>{temporaryPasswordErrors.passwordConfirmation?.message}</FieldError>
            </label>

            {temporaryPasswordMutation.error ? (
              <div className="mb-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                {getErrorMessage(temporaryPasswordMutation.error)}
              </div>
            ) : null}

            <Button className="w-full gap-2" disabled={isTemporaryPending} type="submit">
              {temporaryPasswordMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}
              Save password
            </Button>

            <Button
              className="mt-3 w-full gap-2"
              disabled={isTemporaryPending}
              onClick={() => logoutMutation.mutate(undefined)}
              type="button"
              variant="ghost"
            >
              {logoutMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
              Use another account
            </Button>
          </form>
        ) : (
          <form onSubmit={loginForm.handleSubmit((values) => loginMutation.mutate(values))}>
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
                aria-invalid={Boolean(loginErrors.email)}
                autoComplete="email"
                control={loginForm.control}
                disabled={loginMutation.isPending}
                name="email"
                type="email"
              />
              <FieldError>{loginErrors.email?.message}</FieldError>
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
                aria-invalid={Boolean(loginErrors.password)}
                autoComplete="current-password"
                control={loginForm.control}
                disabled={loginMutation.isPending}
                name="password"
                type="password"
              />
              <FieldError>{loginErrors.password?.message}</FieldError>
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
        )}
      </Surface>
    </main>
  );
}
