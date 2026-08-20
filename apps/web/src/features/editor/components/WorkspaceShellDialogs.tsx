import { zodResolver } from '@hookform/resolvers/zod';
import { type DatabaseDialect } from '@tabliodb/schema-core';
import {
  Dialect as SdkDialect,
  type DiagramResponseDtoOutput,
  type OrganizationDtoOutput,
  type ProjectResponseDtoOutput,
} from '@tabliodb/sdk';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FieldError,
} from '@tabliodb/ui';
import { Building2, FileText, FolderPlus, Loader2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ControlledInput, ControlledSelect, ControlledTextarea } from '@/features/app/FormControls';
import { getErrorMessage } from '@/features/app/RouteStates';
import { defaultDiagramName, useCreateDiagramMutation, useCreateWorkspaceDiagramMutation } from '@/resources/diagrams';
import { useCreateOrganizationMutation } from '@/resources/organizations';
import { useCreateProjectMutation } from '@/resources/projects';
import { formatDiagramDialect } from '../diagram-formatters';

type DiagramResponseDto = DiagramResponseDtoOutput;
type OrganizationDto = OrganizationDtoOutput;
type ProjectResponseDto = ProjectResponseDtoOutput;

const diagramDialectOptions = [
  'postgresql',
  'mysql',
  'sqlite',
  'mariadb',
  'sqlserver',
] as const satisfies readonly DatabaseDialect[];

const sdkDialectByValue: Record<DatabaseDialect, SdkDialect> = {
  mariadb: SdkDialect.Mariadb,
  mysql: SdkDialect.Mysql,
  postgresql: SdkDialect.Postgresql,
  sqlite: SdkDialect.Sqlite,
  sqlserver: SdkDialect.Sqlserver,
};

const workspaceCreateFormSchema = z.object({
  name: z.string().trim().min(1, 'Workspace name is required.').max(80, 'Keep the workspace name under 80 characters.'),
});

type WorkspaceCreateFormState = z.infer<typeof workspaceCreateFormSchema>;

const projectCreateFormSchema = z.object({
  description: z.string().trim().max(240, 'Keep the description under 240 characters.').optional(),
  name: z.string().trim().min(1, 'Project name is required.').max(80, 'Keep the name under 80 characters.'),
});

type ProjectCreateFormState = z.infer<typeof projectCreateFormSchema>;

const diagramCreateFormSchema = z.object({
  dialect: z.enum(diagramDialectOptions),
  name: z.string().trim().min(1, 'Diagram name is required.').max(80, 'Keep the name under 80 characters.'),
});

type DiagramCreateFormState = z.infer<typeof diagramCreateFormSchema>;

