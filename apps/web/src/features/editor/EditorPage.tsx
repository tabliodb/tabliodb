import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getRelationshipColumnPairs,
  getTableColumns,
  type DatabaseTable,
  type DiagramModel,
} from '@tabliodb/schema-core';
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
import { Navigate, useNavigate, useParams } from 'react-router';
import { routes } from '@/app/routes';
import { ErrorState, LoadingState } from '@/features/app/RouteStates';
import { sdk } from '@/services/sdk';
import { addTableToDiagramModel, createSeedDiagramModel, formatColumnType } from './diagram-model';
import { SchemaCanvas } from './components/SchemaCanvas';

const defaultProjectName = 'Library System';
const defaultDiagramName = 'Main schema';

export function EditorPage() {
  const navigate = useNavigate();
  const params = useParams();
  const queryClient = useQueryClient();
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
  const routeProjectId = params.projectId ?? null;
  const routeDiagramId = params.diagramId ?? null;
  const activeProject = projects.find((project) => project.id === routeProjectId) ?? projects[0] ?? null;

  const diagramsQuery = useQuery({
    enabled: Boolean(activeProject?.id),
    queryKey: ['diagrams', activeProject?.id],
    queryFn: () => loadOrCreateDiagrams(activeProject!),
    retry: false,
  });

  const diagrams = diagramsQuery.data ?? [];
  const activeDiagram = diagrams.find((diagram) => diagram.id === routeDiagramId) ?? diagrams[0] ?? null;

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
      setModel(null);
      setSelectedTableId(null);
      queryClient.clear();
      navigate(routes.login.to(), { replace: true });
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

function getWorkspaceSlug(project: ProjectResponseDto): string {
  return project.organizationSlug || project.organizationId;
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

function isUnauthorized(error: unknown): boolean {
  return error instanceof TabliodbApiError && error.status === 401;
}

function countTableRelationships(model: DiagramModel, table: DatabaseTable): number {
  return Object.values(model.relationships).filter(
    (relationship) => relationship.sourceTableId === table.id || relationship.targetTableId === table.id,
  ).length;
}

function getReviewSignals(model: DiagramModel): string[] {
  const relationshipsByTargetColumn = new Set(
    Object.values(model.relationships).flatMap((relationship) =>
      getRelationshipColumnPairs(relationship).map((pair) => pair.targetColumnId),
    ),
  );

  const missingRelationshipIndexes = Object.values(model.columns)
    .filter((column) => column.name.endsWith('_id') && !relationshipsByTargetColumn.has(column.id))
    .map((column) => `${model.tables[column.tableId]?.name ?? column.tableId}.${column.name} has no relationship`);

  if (missingRelationshipIndexes.length > 0) {
    return missingRelationshipIndexes.slice(0, 2);
  }

  return ['Foreign keys are mapped', 'Unique columns are visible'];
}
