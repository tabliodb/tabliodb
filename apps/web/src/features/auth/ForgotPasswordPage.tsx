import { zodResolver } from '@hookform/resolvers/zod';
import { Button, FieldError, Surface } from '@tabliodb/ui';
import { ArrowLeft, ExternalLink, KeyRound, Loader2, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { routes } from '@/app/routes';
import { ControlledInput } from '@/features/app/FormControls';
import { getErrorMessage } from '@/features/app/RouteStates';
import { usePasswordResetRequestMutation } from '@/resources/auth';

const forgotPasswordFormSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
});

type ForgotPasswordFormState = z.infer<typeof forgotPasswordFormSchema>;

export function ForgotPasswordPage() {
  const form = useForm<ForgotPasswordFormState>({
    defaultValues: {
      email: '',
    },
    mode: 'onBlur',
    resolver: zodResolver(forgotPasswordFormSchema),
  });
  const { errors } = form.formState;
  const requestMutation = usePasswordResetRequestMutation();

  return (
    <main className="grid min-h-screen place-items-center bg-[rgb(var(--tabliodb-surface))] px-6 py-10 text-[rgb(var(--tabliodb-ink))]">
      <Surface className="w-full max-w-sm p-5" depth="md">
        <div className="mb-5 flex items-center gap-2">
          <div className="grid size-10 place-items-center rounded-2xl bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]">
            <KeyRound className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold">Reset password</h1>
            <p className="text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">Recover access to Tabliodb</p>
          </div>
        </div>

        <form onSubmit={form.handleSubmit((values) => requestMutation.mutate(values))}>
          <label className="mb-4 block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Email
            </span>
            <ControlledInput
              aria-invalid={Boolean(errors.email)}
              autoComplete="email"
              control={form.control}
              disabled={requestMutation.isPending}
              name="email"
              type="email"
            />
            <FieldError>{errors.email?.message}</FieldError>
          </label>

          {requestMutation.error ? (
            <div className="mb-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
              {getErrorMessage(requestMutation.error)}
            </div>
          ) : null}

          {requestMutation.data ? (
            <div className="mb-4 rounded-[16px] border-2 border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-primary-text))]">
              <p>
                If the account exists, a password reset token has been prepared. Check your configured delivery channel.
              </p>
              {requestMutation.data.resetToken ? (
                <Button asChild className="mt-3 w-full gap-2" size="sm" variant="secondary">
                  <Link to={routes.resetPassword.to({ token: requestMutation.data.resetToken })}>
                    <ExternalLink className="size-4" />
                    Open reset link
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null}

          <Button className="w-full gap-2" disabled={requestMutation.isPending} type="submit">
            {requestMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            Send reset instructions
          </Button>

          <Button asChild className="mt-3 w-full gap-2" variant="ghost">
            <Link to={routes.login.to()}>
              <ArrowLeft className="size-4" />
              Back to login
            </Link>
          </Button>
        </form>
      </Surface>
    </main>
  );
}
