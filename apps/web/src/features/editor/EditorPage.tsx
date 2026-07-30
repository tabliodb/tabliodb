import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DatabaseDialect, DiagramModel } from '@tabliodb/schema-core';
import { OrganizationRole, Permission, ProjectRole, isGranted, permissionsForProjectRole } from '@tabliodb/shared';
import {
  TabliodbApiError,
  type AuditLogDto,
  type DiagramResponseDto,
  type OrganizationDto,
  type OrganizationMemberDto,
  type OrganizationSettingsDto,
  type ProjectMemberDto,
  type ProjectResponseDto,
} from '@tabliodb/sdk';
import { generateCreateSchemaSql } from '@tabliodb/sql';
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
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
  Select,
  cn,
} from '@tabliodb/ui';
import {
  Archive,
  Building2,
  Check,
  ChevronsUpDown,
  Database,
  FolderPlus,
  GitBranch,
  History,
  Loader2,
  LocateFixed,
  LogOut,
  MessageSquareText,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  Play,
  Plus,
  Save,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type SVGProps } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { routes } from '@/app/routes';
import { ControlledCheckbox, ControlledInput, ControlledSelect, ControlledTextarea } from '@/features/app/FormControls';
import { ErrorState, LoadingState, getErrorMessage } from '@/features/app/RouteStates';
import { useLogoutMutation } from '@/resources/auth';
import { defaultDiagramName, diagramsQueries, useUpdateDiagramMutation } from '@/resources/diagrams';
import {
  organizationsQueries,
  useRemoveOrganizationMemberMutation,
  useUpdateOrganizationMemberMutation,
  useUpdateOrganizationSettingsMutation,
} from '@/resources/organizations';
import {
  defaultProjectName,
  projectsQueries,
  useAddProjectMemberMutation,
  useArchiveProjectMutation,
  useCreateProjectMutation,
  useRemoveProjectMemberMutation,
  useUpdateProjectMemberMutation,
  useUpdateProjectMutation,
} from '@/resources/projects';
import { snapshotsQueries, useCreateSnapshotMutation } from '@/resources/snapshots';
import { addTableToDiagramModel, createSeedDiagramModel } from './diagram-model';
import { SchemaCanvas } from './components/SchemaCanvas';
import { SchemaInspector } from './components/SchemaInspector';
import { TableStructureSidebar } from './components/TableStructureSidebar';

const addTableFormSchema = z.object({
  tableName: z.string().trim().max(64, 'Keep the table name under 64 characters.'),
});

type AddTableFormState = z.infer<typeof addTableFormSchema>;

const projectFormSchema = z.object({
  description: z.string().trim().max(240, 'Keep the description under 240 characters.').optional(),
  name: z.string().trim().min(1, 'Project name is required.').max(80, 'Keep the name under 80 characters.'),
});

type ProjectFormState = z.infer<typeof projectFormSchema>;

const diagramDialectOptions = [
  'postgresql',
  'mysql',
  'sqlite',
  'mariadb',
  'sqlserver',
] as const satisfies readonly DatabaseDialect[];

const diagramSettingsFormSchema = z.object({
  dialect: z.enum(diagramDialectOptions),
  name: z.string().trim().min(1, 'Diagram name is required.').max(80, 'Keep the name under 80 characters.'),
});

type DiagramSettingsFormState = z.infer<typeof diagramSettingsFormSchema>;

const workspaceDefaultRoleOptions = ['none', ProjectRole.Editor, ProjectRole.Commenter, ProjectRole.Viewer] as const;

const workspaceSettingsFormSchema = z.object({
  allowMemberProjectCreate: z.boolean(),
  defaultProjectRole: z.enum(workspaceDefaultRoleOptions),
  name: z.string().trim().min(1, 'Workspace name is required.').max(80, 'Keep the workspace name under 80 characters.'),
});

type WorkspaceSettingsFormState = z.infer<typeof workspaceSettingsFormSchema>;

const memberFormSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
  role: z.enum([ProjectRole.Owner, ProjectRole.Editor, ProjectRole.Commenter, ProjectRole.Viewer]),
});

type MemberFormState = z.infer<typeof memberFormSchema>;

const memberFormDefaults: MemberFormState = {
  email: '',
  role: ProjectRole.Viewer,
};

const projectRoleOptions = [ProjectRole.Owner, ProjectRole.Editor, ProjectRole.Commenter, ProjectRole.Viewer] as const;
const organizationRoleOptions = [
  OrganizationRole.Owner,
  OrganizationRole.Admin,
  OrganizationRole.Member,
  OrganizationRole.Guest,
] as const;

const projectMemberPageQuery = { limit: 50 } as const;
const workspaceMemberPageQuery = { limit: 50 } as const;
const workspaceAuditLogQuery = { limit: 8 } as const;

const selectClassName =
  'h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-primary)/0.18)] disabled:cursor-not-allowed disabled:opacity-50';

