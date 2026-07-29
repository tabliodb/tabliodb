import { zodResolver } from '@hookform/resolvers/zod';
import { Button, FieldError, Surface } from '@tabliodb/ui';
import { Database, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { routes } from '@/app/routes';
import { ControlledInput } from '@/features/app/FormControls';
import { getErrorMessage } from '@/features/app/RouteStates';
import { useCompleteSetupMutation } from '@/resources/setup';

const setupFormSchema = z.object({
  ownerEmail: z.string().trim().email('Enter a valid owner email.'),
  ownerName: z.string().trim().min(1, 'Owner name is required.'),
  ownerPassword: z.string().min(8, 'Password must be at least 8 characters.'),
  publicUrl: z.string().trim().refine(isOptionalUrl, 'Enter a valid public URL.'),
  workspaceName: z.string().trim().min(1, 'Workspace name is required.'),
});

type SetupFormState = z.infer<typeof setupFormSchema>;

function getSetupDefaults(): SetupFormState {
  return {
    ownerEmail: 'owner@tabliodb.local',
    ownerName: 'Tabliodb Owner',
    ownerPassword: 'tabliodb-dev',
    publicUrl: typeof window === 'undefined' ? '' : window.location.origin,
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
  const form = useForm<SetupFormState>({
    defaultValues: getSetupDefaults(),
    mode: 'onBlur',
    resolver: zodResolver(setupFormSchema),
  });
  const { errors } = form.formState;

  const setupMutation = useCompleteSetupMutation({
    mutationConfig: {
      onSuccess: () => {
        // Setelah owner/workspace pertama dibuat, editor branch loader akan mengambil project starter yang valid.
        navigate(routes.home.to(), { replace: true });
      },
    },
  });

  return (
    <main className="grid min-h-screen place-items-center bg-[rgb(var(--tabliodb-surface))] px-6 py-10 text-[rgb(var(--tabliodb-ink))]">
      <Surface className="w-full max-w-lg p-5" depth="md">
        <form
          onSubmit={form.handleSubmit((values) =>
            setupMutation.mutate({
              ownerEmail: values.ownerEmail,
              ownerName: values.ownerName,
              ownerPassword: values.ownerPassword,
              publicUrl: values.publicUrl.trim() || undefined,
              workspaceName: values.workspaceName,
            }),
          )}
        >
          <div className="mb-5 flex items-center gap-2">
            <div className="grid size-10 place-items-center rounded-2xl bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]">
              <Database className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold">Tabliodb</h1>
              <p className="text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">Set up this instance</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Owner name
              </span>
              <ControlledInput
                aria-invalid={Boolean(errors.ownerName)}
                autoComplete="name"
                control={form.control}
                disabled={setupMutation.isPending}
                name="ownerName"
              />
              <FieldError>{errors.ownerName?.message}</FieldError>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Owner email
              </span>
              <ControlledInput
                aria-invalid={Boolean(errors.ownerEmail)}
                autoComplete="email"
                control={form.control}
                disabled={setupMutation.isPending}
                name="ownerEmail"
                type="email"
              />
              <FieldError>{errors.ownerEmail?.message}</FieldError>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Password
              </span>
              <ControlledInput
                aria-invalid={Boolean(errors.ownerPassword)}
                autoComplete="new-password"
                control={form.control}
                disabled={setupMutation.isPending}
                name="ownerPassword"
                type="password"
              />
              <FieldError>{errors.ownerPassword?.message}</FieldError>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Workspace
              </span>
              <ControlledInput
                aria-invalid={Boolean(errors.workspaceName)}
                autoComplete="organization"
                control={form.control}
                disabled={setupMutation.isPending}
                name="workspaceName"
              />
              <FieldError>{errors.workspaceName?.message}</FieldError>
            </label>
          </div>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Public URL
            </span>
            <ControlledInput
              aria-invalid={Boolean(errors.publicUrl)}
              autoComplete="url"
              control={form.control}
              disabled={setupMutation.isPending}
              name="publicUrl"
              type="url"
            />
            <FieldError>{errors.publicUrl?.message}</FieldError>
          </label>
          {setupMutation.error ? (
            <div className="mt-4 rounded-[14px] border-2 border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              {getErrorMessage(setupMutation.error)}
            </div>
          ) : null}
          <Button className="mt-5 w-full gap-2" disabled={setupMutation.isPending} type="submit">
            {setupMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
            Create owner and workspace
          </Button>
        </form>
      </Surface>
    </main>
  );
}
