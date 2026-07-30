import { zodResolver } from '@hookform/resolvers/zod';
import { Button, FieldError, Surface } from '@tabliodb/ui';
import { Database, Loader2, LogIn, MailCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { routes } from '@/app/routes';
import { ControlledInput } from '@/features/app/FormControls';
import { getErrorMessage } from '@/features/app/RouteStates';
import { invitationsQueries, useAcceptInvitationMutation } from '@/resources/invitations';
import { useQuery } from '@tanstack/react-query';

const acceptInvitationFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

type AcceptInvitationFormState = z.infer<typeof acceptInvitationFormSchema>;

const acceptInvitationDefaults: AcceptInvitationFormState = {
  name: '',
  password: '',
};

export function AcceptInvitationPage() {
  const navigate = useNavigate();
  const { token = '' } = useParams();
  const invitationQuery = useQuery(invitationsQueries.byToken(token));
  const invitation = invitationQuery.data;
  const form = useForm<AcceptInvitationFormState>({
    defaultValues: acceptInvitationDefaults,
    mode: 'onBlur',
    resolver: zodResolver(acceptInvitationFormSchema),
  });
  const { errors } = form.formState;

  const acceptInvitationMutation = useAcceptInvitationMutation({
    mutationConfig: {
      onSuccess: () => {
        // Setelah accept, user sudah punya cookie session sehingga home route dapat memilih workspace aktif.
        navigate(routes.home.to(), { replace: true });
      },
    },
  });

  const isPendingInvite = invitation?.status === 'pending';

  return (
    <main className="grid min-h-screen place-items-center bg-[rgb(var(--tabliodb-surface))] px-6 py-10 text-[rgb(var(--tabliodb-ink))]">
      <Surface className="w-full max-w-md overflow-hidden p-0" depth="md">
        <div className="border-b-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-primary-soft))] p-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-[18px] bg-white text-[rgb(var(--tabliodb-primary-text))] shadow-[0_4px_0_rgba(0,0,0,0.08)]">
              <MailCheck className="size-6" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold">Join Tabliodb</h1>
              <p className="text-sm font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                {invitation ? invitation.organizationName : 'Loading invitation'}
              </p>
            </div>
          </div>
          {invitation ? (
            <p className="text-sm font-bold leading-6 text-[rgb(var(--tabliodb-ink))]">
              {invitation.email} was invited as {formatRole(invitation.organizationRole)}
              {invitation.projectName ? ` for ${invitation.projectName}` : ''}.
            </p>
          ) : null}
        </div>

        <div className="p-5">
          {isPendingInvite ? (
            <form
              onSubmit={form.handleSubmit((values) =>
                acceptInvitationMutation.mutate({
                  ...values,
                  token,
                }),
              )}
            >
              {invitation.message ? (
                <div className="mb-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white p-3 text-sm font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                  {invitation.message}
                </div>
              ) : null}
              <label className="mb-3 block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Name
                </span>
                <ControlledInput
                  aria-invalid={Boolean(errors.name)}
                  autoComplete="name"
                  control={form.control}
                  disabled={acceptInvitationMutation.isPending}
                  name="name"
                />
                <FieldError>{errors.name?.message}</FieldError>
              </label>
              <label className="mb-4 block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Password
                </span>
                <ControlledInput
                  aria-invalid={Boolean(errors.password)}
                  autoComplete="new-password"
                  control={form.control}
                  disabled={acceptInvitationMutation.isPending}
                  name="password"
                  type="password"
                />
                <FieldError>{errors.password?.message}</FieldError>
              </label>
              {acceptInvitationMutation.error ? (
                <div className="mb-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                  {getErrorMessage(acceptInvitationMutation.error)}
                </div>
              ) : null}
              <Button className="w-full gap-2" disabled={acceptInvitationMutation.isPending} type="submit">
                {acceptInvitationMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Database className="size-4" />
                )}
                Create account
              </Button>
            </form>
          ) : (
            <div>
              <div className="mb-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-gold-text))]">
                This invitation is {invitation?.status ?? 'unavailable'}.
              </div>
              <Button className="w-full gap-2" onClick={() => navigate(routes.login.to())} variant="secondary">
                <LogIn className="size-4" />
                Go to login
              </Button>
            </div>
          )}
        </div>
      </Surface>
    </main>
  );
}

function formatRole(role: string): string {
  return role.replaceAll('_', ' ');
}