export function EditorPage() {
  const navigate = useNavigate();
  const params = useParams();
  const queryClient = useQueryClient();
  const [copiedSql, setCopiedSql] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  const [model, setModel] = useState<DiagramModel | null>(null);
  const modelRef = useRef<DiagramModel | null>(null);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  // Inspector starts collapsed so the editor opens with more canvas room while keeping the right rail discoverable.
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);

  const organizationsQuery = useQuery(organizationsQueries.list({ limit: 50 }));
  const organizations = organizationsQuery.data?.items ?? [];
  const routeWorkspaceSlug = params.workspaceSlug ?? null;
  const activeOrganization = useMemo(() => {
    if (organizations.length === 0) {
      return null;
    }

    return (
      organizations.find((organization) => matchesWorkspaceRoute(organization, routeWorkspaceSlug)) ??
      organizations[0] ??
      null
    );
  }, [organizations, routeWorkspaceSlug]);

  const projectsQuery = useQuery(projectsQueries.listOrCreateStarter(activeOrganization?.id ?? null));

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
  const canEditDiagram = activeProject
    ? hasProjectPermission(activeProject.projectRole, Permission.DiagramUpdate)
    : false;
  const canCreateSnapshot = activeProject
    ? hasProjectPermission(activeProject.projectRole, Permission.SnapshotCreate)
    : false;

  const snapshotsQuery = useQuery(
    snapshotsQueries.listOrCreateInitial(activeDiagram, activeProject, (diagram) =>
      createSeedDiagramModel(diagram.name),
    ),
  );

  const latestSnapshot = snapshotsQuery.data?.[0] ?? null;

  const saveSnapshotMutation = useCreateSnapshotMutation({
    mutationConfig: {
      onSuccess: (snapshot) => {
        // Snapshot creation returns the canonical versioned model while live editing remains a separate persistence concern.
        modelRef.current = snapshot.snapshot;
        setModel(snapshot.snapshot);
      },
    },
  });

  const logoutMutation = useLogoutMutation({
    mutationConfig: {
      onSuccess: () => {
        modelRef.current = null;
        setModel(null);
        setSelectedTableId(null);
        navigate(routes.login.to(), { replace: true });
      },
    },
  });

  const handleModelChange = useCallback(
    (nextModel: DiagramModel) => {
      if (!canEditDiagram) {
        return;
      }

      // Keep the latest draft model synchronously available for snapshot clicks that happen immediately after an input blur.
      modelRef.current = nextModel;
      setModel(nextModel);
    },
    [canEditDiagram],
  );

  const handleSelectedTableChange = useCallback((tableId: string | null) => {
    setSelectedTableId(tableId);

    if (tableId) {
      // Selecting a table promotes the left sidebar into structure-edit mode, even if the user hid it earlier.
      setLeftSidebarOpen(true);
    }
  }, []);

  useEffect(() => {
    if (organizations.length === 0 || organizationsQuery.isPending) {
      return;
    }

    if (
      !routeWorkspaceSlug ||
      !organizations.some((organization) => matchesWorkspaceRoute(organization, routeWorkspaceSlug))
    ) {
      const organization = organizations[0];
      navigate(routes.workspace.to({ workspaceSlug: getOrganizationSlug(organization) }), {
        replace: true,
      });
    }
  }, [navigate, organizations, organizationsQuery.isPending, routeWorkspaceSlug]);

  useEffect(() => {
    if (!activeOrganization) {
      return;
    }

    if (projects.length > 0 && (!routeProjectId || !projects.some((project) => project.id === routeProjectId))) {
      const project = projects[0];
      navigate(routes.project.to({ projectId: project.id, workspaceSlug: getOrganizationSlug(activeOrganization) }), {
        replace: true,
      });
    }
  }, [activeOrganization, navigate, projects, routeProjectId]);

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

    modelRef.current = latestSnapshot.snapshot;
    setModel(latestSnapshot.snapshot);
    setSelectedTableId(null);
  }, [latestSnapshot]);

  useEffect(() => {
    if (!activeDiagram || snapshotsQuery.isPending || snapshotsQuery.data === undefined || latestSnapshot) {
      return;
    }

    // Empty read-only diagrams cannot create an initial snapshot, so the editor renders an unsaved empty model instead of spinning forever.
    const seedModel = createSeedDiagramModel(activeDiagram.name);
    modelRef.current = seedModel;
    setModel(seedModel);
    setSelectedTableId(null);
  }, [activeDiagram, latestSnapshot, snapshotsQuery.data, snapshotsQuery.isPending]);

  async function handleExportSql() {
    if (!model) {
      return;
    }

    await navigator.clipboard.writeText(generateCreateSchemaSql(model, { dialect: model.dialect }));
    setCopiedSql(true);
    window.setTimeout(() => setCopiedSql(false), 1600);
  }

  function handleAddTable(tableName?: string) {
    if (!canEditDiagram || !model) {
      return;
    }

    const nextModel = addTableToDiagramModel(model, tableName);
    const nextTableId = Object.keys(nextModel.tables).find((tableId) => !model.tables[tableId]) ?? null;

    modelRef.current = nextModel;
    setModel(nextModel);
    setSelectedTableId(nextTableId);
  }

  function handleSaveSnapshot() {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    window.setTimeout(() => {
      const modelToSave = modelRef.current;

      if (!activeDiagram || !modelToSave || !canCreateSnapshot || saveSnapshotMutation.isPending) {
        return;
      }

      saveSnapshotMutation.mutate({
        diagramId: activeDiagram.id,
        message: 'Manual snapshot',
        snapshot: {
          ...modelToSave,
          metadata: {
            ...modelToSave.metadata,
            // Snapshots are append-only, so every explicit save gets a fresh timestamp inside the domain model too.
            updatedAt: new Date().toISOString(),
          },
        },
      });
    }, 0);
  }

  if (isUnauthorized(projectsQuery.error)) {
    return <Navigate replace to={routes.login.to()} />;
  }

  if (isUnauthorized(organizationsQuery.error)) {
    return <Navigate replace to={routes.login.to()} />;
  }

  const blockingError = organizationsQuery.error ?? projectsQuery.error ?? diagramsQuery.error ?? snapshotsQuery.error;

  if (blockingError) {
    return <ErrorState error={blockingError} onRetry={() => queryClient.invalidateQueries()} />;
  }

  if (!organizationsQuery.isPending && organizations.length === 0) {
    return <ErrorState error={new Error('No workspace found')} onRetry={() => queryClient.invalidateQueries()} />;
  }

  const isLoadingWorkspace =
    organizationsQuery.isPending ||
    Boolean(activeOrganization && projectsQuery.isPending) ||
    Boolean(activeProject && diagramsQuery.isPending) ||
    Boolean(activeDiagram && snapshotsQuery.isPending) ||
    Boolean(activeProject && activeDiagram && !model);

  if (isLoadingWorkspace) {
    return <LoadingState />;
  }

  if (!diagramsQuery.isPending && activeProject && diagrams.length === 0) {
    return (
      <ErrorState
        error={
          new Error(canEditDiagram ? 'No diagram found' : 'No diagram is available for your current project role yet')
        }
        onRetry={() => queryClient.invalidateQueries()}
      />
    );
  }

  if (!activeOrganization || !activeProject || !activeDiagram || !model) {
    return <LoadingState />;
  }

  const selectedTable = selectedTableId ? (model.tables[selectedTableId] ?? null) : null;
  // Expanded sidebars share one comfortable width so table controls do not collapse into cramped rows.
  const expandedSidebarWidth = '332px';
  const collapsedSidebarWidth = '48px';
  const leftSidebarWidth = leftSidebarOpen ? expandedSidebarWidth : collapsedSidebarWidth;
  const rightSidebarWidth = rightSidebarOpen ? expandedSidebarWidth : collapsedSidebarWidth;

  return (
    <main className="flex h-screen flex-col bg-[rgb(var(--tabliodb-surface))] text-[rgb(var(--tabliodb-ink))]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b-2 border-[rgb(var(--tabliodb-border))] bg-white px-5">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex shrink-0 items-center gap-2">
            <div className="grid size-9 place-items-center rounded-2xl bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]">
              <Database className="size-5" />
            </div>
            <span className="text-base font-extrabold">Tabliodb</span>
          </div>
          <div className="min-w-0 border-l-2 border-[rgb(var(--tabliodb-border))] pl-4">
            <h1 className="truncate text-base font-extrabold">{activeProject?.name ?? defaultProjectName}</h1>
            <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
              {activeDiagram?.name ?? defaultDiagramName} / {model.dialect} / snapshot v{latestSnapshot?.version ?? 0}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant={canEditDiagram ? 'green' : 'yellow'}>{formatProjectRole(activeProject.projectRole)}</Badge>
          <IconButton icon={MessageSquareText} label="Comments" />
          <IconButton icon={History} label="History" />
          <IconButton icon={GitBranch} label="Branches" />
          <IconButton icon={LocateFixed} label="Fit diagram" onClick={() => setFitSignal((value) => value + 1)} />
          {activeProject ? (
            <>
              <WorkspaceSettingsDialog organization={activeOrganization} project={activeProject} />
              <ProjectSettingsDialog
                onArchived={() => {
                  modelRef.current = null;
                  setModel(null);
                  setSelectedTableId(null);
                  navigate(routes.home.to(), { replace: true });
                }}
                project={activeProject}
              />
              <DiagramSettingsDialog
                canEdit={canEditDiagram}
                diagram={activeDiagram}
                model={model}
                onUpdated={(diagram) => {
                  setModel((current) => (current ? updateLiveModelFromDiagram(current, diagram, modelRef) : current));
                }}
              />
            </>
          ) : null}
          <AddTableDialog disabled={!canEditDiagram} onCreate={handleAddTable} />
          <Button
            className="gap-2"
            disabled={saveSnapshotMutation.isPending || !canCreateSnapshot}
            onClick={handleSaveSnapshot}
          >
            {saveSnapshotMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Snapshot
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

      <div
        className="grid min-h-0 flex-1 transition-[grid-template-columns] duration-200"
        style={{ gridTemplateColumns: `${leftSidebarWidth} minmax(0,1fr) ${rightSidebarWidth}` }}
      >
        <aside className="relative min-w-0 overflow-hidden border-r-2 border-[rgb(var(--tabliodb-border))] bg-white">
          {!leftSidebarOpen ? (
            <SidebarRail
              icon={PanelLeftOpen}
              label="Show left sidebar"
              onClick={() => setLeftSidebarOpen(true)}
              side="left"
            />
          ) : selectedTable ? (
            <TableStructureSidebar
              model={model}
              onClearTableSelection={() => setSelectedTableId(null)}
              onHide={() => setLeftSidebarOpen(false)}
              onModelChange={handleModelChange}
              readOnly={!canEditDiagram}
              selectedTableId={selectedTable.id}
            />
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex h-16 shrink-0 items-center gap-3 border-b-2 border-[rgb(var(--tabliodb-border))] px-5">
                <div className="grid size-9 place-items-center rounded-2xl bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]">
                  <Database className="size-5" />
                </div>
                <span className="min-w-0 flex-1 truncate text-base font-extrabold">Workspace</span>
                <IconButton icon={PanelLeftClose} label="Hide left sidebar" onClick={() => setLeftSidebarOpen(false)} />
              </div>
              <div className="tabliodb-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
                <WorkspaceSwitcher
                  activeOrganization={activeOrganization}
                  onSelect={(organization) => {
                    modelRef.current = null;
                    setModel(null);
                    setSelectedTableId(null);
                    setProjectSearchTerm('');
                    navigate(routes.workspace.to({ workspaceSlug: getOrganizationSlug(organization) }));
                  }}
                  organizations={organizations}
                />
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                    Projects
                  </span>
                  <CreateProjectDialog
                    organizationId={activeOrganization?.id ?? null}
                    onCreated={(project) => {
                      modelRef.current = null;
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
                          modelRef.current = null;
                          setModel(null);
                          setSelectedTableId(null);
                          navigate(
                            routes.project.to({ projectId: project.id, workspaceSlug: getWorkspaceSlug(project) }),
                          );
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
            </div>
          )}
        </aside>

        <section className="flex min-h-0 min-w-0">
          <SchemaCanvas
            fitKey={activeDiagram?.id ?? 'empty'}
            fitSignal={fitSignal}
            model={model}
            onModelChange={handleModelChange}
            onSelectedTableChange={handleSelectedTableChange}
            readOnly={!canEditDiagram}
            selectedTableId={selectedTableId}
          />
        </section>

        {rightSidebarOpen ? (
          <SchemaInspector
            latestSnapshotVersion={latestSnapshot?.version ?? 0}
            model={model}
            onHide={() => setRightSidebarOpen(false)}
            onModelChange={handleModelChange}
            readOnly={!canEditDiagram}
            selectedTableId={selectedTableId}
          />
        ) : (
          <aside className="min-w-0 overflow-hidden border-l-2 border-[rgb(var(--tabliodb-border))] bg-white">
            <SidebarRail
              icon={PanelRightOpen}
              label="Show inspector"
              onClick={() => setRightSidebarOpen(true)}
              side="right"
            />
          </aside>
        )}
      </div>
    </main>
  );
}

function getWorkspaceSlug(project: ProjectResponseDto): string {
  return project.organizationSlug || project.organizationId;
}

function getOrganizationSlug(organization: OrganizationDto): string {
  return organization.slug || organization.id;
}

function matchesWorkspaceRoute(organization: OrganizationDto, workspaceSlug: string | null): boolean {
  return Boolean(workspaceSlug && (organization.slug === workspaceSlug || organization.id === workspaceSlug));
}

function updateLiveModelFromDiagram(
  currentModel: DiagramModel,
  diagram: DiagramResponseDto,
  modelRef: { current: DiagramModel | null },
): DiagramModel {
  const nextModel = {
    ...currentModel,
    dialect: diagram.dialect,
    metadata: {
      ...currentModel.metadata,
      // Diagram metadata follows the server record immediately; version history is created only by the Snapshot action.
      name: diagram.name,
      updatedAt: new Date().toISOString(),
    },
  };

  modelRef.current = nextModel;

  return nextModel;
}

function SidebarRail({
  icon,
  label,
  onClick,
  side,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  onClick: () => void;
  side: 'left' | 'right';
}) {
  return (
    <div
      className={cn(
        'flex h-full min-h-0 items-start justify-center pt-3',
        side === 'left' ? 'border-r-0' : 'border-l-0',
      )}
    >
      <IconButton icon={icon} label={label} onClick={onClick} variant="ghost" />
    </div>
  );
}

function WorkspaceSwitcher({
  activeOrganization,
  onSelect,
  organizations,
}: {
  activeOrganization: OrganizationDto | null;
  onSelect: (organization: OrganizationDto) => void;
  organizations: OrganizationDto[];
}) {
  return (
    <div className="mb-5">
      <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
        Workspace
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex h-12 w-full cursor-pointer items-center gap-3 rounded-[16px] border-2 border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 text-left shadow-[0_3px_0_rgb(var(--tabliodb-border-strong))] transition hover:bg-[rgb(var(--tabliodb-surface))] active:translate-y-0.5 active:shadow-[0_1px_0_rgb(var(--tabliodb-border-strong))]"
            type="button"
          >
            <div className="grid size-8 shrink-0 place-items-center rounded-[12px] bg-[rgb(var(--tabliodb-sky-soft))] text-[rgb(var(--tabliodb-sky-text))]">
              <Building2 className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-extrabold">{activeOrganization?.name ?? 'Select workspace'}</div>
              <div className="truncate text-[11px] font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                {activeOrganization ? formatOrganizationRole(activeOrganization.role) : 'No workspace'}
              </div>
            </div>
            <ChevronsUpDown className="size-4 shrink-0 text-[rgb(var(--tabliodb-ink-muted))]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {organizations.map((organization) => {
            const isActive = organization.id === activeOrganization?.id;

            return (
              <DropdownMenuItem
                className="justify-between"
                key={organization.id}
                onSelect={() => {
                  if (!isActive) {
                    onSelect(organization);
                  }
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold">{organization.name}</span>
                  <span className="block truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                    {organization.slug}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge variant={isOrganizationManager(organization) ? 'blue' : 'neutral'}>
                    {formatOrganizationRole(organization.role)}
                  </Badge>
                  {isActive ? <Check className="size-4 text-[rgb(var(--tabliodb-primary-text))]" /> : null}
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function CreateProjectDialog({
  onCreated,
  organizationId,
}: {
  onCreated: (project: ProjectResponseDto) => void;
  organizationId: string | null;
}) {
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
      organizationId: organizationId ?? undefined,
    });
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button disabled={!organizationId} size="sm" variant="secondary">
          <FolderPlus className="size-4" />
          New
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(94vw,520px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>Create a workspace project for a schema, product area, or service.</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="grid gap-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Project name
                </span>
                <ControlledInput
                  autoFocus
                  aria-invalid={Boolean(errors.name)}
                  control={form.control}
                  disabled={!organizationId || createProjectMutation.isPending}
                  name="name"
                  placeholder="Billing Platform"
                />
                <FieldError>{errors.name?.message}</FieldError>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Description
                </span>
                <ControlledTextarea
                  aria-invalid={Boolean(errors.description)}
                  className="min-h-24 w-full resize-none rounded-[16px] border-2 border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 py-2 text-sm font-semibold outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-primary-soft))]"
                  control={form.control}
                  disabled={!organizationId || createProjectMutation.isPending}
                  name="description"
                  placeholder="Schemas for invoices, customers, and subscriptions."
                />
                <FieldError>{errors.description?.message}</FieldError>
              </label>

              {createProjectMutation.error ? (
                <div className="rounded-[14px] border-2 border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
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
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceSettingsDialog({
  organization,
  project,
}: {
  organization: OrganizationDto;
  project: ProjectResponseDto;
}) {
  const [open, setOpen] = useState(false);
  const canManageWorkspace = isOrganizationManager(organization);
  const form = useForm<WorkspaceSettingsFormState>({
    defaultValues: getWorkspaceSettingsDefaults(project),
    mode: 'onBlur',
    resolver: zodResolver(workspaceSettingsFormSchema),
  });
  const { errors } = form.formState;
  const settingsQueryOptions = organizationsQueries.settings(project.organizationId);
  const settingsQuery = useQuery({
    ...settingsQueryOptions,
    // Workspace settings tidak perlu di-fetch sebelum user membuka dialog, jadi modal menjadi fetch boundary.
    enabled: open && settingsQueryOptions.enabled !== false,
  });
  const auditLogsQueryOptions = organizationsQueries.auditLogs(project.organizationId, workspaceAuditLogQuery);
  const auditLogsQuery = useQuery({
    ...auditLogsQueryOptions,
    enabled: open && canManageWorkspace && auditLogsQueryOptions.enabled !== false,
  });
  const membersQueryOptions = organizationsQueries.members(project.organizationId, workspaceMemberPageQuery);
  const membersQuery = useQuery({
    ...membersQueryOptions,
    // Workspace members are admin-only data, so the dialog becomes the fetch boundary just like audit logs.
    enabled: open && canManageWorkspace && membersQueryOptions.enabled !== false,
  });
  const auditLogs = auditLogsQuery.data?.items ?? [];
  const workspaceMembers = membersQuery.data?.items ?? [];
  const updateSettingsMutation = useUpdateOrganizationSettingsMutation({
    mutationConfig: {
      onSuccess: (settings) => {
        // Response server menjadi source of truth karena slug bisa berubah mengikuti nama workspace.
        form.reset(getWorkspaceSettingsDefaults(project, settings));
      },
    },
  });
  const updateMemberMutation = useUpdateOrganizationMemberMutation();
  const removeMemberMutation = useRemoveOrganizationMemberMutation();
  const isWorkspaceMemberMutationPending = updateMemberMutation.isPending || removeMemberMutation.isPending;

  useEffect(() => {
    if (open) {
      form.reset(getWorkspaceSettingsDefaults(project, settingsQuery.data));
      updateSettingsMutation.reset();
      updateMemberMutation.reset();
      removeMemberMutation.reset();
    }
  }, [form, open, project, settingsQuery.data]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && (updateSettingsMutation.isPending || isWorkspaceMemberMutationPending)) {
      return;
    }

    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset(getWorkspaceSettingsDefaults(project, settingsQuery.data));
      updateSettingsMutation.reset();
      updateMemberMutation.reset();
      removeMemberMutation.reset();
    }
  }

  function handleSubmit(values: WorkspaceSettingsFormState) {
    if (!canManageWorkspace) {
      return;
    }

    updateSettingsMutation.mutate({
      body: {
        allowMemberProjectCreate: values.allowMemberProjectCreate,
        defaultProjectRole: values.defaultProjectRole === 'none' ? null : values.defaultProjectRole,
        name: values.name,
      },
      organizationId: project.organizationId,
    });
  }

  function handleUpdateWorkspaceMemberRole(member: OrganizationMemberDto, role: OrganizationRole) {
    if (member.role === role) {
      return;
    }

    updateMemberMutation.mutate({
      body: { role },
      organizationId: project.organizationId,
      userId: member.userId,
    });
  }

  function handleRemoveWorkspaceMember(member: OrganizationMemberDto) {
    removeMemberMutation.mutate({
      organizationId: project.organizationId,
      userId: member.userId,
    });
  }

  const memberMutationError = updateMemberMutation.error ?? removeMemberMutation.error;
  const updatingUserId = updateMemberMutation.isPending ? updateMemberMutation.variables?.userId : null;
  const removingUserId = removeMemberMutation.isPending ? removeMemberMutation.variables?.userId : null;

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <IconButton icon={Building2} label="Workspace settings" variant="secondary" />
      </DialogTrigger>
      <DialogContent className="w-[min(94vw,680px)]">
        <DialogHeader>
          <DialogTitle>Workspace settings</DialogTitle>
          <DialogDescription>Configure the current workspace without changing the Tabliodb brand.</DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-5">
          <form className="grid gap-4" id="workspace-settings-form" onSubmit={form.handleSubmit(handleSubmit)}>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Workspace name
              </span>
              <ControlledInput
                aria-invalid={Boolean(errors.name)}
                control={form.control}
                disabled={settingsQuery.isPending || updateSettingsMutation.isPending || !canManageWorkspace}
                name="name"
              />
              <FieldError>{errors.name?.message}</FieldError>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Default project role
                </span>
                <ControlledSelect
                  className={selectClassName}
                  control={form.control}
                  disabled={settingsQuery.isPending || updateSettingsMutation.isPending || !canManageWorkspace}
                  name="defaultProjectRole"
                  options={workspaceDefaultRoleOptions.map((role) => ({
                    label: role === 'none' ? 'No automatic project role' : formatProjectRole(role),
                    value: role,
                  }))}
                />
              </label>

              <label className="mt-6 flex min-h-11 cursor-pointer items-center gap-3 rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold transition hover:bg-[rgb(var(--tabliodb-surface))]">
                <ControlledCheckbox
                  control={form.control}
                  disabled={settingsQuery.isPending || updateSettingsMutation.isPending || !canManageWorkspace}
                  name="allowMemberProjectCreate"
                />
                Members can create projects
              </label>
            </div>

            {settingsQuery.error || updateSettingsMutation.error ? (
              <div className="rounded-[14px] border-2 border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                {getErrorMessage(settingsQuery.error ?? updateSettingsMutation.error)}
              </div>
            ) : null}
          </form>

          {canManageWorkspace ? (
            <section className="border-t-2 border-[rgb(var(--tabliodb-border))] pt-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-extrabold">
                    <UsersRound className="size-4 text-[rgb(var(--tabliodb-sky-text))]" />
                    Workspace members
                  </h3>
                  <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                    {membersQuery.data?.totalCount ?? workspaceMembers.length} people with workspace access
                  </p>
                </div>
                <Badge variant="green">{workspaceMembers.length} loaded</Badge>
              </div>

              {membersQuery.isPending ? (
                <div className="mt-4 flex items-center gap-2 rounded-[16px] border-2 border-[rgb(var(--tabliodb-border))] bg-white p-4 text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                  <Loader2 className="size-4 animate-spin" />
                  Loading members
                </div>
              ) : membersQuery.error ? (
                <div className="mt-4 rounded-[14px] border-2 border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                  {getErrorMessage(membersQuery.error)}
                </div>
              ) : workspaceMembers.length === 0 ? (
                <div className="mt-4 rounded-[16px] border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-4 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                  No workspace members yet
                </div>
              ) : (
                <div className="tabliodb-scrollbar mt-4 max-h-72 overflow-y-auto rounded-[16px] border-2 border-[rgb(var(--tabliodb-border))] bg-white">
                  <div className="divide-y divide-[rgb(var(--tabliodb-border))]">
                    {workspaceMembers.map((member) => (
                      <OrganizationMemberRow
                        isRemoving={removingUserId === member.userId}
                        isUpdating={updatingUserId === member.userId}
                        key={member.userId}
                        member={member}
                        onRemove={handleRemoveWorkspaceMember}
                        onRoleChange={handleUpdateWorkspaceMemberRole}
                      />
                    ))}
                  </div>
                </div>
              )}

              {memberMutationError ? (
                <div className="mt-4 rounded-[14px] border-2 border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                  {getErrorMessage(memberMutationError)}
                </div>
              ) : null}
            </section>
          ) : (
            <section className="border-t-2 border-[rgb(var(--tabliodb-border))] pt-5">
              <div className="rounded-[16px] border-2 border-[rgb(var(--tabliodb-border))] bg-white p-4 text-sm font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                Your workspace role is {formatOrganizationRole(organization.role)}. Owner or Admin access is required to
                manage workspace settings and members.
              </div>
            </section>
          )}

          {canManageWorkspace ? (
            <section className="border-t-2 border-[rgb(var(--tabliodb-border))] pt-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold">Recent activity</h3>
                  <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                    Project and workspace changes recorded by the server
                  </p>
                </div>
                <Badge variant="blue">{auditLogs.length} loaded</Badge>
              </div>

              {auditLogsQuery.isPending ? (
                <div className="mt-4 flex items-center gap-2 rounded-[16px] border-2 border-[rgb(var(--tabliodb-border))] bg-white p-4 text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                  <Loader2 className="size-4 animate-spin" />
                  Loading activity
                </div>
              ) : auditLogsQuery.error ? (
                <div className="mt-4 rounded-[14px] border-2 border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                  {getErrorMessage(auditLogsQuery.error)}
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="mt-4 rounded-[16px] border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-4 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                  No activity yet
                </div>
              ) : (
                <div className="tabliodb-scrollbar mt-4 max-h-72 overflow-y-auto rounded-[16px] border-2 border-[rgb(var(--tabliodb-border))] bg-white">
                  <div className="divide-y divide-[rgb(var(--tabliodb-border))]">
                    {auditLogs.map((auditLog) => (
                      <AuditLogRow auditLog={auditLog} key={auditLog.id} />
                    ))}
                  </div>
                </div>
              )}
            </section>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button
            disabled={updateSettingsMutation.isPending || isWorkspaceMemberMutationPending}
            onClick={() => handleOpenChange(false)}
            type="button"
            variant="secondary"
          >
            Close
          </Button>
          <Button
            disabled={
              settingsQuery.isPending ||
              updateSettingsMutation.isPending ||
              isWorkspaceMemberMutationPending ||
              !canManageWorkspace
            }
            form="workspace-settings-form"
            type="submit"
          >
            {updateSettingsMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectSettingsDialog({ onArchived, project }: { onArchived: () => void; project: ProjectResponseDto }) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [open, setOpen] = useState(false);
  const form = useForm<ProjectFormState>({
    defaultValues: getProjectFormDefaults(project),
    mode: 'onBlur',
    resolver: zodResolver(projectFormSchema),
  });
  const memberForm = useForm<MemberFormState>({
    defaultValues: memberFormDefaults,
    mode: 'onBlur',
    resolver: zodResolver(memberFormSchema),
  });
  const { errors } = form.formState;
  const { errors: memberErrors } = memberForm.formState;
  const membersQueryOptions = projectsQueries.members(project.id, projectMemberPageQuery);
  const membersQuery = useQuery({
    ...membersQueryOptions,
    // Member list is only needed while the modal is visible, so opening settings becomes the fetch boundary.
    enabled: open && membersQueryOptions.enabled !== false,
  });
  const members = membersQuery.data?.items ?? [];

  useEffect(() => {
    if (open) {
      // Opening settings always reflects the latest project data from query cache.
      form.reset(getProjectFormDefaults(project));
      memberForm.reset(memberFormDefaults);
      setConfirmArchive(false);
    }
  }, [form, memberForm, open, project]);

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
  const addProjectMemberMutation = useAddProjectMemberMutation({
    mutationConfig: {
      onSuccess: () => {
        // Keep the role sticky at viewer after add so repeated safe invites are quick, but clear the consumed email.
        memberForm.reset(memberFormDefaults);
      },
    },
  });
  const updateProjectMemberMutation = useUpdateProjectMemberMutation();
  const removeProjectMemberMutation = useRemoveProjectMemberMutation();
  const isProjectMutationPending = updateProjectMutation.isPending || archiveProjectMutation.isPending;
  const isMemberMutationPending =
    addProjectMemberMutation.isPending ||
    updateProjectMemberMutation.isPending ||
    removeProjectMemberMutation.isPending;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && (isProjectMutationPending || isMemberMutationPending)) {
      return;
    }

    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset(getProjectFormDefaults(project));
      memberForm.reset(memberFormDefaults);
      setConfirmArchive(false);
      updateProjectMutation.reset();
      archiveProjectMutation.reset();
      addProjectMemberMutation.reset();
      updateProjectMemberMutation.reset();
      removeProjectMemberMutation.reset();
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

    archiveProjectMutation.mutate({ organizationId: project.organizationId, projectId: project.id });
  }

  function handleAddMember(values: MemberFormState) {
    addProjectMemberMutation.mutate({
      body: {
        email: values.email,
        role: values.role,
      },
      projectId: project.id,
    });
  }

  function handleUpdateMemberRole(member: ProjectMemberDto, role: ProjectRole) {
    if (member.role === role) {
      return;
    }

    updateProjectMemberMutation.mutate({
      body: { role },
      projectId: project.id,
      userId: member.userId,
    });
  }

  function handleRemoveMember(member: ProjectMemberDto) {
    removeProjectMemberMutation.mutate({
      projectId: project.id,
      userId: member.userId,
    });
  }

  const mutationError = updateProjectMutation.error ?? archiveProjectMutation.error;
  const memberMutationError =
    addProjectMemberMutation.error ?? updateProjectMemberMutation.error ?? removeProjectMemberMutation.error;
  const updatingUserId = updateProjectMemberMutation.isPending ? updateProjectMemberMutation.variables?.userId : null;
  const removingUserId = removeProjectMemberMutation.isPending ? removeProjectMemberMutation.variables?.userId : null;

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <IconButton icon={Settings} label="Project settings" variant="secondary" />
      </DialogTrigger>
      <DialogContent className="w-[min(94vw,680px)]">
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
          <DialogDescription>Manage project details, access, and archive state.</DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-5">
          <form className="grid gap-4" id="project-settings-form" onSubmit={form.handleSubmit(handleSubmit)}>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Project name
              </span>
              <ControlledInput
                aria-invalid={Boolean(errors.name)}
                control={form.control}
                disabled={isProjectMutationPending}
                name="name"
              />
              <FieldError>{errors.name?.message}</FieldError>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Description
              </span>
              <ControlledTextarea
                aria-invalid={Boolean(errors.description)}
                className="min-h-24 w-full resize-none rounded-[16px] border-2 border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 py-2 text-sm font-semibold outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-primary-soft))]"
                control={form.control}
                disabled={isProjectMutationPending}
                name="description"
              />
              <FieldError>{errors.description?.message}</FieldError>
            </label>

            {mutationError ? (
              <div className="rounded-[14px] border-2 border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                {getErrorMessage(mutationError)}
              </div>
            ) : null}
          </form>

          <section className="border-t-2 border-[rgb(var(--tabliodb-border))] pt-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-extrabold">
                  <UsersRound className="size-4 text-[rgb(var(--tabliodb-sky-text))]" />
                  Project members
                </h3>
                <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                  {membersQuery.data?.totalCount ?? members.length} people with direct project access
                </p>
              </div>
              <Badge variant="green">{members.length} loaded</Badge>
            </div>

            <form
              className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_auto]"
              onSubmit={memberForm.handleSubmit(handleAddMember)}
            >
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Email
                </span>
                <ControlledInput
                  aria-invalid={Boolean(memberErrors.email)}
                  autoComplete="email"
                  control={memberForm.control}
                  disabled={isMemberMutationPending}
                  name="email"
                  placeholder="teammate@example.com"
                  type="email"
                />
                <FieldError>{memberErrors.email?.message}</FieldError>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Role
                </span>
                <ControlledSelect
                  className={selectClassName}
                  control={memberForm.control}
                  disabled={isMemberMutationPending}
                  name="role"
                  options={projectRoleOptions.map((role) => ({
                    label: formatProjectRole(role),
                    value: role,
                  }))}
                />
              </label>
              <Button className="self-start sm:mt-6" disabled={isMemberMutationPending} type="submit">
                {addProjectMemberMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                Add
              </Button>
            </form>

            {membersQuery.isPending ? (
              <div className="mt-4 flex items-center gap-2 rounded-[16px] border-2 border-[rgb(var(--tabliodb-border))] bg-white p-4 text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                <Loader2 className="size-4 animate-spin" />
                Loading members
              </div>
            ) : membersQuery.error ? (
              <div className="mt-4 rounded-[14px] border-2 border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                {getErrorMessage(membersQuery.error)}
              </div>
            ) : members.length === 0 ? (
              <div className="mt-4 rounded-[16px] border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-4 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                No project members yet
              </div>
            ) : (
              <div className="tabliodb-scrollbar mt-4 max-h-72 overflow-y-auto rounded-[16px] border-2 border-[rgb(var(--tabliodb-border))] bg-white">
                <div className="divide-y divide-[rgb(var(--tabliodb-border))]">
                  {members.map((member) => (
                    <ProjectMemberRow
                      isRemoving={removingUserId === member.userId}
                      isUpdating={updatingUserId === member.userId}
                      key={member.userId}
                      member={member}
                      onRemove={handleRemoveMember}
                      onRoleChange={handleUpdateMemberRole}
                    />
                  ))}
                </div>
              </div>
            )}

            {memberMutationError ? (
              <div className="mt-4 rounded-[14px] border-2 border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                {getErrorMessage(memberMutationError)}
              </div>
            ) : null}
          </section>
        </DialogBody>

        <DialogFooter className="justify-between sm:justify-between">
          <Button
            disabled={isProjectMutationPending || isMemberMutationPending}
            onClick={handleArchive}
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
              disabled={isProjectMutationPending || isMemberMutationPending}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              disabled={isProjectMutationPending || isMemberMutationPending}
              form="project-settings-form"
              type="submit"
            >
              {updateProjectMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiagramSettingsDialog({
  canEdit,
  diagram,
  model,
  onUpdated,
}: {
  canEdit: boolean;
  diagram: DiagramResponseDto;
  model: DiagramModel;
  onUpdated: (diagram: DiagramResponseDto) => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<DiagramSettingsFormState>({
    defaultValues: getDiagramSettingsDefaults(diagram),
    mode: 'onBlur',
    resolver: zodResolver(diagramSettingsFormSchema),
  });
  const { errors } = form.formState;
  const updateDiagramMutation = useUpdateDiagramMutation({
    mutationConfig: {
      onSuccess: (updatedDiagram) => {
        // Server response is the canonical diagram metadata, so the form and live model are reset from that exact payload.
        form.reset(getDiagramSettingsDefaults(updatedDiagram));
        onUpdated(updatedDiagram);
        setOpen(false);
      },
    },
  });
  const isPending = updateDiagramMutation.isPending;
  const hasUnsavedDialectChange = model.dialect !== diagram.dialect;

  useEffect(() => {
    if (open) {
      form.reset(getDiagramSettingsDefaults(diagram));
      updateDiagramMutation.reset();
    }
  }, [diagram, form, open]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isPending) {
      return;
    }

    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset(getDiagramSettingsDefaults(diagram));
      updateDiagramMutation.reset();
    }
  }

  function handleSubmit(values: DiagramSettingsFormState) {
    if (!canEdit) {
      return;
    }

    updateDiagramMutation.mutate({
      body: {
        dialect: values.dialect,
        name: values.name,
      },
      diagramId: diagram.id,
    });
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <IconButton icon={SlidersHorizontal} label="Diagram settings" variant="secondary" />
      </DialogTrigger>
      <DialogContent className="w-[min(94vw,520px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Diagram settings</DialogTitle>
            <DialogDescription>
              Rename the active diagram and choose the SQL dialect for generated output.
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
                  disabled={isPending || !canEdit}
                  name="name"
                />
                <FieldError>{errors.name?.message}</FieldError>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  SQL dialect
                </span>
                <ControlledSelect
                  className={selectClassName}
                  control={form.control}
                  disabled={isPending || !canEdit}
                  name="dialect"
                  options={diagramDialectOptions.map((dialect) => ({
                    label: formatDiagramDialect(dialect),
                    value: dialect,
                  }))}
                />
                <FieldError>{errors.dialect?.message}</FieldError>
              </label>

              {!canEdit ? (
                <div className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-gold-text))]">
                  Your project role can view this diagram but cannot update diagram settings.
                </div>
              ) : null}

              {hasUnsavedDialectChange ? (
                <div className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-sky-text))]">
                  The open snapshot uses {formatDiagramDialect(model.dialect)} while the diagram record uses{' '}
                  {formatDiagramDialect(diagram.dialect)}.
                </div>
              ) : null}

              {updateDiagramMutation.error ? (
                <div className="rounded-[14px] border-2 border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                  {getErrorMessage(updateDiagramMutation.error)}
                </div>
              ) : null}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button disabled={isPending} onClick={() => handleOpenChange(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button disabled={isPending || !canEdit} type="submit">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save diagram
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getDiagramSettingsDefaults(diagram: DiagramResponseDto): DiagramSettingsFormState {
  return {
    dialect: diagram.dialect,
    name: diagram.name,
  };
}

function getProjectFormDefaults(project: ProjectResponseDto): ProjectFormState {
  return {
    description: project.description ?? '',
    name: project.name,
  };
}

function getWorkspaceSettingsDefaults(
  project: ProjectResponseDto,
  settings?: OrganizationSettingsDto,
): WorkspaceSettingsFormState {
  return {
    allowMemberProjectCreate: settings?.allowMemberProjectCreate ?? true,
    defaultProjectRole: settings?.defaultProjectRole ?? 'none',
    name: settings?.name ?? project.organizationName,
  };
}

function toOptionalDescription(value: string | undefined): string | undefined {
  const description = value?.trim();
  return description ? description : undefined;
}

function AuditLogRow({ auditLog }: { auditLog: AuditLogDto }) {
  return (
    <article className="grid gap-2 p-3 transition hover:bg-[rgb(var(--tabliodb-surface))] sm:grid-cols-[minmax(0,1fr)_120px] sm:items-center">
      <div className="min-w-0">
        <div className="truncate text-sm font-extrabold">{formatAuditLogMessage(auditLog)}</div>
        <p className="mt-1 truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
          {auditLog.actorName ?? auditLog.actorEmail ?? 'System'} - {formatDateTime(auditLog.createdAt)}
        </p>
      </div>
      <Badge variant={getAuditLogTone(auditLog.action)}>{formatAuditLogAction(auditLog.action)}</Badge>
    </article>
  );
}

function ProjectMemberRow({
  isRemoving,
  isUpdating,
  member,
  onRemove,
  onRoleChange,
}: {
  isRemoving: boolean;
  isUpdating: boolean;
  member: ProjectMemberDto;
  onRemove: (member: ProjectMemberDto) => void;
  onRoleChange: (member: ProjectMemberDto, role: ProjectRole) => void;
}) {
  const isBusy = isRemoving || isUpdating;

  return (
    <article className="grid gap-3 p-3 transition hover:bg-[rgb(var(--tabliodb-surface))] sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="grid size-10 shrink-0 place-items-center rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-primary-soft))] text-xs font-extrabold text-[rgb(var(--tabliodb-primary-text))]"
          style={member.avatarColor ? { backgroundColor: member.avatarColor } : undefined}
        >
          {getMemberInitials(member)}
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h4 className="truncate text-sm font-extrabold">{member.name}</h4>
            <ProjectRoleBadge role={member.role} />
          </div>
          <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">{member.email}</p>
        </div>
      </div>
      <Select
        className={selectClassName}
        disabled={isBusy}
        onValueChange={(role) => onRoleChange(member, role as ProjectRole)}
        options={projectRoleOptions.map((role) => ({
          label: formatProjectRole(role),
          value: role,
        }))}
        value={member.role}
      />
      <Button
        aria-label={`Remove ${member.name}`}
        disabled={isBusy}
        onClick={() => onRemove(member)}
        size="icon"
        variant="ghost"
      >
        {isRemoving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </Button>
    </article>
  );
}

function OrganizationMemberRow({
  isRemoving,
  isUpdating,
  member,
  onRemove,
  onRoleChange,
}: {
  isRemoving: boolean;
  isUpdating: boolean;
  member: OrganizationMemberDto;
  onRemove: (member: OrganizationMemberDto) => void;
  onRoleChange: (member: OrganizationMemberDto, role: OrganizationRole) => void;
}) {
  const isBusy = isRemoving || isUpdating;

  return (
    <article className="grid gap-3 p-3 transition hover:bg-[rgb(var(--tabliodb-surface))] sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="grid size-10 shrink-0 place-items-center rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-primary-soft))] text-xs font-extrabold text-[rgb(var(--tabliodb-primary-text))]"
          style={member.avatarColor ? { backgroundColor: member.avatarColor } : undefined}
        >
          {getMemberInitials(member)}
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h4 className="truncate text-sm font-extrabold">{member.name}</h4>
            <OrganizationRoleBadge role={member.role} />
          </div>
          <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">{member.email}</p>
        </div>
      </div>
      <Select
        className={selectClassName}
        disabled={isBusy}
        onValueChange={(role) => onRoleChange(member, role as OrganizationRole)}
        options={organizationRoleOptions.map((role) => ({
          label: formatOrganizationRole(role),
          value: role,
        }))}
        value={member.role}
      />
      <Button
        aria-label={`Remove ${member.name}`}
        disabled={isBusy}
        onClick={() => onRemove(member)}
        size="icon"
        variant="ghost"
      >
        {isRemoving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </Button>
    </article>
  );
}

function ProjectRoleBadge({ role }: { role: ProjectRole }) {
  if (role === ProjectRole.Owner) {
    return <Badge variant="yellow">{formatProjectRole(role)}</Badge>;
  }

  if (role === ProjectRole.Editor) {
    return <Badge variant="green">{formatProjectRole(role)}</Badge>;
  }

  if (role === ProjectRole.Commenter) {
    return <Badge variant="blue">{formatProjectRole(role)}</Badge>;
  }

  return <Badge>{formatProjectRole(role)}</Badge>;
}

function OrganizationRoleBadge({ role }: { role: OrganizationRole }) {
  if (role === OrganizationRole.Owner) {
    return <Badge variant="yellow">{formatOrganizationRole(role)}</Badge>;
  }

  if (role === OrganizationRole.Admin) {
    return <Badge variant="blue">{formatOrganizationRole(role)}</Badge>;
  }

  if (role === OrganizationRole.Member) {
    return <Badge variant="green">{formatOrganizationRole(role)}</Badge>;
  }

  return <Badge>{formatOrganizationRole(role)}</Badge>;
}

function formatProjectRole(role: ProjectRole): string {
  return {
    [ProjectRole.Commenter]: 'Commenter',
    [ProjectRole.Editor]: 'Editor',
    [ProjectRole.Owner]: 'Owner',
    [ProjectRole.Viewer]: 'Viewer',
  }[role];
}

function formatDiagramDialect(dialect: DatabaseDialect): string {
  return {
    mariadb: 'MariaDB',
    mysql: 'MySQL',
    postgresql: 'PostgreSQL',
    sqlite: 'SQLite',
    sqlserver: 'SQL Server',
  }[dialect];
}

function formatOrganizationRole(role: OrganizationDto['role']): string {
  return {
    [OrganizationRole.Admin]: 'Admin',
    [OrganizationRole.Guest]: 'Guest',
    [OrganizationRole.Member]: 'Member',
    [OrganizationRole.Owner]: 'Owner',
  }[role];
}

function isOrganizationManager(organization: OrganizationDto): boolean {
  return organization.role === 'owner' || organization.role === 'admin';
}

function hasProjectPermission(role: ProjectRole, permission: Permission): boolean {
  return isGranted({
    current: permissionsForProjectRole(role),
    requested: [permission],
  });
}

function formatAuditLogMessage(auditLog: AuditLogDto): string {
  if (auditLog.action === 'project.created') {
    return `Created project ${readMetadataString(auditLog.metadata, 'name', 'project')}`;
  }

  if (auditLog.action === 'project.archived') {
    return `Archived project ${readMetadataString(auditLog.metadata, 'name', 'project')}`;
  }

  if (auditLog.action === 'project.member_added') {
    return `Added ${readMetadataString(auditLog.metadata, 'email', 'member')} as ${formatProjectRoleValue(
      readMetadataString(auditLog.metadata, 'role', ProjectRole.Viewer),
    )}`;
  }

  if (auditLog.action === 'project.member_removed') {
    return `Removed ${readMetadataString(auditLog.metadata, 'email', 'member')} from project access`;
  }

  if (auditLog.action === 'project.member_role_updated') {
    const role = readMetadataRecord(auditLog.metadata, 'role');
    return `Changed ${readMetadataString(auditLog.metadata, 'email', 'member')} from ${formatProjectRoleValue(
      readMetadataString(role, 'before', ProjectRole.Viewer),
    )} to ${formatProjectRoleValue(readMetadataString(role, 'after', ProjectRole.Viewer))}`;
  }

  if (auditLog.action === 'organization.member_removed') {
    return `Removed ${readMetadataString(auditLog.metadata, 'email', 'member')} from workspace access`;
  }

  if (auditLog.action === 'organization.member_role_updated') {
    const role = readMetadataRecord(auditLog.metadata, 'role');
    return `Changed ${readMetadataString(auditLog.metadata, 'email', 'member')} from ${formatOrganizationRoleValue(
      readMetadataString(role, 'before', OrganizationRole.Guest),
    )} to ${formatOrganizationRoleValue(readMetadataString(role, 'after', OrganizationRole.Guest))}`;
  }

  if (auditLog.action === 'organization.settings_updated') {
    const changes = readMetadataRecord(auditLog.metadata, 'changes');
    const changedFields = Object.keys(changes);
    return changedFields.length > 0 ? `Updated workspace ${changedFields.join(', ')}` : 'Updated workspace settings';
  }

  return auditLog.action;
}

function formatAuditLogAction(action: string): string {
  return (
    {
      'organization.settings_updated': 'Workspace',
      'organization.member_removed': 'Removed',
      'organization.member_role_updated': 'Role',
      'project.archived': 'Archived',
      'project.created': 'Created',
      'project.member_added': 'Member',
      'project.member_removed': 'Removed',
      'project.member_role_updated': 'Role',
    }[action] ?? 'Audit'
  );
}

function getAuditLogTone(action: string): 'blue' | 'green' | 'neutral' | 'yellow' {
  if (action === 'project.created' || action === 'project.member_added') {
    return 'green';
  }

  if (
    action === 'organization.member_removed' ||
    action === 'project.archived' ||
    action === 'project.member_removed'
  ) {
    return 'yellow';
  }

  if (
    action === 'organization.member_role_updated' ||
    action === 'organization.settings_updated' ||
    action === 'project.member_role_updated'
  ) {
    return 'blue';
  }

  return 'neutral';
}

function readMetadataRecord(metadata: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = metadata[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readMetadataString(metadata: Record<string, unknown>, key: string, fallback: string): string {
  const value = metadata[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function formatProjectRoleValue(role: string): string {
  if (Object.values(ProjectRole).includes(role as ProjectRole)) {
    return formatProjectRole(role as ProjectRole);
  }

  return role;
}

function formatOrganizationRoleValue(role: string): string {
  if (Object.values(OrganizationRole).includes(role as OrganizationRole)) {
    return formatOrganizationRole(role as OrganizationRole);
  }

  return role;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function getMemberInitials(member: Pick<ProjectMemberDto, 'email' | 'name'>): string {
  const source = member.name.trim() || member.email;

  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function AddTableDialog({
  disabled = false,
  onCreate,
}: {
  disabled?: boolean;
  onCreate: (tableName?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<AddTableFormState>({
    defaultValues: {
      tableName: '',
    },
    resolver: zodResolver(addTableFormSchema),
  });
  const { errors } = form.formState;

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && disabled) {
      return;
    }

    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset();
    }
  }

  function handleSubmit(values: AddTableFormState) {
    if (disabled) {
      return;
    }

    onCreate(values.tableName || undefined);
    form.reset();
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button className="ml-2 gap-2" disabled={disabled} variant="secondary">
          <Plus className="size-4" />
          Table
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>New table</DialogTitle>
            <DialogDescription>
              Give the table a friendly SQL-safe name. Spaces will become underscores.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <label className="block text-sm">
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
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button disabled={disabled} type="submit">
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
