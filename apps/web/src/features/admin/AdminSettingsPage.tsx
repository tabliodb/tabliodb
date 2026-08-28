import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { AutoJoinOrganizationRole, SignupPolicy, SmtpSecurity, type OrganizationDtoOutput } from '@tabliodb/sdk';
import { Badge, Button, FieldError, Surface, cn } from '@tabliodb/ui';
import {
  Building2,
  CheckCircle2,
  Globe2,
  Loader2,
  LockKeyhole,
  MailCheck,
  Save,
  Send,
  ServerCog,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { z } from 'zod';
import { ControlledCheckbox, ControlledInput, ControlledSelect, ControlledTextarea } from '@/features/app/FormControls';
import { ErrorState, InlineErrorState, LoadingState } from '@/features/app/RouteStates';
import { organizationsQueries } from '@/resources/organizations';
import {
  setupQueries,
  useUpdateAuthSettingsMutation,
  useUpdateOidcProviderMutation,
  useUpdateSmtpSettingsMutation,
} from '@/resources/setup';

const signupPolicyOptions = [
  SignupPolicy.InviteOnly,
  SignupPolicy.AllowedDomains,
  SignupPolicy.SignupDisabled,
  SignupPolicy.SsoOnly,
  SignupPolicy.PublicSignup,
] as const satisfies readonly SignupPolicy[];
const oidcAutoJoinRoleOptions = [AutoJoinOrganizationRole.Member, AutoJoinOrganizationRole.Guest] as const;
const oidcAutoJoinNoneValue = '__none__';
const smtpSecurityOptions = [SmtpSecurity.Starttls, SmtpSecurity.Tls, SmtpSecurity.None] as const;

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

const oidcProviderFormSchema = z
  .object({
    autoCreateUsers: z.boolean(),
    autoJoinOrganizationId: z.string(),
    autoJoinOrganizationRole: z.enum(oidcAutoJoinRoleOptions),
    buttonLabel: z.string().trim().min(1, 'Button label is required.').max(60, 'Button label is too long.'),
    clearClientSecret: z.boolean(),
    clientId: z.string().max(200, 'Client ID is too long.'),
    clientSecret: z.string().max(4096, 'Client secret is too long.'),
    enabled: z.boolean(),
    issuerUrl: z.string().max(500, 'Issuer URL is too long.'),
    scopesText: z.string().max(1000, 'Scope list is too long.'),
  })
  .superRefine((value, context) => {
    const issuerUrl = value.issuerUrl.trim();
    const clientId = value.clientId.trim();
    const scopes = parseScopesText(value.scopesText);

    if (value.enabled && !issuerUrl) {
      context.addIssue({
        code: 'custom',
        message: 'Issuer URL is required when OIDC is enabled.',
        path: ['issuerUrl'],
      });
    }

    if (issuerUrl && !isHttpUrl(issuerUrl)) {
      context.addIssue({
        code: 'custom',
        message: 'Use a valid HTTP or HTTPS issuer URL.',
        path: ['issuerUrl'],
      });
    }

    if (value.enabled && !clientId) {
      context.addIssue({
        code: 'custom',
        message: 'Client ID is required when OIDC is enabled.',
        path: ['clientId'],
      });
    }

    if (value.enabled && scopes.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'Add at least the openid scope.',
        path: ['scopesText'],
      });
    }
  });

