import { zodResolver } from '@hookform/resolvers/zod';
import { Button, FieldError, Surface, type InputProps, cn } from '@tabliodb/ui';
import { ArrowLeft, ArrowRight, CheckCircle2, Database, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm, type SubmitErrorHandler } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { routes } from '@/app/routes';
import { ControlledInput } from '@/features/app/FormControls';
import { InlineErrorState } from '@/features/app/RouteStates';
import { useCompleteSetupMutation } from '@/resources/setup';
import LOGO from '@/assets/logo.svg';

const setupFormSchema = z.object({
  ownerEmail: z.email('Enter a valid owner email.'),
  ownerName: z.string().trim().min(1, 'Owner name is required.'),
  ownerPassword: z.string().min(8, 'Password must be at least 8 characters.'),
  publicUrl: z.string().trim().refine(isOptionalUrl, 'Enter a valid public URL.'),
  workspaceName: z.string().trim().min(1, 'Workspace name is required.'),
});

type SetupFormState = z.infer<typeof setupFormSchema>;
type SetupFieldName = keyof SetupFormState;
type SetupStep = {
  autoComplete: string;
  description: string;
  helper: string;
  label: string;
  name: SetupFieldName;
  placeholder: string;
  title: string;
  type?: InputProps['type'];
};

const setupSteps: readonly SetupStep[] = [
  {
    autoComplete: 'name',
    description: 'This account becomes the first instance owner and can manage users, auth settings, and workspaces.',
    helper: 'Use a real person name so audit logs stay readable later.',
    label: 'Your name',
    name: 'ownerName',
    placeholder: 'Tabliodb Owner',
    title: 'Who will own this instance?',
  },
  {
    autoComplete: 'email',
    description: 'This email is used to sign in and receive future admin-related messages.',
    helper: 'For self-hosting, prefer an email that belongs to your team or company.',
    label: 'Your email',
    name: 'ownerEmail',
    placeholder: 'owner@company.com',
    title: 'Where should the owner sign in?',
    type: 'email',
  },
  {
    autoComplete: 'new-password',
    description: 'Create the first password for the owner account. You can rotate it later from user management.',
    helper: 'Use at least 8 characters. A password manager is the tidy path here.',
    label: 'Your password',
    name: 'ownerPassword',
    placeholder: 'Minimum 8 characters',
    title: 'Secure the owner account',
    type: 'password',
  },
  {
    autoComplete: 'organization',
    description: 'A workspace groups users, projects, teams, diagrams, and access policy.',
    helper: 'This does not rename the product. The app stays TablioDB; this only names the first workspace.',
    label: 'Workspace name',
    name: 'workspaceName',
    placeholder: 'Personal Workspace',
    title: 'Name the first workspace',
  },
  {
    autoComplete: 'url',
    description: 'TablioDB uses this URL to build links such as invitations and password recovery.',
    helper: 'Use your real HTTPS domain.',
    label: 'Public URL',
    name: 'publicUrl',
    placeholder: 'https://tabliodb.company.com',
    title: 'What URL will people use?',
    type: 'url',
  },
];

const totalStepCount = setupSteps.length + 1;

function getSetupDefaults(): SetupFormState {
  return {
    ownerEmail: '',
    ownerName: '',
    ownerPassword: '',
    publicUrl: '',
    workspaceName: 'Personal Workspace',
  };
}

