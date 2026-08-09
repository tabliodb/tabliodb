import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { SignupPolicy } from '@tabliodb/sdk';
import { Badge, Button, FieldError, Surface, cn } from '@tabliodb/ui';
import { Globe2, Loader2, LockKeyhole, MailCheck, Save, ShieldCheck, UserPlus } from 'lucide-react';
import { useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { z } from 'zod';
import { ControlledSelect, ControlledTextarea } from '@/features/app/FormControls';
import { ErrorState, InlineErrorState, LoadingState } from '@/features/app/RouteStates';
import { setupQueries, useUpdateAuthSettingsMutation } from '@/resources/setup';

const signupPolicyOptions = [
  SignupPolicy.InviteOnly,
  SignupPolicy.AllowedDomains,
  SignupPolicy.SignupDisabled,
  SignupPolicy.SsoOnly,
  SignupPolicy.PublicSignup,
] as const satisfies readonly SignupPolicy[];

const authSettingsFormSchema = z
  .object({
    allowedDomainsText: z.string().max(2000, 'Domain list is too long.'),
    signupPolicy: z.enum(signupPolicyOptions),
  })
  .superRefine((value, context) => {
    if (value.signupPolicy === 'allowed_domains' && parseAllowedDomainsText(value.allowedDomainsText).length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'Add at least one email domain for allowed-domain signup.',
        path: ['allowedDomainsText'],
      });
    }
  });

type AuthSettingsFormState = z.infer<typeof authSettingsFormSchema>;

const selectClassName =
  'h-[var(--tabliodb-control-md)] w-full cursor-pointer rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 text-[13px] font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-[3px] focus:ring-[rgb(var(--tabliodb-focus-ring))] disabled:cursor-not-allowed disabled:opacity-50';