const smtpSettingsFormSchema = z
  .object({
    clearPassword: z.boolean(),
    enabled: z.boolean(),
    fromEmail: z.string().max(255, 'From email is too long.'),
    fromName: z.string().max(120, 'From name is too long.'),
    host: z.string().max(255, 'SMTP host is too long.'),
    password: z.string().max(4096, 'SMTP password is too long.'),
    portText: z.string().max(5, 'SMTP port is too long.'),
    replyToEmail: z.string().max(255, 'Reply-to email is too long.'),
    security: z.enum(smtpSecurityOptions),
    username: z.string().max(255, 'SMTP username is too long.'),
  })
  .superRefine((value, context) => {
    const fromEmail = value.fromEmail.trim();
    const host = value.host.trim();
    const port = parsePortText(value.portText);
    const replyToEmail = value.replyToEmail.trim();

    if (value.enabled && !host) {
      context.addIssue({
        code: 'custom',
        message: 'SMTP host is required when mail is enabled.',
        path: ['host'],
      });
    }

    if (value.enabled && !port) {
      context.addIssue({
        code: 'custom',
        message: 'Use a port between 1 and 65535.',
        path: ['portText'],
      });
    }

    if (value.portText.trim() && !port) {
      context.addIssue({
        code: 'custom',
        message: 'Use a port between 1 and 65535.',
        path: ['portText'],
      });
    }

    if (value.enabled && !fromEmail) {
      context.addIssue({
        code: 'custom',
        message: 'From email is required when mail is enabled.',
        path: ['fromEmail'],
      });
    }

    if (fromEmail && !isEmailAddress(fromEmail)) {
      context.addIssue({
        code: 'custom',
        message: 'Use a valid from email address.',
        path: ['fromEmail'],
      });
    }

    if (replyToEmail && !isEmailAddress(replyToEmail)) {
      context.addIssue({
        code: 'custom',
        message: 'Use a valid reply-to email address.',
        path: ['replyToEmail'],
      });
    }
  });

type AuthSettingsFormState = z.infer<typeof authSettingsFormSchema>;
type OidcProviderFormState = z.infer<typeof oidcProviderFormSchema>;
type SmtpSettingsFormState = z.infer<typeof smtpSettingsFormSchema>;

const selectClassName =
  'h-[var(--tabliodb-control-md)] w-full cursor-pointer rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 text-[13px] font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-[3px] focus:ring-[rgb(var(--tabliodb-focus-ring))] disabled:cursor-not-allowed disabled:opacity-50';

