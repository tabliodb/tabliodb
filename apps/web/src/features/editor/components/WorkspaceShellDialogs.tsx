import { zodResolver } from '@hookform/resolvers/zod';
import { type DatabaseDialect } from '@tabliodb/schema-core';
import {
  Dialect as SdkDialect,
  type DiagramResponseDtoOutput,
  type OrganizationDtoOutput,
  type FolderResponseDtoOutput,
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
import { useCreateFolderMutation } from '@/resources/folders';
import { getDialectSelectOption } from './DialectIcon';

type DiagramResponseDto = DiagramResponseDtoOutput;
type OrganizationDto = OrganizationDtoOutput;
type FolderResponseDto = FolderResponseDtoOutput;
const rootDiagramLocationValue = '__workspace_root__';

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

const folderCreateFormSchema = z.object({
  description: z.string().trim().max(240, 'Keep the description under 240 characters.').optional(),
  name: z.string().trim().min(1, 'Folder name is required.').max(80, 'Keep the name under 80 characters.'),
});

type FolderCreateFormState = z.infer<typeof folderCreateFormSchema>;

const diagramCreateFormSchema = z.object({
  dialect: z.enum(diagramDialectOptions),
  folderId: z.string().min(1, 'Choose where this diagram should live.'),
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
            <DialogDescription>Create a place for diagrams, optional folders, teams, and members.</DialogDescription>
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

export function CreateFolderDialog({
  onCreated,
  onOpenChange,
  open,
  organizationId,
  trigger,
}: {
  onCreated: (folder: FolderResponseDto) => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  organizationId: string | null;
  trigger?: ReactNode | null;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const dialogOpen = open ?? internalOpen;
  const form = useForm<FolderCreateFormState>({
    defaultValues: {
      description: '',
      name: '',
    },
    mode: 'onBlur',
    resolver: zodResolver(folderCreateFormSchema),
  });
  const { errors } = form.formState;

  const createFolderMutation = useCreateFolderMutation({
    mutationConfig: {
      onSuccess: (folder) => {
        // Folder creation updates the folder list; the current canvas should stay focused on the open diagram.
        form.reset({ description: '', name: '' });
        handleOpenChange(false);
        onCreated(folder);
      },
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);

    if (!nextOpen && !createFolderMutation.isPending) {
      form.reset({ description: '', name: '' });
      createFolderMutation.reset();
    }
  }

  function handleSubmit(values: FolderCreateFormState) {
    if (!organizationId) {
      return;
    }

    createFolderMutation.mutate({
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
            <DialogTitle>New folder</DialogTitle>
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
                  disabled={!organizationId || createFolderMutation.isPending}
                  name="name"
                  placeholder="Backend schema"
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
                  disabled={!organizationId || createFolderMutation.isPending}
                  name="description"
                  placeholder="Diagrams for the main database, reporting schema, or future redesign."
                />
                <FieldError>{errors.description?.message}</FieldError>
              </label>

              {createFolderMutation.error ? (
                <div className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                  {getErrorMessage(createFolderMutation.error)}
                </div>
              ) : null}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              disabled={createFolderMutation.isPending}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button disabled={!organizationId || createFolderMutation.isPending} type="submit">
              {createFolderMutation.isPending ? (
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
  defaultFolderId,
  onCreated,
  onOpenChange,
  open,
  organizationId,
  folders = [],
  trigger,
}: {
  defaultDialect: DatabaseDialect;
  defaultFolderId?: string | null;
  onCreated: (diagram: DiagramResponseDto) => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  organizationId: string | null;
  folders?: FolderResponseDto[];
  trigger?: ReactNode | null;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const dialogOpen = open ?? internalOpen;
  const canCreateInContext = Boolean(organizationId);
  const selectedDefaultFolderId =
    defaultFolderId && folders.some((folder) => folder.id === defaultFolderId)
      ? defaultFolderId
      : rootDiagramLocationValue;
  const form = useForm<DiagramCreateFormState>({
    defaultValues: {
      dialect: defaultDialect,
      name: '',
      folderId: selectedDefaultFolderId,
    },
    mode: 'onBlur',
    resolver: zodResolver(diagramCreateFormSchema),
  });
  const { errors } = form.formState;
  const createWorkspaceDiagramMutation = useCreateWorkspaceDiagramMutation({
    mutationConfig: {
      onSuccess: (diagram) => {
        // Workspace-level diagram creation has the same UX contract as folder-level creation: close and open the new ERD.
        form.reset({ dialect: defaultDialect, name: '', folderId: selectedDefaultFolderId });
        handleOpenChange(false);
        onCreated(diagram);
      },
    },
  });

  useEffect(() => {
    if (dialogOpen) {
      // Opening the dialog respects the active dialect and the folder filter selected in the diagram library.
      form.reset({ dialect: defaultDialect, name: '', folderId: selectedDefaultFolderId });
    }
  }, [defaultDialect, dialogOpen, form, selectedDefaultFolderId]);

  const createDiagramMutation = useCreateDiagramMutation({
    mutationConfig: {
      onSuccess: (diagram) => {
        // New diagram becomes an empty unsaved draft; the first persisted saved version is created only when the user clicks Save.
        form.reset({ dialect: defaultDialect, name: '', folderId: selectedDefaultFolderId });
        handleOpenChange(false);
        onCreated(diagram);
      },
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);

    if (!nextOpen && !createDiagramMutation.isPending && !createWorkspaceDiagramMutation.isPending) {
      form.reset({ dialect: defaultDialect, name: '', folderId: selectedDefaultFolderId });
      createDiagramMutation.reset();
      createWorkspaceDiagramMutation.reset();
    }
  }

  async function handleSubmit(values: DiagramCreateFormState) {
    if (!canCreateInContext) {
      return;
    }

    try {
      const selectedFolderId = values.folderId === rootDiagramLocationValue ? null : values.folderId;

      if (!selectedFolderId) {
        await createWorkspaceDiagramMutation.mutateAsync({
          body: {
            dialect: sdkDialectByValue[values.dialect],
            name: values.name,
          },
          organizationId: organizationId!,
        });

        return;
      }

      await createDiagramMutation.mutateAsync({
        dialect: sdkDialectByValue[values.dialect],
        name: values.name,
        // Diagram tetap milik workspace; folderId hanya metadata folder opsional untuk organisasi daftar.
        organizationId: organizationId!,
        folderId: selectedFolderId,
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
                  options={diagramDialectOptions.map(getDialectSelectOption)}
                />
                <FieldError>{errors.dialect?.message}</FieldError>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Location
                </span>
                <ControlledSelect
                  aria-invalid={Boolean(errors.folderId)}
                  control={form.control}
                  disabled={!canCreateInContext || isCreatingDiagram}
                  name="folderId"
                  options={[
                    {
                      label: 'No folder',
                      value: rootDiagramLocationValue,
                    },
                    ...folders.map((folder) => ({
                      label: folder.name,
                      value: folder.id,
                    })),
                  ]}
                />
                <FieldError>{errors.folderId?.message}</FieldError>
                <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                  Folders are optional. Choose one only when this diagram should be grouped with related ERDs.
                </p>
              </label>

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
              {isCreatingDiagram ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
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
