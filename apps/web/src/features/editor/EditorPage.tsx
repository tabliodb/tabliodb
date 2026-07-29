import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTableColumns, type DatabaseTable, type DiagramModel } from '@tabliodb/schema-core';
import {
  TabliodbApiError,
  type DiagramResponseDto,
  type ProjectResponseDto,
  type SnapshotResponseDto,
} from '@tabliodb/sdk';
import { generateCreateSchemaSql } from '@tabliodb/sql';
import {
  Badge,
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
  DropdownMenuTrigger,
  IconButton,
  Input,
  Surface,
} from '@tabliodb/ui';
import {
  AlertCircle,
  Database,
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
  Share2,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { sdk } from '@/services/sdk';
import { addTableToDiagramModel, createSeedDiagramModel, formatColumnType } from './diagram-model';
import { SchemaCanvas } from './components/SchemaCanvas';

const defaultProjectName = 'Library System';
const defaultDiagramName = 'Main schema';
const authDefaults = {
  email: 'demo@tabliodb.local',
  name: 'Tabliodb Maker',
  password: 'tabliodb-dev',
};

type AuthMode = 'login' | 'sign-up';

type AuthFormState = {
  email: string;
  mode: AuthMode;
  name: string;
  password: string;
};

export function EditorPage() {
  const queryClient = useQueryClient();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeDiagramId, setActiveDiagramId] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  const [model, setModel] = useState<DiagramModel | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: loadOrCreateProjects,
    retry: false,
  });

  const projects = projectsQuery.data ?? [];
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0] ?? null;

  const diagramsQuery = useQuery({
    enabled: Boolean(activeProject?.id),
    queryKey: ['diagrams', activeProject?.id],
    queryFn: () => loadOrCreateDiagrams(activeProject!),
    retry: false,
  });

  const diagrams = diagramsQuery.data ?? [];
  const activeDiagram = diagrams.find((diagram) => diagram.id === activeDiagramId) ?? diagrams[0] ?? null;

  const snapshotsQuery = useQuery({
    enabled: Boolean(activeDiagram?.id),
    queryKey: ['snapshots', activeDiagram?.id],
    queryFn: () => loadOrCreateSnapshots(activeDiagram!),
    retry: false,
  });

  const latestSnapshot = snapshotsQuery.data?.[0] ?? null;
  const selectedTable = selectedTableId && model ? model.tables[selectedTableId] : null;
  const selectedColumns = selectedTable && model ? getTableColumns(model, selectedTable.id) : [];
  const reviewSignals = useMemo(() => (model ? getReviewSignals(model) : []), [model]);

  const authMutation = useMutation({
    mutationFn: async (form: AuthFormState) => {
      if (form.mode === 'login') {
        return sdk.auth.login({ email: form.email, password: form.password });
      }

      try {
        return await sdk.auth.signUp({
          email: form.email,
          name: form.name,
          password: form.password,
        });
      } catch (error) {
        if (isEmailAlreadyRegistered(error)) {
          // The seeded dev credential is intentionally reusable, so an existing user falls through to login.
          return sdk.auth.login({ email: form.email, password: form.password });
        }

        throw error;
      }
    },
    onSuccess: async () => {
      setActiveDiagramId(null);
      setActiveProjectId(null);
      setModel(null);
      setSelectedTableId(null);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const saveSnapshotMutation = useMutation({
    mutationFn: async () => {
      if (!activeDiagram || !model) {
        throw new Error('Diagram is not ready yet');
      }

      const snapshot: DiagramModel = {
        ...model,
        metadata: {
          ...model.metadata,
          // Snapshots are append-only, so every explicit save gets a fresh timestamp inside the domain model too.
          updatedAt: new Date().toISOString(),
        },
      };

      return sdk.snapshots.create({
        diagramId: activeDiagram.id,
        message: 'Manual save',
        snapshot,
      });
    },
    onSuccess: (snapshot) => {
      setModel(snapshot.snapshot);
      queryClient.setQueryData<SnapshotResponseDto[]>(['snapshots', snapshot.diagramId], (current) => [
        snapshot,
        ...(current ?? []),
      ]);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => sdk.auth.logout(),
    onSuccess: () => {
      setActiveDiagramId(null);
      setActiveProjectId(null);
      setModel(null);
      setSelectedTableId(null);
      queryClient.clear();
    },
  });

  useEffect(() => {
    if (projects.length > 0 && !projects.some((project) => project.id === activeProjectId)) {
      setActiveProjectId(projects[0].id);
    }
  }, [activeProjectId, projects]);

  useEffect(() => {
    if (diagrams.length > 0 && !diagrams.some((diagram) => diagram.id === activeDiagramId)) {
      setActiveDiagramId(diagrams[0].id);
    }
  }, [activeDiagramId, diagrams]);

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
    return <AuthGate error={authMutation.error} isSubmitting={authMutation.isPending} onSubmit={authMutation.mutate} />;
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
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--tabliodb-ink-subtle))]" />
            <Input className="pl-9" placeholder="Search projects" />
          </div>
          <div className="space-y-1">
            {projects.map((project) => (
              <button
                className={`flex w-full cursor-pointer items-center justify-between rounded-[14px] border-2 px-3 py-2.5 text-left text-sm font-extrabold transition ${
                  project.id === activeProject?.id
                    ? 'border-[rgb(var(--tabliodb-primary))] bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))] shadow-[0_3px_0_rgb(var(--tabliodb-primary-border))]'
                    : 'border-transparent text-[rgb(var(--tabliodb-ink-muted))] hover:border-[rgb(var(--tabliodb-border))] hover:bg-[rgb(var(--tabliodb-surface))]'
                }`}
                key={project.id}
                onClick={() => {
                  setActiveProjectId(project.id);
                  setActiveDiagramId(null);
                  setModel(null);
                  setSelectedTableId(null);
                }}
                type="button"
              >
                <span className="min-w-0 truncate">{project.name}</span>
                <span className="text-xs opacity-70">{project.slug}</span>
              </button>
            ))}
          </div>
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
            <AddTableDialog onCreate={handleAddTable} />
            <Button
              className="gap-2"
              disabled={saveSnapshotMutation.isPending}
              onClick={() => saveSnapshotMutation.mutate()}
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
                <DropdownMenuSeparatorItem />
                <DropdownMenuItem disabled={logoutMutation.isPending} onSelect={() => logoutMutation.mutate()}>
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

      <aside className="border-l-2 border-[rgb(var(--tabliodb-border))] bg-white">
        <div className="flex h-16 items-center border-b-2 border-[rgb(var(--tabliodb-border))] px-5 text-sm font-extrabold">
          Inspector
        </div>
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="green">{model.dialect}</Badge>
            <Badge variant="blue">v{latestSnapshot?.version ?? 0}</Badge>
          </div>
          <section>
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Selected table
            </h2>
            {selectedTable ? (
              <Surface className="mt-2 p-4">
                <div className="text-sm font-extrabold">{selectedTable.name}</div>
                <div className="mt-1 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                  {selectedColumns.length} columns / {selectedTable.indexIds.length} indexes /{' '}
                  {countTableRelationships(model, selectedTable)} relationships
                </div>
                <div className="mt-3 divide-y divide-[rgb(var(--tabliodb-border))]">
                  {selectedColumns.map((column) => (
                    <div className="grid grid-cols-[1fr_auto] gap-2 py-2 text-xs" key={column.id}>
                      <span className="truncate font-extrabold text-[rgb(var(--tabliodb-ink))]">{column.name}</span>
                      <span className="font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                        {formatColumnType(column.type)}
                      </span>
                    </div>
                  ))}
                </div>
              </Surface>
            ) : (
              <Surface className="mt-2 border-dashed p-4 text-sm font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                No table selected
              </Surface>
            )}
          </section>
          <section>
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Review signals
            </h2>
            <div className="mt-2 space-y-2 text-sm">
              {reviewSignals.map((signal) => (
                <Surface
                  className="border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] p-3 font-bold text-[rgb(var(--tabliodb-gold-text))] shadow-[0_3px_0_rgb(var(--tabliodb-gold-border))]"
                  key={signal}
                >
                  {signal}
                </Surface>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </main>
  );
}

async function loadOrCreateProjects(): Promise<ProjectResponseDto[]> {
  const projects = await sdk.projects.list();

  if (projects.length > 0) {
    return projects;
  }

  // The first authenticated visit should produce a real database-backed workspace instead of keeping the UI in mock mode.
  const project = await sdk.projects.create({
    name: defaultProjectName,
    description: 'Starter schema workspace',
  });

  return [project];
}

async function loadOrCreateDiagrams(project: ProjectResponseDto): Promise<DiagramResponseDto[]> {
  const diagrams = await sdk.projects.listDiagrams(project.id);

  if (diagrams.length > 0) {
    return diagrams;
  }

  const diagram = await sdk.diagrams.create({
    projectId: project.id,
    name: defaultDiagramName,
    dialect: 'postgresql',
  });

  return [diagram];
}

async function loadOrCreateSnapshots(diagram: DiagramResponseDto): Promise<SnapshotResponseDto[]> {
  const snapshots = await sdk.snapshots.listByDiagram(diagram.id);

  if (snapshots.length > 0) {
    return snapshots;
  }

  const snapshot = await sdk.snapshots.create({
    diagramId: diagram.id,
    message: 'Initial schema',
    snapshot: createSeedDiagramModel(diagram.name),
  });

  return [snapshot];
}

function AddTableDialog({ onCreate }: { onCreate: (tableName?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [tableName, setTableName] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate(tableName);
    setTableName('');
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button className="ml-2 gap-2" variant="secondary">
          <Plus className="size-4" />
          Table
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
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
            <Input
              autoFocus
              onChange={(event) => setTableName(event.target.value)}
              placeholder="subscriptions"
              value={tableName}
            />
          </label>
          <DialogFooter className="mt-5">
            <Button onClick={() => setOpen(false)} type="button" variant="secondary">
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

function AuthGate({
  error,
  isSubmitting,
  onSubmit,
}: {
  error: unknown;
  isSubmitting: boolean;
  onSubmit: (form: AuthFormState) => void;
}) {
  const [form, setForm] = useState<AuthFormState>({
    email: authDefaults.email,
    mode: 'sign-up',
    name: authDefaults.name,
    password: authDefaults.password,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <main className="grid h-screen place-items-center bg-[rgb(var(--tabliodb-surface))] px-6 text-[rgb(var(--tabliodb-ink))]">
      <Surface className="w-full max-w-sm p-5" depth="md">
        <form onSubmit={handleSubmit}>
          <div className="mb-5 flex items-center gap-2">
            <div className="grid size-10 place-items-center rounded-2xl bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]">
              <Database className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold">Tabliodb</h1>
              <p className="text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">Development workspace</p>
            </div>
          </div>
          <div className="mb-4 grid grid-cols-2 rounded-[16px] border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface))] p-1 text-sm font-extrabold">
            <button
              className={`cursor-pointer rounded-[12px] px-3 py-1.5 transition ${
                form.mode === 'sign-up'
                  ? 'bg-white text-[rgb(var(--tabliodb-primary-text))] shadow-[0_2px_0_rgb(var(--tabliodb-border-strong))]'
                  : 'text-[rgb(var(--tabliodb-ink-muted))]'
              }`}
              onClick={() => setForm((current) => ({ ...current, mode: 'sign-up' }))}
              type="button"
            >
              Sign up
            </button>
            <button
              className={`cursor-pointer rounded-[12px] px-3 py-1.5 transition ${
                form.mode === 'login'
                  ? 'bg-white text-[rgb(var(--tabliodb-primary-text))] shadow-[0_2px_0_rgb(var(--tabliodb-border-strong))]'
                  : 'text-[rgb(var(--tabliodb-ink-muted))]'
              }`}
              onClick={() => setForm((current) => ({ ...current, mode: 'login' }))}
              type="button"
            >
              Login
            </button>
          </div>
          {form.mode === 'sign-up' ? (
            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Name
              </span>
              <Input
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                value={form.name}
              />
            </label>
          ) : null}
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Email
            </span>
            <Input
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              type="email"
              value={form.email}
            />
          </label>
          <label className="mb-4 block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Password
            </span>
            <Input
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              type="password"
              value={form.password}
            />
          </label>
          {error ? (
            <div className="mb-4 rounded-[14px] border-2 border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              {getErrorMessage(error)}
            </div>
          ) : null}
          <Button className="w-full gap-2" disabled={isSubmitting} type="submit">
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
            Continue
          </Button>
        </form>
      </Surface>
    </main>
  );
}

function LoadingState() {
  return (
    <main className="grid h-screen place-items-center bg-[rgb(var(--tabliodb-surface))] text-[rgb(var(--tabliodb-ink-muted))]">
      <Surface className="flex items-center gap-2 p-4 text-sm font-extrabold">
        <Loader2 className="size-4 animate-spin" />
        Loading workspace
      </Surface>
    </main>
  );
}

function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <main className="grid h-screen place-items-center bg-[rgb(var(--tabliodb-surface))] px-6 text-[rgb(var(--tabliodb-ink))]">
      <Surface className="w-full max-w-md border-red-200 p-5">
        <div className="mb-3 flex items-center gap-2 text-red-700">
          <AlertCircle className="size-5" />
          <h1 className="text-sm font-extrabold">Workspace error</h1>
        </div>
        <p className="mb-4 text-sm font-semibold text-[rgb(var(--tabliodb-ink-muted))]">{getErrorMessage(error)}</p>
        <Button onClick={onRetry} variant="secondary">
          Retry
        </Button>
      </Surface>
    </main>
  );
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof TabliodbApiError && error.status === 401;
}

function isEmailAlreadyRegistered(error: unknown): boolean {
  return error instanceof TabliodbApiError && error.status === 400 && error.message.includes('already registered');
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function countTableRelationships(model: DiagramModel, table: DatabaseTable): number {
  return Object.values(model.relationships).filter(
    (relationship) => relationship.sourceTableId === table.id || relationship.targetTableId === table.id,
  ).length;
}

function getReviewSignals(model: DiagramModel): string[] {
  const relationshipsByTargetColumn = new Set(
    Object.values(model.relationships).map((relationship) => relationship.targetColumnId),
  );

  const missingRelationshipIndexes = Object.values(model.columns)
    .filter((column) => column.name.endsWith('_id') && !relationshipsByTargetColumn.has(column.id))
    .map((column) => `${model.tables[column.tableId]?.name ?? column.tableId}.${column.name} has no relationship`);

  if (missingRelationshipIndexes.length > 0) {
    return missingRelationshipIndexes.slice(0, 2);
  }

  return ['Foreign keys are mapped', 'Unique columns are visible'];
}