export function AdminSettingsPage() {
  const authSettingsQuery = useQuery(setupQueries.authSettings());
  const updateAuthSettingsMutation = useUpdateAuthSettingsMutation();
  const form = useForm<AuthSettingsFormState>({
    defaultValues: {
      allowedDomainsText: '',
      signupPolicy: SignupPolicy.InviteOnly,
    },
    mode: 'onBlur',
    resolver: zodResolver(authSettingsFormSchema) as Resolver<AuthSettingsFormState>,
  });
  const { errors, isDirty } = form.formState;
  const selectedPolicy = form.watch('signupPolicy');
  const parsedDomains = parseAllowedDomainsText(form.watch('allowedDomainsText'));

  useEffect(() => {
    if (!authSettingsQuery.data) {
      return;
    }

    form.reset({
      allowedDomainsText: authSettingsQuery.data.allowedDomains.join('\n'),
      signupPolicy: authSettingsQuery.data.signupPolicy,
    });
  }, [authSettingsQuery.data, form]);

  function handleSubmit(values: AuthSettingsFormState) {
    updateAuthSettingsMutation.mutate(
      {
        allowedDomains: parseAllowedDomainsText(values.allowedDomainsText),
        signupPolicy: values.signupPolicy,
      },
      {
        onSuccess: (settings) => {
          // Server melakukan normalisasi domain; reset dari response menjaga form dan persisted state identik.
          form.reset({
            allowedDomainsText: settings.allowedDomains.join('\n'),
            signupPolicy: settings.signupPolicy,
          });
        },
      },
    );
  }

  if (authSettingsQuery.isPending) {
    return <LoadingState message="Loading sign-up settings" />;
  }

  if (authSettingsQuery.error) {
    return <ErrorState error={authSettingsQuery.error} onRetry={() => void authSettingsQuery.refetch()} />;
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 px-5 py-5">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-normal text-[rgb(var(--tabliodb-ink))]">Sign-up policy</h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
            Control how new employees can enter this self-hosted Tabliodb instance.
          </p>
        </div>
      </section>

      <form className="grid gap-5" onSubmit={form.handleSubmit(handleSubmit)}>
        <Surface className="grid gap-4 p-4" depth="md">
          <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Policy
              </span>
              <ControlledSelect
                className={selectClassName}
                control={form.control}
                disabled={updateAuthSettingsMutation.isPending}
                name="signupPolicy"
                options={signupPolicyOptions.map((policy) => ({
                  label: formatSignupPolicy(policy),
                  value: policy,
                }))}
              />
              <FieldError>{errors.signupPolicy?.message}</FieldError>
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              {signupPolicyOptions.map((policy) => (
                <div
                  className={cn(
                    'rounded-[18px] border-2 p-3 text-left transition',
                    'border-[rgb(var(--tabliodb-border))] bg-white',
                  )}
                  key={policy}
                >
                  <div className="mb-2 flex items-center gap-2 text-sm font-extrabold">
                    <SignupPolicyIcon policy={policy} />
                    {formatSignupPolicy(policy)}
                  </div>
                  <p className="text-xs font-bold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
                    {describeSignupPolicy(policy)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Surface>

        <Surface className="grid gap-4 p-4" depth="md">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-extrabold">Allowed email domains</h3>
              <p className="text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                Used only when policy is set to allowed domains.
              </p>
            </div>
            <Badge variant={parsedDomains.length > 0 ? 'blue' : 'neutral'}>{parsedDomains.length} domains</Badge>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Domains
            </span>
            <ControlledTextarea
              aria-invalid={Boolean(errors.allowedDomainsText)}
              className="min-h-36 w-full resize-y rounded-(--tabliodb-radius-lg) border border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 py-3 text-[13px] font-semibold leading-5 text-[rgb(var(--tabliodb-ink))] outline-none transition placeholder:text-[rgb(var(--tabliodb-ink-subtle))] focus:border-[rgb(var(--tabliodb-primary))] focus:ring-[3px] focus:ring-[rgb(var(--tabliodb-focus-ring))] disabled:cursor-not-allowed disabled:opacity-60"
              control={form.control}
              disabled={updateAuthSettingsMutation.isPending}
              name="allowedDomainsText"
              placeholder={'company.com\nteam.company.com'}
            />
            <FieldError>{errors.allowedDomainsText?.message}</FieldError>
          </label>

          {updateAuthSettingsMutation.error ? (
            <InlineErrorState error={updateAuthSettingsMutation.error} title="Could not save sign-up settings" />
          ) : null}
        </Surface>

        <div className="sticky bottom-5 flex justify-end">
          <Button disabled={updateAuthSettingsMutation.isPending || !isDirty} type="submit">
            {updateAuthSettingsMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save settings
          </Button>
        </div>
      </form>
    </div>
  );
}

function parseAllowedDomainsText(value: string): string[] {
  const domains = value
    .split(/[\n,]+/)
    .map((domain) => domain.trim().toLowerCase().replace(/^@+/, ''))
    .filter(Boolean);

  return [...new Set(domains)].sort();
}

function formatSignupPolicy(policy: SignupPolicy): string {
  return {
    allowed_domains: 'Allowed domains',
    invite_only: 'Invite only',
    public_signup: 'Public signup',
    signup_disabled: 'Signup disabled',
    sso_only: 'SSO only',
  }[policy];
}

function describeSignupPolicy(policy: SignupPolicy): string {
  return {
    allowed_domains: 'Password sign-up is open only for email domains you list.',
    invite_only: 'New users need an invitation link from an admin.',
    public_signup: 'Anyone who can reach this instance can create an account.',
    signup_disabled: 'No public password sign-up. Admin-created users and invites still work.',
    sso_only: 'Password sign-up is blocked so future SSO can own entry.',
  }[policy];
}

function SignupPolicyIcon({ policy }: { policy: SignupPolicy }) {
  const Icon = {
    allowed_domains: MailCheck,
    invite_only: UserPlus,
    public_signup: Globe2,
    signup_disabled: LockKeyhole,
    sso_only: ShieldCheck,
  }[policy];

  return <Icon className="size-4 text-[rgb(var(--tabliodb-primary-text))]" />;
}
