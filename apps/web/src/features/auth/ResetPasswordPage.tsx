import { zodResolver } from '@hookform/resolvers/zod';
import { Button, FieldError, Surface } from '@tabliodb/ui';
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router';
import { z } from 'zod';
import { routes } from '@/app/routes';
import { ControlledInput } from '@/features/app/FormControls';
import { getErrorMessage } from '@/features/app/RouteStates';
import { usePasswordResetConfirmMutation } from '@/resources/auth';

const resetPasswordFormSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    passwordConfirmation: z.string().min(8, 'Password confirmation is required.'),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    message: 'Passwords do not match.',
    path: ['passwordConfirmation'],
  });

type ResetPasswordFormState = z.infer<typeof resetPasswordFormSchema>;

export function ResetPasswordPage() {
  const params = useParams();
  const token = params.token ?? '';
  const form = useForm<ResetPasswordFormState>({
    defaultValues: {
      password: '',
      passwordConfirmation: '',
    },
    mode: 'onBlur',
    resolver: zodResolver(resetPasswordFormSchema),
  });
  const { errors } = form.formState;
  const resetMutation = usePasswordResetConfirmMutation();
  const hasResetPassword = resetMutation.isSuccess;

  return (
    <main className="grid min-h-screen place-items-center bg-[rgb(var(--tabliodb-surface))] px-6 py-10 text-[rgb(var(--tabliodb-ink))]">
      <Surface className="w-full max-w-sm p-5" depth="md">
        <div className="mb-5 flex items-center gap-2">
          <div className="grid size-10 place-items-center rounded-2xl bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]">
            {hasResetPassword ? <CheckCircle2 className="size-5" /> : <ShieldCheck className="size-5" />}
          </div>
          <div>
            <h1 className="text-base font-extrabold">
              {hasResetPassword ? 'Password updated' : 'Choose a new password'}
            </h1>
            <p className="text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
              {hasResetPassword ? 'You can sign in again safely' : 'This token can only be used once'}
            </p>
          </div>
        </div>

        {hasResetPassword ? (
          <div>
            <div className="mb-4 rounded-[16px] border-2 border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-primary-text))]">
              Password changed and {resetMutation.data.revokedSessions} old session(s) were revoked.
            </div>
            <Button asChild className="w-full gap-2">
              <Link to={routes.login.to()}>
                <KeyRound className="size-4" />
                Go to login
              </Link>
            </Button>
          </div>
        ) : (
          <form
            onSubmit={form.handleSubmit((values) =>
              resetMutation.mutate({
                password: values.password,
                token,
              }),
            )}
          >
            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                New password
              </span>
              <ControlledInput
                aria-invalid={Boolean(errors.password)}
                autoComplete="new-password"
                control={form.control}
                disabled={resetMutation.isPending}
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
                disabled={resetMutation.isPending}
                name="passwordConfirmation"
                type="password"
              />
              <FieldError>{errors.passwordConfirmation?.message}</FieldError>
            </label>

            {resetMutation.error ? (
              <div className="mb-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                {getErrorMessage(resetMutation.error)}
              </div>
            ) : null}

            <Button className="w-full gap-2" disabled={resetMutation.isPending || !token} type="submit">
              {resetMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              Update password
            </Button>

            <Button asChild className="mt-3 w-full gap-2" variant="ghost">
              <Link to={routes.login.to()}>
                <ArrowLeft className="size-4" />
                Back to login
              </Link>
            </Button>
          </form>
        )}
      </Surface>
    </main>
  );
}
