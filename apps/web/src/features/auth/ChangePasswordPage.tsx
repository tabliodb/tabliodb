import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Button, FieldError, Surface } from '@tabliodb/ui';
import { KeyRound, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { routes } from '@/app/routes';
import { ControlledInput } from '@/features/app/FormControls';
import { LoadingState, getErrorMessage } from '@/features/app/RouteStates';
import { authQueries, useLogoutMutation, useUpdateCurrentUserPasswordMutation } from '@/resources/auth';

const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Temporary password is required.'),
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    passwordConfirmation: z.string().min(8, 'Password confirmation is required.'),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    message: 'Passwords do not match.',
    path: ['passwordConfirmation'],
  });

type ChangePasswordFormState = z.infer<typeof changePasswordFormSchema>;

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const currentUserQuery = useQuery(authQueries.me());
  const form = useForm<ChangePasswordFormState>({
    defaultValues: {
      currentPassword: '',
      password: '',
      passwordConfirmation: '',
    },
    mode: 'onBlur',
    resolver: zodResolver(changePasswordFormSchema),
  });
  const { errors } = form.formState;
  const changePasswordMutation = useUpdateCurrentUserPasswordMutation({
    mutationConfig: {
      onSuccess: () => {
        navigate(routes.home.to(), { replace: true });
      },
    },
  });
  const logoutMutation = useLogoutMutation({
    mutationConfig: {
      onSuccess: () => {
        navigate(routes.login.to(), { replace: true });
      },
    },
  });

  if (currentUserQuery.isPending) {
    return <LoadingState message="Preparing password update" />;
  }

  const currentUser = currentUserQuery.data;
  const isPending = changePasswordMutation.isPending || logoutMutation.isPending;

  return (
    <main className="grid min-h-screen place-items-center bg-[rgb(var(--tabliodb-surface))] px-6 py-10 text-[rgb(var(--tabliodb-ink))]">
      <Surface className="w-full max-w-md p-5" depth="md">
        <div className="mb-5 flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-[18px] border-2 border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))] shadow-[0_3px_0_rgb(var(--tabliodb-primary-border))]">
            <ShieldCheck className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold">Choose your password</h1>
            <p className="mt-1 text-sm font-bold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
              {currentUser?.name ?? 'Your account'} was created with a temporary password. Pick a private password
              before entering the workspace.
            </p>
          </div>
        </div>

        {currentUser ? (
          <div className="mb-5 rounded-[18px] border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] p-3">
            <p className="truncate text-sm font-extrabold">{currentUser.name}</p>
            <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">{currentUser.email}</p>
          </div>
        ) : null}

        <form
          onSubmit={form.handleSubmit((values) =>
            changePasswordMutation.mutate({
              currentPassword: values.currentPassword,
              password: values.password,
            }),
          )}
        >
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Temporary password
            </span>
            <ControlledInput
              aria-invalid={Boolean(errors.currentPassword)}
              autoComplete="current-password"
              control={form.control}
              disabled={isPending}
              name="currentPassword"
              type="password"
            />
            <FieldError>{errors.currentPassword?.message}</FieldError>
          </label>

          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              New password
            </span>
            <ControlledInput
              aria-invalid={Boolean(errors.password)}
              autoComplete="new-password"
              control={form.control}
              disabled={isPending}
              name="password"
              type="password"
            />
            <FieldError>{errors.password?.message}</FieldError>
          </label>

          <label className="mb-4 block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Confirm password
            </span>
            <ControlledInput
              aria-invalid={Boolean(errors.passwordConfirmation)}
              autoComplete="new-password"
              control={form.control}
              disabled={isPending}
              name="passwordConfirmation"
              type="password"
            />
            <FieldError>{errors.passwordConfirmation?.message}</FieldError>
          </label>

          {changePasswordMutation.error ? (
            <div className="mb-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
              {getErrorMessage(changePasswordMutation.error)}
            </div>
          ) : null}

          <Button className="w-full gap-2" disabled={isPending} type="submit">
            {changePasswordMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}
            Update password
          </Button>

          <Button
            className="mt-3 w-full gap-2"
            disabled={isPending}
            onClick={() => logoutMutation.mutate(undefined)}
            type="button"
            variant="ghost"
          >
            {logoutMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
            Use another account
          </Button>
        </form>
      </Surface>
    </main>
  );
}