function isOptionalUrl(value: string): boolean {
  if (value.length === 0) {
    return true;
  }

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function SetupPage() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const form = useForm<SetupFormState>({
    defaultValues: getSetupDefaults(),
    mode: 'onBlur',
    resolver: zodResolver(setupFormSchema),
  });
  const { errors } = form.formState;
  const values = form.watch();
  const isReviewStep = stepIndex === setupSteps.length;
  const currentStep = isReviewStep ? null : setupSteps[stepIndex];
  const progressPercent = Math.round(((stepIndex + 1) / totalStepCount) * 100);
  const setupMutation = useCompleteSetupMutation({
    mutationConfig: {
      onSuccess: () => {
        // Setelah owner/workspace pertama dibuat, editor branch loader akan mengambil project starter yang valid.
        navigate(routes.home.to(), { replace: true });
      },
    },
  });
  const reviewItems = useMemo(
    () => [
      { label: 'Owner', value: values.ownerName || 'Not set' },
      { label: 'Email', value: values.ownerEmail || 'Not set' },
      { label: 'Password', value: values.ownerPassword ? 'Hidden after setup' : 'Not set' },
      { label: 'Workspace', value: values.workspaceName || 'Not set' },
      { label: 'Public URL', value: values.publicUrl || 'Server default' },
    ],
    [values.ownerEmail, values.ownerName, values.ownerPassword, values.publicUrl, values.workspaceName],
  );

  async function handlePrimaryAction() {
    if (!isReviewStep && currentStep) {
      // Wizard validates only the current field on Next, so users fix one clear problem at a time.
      const isStepValid = await form.trigger(currentStep.name, { shouldFocus: true });

      if (!isStepValid) {
        return;
      }

      setStepIndex((current) => Math.min(current + 1, totalStepCount - 1));
      return;
    }

    await form.handleSubmit(handleSubmit, handleInvalidSubmit)();
  }

  function handleBack() {
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  function handleSubmit(valuesToSubmit: SetupFormState) {
    setupMutation.mutate({
      ownerEmail: valuesToSubmit.ownerEmail,
      ownerName: valuesToSubmit.ownerName,
      ownerPassword: valuesToSubmit.ownerPassword,
      publicUrl: valuesToSubmit.publicUrl.trim() || undefined,
      workspaceName: valuesToSubmit.workspaceName,
    });
  }

  const handleInvalidSubmit: SubmitErrorHandler<SetupFormState> = (invalidFields) => {
    const firstInvalidStepIndex = setupSteps.findIndex((step) => Boolean(invalidFields[step.name]));

    // Final review can still catch stale invalid fields if a browser autofill or edit changed a previous value.
    if (firstInvalidStepIndex >= 0) {
      setStepIndex(firstInvalidStepIndex);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[rgb(var(--tabliodb-surface))] px-4 py-8 text-[rgb(var(--tabliodb-ink))] sm:px-6">
      <Surface className="grid w-full max-w-5xl overflow-hidden p-0 md:grid-cols-[320px_minmax(0,1fr)]" depth="md">
        <aside className="border-b border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] p-5 md:border-b-0 md:border-r">
          <div className="flex items-center gap-3">
            <img src={LOGO} alt="Tabliodb Logo" className="w-28" />
          </div>

          <div className="mt-7">
            <div className="mb-2 flex items-center justify-between text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
              <span>
                Step {stepIndex + 1} of {totalStepCount}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full border border-[rgb(var(--tabliodb-primary-border))] bg-white">
              <div
                className="h-full rounded-full bg-[rgb(var(--tabliodb-primary))] transition-[width]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <ol className="mt-6 grid gap-2">
            {setupSteps.map((step, index) => (
              <li
                className={cn(
                  'flex items-center gap-2 rounded-[var(--tabliodb-radius-md)] border px-3 py-2 text-xs font-extrabold transition',
                  index === stepIndex
                    ? 'border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary))] text-white'
                    : index < stepIndex
                      ? 'border-[rgb(var(--tabliodb-primary-border))] text-[rgb(var(--tabliodb-ink-muted))] opacity-60'
                      : 'border-transparent bg-white text-[rgb(var(--tabliodb-ink-muted))]',
                )}
                key={step.name}
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white">
                  {index < stepIndex ? (
                    <CheckCircle2 className="size-4 text-[rgb(var(--tabliodb-primary))]" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="min-w-0 truncate">{step.label}</span>
              </li>
            ))}
            <li
              className={cn(
                'flex items-center gap-2 rounded-[var(--tabliodb-radius-md)] border px-3 py-2 text-xs font-extrabold transition',
                isReviewStep
                  ? 'border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]'
                  : 'border-transparent bg-white text-[rgb(var(--tabliodb-ink-muted))]',
              )}
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white">
                {isReviewStep ? totalStepCount : <CheckCircle2 className="size-4" />}
              </span>
              <span>Review</span>
            </li>
          </ol>
        </aside>

        <form
          className="grid min-h-[520px] grid-rows-[1fr_auto] p-5 sm:p-7"
          onSubmit={(event) => {
            event.preventDefault();
            void handlePrimaryAction();
          }}
        >
          <section className="grid content-center gap-6">
            {currentStep ? (
              <div className="max-w-xl">
                <p className="text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-primary-text))]">
                  {currentStep.label}
                </p>
                <h2 className="mt-2 text-3xl font-extrabold leading-tight tracking-normal text-[rgb(var(--tabliodb-ink))]">
                  {currentStep.title}
                </h2>
                <p className="mt-3 text-sm font-semibold leading-6 text-[rgb(var(--tabliodb-ink-muted))]">
                  {currentStep.description}
                </p>

                <label className="mt-7 block">
                  <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                    {currentStep.label}
                  </span>
                  <ControlledInput
                    aria-invalid={Boolean(errors[currentStep.name])}
                    autoComplete={currentStep.autoComplete}
                    autoFocus
                    className="h-14 rounded-[18px] px-4 text-[16px] font-extrabold"
                    control={form.control}
                    disabled={setupMutation.isPending}
                    name={currentStep.name}
                    placeholder={currentStep.placeholder}
                    type={currentStep.type}
                  />
                  <FieldError>{errors[currentStep.name]?.message}</FieldError>
                </label>

                <p className="mt-3 rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] px-3 py-2 text-xs font-bold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
                  {currentStep.helper}
                </p>
              </div>
            ) : (
              <div className="max-w-xl">
                <p className="text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-primary-text))]">
                  Review
                </p>
                <h2 className="mt-2 text-3xl font-extrabold leading-tight tracking-normal text-[rgb(var(--tabliodb-ink))]">
                  Check the first owner and workspace
                </h2>
                <p className="mt-3 text-sm font-semibold leading-6 text-[rgb(var(--tabliodb-ink-muted))]">
                  This creates the first admin account, the first workspace, and the starter project used by the editor.
                </p>

                <div className="mt-7 grid gap-2">
                  {reviewItems.map((item) => (
                    <div
                      className="grid gap-1 rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] px-4 py-3 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center"
                      key={item.label}
                    >
                      <span className="text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                        {item.label}
                      </span>
                      <span className="min-w-0 truncate text-sm font-extrabold text-[rgb(var(--tabliodb-ink))]">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {setupMutation.error ? <InlineErrorState error={setupMutation.error} title="Setup failed" /> : null}
          </section>

          <footer className="mt-7 flex flex-col-reverse gap-3 border-t border-[rgb(var(--tabliodb-border))] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Button disabled={stepIndex === 0 || setupMutation.isPending} onClick={handleBack} variant="secondary">
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Button
              className="gap-2"
              disabled={setupMutation.isPending}
              type="submit"
              variant={isReviewStep ? 'primary' : 'sky'}
            >
              {setupMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isReviewStep ? (
                <Database className="size-4" />
              ) : (
                <ArrowRight className="size-4" />
              )}
              {isReviewStep ? 'Create owner and workspace' : 'Next'}
            </Button>
          </footer>
        </form>
      </Surface>
    </main>
  );
}