export function AdminSettingsPage() {
  const authSettingsQuery = useQuery(setupQueries.authSettings());
  const oidcProviderQuery = useQuery(setupQueries.oidcProvider());
  const smtpSettingsQuery = useQuery(setupQueries.smtpSettings());
  const organizationsQuery = useQuery(organizationsQueries.list({ limit: 100 }));
  const updateAuthSettingsMutation = useUpdateAuthSettingsMutation();
  const updateOidcProviderMutation = useUpdateOidcProviderMutation();
  const updateSmtpSettingsMutation = useUpdateSmtpSettingsMutation();
  const authForm = useForm<AuthSettingsFormState>({
    defaultValues: {
      allowedDomainsText: '',
      signupPolicy: SignupPolicy.InviteOnly,
    },
    mode: 'onBlur',
    resolver: zodResolver(authSettingsFormSchema) as Resolver<AuthSettingsFormState>,
  });
  const oidcForm = useForm<OidcProviderFormState>({
    defaultValues: {
      autoCreateUsers: false,
      autoJoinOrganizationId: oidcAutoJoinNoneValue,
      autoJoinOrganizationRole: AutoJoinOrganizationRole.Member,
      buttonLabel: 'Continue with SSO',
      clearClientSecret: false,
      clientId: '',
      clientSecret: '',
      enabled: false,
      issuerUrl: '',
      scopesText: 'openid email profile',
    },
    mode: 'onBlur',
    resolver: zodResolver(oidcProviderFormSchema) as Resolver<OidcProviderFormState>,
  });
  const smtpForm = useForm<SmtpSettingsFormState>({
    defaultValues: {
      clearPassword: false,
      enabled: false,
      fromEmail: '',
      fromName: 'Tabliodb',
      host: '',
      password: '',
      portText: '587',
      replyToEmail: '',
      security: SmtpSecurity.Starttls,
      username: '',
    },
    mode: 'onBlur',
    resolver: zodResolver(smtpSettingsFormSchema) as Resolver<SmtpSettingsFormState>,
  });
  const authErrors = authForm.formState.errors;
  const oidcErrors = oidcForm.formState.errors;
  const smtpErrors = smtpForm.formState.errors;
  const selectedPolicy = authForm.watch('signupPolicy');
  const parsedDomains = parseAllowedDomainsText(authForm.watch('allowedDomainsText'));
  const autoJoinOrganizationId = oidcForm.watch('autoJoinOrganizationId');
  const oidcEnabled = oidcForm.watch('enabled');
  const oidcScopes = parseScopesText(oidcForm.watch('scopesText'));
  const smtpEnabled = smtpForm.watch('enabled');

  useEffect(() => {
    if (!authSettingsQuery.data) {
      return;
    }

    authForm.reset({
      allowedDomainsText: authSettingsQuery.data.allowedDomains.join('\n'),
      signupPolicy: authSettingsQuery.data.signupPolicy,
    });
  }, [authSettingsQuery.data, authForm]);

  useEffect(() => {
    if (!oidcProviderQuery.data) {
      return;
    }

    oidcForm.reset({
      autoCreateUsers: oidcProviderQuery.data.autoCreateUsers,
      autoJoinOrganizationId: oidcProviderQuery.data.autoJoinOrganizationId ?? oidcAutoJoinNoneValue,
      autoJoinOrganizationRole: oidcProviderQuery.data.autoJoinOrganizationRole ?? AutoJoinOrganizationRole.Member,
      buttonLabel: oidcProviderQuery.data.buttonLabel,
      clearClientSecret: false,
      clientId: oidcProviderQuery.data.clientId ?? '',
      clientSecret: '',
      enabled: oidcProviderQuery.data.enabled,
      issuerUrl: oidcProviderQuery.data.issuerUrl ?? '',
      scopesText: oidcProviderQuery.data.scopes.join(' '),
    });
  }, [oidcProviderQuery.data, oidcForm]);

  useEffect(() => {
    if (!smtpSettingsQuery.data) {
      return;
    }

    smtpForm.reset({
      clearPassword: false,
      enabled: smtpSettingsQuery.data.enabled,
      fromEmail: smtpSettingsQuery.data.fromEmail ?? '',
      fromName: smtpSettingsQuery.data.fromName ?? 'Tabliodb',
      host: smtpSettingsQuery.data.host ?? '',
      password: '',
      portText: smtpSettingsQuery.data.port?.toString() ?? '587',
      replyToEmail: smtpSettingsQuery.data.replyToEmail ?? '',
      security: toSmtpSecurity(smtpSettingsQuery.data.security),
      username: smtpSettingsQuery.data.username ?? '',
    });
  }, [smtpSettingsQuery.data, smtpForm]);

  function handleAuthSubmit(values: AuthSettingsFormState) {
    updateAuthSettingsMutation.mutate(
      {
        allowedDomains: parseAllowedDomainsText(values.allowedDomainsText),
        signupPolicy: values.signupPolicy,
      },
      {
        onSuccess: (settings) => {
          // Server melakukan normalisasi domain; reset dari response menjaga form dan persisted state identik.
          authForm.reset({
            allowedDomainsText: settings.allowedDomains.join('\n'),
            signupPolicy: settings.signupPolicy,
          });
        },
      },
    );
  }

  function handleOidcSubmit(values: OidcProviderFormState) {
    const clientSecret = values.clientSecret.trim();
    const autoJoinOrganizationId =
      values.autoJoinOrganizationId === oidcAutoJoinNoneValue ? null : values.autoJoinOrganizationId;

    updateOidcProviderMutation.mutate(
      {
        autoCreateUsers: values.autoCreateUsers,
        autoJoinOrganizationId,
        autoJoinOrganizationRole: autoJoinOrganizationId ? values.autoJoinOrganizationRole : null,
        buttonLabel: values.buttonLabel.trim(),
        clearClientSecret: values.clearClientSecret,
        clientId: values.clientId.trim() || null,
        ...(clientSecret ? { clientSecret } : {}),
        enabled: values.enabled,
        issuerUrl: values.issuerUrl.trim().replace(/\/+$/, '') || null,
        scopes: parseScopesText(values.scopesText),
      },
      {
        onSuccess: (settings) => {
          // Secret values are write-only; after save the form only keeps the configured status from the server.
          oidcForm.reset({
            autoCreateUsers: settings.autoCreateUsers,
            autoJoinOrganizationId: settings.autoJoinOrganizationId ?? oidcAutoJoinNoneValue,
            autoJoinOrganizationRole: settings.autoJoinOrganizationRole ?? AutoJoinOrganizationRole.Member,
            buttonLabel: settings.buttonLabel,
            clearClientSecret: false,
            clientId: settings.clientId ?? '',
            clientSecret: '',
            enabled: settings.enabled,
            issuerUrl: settings.issuerUrl ?? '',
            scopesText: settings.scopes.join(' '),
          });
        },
      },
    );
  }

  function handleSmtpSubmit(values: SmtpSettingsFormState) {
    const password = values.password;

    updateSmtpSettingsMutation.mutate(
      {
        clearPassword: values.clearPassword,
        enabled: values.enabled,
        fromEmail: values.fromEmail.trim().toLowerCase() || null,
        fromName: values.fromName.trim() || null,
        host: values.host.trim() || null,
        ...(password ? { password } : {}),
        port: parsePortText(values.portText),
        replyToEmail: values.replyToEmail.trim().toLowerCase() || null,
        security: values.security,
        username: values.username.trim() || null,
      },
      {
        onSuccess: (settings) => {
          // Password SMTP juga write-only; reset dari response hanya mempertahankan status configured yang aman ditampilkan.
          smtpForm.reset({
            clearPassword: false,
            enabled: settings.enabled,
            fromEmail: settings.fromEmail ?? '',
            fromName: settings.fromName ?? 'Tabliodb',
            host: settings.host ?? '',
            password: '',
            portText: settings.port?.toString() ?? '587',
            replyToEmail: settings.replyToEmail ?? '',
            security: toSmtpSecurity(settings.security),
            username: settings.username ?? '',
          });
        },
      },
    );
  }

  if (
    authSettingsQuery.isPending ||
    oidcProviderQuery.isPending ||
    smtpSettingsQuery.isPending ||
    organizationsQuery.isPending
  ) {
    return <LoadingState message="Loading admin settings" />;
  }

  if (authSettingsQuery.error) {
    return <ErrorState error={authSettingsQuery.error} onRetry={() => void authSettingsQuery.refetch()} />;
  }

  if (oidcProviderQuery.error) {
    return <ErrorState error={oidcProviderQuery.error} onRetry={() => void oidcProviderQuery.refetch()} />;
  }

  if (smtpSettingsQuery.error) {
    return <ErrorState error={smtpSettingsQuery.error} onRetry={() => void smtpSettingsQuery.refetch()} />;
  }

  if (organizationsQuery.error) {
    return <ErrorState error={organizationsQuery.error} onRetry={() => void organizationsQuery.refetch()} />;
  }

  const autoJoinWorkspaceOptions = createAutoJoinWorkspaceOptions(
    oidcProviderQuery.data.autoJoinOrganizationId,
    organizationsQuery.data.items,
  );

  return (
    <div className="mx-auto grid min-w-0 w-full max-w-5xl gap-6 px-4 py-4 sm:px-5 sm:py-5">
      <SettingsHeader
        description="Control how new employees can enter this self-hosted Tabliodb instance."
        title="Sign-up policy"
      />

      <form className="grid gap-5" onSubmit={authForm.handleSubmit(handleAuthSubmit)}>
        <Surface className="grid gap-4 p-4" depth="md">
          <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
            <label className="block text-sm">
              <FieldLabel>Policy</FieldLabel>
              <ControlledSelect
                className={selectClassName}
                control={authForm.control}
                disabled={updateAuthSettingsMutation.isPending}
                name="signupPolicy"
                options={signupPolicyOptions.map((policy) => ({
                  label: formatSignupPolicy(policy),
                  value: policy,
                }))}
              />
              <FieldError>{authErrors.signupPolicy?.message}</FieldError>
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              {signupPolicyOptions.map((policy) => (
                <div
                  className={cn(
                    'rounded-[var(--tabliodb-radius-lg)] border-2 p-3 text-left transition',
                    selectedPolicy === policy
                      ? 'border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))]'
                      : 'border-[rgb(var(--tabliodb-border))] bg-white',
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
            <FieldLabel>Domains</FieldLabel>
            <ControlledTextarea
              aria-invalid={Boolean(authErrors.allowedDomainsText)}
              className="min-h-36 w-full resize-y rounded-(--tabliodb-radius-lg) border border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 py-3 text-[13px] font-semibold leading-5 text-[rgb(var(--tabliodb-ink))] outline-none transition placeholder:text-[rgb(var(--tabliodb-ink-subtle))] focus:border-[rgb(var(--tabliodb-primary))] focus:ring-[3px] focus:ring-[rgb(var(--tabliodb-focus-ring))] disabled:cursor-not-allowed disabled:opacity-60"
              control={authForm.control}
              disabled={updateAuthSettingsMutation.isPending}
              name="allowedDomainsText"
              placeholder={'company.com\nteam.company.com'}
            />
            <FieldError>{authErrors.allowedDomainsText?.message}</FieldError>
          </label>

          {updateAuthSettingsMutation.error ? (
            <InlineErrorState error={updateAuthSettingsMutation.error} title="Could not save sign-up settings" />
          ) : null}
        </Surface>

        <div className="flex justify-end">
          <Button disabled={updateAuthSettingsMutation.isPending || !authForm.formState.isDirty} type="submit">
            {updateAuthSettingsMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save sign-up settings
          </Button>
        </div>
      </form>

      <SettingsHeader
        description="Prepare generic OIDC for company identity providers and decide where SSO users should land."
        title="OIDC provider"
      />

      <form className="grid gap-5" onSubmit={oidcForm.handleSubmit(handleOidcSubmit)}>
        <Surface className="grid gap-4 p-4" depth="md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <label className="flex cursor-pointer items-start gap-3 rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-border))] bg-white p-3">
              <ControlledCheckbox
                aria-label="Enable OIDC provider"
                control={oidcForm.control}
                disabled={updateOidcProviderMutation.isPending}
                name="enabled"
              />
              <span>
                <span className="block text-sm font-extrabold">Enable OIDC provider</span>
                <span className="block text-xs font-bold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
                  Keep disabled until issuer, client ID, and client secret are ready.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap gap-2">
              <Badge variant={oidcEnabled ? 'green' : 'neutral'}>{oidcEnabled ? 'Enabled' : 'Disabled'}</Badge>
              <SecretStatus
                configured={oidcProviderQuery.data.clientSecretConfigured}
                updatedAt={oidcProviderQuery.data.clientSecretUpdatedAt}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm md:col-span-2">
              <FieldLabel>Issuer URL</FieldLabel>
              <ControlledInput
                aria-invalid={Boolean(oidcErrors.issuerUrl)}
                control={oidcForm.control}
                disabled={updateOidcProviderMutation.isPending}
                name="issuerUrl"
                placeholder="https://id.company.com"
                type="url"
              />
              <FieldError>{oidcErrors.issuerUrl?.message}</FieldError>
            </label>

            <label className="block text-sm">
              <FieldLabel>Client ID</FieldLabel>
              <ControlledInput
                aria-invalid={Boolean(oidcErrors.clientId)}
                control={oidcForm.control}
                disabled={updateOidcProviderMutation.isPending}
                name="clientId"
                placeholder="tabliodb"
              />
              <FieldError>{oidcErrors.clientId?.message}</FieldError>
            </label>

            <label className="block text-sm">
              <FieldLabel>Button label</FieldLabel>
              <ControlledInput
                aria-invalid={Boolean(oidcErrors.buttonLabel)}
                control={oidcForm.control}
                disabled={updateOidcProviderMutation.isPending}
                name="buttonLabel"
                placeholder="Continue with SSO"
              />
              <FieldError>{oidcErrors.buttonLabel?.message}</FieldError>
            </label>

            <label className="block text-sm md:col-span-2">
              <FieldLabel>Scopes</FieldLabel>
              <ControlledInput
                aria-invalid={Boolean(oidcErrors.scopesText)}
                control={oidcForm.control}
                disabled={updateOidcProviderMutation.isPending}
                name="scopesText"
                placeholder="openid email profile"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {oidcScopes.map((scope) => (
                  <Badge key={scope} variant={scope === 'openid' ? 'green' : 'blue'}>
                    {scope}
                  </Badge>
                ))}
              </div>
              <FieldError>{oidcErrors.scopesText?.message}</FieldError>
            </label>

            <label className="block text-sm md:col-span-2">
              <FieldLabel>Client secret</FieldLabel>
              <ControlledInput
                aria-invalid={Boolean(oidcErrors.clientSecret)}
                autoComplete="new-password"
                control={oidcForm.control}
                disabled={updateOidcProviderMutation.isPending}
                name="clientSecret"
                placeholder={
                  oidcProviderQuery.data.clientSecretConfigured
                    ? 'Leave blank to keep the current secret'
                    : 'Paste OIDC client secret'
                }
                type="password"
              />
              <FieldError>{oidcErrors.clientSecret?.message}</FieldError>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-border))] bg-white p-3">
              <ControlledCheckbox
                aria-label="Automatically create users from OIDC"
                control={oidcForm.control}
                disabled={updateOidcProviderMutation.isPending}
                name="autoCreateUsers"
              />
              <span>
                <span className="block text-sm font-extrabold">Create users automatically</span>
                <span className="block text-xs font-bold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
                  Future OIDC login can create a user when the identity provider email is accepted.
                </span>
              </span>
            </label>

            <label
              className={cn(
                'flex items-start gap-3 rounded-[var(--tabliodb-radius-md)] border p-3',
                oidcProviderQuery.data.clientSecretConfigured
                  ? 'cursor-pointer border-[rgb(var(--tabliodb-border))] bg-white'
                  : 'cursor-not-allowed border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] opacity-70',
              )}
            >
              <ControlledCheckbox
                aria-label="Clear existing OIDC client secret"
                control={oidcForm.control}
                disabled={!oidcProviderQuery.data.clientSecretConfigured || updateOidcProviderMutation.isPending}
                name="clearClientSecret"
              />
              <span>
                <span className="block text-sm font-extrabold">Clear stored secret</span>
                <span className="block text-xs font-bold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
                  Use this when rotating away from a retired OIDC client.
                </span>
              </span>
            </label>
          </div>

          <div className="rounded-[var(--tabliodb-radius-lg)] border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] p-3">
            <div className="mb-3 flex items-start gap-2">
              <div className="grid size-9 shrink-0 place-items-center rounded-[var(--tabliodb-radius-md)] bg-[rgb(var(--tabliodb-sky-soft))] text-[rgb(var(--tabliodb-sky-text))]">
                <Building2 className="size-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold">Workspace mapping</h3>
                <p className="mt-0.5 text-xs font-bold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
                  Auto-created SSO users can land in a shared company workspace instead of a personal workspace.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
              <label className="block text-sm">
                <FieldLabel>Auto-join workspace</FieldLabel>
                <ControlledSelect
                  className={selectClassName}
                  control={oidcForm.control}
                  disabled={updateOidcProviderMutation.isPending}
                  name="autoJoinOrganizationId"
                  options={autoJoinWorkspaceOptions}
                />
              </label>

              <label className="block text-sm">
                <FieldLabel>Default role</FieldLabel>
                <ControlledSelect
                  className={selectClassName}
                  control={oidcForm.control}
                  disabled={updateOidcProviderMutation.isPending || autoJoinOrganizationId === oidcAutoJoinNoneValue}
                  name="autoJoinOrganizationRole"
                  options={oidcAutoJoinRoleOptions.map((role) => ({
                    label: formatAutoJoinRole(role),
                    value: role,
                  }))}
                />
              </label>
            </div>
          </div>

          {updateOidcProviderMutation.error ? (
            <InlineErrorState error={updateOidcProviderMutation.error} title="Could not save OIDC provider" />
          ) : null}
        </Surface>

        <div className="flex justify-end">
          <Button disabled={updateOidcProviderMutation.isPending || !oidcForm.formState.isDirty} type="submit">
            {updateOidcProviderMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save OIDC provider
          </Button>
        </div>
      </form>

      <SettingsHeader
        description="Prepare the mail server used by invitations, password recovery, and collaboration notifications."
        title="SMTP mail"
      />

      <form className="grid gap-5" onSubmit={smtpForm.handleSubmit(handleSmtpSubmit)}>
        <Surface className="grid gap-4 p-4" depth="md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <label className="flex cursor-pointer items-start gap-3 rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-border))] bg-white p-3">
              <ControlledCheckbox
                aria-label="Enable SMTP mail delivery"
                control={smtpForm.control}
                disabled={updateSmtpSettingsMutation.isPending}
                name="enabled"
              />
              <span>
                <span className="block text-sm font-extrabold">Enable SMTP mail</span>
                <span className="block text-xs font-bold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
                  Keep disabled until host, sender, and optional credentials are verified.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap gap-2">
              <Badge variant={smtpEnabled ? 'green' : 'neutral'}>{smtpEnabled ? 'Enabled' : 'Disabled'}</Badge>
              <SecretStatus
                configured={smtpSettingsQuery.data.passwordConfigured}
                updatedAt={smtpSettingsQuery.data.passwordUpdatedAt}
              />
            </div>
          </div>

          <div className="rounded-[var(--tabliodb-radius-lg)] border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] p-3">
            <div className="mb-3 flex items-start gap-2">
              <div className="grid size-9 shrink-0 place-items-center rounded-[var(--tabliodb-radius-md)] bg-[rgb(var(--tabliodb-sky-soft))] text-[rgb(var(--tabliodb-sky-text))]">
                <ServerCog className="size-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold">SMTP server</h3>
                <p className="mt-0.5 text-xs font-bold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
                  StartTLS on port 587 is the safest default for most company mail relays.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_180px]">
              <label className="block text-sm">
                <FieldLabel>Host</FieldLabel>
                <ControlledInput
                  aria-invalid={Boolean(smtpErrors.host)}
                  control={smtpForm.control}
                  disabled={updateSmtpSettingsMutation.isPending}
                  name="host"
                  placeholder="smtp.company.com"
                />
                <FieldError>{smtpErrors.host?.message}</FieldError>
              </label>

              <label className="block text-sm">
                <FieldLabel>Port</FieldLabel>
                <ControlledInput
                  aria-invalid={Boolean(smtpErrors.portText)}
                  control={smtpForm.control}
                  disabled={updateSmtpSettingsMutation.isPending}
                  inputMode="numeric"
                  name="portText"
                  placeholder="587"
                />
                <FieldError>{smtpErrors.portText?.message}</FieldError>
              </label>

              <label className="block text-sm">
                <FieldLabel>Security</FieldLabel>
                <ControlledSelect
                  className={selectClassName}
                  control={smtpForm.control}
                  disabled={updateSmtpSettingsMutation.isPending}
                  name="security"
                  options={smtpSecurityOptions.map((security) => ({
                    label: formatSmtpSecurity(security),
                    value: security,
                  }))}
                />
              </label>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm">
              <FieldLabel>From email</FieldLabel>
              <ControlledInput
                aria-invalid={Boolean(smtpErrors.fromEmail)}
                autoComplete="email"
                control={smtpForm.control}
                disabled={updateSmtpSettingsMutation.isPending}
                name="fromEmail"
                placeholder="noreply@company.com"
                type="email"
              />
              <FieldError>{smtpErrors.fromEmail?.message}</FieldError>
            </label>

            <label className="block text-sm">
              <FieldLabel>From name</FieldLabel>
              <ControlledInput
                aria-invalid={Boolean(smtpErrors.fromName)}
                control={smtpForm.control}
                disabled={updateSmtpSettingsMutation.isPending}
                name="fromName"
                placeholder="Tabliodb"
              />
              <FieldError>{smtpErrors.fromName?.message}</FieldError>
            </label>

            <label className="block text-sm md:col-span-2">
              <FieldLabel>Reply-to email</FieldLabel>
              <ControlledInput
                aria-invalid={Boolean(smtpErrors.replyToEmail)}
                autoComplete="email"
                control={smtpForm.control}
                disabled={updateSmtpSettingsMutation.isPending}
                name="replyToEmail"
                placeholder="support@company.com"
                type="email"
              />
              <FieldError>{smtpErrors.replyToEmail?.message}</FieldError>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm">
              <FieldLabel>Username</FieldLabel>
              <ControlledInput
                aria-invalid={Boolean(smtpErrors.username)}
                autoComplete="username"
                control={smtpForm.control}
                disabled={updateSmtpSettingsMutation.isPending}
                name="username"
                placeholder="mailer"
              />
              <FieldError>{smtpErrors.username?.message}</FieldError>
            </label>

            <label className="block text-sm">
              <FieldLabel>Password</FieldLabel>
              <ControlledInput
                aria-invalid={Boolean(smtpErrors.password)}
                autoComplete="new-password"
                control={smtpForm.control}
                disabled={updateSmtpSettingsMutation.isPending}
                name="password"
                placeholder={
                  smtpSettingsQuery.data.passwordConfigured
                    ? 'Leave blank to keep the current password'
                    : 'Paste SMTP password'
                }
                type="password"
              />
              <FieldError>{smtpErrors.password?.message}</FieldError>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label
              className={cn(
                'flex items-start gap-3 rounded-[var(--tabliodb-radius-md)] border p-3',
                smtpSettingsQuery.data.passwordConfigured
                  ? 'cursor-pointer border-[rgb(var(--tabliodb-border))] bg-white'
                  : 'cursor-not-allowed border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] opacity-70',
              )}
            >
              <ControlledCheckbox
                aria-label="Clear existing SMTP password"
                control={smtpForm.control}
                disabled={!smtpSettingsQuery.data.passwordConfigured || updateSmtpSettingsMutation.isPending}
                name="clearPassword"
              />
              <span>
                <span className="block text-sm font-extrabold">Clear stored password</span>
                <span className="block text-xs font-bold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
                  Use this when rotating away from an old mail credential.
                </span>
              </span>
            </label>

            <div className="flex items-start gap-3 rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-border))] bg-white p-3">
              <div className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]">
                <Send className="size-3.5" />
              </div>
              <div>
                <span className="block text-sm font-extrabold">Delivery boundary ready</span>
                <span className="block text-xs font-bold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
                  Mail sending can consume this config later without exposing secrets to the browser.
                </span>
              </div>
            </div>
          </div>

          {updateSmtpSettingsMutation.error ? (
            <InlineErrorState error={updateSmtpSettingsMutation.error} title="Could not save SMTP settings" />
          ) : null}
        </Surface>

        <div className="flex justify-end">
          <Button disabled={updateSmtpSettingsMutation.isPending || !smtpForm.formState.isDirty} type="submit">
            {updateSmtpSettingsMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save SMTP settings
          </Button>
        </div>
      </form>
    </div>
  );
}