export function CreateWorkspaceDialog({
  onCreated,
  onOpenChange,
  open,
  trigger,
}: {
  onCreated: (organization: OrganizationDto) => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  trigger?: ReactNode | null;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const dialogOpen = open ?? internalOpen;
  const form = useForm<WorkspaceCreateFormState>({
    defaultValues: {
      name: '',
    },
    mode: 'onBlur',
    resolver: zodResolver(workspaceCreateFormSchema),
  });
  const { errors } = form.formState;

  const createWorkspaceMutation = useCreateOrganizationMutation({
    mutationConfig: {
      onSuccess: (organization) => {
        // Workspace creation switches context immediately so the next expected action can be creating a diagram directly.
        form.reset({ name: '' });
        handleOpenChange(false);
        onCreated(organization);
      },
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);

    if (!nextOpen && !createWorkspaceMutation.isPending) {
      form.reset({ name: '' });
      createWorkspaceMutation.reset();
    }
  }

  function handleSubmit(values: WorkspaceCreateFormState) {
    createWorkspaceMutation.mutate({
      name: values.name,
    });
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={dialogOpen}>
      {trigger !== null ? (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="sm" variant="secondary">
              <Building2 className="size-4" />
              Workspace
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent className="w-[min(94vw,520px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>Create a place for teams, projects, members, and governance settings.</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Workspace name
              </span>
              <ControlledInput
                autoFocus
                aria-invalid={Boolean(errors.name)}
                control={form.control}
                disabled={createWorkspaceMutation.isPending}
                name="name"
                placeholder="Data Platform"
              />
              <FieldError>{errors.name?.message}</FieldError>
            </label>

            {createWorkspaceMutation.error ? (
              <div className="mt-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                {getErrorMessage(createWorkspaceMutation.error)}
              </div>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button
              disabled={createWorkspaceMutation.isPending}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button disabled={createWorkspaceMutation.isPending} type="submit">
              {createWorkspaceMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Building2 className="size-4" />
              )}
              Create workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateProjectDialog({
  onCreated,
  onOpenChange,
  open,
  organizationId,
  trigger,
}: {
  onCreated: (project: ProjectResponseDto) => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  organizationId: string | null;
  trigger?: ReactNode | null;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const dialogOpen = open ?? internalOpen;
  const form = useForm<ProjectCreateFormState>({
    defaultValues: {
      description: '',
      name: '',
    },
    mode: 'onBlur',
    resolver: zodResolver(projectCreateFormSchema),
  });
  const { errors } = form.formState;

  const createProjectMutation = useCreateProjectMutation({
    mutationConfig: {
      onSuccess: (project) => {
        // New project langsung dinavigasikan agar user merasa aksi create menghasilkan workspace yang nyata.
        form.reset({ description: '', name: '' });
        handleOpenChange(false);
        onCreated(project);
      },
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);

    if (!nextOpen && !createProjectMutation.isPending) {
      form.reset({ description: '', name: '' });
      createProjectMutation.reset();
    }
  }

  function handleSubmit(values: ProjectCreateFormState) {
    if (!organizationId) {
      return;
    }

    createProjectMutation.mutate({
      description: toOptionalDescription(values.description),
      name: values.name,
      organizationId,
    });
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={dialogOpen}>
      {trigger !== null ? (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button disabled={!organizationId} size="sm" variant="secondary">
              <FolderPlus className="size-4" />
              Folder
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent className="w-[min(94vw,520px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>New project folder</DialogTitle>
            <DialogDescription>Group related diagrams for one app, service, product area, or client.</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="grid gap-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Folder name
                </span>
                <ControlledInput
                  autoFocus
                  aria-invalid={Boolean(errors.name)}
                  control={form.control}
                  disabled={!organizationId || createProjectMutation.isPending}
                  name="name"
                  placeholder="Library System"
                />
                <FieldError>{errors.name?.message}</FieldError>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Description
                </span>
                <ControlledTextarea
                  aria-invalid={Boolean(errors.description)}
                  className="min-h-24 w-full resize-none rounded-2xl border-2 border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 py-2 text-sm font-semibold outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
                  control={form.control}
                  disabled={!organizationId || createProjectMutation.isPending}
                  name="description"
                  placeholder="Diagrams for the main database, reporting schema, or future redesign."
                />
                <FieldError>{errors.description?.message}</FieldError>
              </label>

              {createProjectMutation.error ? (
                <div className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                  {getErrorMessage(createProjectMutation.error)}
                </div>
              ) : null}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              disabled={createProjectMutation.isPending}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button disabled={!organizationId || createProjectMutation.isPending} type="submit">
              {createProjectMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FolderPlus className="size-4" />
              )}
              Create folder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateDiagramDialog({
  defaultDialect,
  onCreated,
  onOpenChange,
  open,
  organizationId,
  projectId,
  trigger,
}: {
  defaultDialect: DatabaseDialect;
  onCreated: (diagram: DiagramResponseDto) => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  organizationId: string | null;
  projectId: string | null;
  trigger?: ReactNode | null;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const dialogOpen = open ?? internalOpen;
  const canCreateInContext = Boolean(projectId || organizationId);
  const form = useForm<DiagramCreateFormState>({
    defaultValues: {
      dialect: defaultDialect,
      name: '',
    },
    mode: 'onBlur',
    resolver: zodResolver(diagramCreateFormSchema),
  });
  const { errors } = form.formState;
  const createWorkspaceDiagramMutation = useCreateWorkspaceDiagramMutation({
    mutationConfig: {
      onSuccess: (diagram) => {
        // Workspace-level diagram creation has the same UX contract as project-level creation: close and open the new ERD.
        form.reset({ dialect: defaultDialect, name: '' });
        handleOpenChange(false);
        onCreated(diagram);
      },
    },
  });

  useEffect(() => {
    if (dialogOpen) {
      // Opening the dialog should respect the current diagram dialect but keep the name intentionally blank.
      form.reset({ dialect: defaultDialect, name: '' });
    }
  }, [defaultDialect, dialogOpen, form]);

  const createDiagramMutation = useCreateDiagramMutation({
    mutationConfig: {
      onSuccess: (diagram) => {
        // New diagram becomes the active route; the editor will create its first snapshot through the existing snapshot flow.
        form.reset({ dialect: defaultDialect, name: '' });
        handleOpenChange(false);
        onCreated(diagram);
      },
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);

    if (!nextOpen && !createDiagramMutation.isPending && !createWorkspaceDiagramMutation.isPending) {
      form.reset({ dialect: defaultDialect, name: '' });
      createDiagramMutation.reset();
      createWorkspaceDiagramMutation.reset();
    }
  }

  async function handleSubmit(values: DiagramCreateFormState) {
    if (!canCreateInContext) {
      return;
    }

    try {
      if (!projectId) {
        await createWorkspaceDiagramMutation.mutateAsync({
          body: {
            dialect: sdkDialectByValue[values.dialect],
            name: values.name,
          },
          // Workspace-level creation lets the server create or reuse the hidden General backing folder atomically.
          organizationId: organizationId!,
        });

        return;
      }

      await createDiagramMutation.mutateAsync({
        dialect: sdkDialectByValue[values.dialect],
        name: values.name,
        // Diagram tetap milik workspace walau diletakkan di folder tertentu.
        organizationId: organizationId!,
        projectId,
      });
    } catch {
      // React Query keeps the failed mutation in state; the dialog renders that message without throwing into react-hook-form.
    }
  }

  const isCreatingDiagram = createDiagramMutation.isPending || createWorkspaceDiagramMutation.isPending;
  const createDiagramError = createDiagramMutation.error ?? createWorkspaceDiagramMutation.error;

  return (
    <Dialog onOpenChange={handleOpenChange} open={dialogOpen}>
      {trigger !== null ? (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button disabled={!canCreateInContext} size="sm" variant="secondary">
              <FileText className="size-4" />
              Diagram
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent className="w-[min(94vw,520px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>New database diagram</DialogTitle>
            <DialogDescription>
              Name the ERD and choose its SQL dialect. Folder organization can wait until the diagram list gets busy.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="grid gap-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Diagram name
                </span>
                <ControlledInput
                  autoFocus
                  aria-invalid={Boolean(errors.name)}
                  control={form.control}
                  disabled={!canCreateInContext || isCreatingDiagram}
                  name="name"
                  placeholder={defaultDiagramName}
                />
                <FieldError>{errors.name?.message}</FieldError>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Database dialect
                </span>
                <ControlledSelect
                  aria-invalid={Boolean(errors.dialect)}
                  control={form.control}
                  disabled={!canCreateInContext || isCreatingDiagram}
                  name="dialect"
                  options={diagramDialectOptions.map((dialect) => ({
                    label: formatDiagramDialect(dialect),
                    value: dialect,
                  }))}
                />
                <FieldError>{errors.dialect?.message}</FieldError>
              </label>

              {!projectId ? (
                <div className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                  This diagram will be created in the current workspace. Tabliodb keeps the backing folder tidy automatically.
                </div>
              ) : null}

              {createDiagramError ? (
                <div className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                  {getErrorMessage(createDiagramError)}
                </div>
              ) : null}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              disabled={isCreatingDiagram}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button disabled={!canCreateInContext || isCreatingDiagram} type="submit">
              {isCreatingDiagram ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
              Create diagram
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toOptionalDescription(value: string | undefined): string | undefined {
  const description = value?.trim();
  return description ? description : undefined;
}
