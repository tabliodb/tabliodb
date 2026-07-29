import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DiagramModel } from '@tabliodb/schema-core';
import { TabliodbApiError, type ProjectResponseDto } from '@tabliodb/sdk';
import { generateCreateSchemaSql } from '@tabliodb/sql';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparatorItem,
  FieldError,
  DropdownMenuTrigger,
  IconButton,
  Input,
} from '@tabliodb/ui';
import {
  Archive,
  Database,
  FolderPlus,
  GitBranch,
  History,
  Loader2,
  LocateFixed,
  LogOut,
  MessageSquareText,
  MoreHorizontal,
  Play,
  Plus,
  Save,
  Search,
  Settings,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { routes } from '@/app/routes';
import { ControlledInput, ControlledTextarea } from '@/features/app/FormControls';
import { ErrorState, LoadingState, getErrorMessage } from '@/features/app/RouteStates';
import { useLogoutMutation } from '@/resources/auth';
import { defaultDiagramName, diagramsQueries } from '@/resources/diagrams';
import {
  defaultProjectName,
  projectsQueries,
  useArchiveProjectMutation,
  useCreateProjectMutation,
  useUpdateProjectMutation,
} from '@/resources/projects';
import { snapshotsQueries, useCreateSnapshotMutation } from '@/resources/snapshots';
import { addTableToDiagramModel, createSeedDiagramModel } from './diagram-model';
import { SchemaCanvas } from './components/SchemaCanvas';
import { SchemaInspector } from './components/SchemaInspector';

const addTableFormSchema = z.object({
  tableName: z.string().trim().max(64, 'Keep the table name under 64 characters.'),
});

type AddTableFormState = z.infer<typeof addTableFormSchema>;

const projectFormSchema = z.object({
  description: z.string().trim().max(240, 'Keep the description under 240 characters.').optional(),
  name: z.string().trim().min(1, 'Project name is required.').max(80, 'Keep the name under 80 characters.'),
});

type ProjectFormState = z.infer<typeof projectFormSchema>;

export function EditorPage() {
  const navigate = useNavigate();
  const params = useParams();
  const queryClient = useQueryClient();
  const [copiedSql, setCopiedSql] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  const [model, setModel] = useState<DiagramModel | null>(null);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  const projectsQuery = useQuery(projectsQueries.listOrCreateStarter());

  const projects = projectsQuery.data ?? [];
  const filteredProjects = useMemo(() => {
    const search = projectSearchTerm.trim().toLowerCase();

    return search
      ? projects.filter((project) =>
          [project.name, project.slug, project.description ?? ''].some((value) => value.toLowerCase().includes(search)),
        )
      : projects;
  }, [projectSearchTerm, projects]);
  const routeProjectId = params.projectId ?? null;
  const routeDiagramId = params.diagramId ?? null;
  const activeProject = projects.find((project) => project.id === routeProjectId) ?? projects[0] ?? null;

  const diagramsQuery = useQuery(diagramsQueries.listOrCreateStarter(activeProject));

  const diagrams = diagramsQuery.data ?? [];
  const activeDiagram = diagrams.find((diagram) => diagram.id === routeDiagramId) ?? diagrams[0] ?? null;

  const snapshotsQuery = useQuery(
    snapshotsQueries.listOrCreateInitial(activeDiagram, (diagram) => createSeedDiagramModel(diagram.name)),
  );

  const latestSnapshot = snapshotsQuery.data?.[0] ?? null;

  const saveSnapshotMutation = useCreateSnapshotMutation({
    mutationConfig: {
      onSuccess: (snapshot) => {
        setModel(snapshot.snapshot);
      },
    },
  });

  const logoutMutation = useLogoutMutation({
    mutationConfig: {
      onSuccess: () => {
        setModel(null);
        setSelectedTableId(null);
        navigate(routes.login.to(), { replace: true });
      },
    },
  });

  useEffect(() => {
    if (projects.length > 0 && (!routeProjectId || !projects.some((project) => project.id === routeProjectId))) {
      const project = projects[0];
      navigate(routes.project.to({ projectId: project.id, workspaceSlug: getWorkspaceSlug(project) }), {
        replace: true,
      });
    }
  }, [navigate, projects, routeProjectId]);

  useEffect(() => {
    if (
      activeProject &&
      diagrams.length > 0 &&
      (!routeDiagramId || !diagrams.some((diagram) => diagram.id === routeDiagramId))
    ) {
      const diagram = diagrams[0];
      navigate(
        routes.diagram.to({
          diagramId: diagram.id,
          projectId: activeProject.id,
          workspaceSlug: getWorkspaceSlug(activeProject),
        }),
        { replace: true },
      );
    }
  }, [activeProject, diagrams, navigate, routeDiagramId]);

  useEffect(() => {
    if (!latestSnapshot) {
      return;
    }

    setModel(latestSnapshot.snapshot);
    setSelectedTableId((current) => current ?? Object.keys(latestSnapshot.snapshot.tables)[0] ?? null);
  }, [latestSnapshot]);

  async function handleExportSql() {
    if (!model) {
      return;
    }

    await navigator.clipboard.writeText(generateCreateSchemaSql(model, { dialect: model.dialect }));
    setCopiedSql(true);
    window.setTimeout(() => setCopiedSql(false), 1600);
  }

  function handleAddTable(tableName?: string) {
    if (!model) {
      return;
    }

    const nextModel = addTableToDiagramModel(model, tableName);
    const nextTableId = Object.keys(nextModel.tables).find((tableId) => !model.tables[tableId]) ?? null;

    setModel(nextModel);
    setSelectedTableId(nextTableId);
  }

  if (isUnauthorized(projectsQuery.error)) {
    return <Navigate replace to={routes.login.to()} />;
  }

  const blockingError = projectsQuery.error ?? diagramsQuery.error ?? snapshotsQuery.error;

  if (blockingError) {
    return <ErrorState error={blockingError} onRetry={() => queryClient.invalidateQueries()} />;
  }

  const isLoadingWorkspace = projectsQuery.isPending || diagramsQuery.isPending || snapshotsQuery.isPending || !model;

  if (isLoadingWorkspace) {
    return <LoadingState />;
  }

  return (
    <main className="grid h-screen grid-cols-[272px_minmax(0,1fr)_332px] bg-[rgb(var(--tabliodb-surface))] text-[rgb(var(--tabliodb-ink))]">
      <aside className="border-r-2 border-[rgb(var(--tabliodb-border))] bg-white">
        <div className="flex h-16 items-center gap-3 border-b-2 border-[rgb(var(--tabliodb-border))] px-5">
          <div className="grid size-9 place-items-center rounded-2xl bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]">
            <Database className="size-5" />
          </div>
          <span className="text-base font-extrabold">Tabliodb</span>
        </div>
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Projects
            </span>
            <CreateProjectDialog
              onCreated={(project) => {
                setModel(null);
                setSelectedTableId(null);
                navigate(routes.project.to({ projectId: project.id, workspaceSlug: getWorkspaceSlug(project) }));
              }}
            />
          </div>
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--tabliodb-ink-subtle))]" />
            <Input
              className="pl-9"
              onChange={(event) => setProjectSearchTerm(event.target.value)}
              placeholder="Search projects"
              value={projectSearchTerm}
            />
          </div>
          {filteredProjects.length === 0 ? (
            <div className="rounded-[14px] border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-4 text-center text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
              No matching projects
            </div>
          ) : (
            <div className="space-y-1">
              {filteredProjects.map((project) => (
              <button
                className={`flex w-full cursor-pointer items-center justify-between rounded-[14px] border-2 px-3 py-2.5 text-left text-sm font-extrabold transition ${
                  project.id === activeProject?.id
                    ? 'border-[rgb(var(--tabliodb-primary))] bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))] shadow-[0_3px_0_rgb(var(--tabliodb-primary-border))]'
                    : 'border-transparent text-[rgb(var(--tabliodb-ink-muted))] hover:border-[rgb(var(--tabliodb-border))] hover:bg-[rgb(var(--tabliodb-surface))]'
                }`}
                key={project.id}
                onClick={() => {
                  setModel(null);
                  setSelectedTableId(null);
                  navigate(routes.project.to({ projectId: project.id, workspaceSlug: getWorkspaceSlug(project) }));
                }}
                type="button"
              >
                <span className="min-w-0 truncate">{project.name}</span>
                <span className="text-xs opacity-70">{project.slug}</span>
              </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-col">
        <header className="flex h-16 items-center justify-between border-b-2 border-[rgb(var(--tabliodb-border))] bg-white px-5">
          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold">{activeProject?.name ?? defaultProjectName}</h1>
            <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
              {activeDiagram?.name ?? defaultDiagramName} / {model.dialect} / snapshot v{latestSnapshot?.version ?? 0}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <IconButton icon={MessageSquareText} label="Comments" />
            <IconButton icon={History} label="History" />
            <IconButton icon={GitBranch} label="Branches" />
            <IconButton icon={LocateFixed} label="Fit diagram" onClick={() => setFitSignal((value) => value + 1)} />
            {activeProject ? (
              <ProjectSettingsDialog
                onArchived={() => {
                  setModel(null);
                  setSelectedTableId(null);
                  navigate(routes.home.to(), { replace: true });
                }}
                project={activeProject}
              />
            ) : null}
            <AddTableDialog onCreate={handleAddTable} />
            <Button
              className="gap-2"
              disabled={saveSnapshotMutation.isPending}
              onClick={() => {
                if (!activeDiagram || !model) {
                  return;
                }

                saveSnapshotMutation.mutate({
                  diagramId: activeDiagram.id,
                  message: 'Manual save',
                  snapshot: {
                    ...model,
                    metadata: {
                      ...model.metadata,
                      // Snapshots are append-only, so every explicit save gets a fresh timestamp inside the domain model too.
                      updatedAt: new Date().toISOString(),
                    },
                  },
                });
              }}
            >
              {saveSnapshotMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save
            </Button>
            <Button className="gap-2" onClick={handleExportSql} variant="sky">
              <Play className="size-4" />
              {copiedSql ? 'Copied' : 'SQL'}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton icon={MoreHorizontal} label="More actions" variant="secondary" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setFitSignal((value) => value + 1)}>
                  <LocateFixed className="size-4" />
                  Fit diagram
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleExportSql}>
                  <Play className="size-4" />
                  Copy SQL
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Share2 className="size-4" />
                  Share workspace
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate(routes.adminUsers.to())}>
                  <ShieldCheck className="size-4" />
                  Admin users
                </DropdownMenuItem>
                <DropdownMenuSeparatorItem />
                <DropdownMenuItem disabled={logoutMutation.isPending} onSelect={() => logoutMutation.mutate(undefined)}>
                  <LogOut className="size-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <SchemaCanvas
          fitKey={activeDiagram?.id ?? 'empty'}
          fitSignal={fitSignal}
          model={model}
          onModelChange={setModel}
          onSelectedTableChange={setSelectedTableId}
          selectedTableId={selectedTableId}
        />
      </section>

      <SchemaInspector
        latestSnapshotVersion={latestSnapshot?.version ?? 0}
        model={model}
        onModelChange={setModel}
        selectedTableId={selectedTableId}
      />
    </main>
  );
}

function getWorkspaceSlug(project: ProjectResponseDto): string {
  return project.organizationSlug || project.organizationId;
}

function CreateProjectDialog({ onCreated }: { onCreated: (project: ProjectResponseDto) => void }) {
  const [open, setOpen] = useState(false);
  const form = useForm<ProjectFormState>({
    defaultValues: {
      description: '',
      name: '',
    },
    mode: 'onBlur',
    resolver: zodResolver(projectFormSchema),
  });
  const { errors } = form.formState;

  const createProjectMutation = useCreateProjectMutation({
    mutationConfig: {
      onSuccess: (project) => {
        // New project langsung dinavigasikan agar user merasa aksi create menghasilkan workspace yang nyata.
        form.reset({ description: '', name: '' });
        setOpen(false);
        onCreated(project);
      },
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen && !createProjectMutation.isPending) {
      form.reset({ description: '', name: '' });
      createProjectMutation.reset();
    }
  }

  function handleSubmit(values: ProjectFormState) {
    createProjectMutation.mutate({
      description: toOptionalDescription(values.description),
      name: values.name,
    });
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <FolderPlus className="size-4" />
          New
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(94vw,520px)]">
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>Create a workspace project for a schema, product area, or service.</DialogDescription>
          </DialogHeader>

          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Project name
            </span>
            <ControlledInput
              autoFocus
              aria-invalid={Boolean(errors.name)}
              control={form.control}
              disabled={createProjectMutation.isPending}
              name="name"
              placeholder="Billing Platform"
            />
            <FieldError>{errors.name?.message}</FieldError>
          </label>

          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Description
            </span>
            <ControlledTextarea
              aria-invalid={Boolean(errors.description)}
              className="min-h-24 w-full resize-none rounded-[16px] border-2 border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 py-2 text-sm font-semibold outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-primary-soft))]"
              control={form.control}
              disabled={createProjectMutation.isPending}
              name="description"
              placeholder="Schemas for invoices, customers, and subscriptions."
            />
            <FieldError>{errors.description?.message}</FieldError>
          </label>

          {createProjectMutation.error ? (
            <div className="mt-4 rounded-[14px] border-2 border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              {getErrorMessage(createProjectMutation.error)}
            </div>
          ) : null}

          <DialogFooter className="mt-5">
            <Button
              disabled={createProjectMutation.isPending}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button disabled={createProjectMutation.isPending} type="submit">
              {createProjectMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FolderPlus className="size-4" />
              )}
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectSettingsDialog({
  onArchived,
  project,
}: {
  onArchived: () => void;
  project: ProjectResponseDto;
}) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [open, setOpen] = useState(false);
  const form = useForm<ProjectFormState>({
    defaultValues: getProjectFormDefaults(project),
    mode: 'onBlur',
    resolver: zodResolver(projectFormSchema),
  });
  const { errors } = form.formState;

  useEffect(() => {
    if (open) {
      // Opening settings always reflects the latest project data from query cache.
      form.reset(getProjectFormDefaults(project));
      setConfirmArchive(false);
    }
  }, [form, open, project]);

  const updateProjectMutation = useUpdateProjectMutation({
    mutationConfig: {
      onSuccess: () => {
        setOpen(false);
      },
    },
  });
  const archiveProjectMutation = useArchiveProjectMutation({
    mutationConfig: {
      onSuccess: () => {
        setOpen(false);
        onArchived();
      },
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen && !updateProjectMutation.isPending && !archiveProjectMutation.isPending) {
      form.reset(getProjectFormDefaults(project));
      setConfirmArchive(false);
      updateProjectMutation.reset();
      archiveProjectMutation.reset();
    }
  }

  function handleSubmit(values: ProjectFormState) {
    updateProjectMutation.mutate({
      body: {
        description: toOptionalDescription(values.description) ?? null,
        name: values.name,
      },
      projectId: project.id,
    });
  }

  function handleArchive() {
    if (!confirmArchive) {
      setConfirmArchive(true);
      return;
    }

    archiveProjectMutation.mutate(project.id);
  }

  const mutationError = updateProjectMutation.error ?? archiveProjectMutation.error;

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <IconButton icon={Settings} label="Project settings" variant="secondary" />
      </DialogTrigger>
      <DialogContent className="w-[min(94vw,560px)]">
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Project settings</DialogTitle>
            <DialogDescription>Update project details or archive it from the active workspace.</DialogDescription>
          </DialogHeader>

          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Project name
            </span>
            <ControlledInput
              aria-invalid={Boolean(errors.name)}
              control={form.control}
              disabled={updateProjectMutation.isPending || archiveProjectMutation.isPending}
              name="name"
            />
            <FieldError>{errors.name?.message}</FieldError>
          </label>

          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Description
            </span>
            <ControlledTextarea
              aria-invalid={Boolean(errors.description)}
              className="min-h-24 w-full resize-none rounded-[16px] border-2 border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 py-2 text-sm font-semibold outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-primary-soft))]"
              control={form.control}
              disabled={updateProjectMutation.isPending || archiveProjectMutation.isPending}
              name="description"
            />
            <FieldError>{errors.description?.message}</FieldError>
          </label>

          {mutationError ? (
            <div className="mt-4 rounded-[14px] border-2 border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              {getErrorMessage(mutationError)}
            </div>
          ) : null}

          <DialogFooter className="mt-5 justify-between sm:justify-between">
            <Button
              disabled={updateProjectMutation.isPending || archiveProjectMutation.isPending}
              onClick={handleArchive}
              type="button"
              variant={confirmArchive ? 'danger' : 'secondary'}
            >
              {archiveProjectMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Archive className="size-4" />
              )}
              {confirmArchive ? 'Confirm archive' : 'Archive'}
            </Button>
            <div className="flex gap-2">
              <Button
                disabled={updateProjectMutation.isPending || archiveProjectMutation.isPending}
                onClick={() => handleOpenChange(false)}
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
              <Button disabled={updateProjectMutation.isPending || archiveProjectMutation.isPending} type="submit">
                {updateProjectMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save changes
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getProjectFormDefaults(project: ProjectResponseDto): ProjectFormState {
  return {
    description: project.description ?? '',
    name: project.name,
  };
}

function toOptionalDescription(value: string | undefined): string | undefined {
  const description = value?.trim();
  return description ? description : undefined;
}

function AddTableDialog({ onCreate }: { onCreate: (tableName?: string) => void }) {
  const [open, setOpen] = useState(false);
  const form = useForm<AddTableFormState>({
    defaultValues: {
      tableName: '',
    },
    resolver: zodResolver(addTableFormSchema),
  });
  const { errors } = form.formState;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset();
    }
  }

  function handleSubmit(values: AddTableFormState) {
    onCreate(values.tableName || undefined);
    form.reset();
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button className="ml-2 gap-2" variant="secondary">
          <Plus className="size-4" />
          Table
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>New table</DialogTitle>
            <DialogDescription>
              Give the table a friendly SQL-safe name. Spaces will become underscores.
            </DialogDescription>
          </DialogHeader>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Table name
            </span>
            <ControlledInput
              autoFocus
              aria-invalid={Boolean(errors.tableName)}
              control={form.control}
              name="tableName"
              placeholder="subscriptions"
            />
            <FieldError>{errors.tableName?.message}</FieldError>
          </label>
          <DialogFooter className="mt-5">
            <Button onClick={() => handleOpenChange(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button type="submit">
              <Plus className="size-4" />
              Create table
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof TabliodbApiError && error.status === 401;
}