function SettingsHeader({ description, title }: { description: string; title: string }) {
  return (
    <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h2 className="text-2xl font-extrabold tracking-normal text-[rgb(var(--tabliodb-ink))]">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm font-semibold text-[rgb(var(--tabliodb-ink-muted))]">{description}</p>
      </div>
    </section>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
      {children}
    </span>
  );
}

function SecretStatus({ configured, updatedAt }: { configured: boolean; updatedAt: string | null }) {
  if (!configured) {
    return <Badge variant="yellow">Secret missing</Badge>;
  }

  return (
    <Badge className="gap-1" variant="green">
      <CheckCircle2 className="size-3" />
      Secret saved{updatedAt ? ` ${formatDate(updatedAt)}` : ''}
    </Badge>
  );
}

function parseAllowedDomainsText(value: string): string[] {
  const domains = value
    .split(/[\n,]+/)
    .map((domain) => domain.trim().toLowerCase().replace(/^@+/, ''))
    .filter(Boolean);

  return [...new Set(domains)].sort();
}

function parseScopesText(value: string): string[] {
  const scopes = value
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

  return [...new Set(scopes)];
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parsePortText(value: string): number | null {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const port = Number(trimmed);

  return Number.isInteger(port) && port >= 1 && port <= 65_535 ? port : null;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function formatSmtpSecurity(security: SmtpSecurity): string {
  return {
    none: 'None',
    starttls: 'StartTLS',
    tls: 'TLS',
  }[security];
}

function toSmtpSecurity(value: string): SmtpSecurity {
  if (value === SmtpSecurity.None || value === SmtpSecurity.Tls) {
    return value;
  }

  return SmtpSecurity.Starttls;
}

function createAutoJoinWorkspaceOptions(
  configuredOrganizationId: string | null,
  organizations: OrganizationDtoOutput[],
) {
  const options = [
    {
      label: 'Do not auto-join',
      value: oidcAutoJoinNoneValue,
    },
    ...organizations.map((organization) => ({
      label: organization.name,
      value: organization.id,
    })),
  ];

  if (configuredOrganizationId && !organizations.some((organization) => organization.id === configuredOrganizationId)) {
    // A stale/inaccessible mapping is still shown so the admin can intentionally clear or replace it.
    options.push({
      label: `Configured workspace (${configuredOrganizationId.slice(0, 8)})`,
      value: configuredOrganizationId,
    });
  }

  return options;
}

function formatAutoJoinRole(role: AutoJoinOrganizationRole): string {
  return {
    guest: 'Guest',
    member: 'Member',
  }[role];
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
