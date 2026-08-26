import {
  OrganizationRole,
  Permission,
  isGranted,
  permissionsForProjectRole,
  type OrganizationRoleValue,
  type ProjectRoleValue,
} from '@tabliodb/shared';
import type { DiagramModel } from '@tabliodb/schema-core';
import {
  Role as SdkOrganizationRole,
  type DiagramResponseDtoOutput,
  type OrganizationDtoOutput,
  type ProjectResponseDtoOutput,
} from '@tabliodb/sdk';
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  Input,
  cn,
} from '@tabliodb/ui';
import {
  Building2,
  Check,
  ChevronsUpDown,
  FileText,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from 'react';
import { DiagramSettingsDialog } from './DiagramSettingsDialog';
import { DialectBadge } from './DialectIcon';
import { MoveDiagramDialog } from './MoveDiagramDialog';
import { ProjectSettingsDialog } from './ProjectSettingsDialog';
import { WorkspaceSettingsDialog } from './WorkspaceSettingsDialog';

type DiagramResponseDto = DiagramResponseDtoOutput;
type OrganizationDto = OrganizationDtoOutput;
type ProjectResponseDto = ProjectResponseDtoOutput;

export function WorkspaceProjectSwitcher({
  activeDiagram,
  activeOrganization,
  activeProject,
  canCreateDiagram,
  canCreateProject,
  canEditDiagram,
  canManageWorkspace,
  currentUserId,
  diagramLibraryOpen,
  diagrams,
  model,
  onCreateDiagram,
  onCreateProject,
  onCreateWorkspace,
  onDiagramSelect,
  onDiagramLibraryOpenChange,
  onDiagramUpdated,
  onOrganizationSelect,
  onProjectArchived,
  organizations,
  projects,
  stackedDialogOpen,
}: {
  activeDiagram: DiagramResponseDto;
  activeOrganization: OrganizationDto;
  activeProject: ProjectResponseDto | null;
  canCreateDiagram: boolean;
  canCreateProject: boolean;
  canEditDiagram: boolean;
  canManageWorkspace: boolean;
  currentUserId: string;
  diagramLibraryOpen: boolean;
  diagrams: DiagramResponseDto[];
  model: DiagramModel;
  onCreateDiagram: (projectId?: string | null) => void;
  onCreateProject: () => void;
  onCreateWorkspace: () => void;
  onDiagramSelect: (diagram: DiagramResponseDto) => void;
  onDiagramLibraryOpenChange: (open: boolean) => void;
  onDiagramUpdated: (diagram: DiagramResponseDto) => void;
  onOrganizationSelect: (organization: OrganizationDto) => void;
  onProjectArchived: () => void;
  organizations: OrganizationDto[];
  projects: ProjectResponseDto[];
  stackedDialogOpen: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 border-l border-[rgb(var(--tabliodb-border))] pl-2 sm:pl-3">
      <WorkspaceSwitcher
        activeOrganization={activeOrganization}
        canManageWorkspace={canManageWorkspace}
        currentUserId={currentUserId}
        onCreateWorkspace={onCreateWorkspace}
        onOrganizationSelect={onOrganizationSelect}
        organizations={organizations}
      />
      <DiagramNavigator
        activeDiagram={activeDiagram}
        activeProject={activeProject}
        canCreateDiagram={canCreateDiagram}
        canCreateProject={canCreateProject}
        canEditDiagram={canEditDiagram}
        currentUserId={currentUserId}
        diagrams={diagrams}
        model={model}
        onCreateDiagram={onCreateDiagram}
        onCreateProject={onCreateProject}
        onDiagramSelect={onDiagramSelect}
        onDiagramLibraryOpenChange={onDiagramLibraryOpenChange}
        onDiagramUpdated={onDiagramUpdated}
        onProjectArchived={onProjectArchived}
        open={diagramLibraryOpen}
        projects={projects}
        stackedDialogOpen={stackedDialogOpen}
      />
    </div>
  );
}

function WorkspaceSwitcher({
  activeOrganization,
  canManageWorkspace,
  currentUserId,
  onCreateWorkspace,
  onOrganizationSelect,
  organizations,
}: {
  activeOrganization: OrganizationDto;
  canManageWorkspace: boolean;
  currentUserId: string;
  onCreateWorkspace: () => void;
  onOrganizationSelect: (organization: OrganizationDto) => void;
  organizations: OrganizationDto[];
}) {
  const [open, setOpen] = useState(false);
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-11 min-w-0 max-w-[180px] cursor-pointer items-center gap-2 rounded-[var(--tabliodb-radius-md)] px-2 text-left transition hover:bg-[rgb(var(--tabliodb-surface-raised))]"
          type="button"
        >
          <Building2 className="size-4 shrink-0 text-[rgb(var(--tabliodb-ink-muted))]" />
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-extrabold uppercase leading-4 tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Workspace
            </span>
            <span className="block truncate text-[13px] font-extrabold leading-4">{activeOrganization.name}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-[rgb(var(--tabliodb-ink-muted))]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[min(72vh,420px)] w-[min(92vw,320px)] overflow-hidden p-2">
        <div className="px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Switch workspace
        </div>
        <div className="tabliodb-scrollbar mt-1 grid max-h-[min(48vh,280px)] gap-1 overflow-y-auto pr-1">
          {organizations.map((organization) => {
            const isActive = organization.id === activeOrganization.id;

            return (
              <DropdownMenuItem
                className="justify-between"
                key={organization.id}
                onSelect={() => {
                  if (!isActive) {
                    onOrganizationSelect(organization);
                  }

                  setOpen(false);
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-extrabold">{organization.name}</span>
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
        </div>
        <div className="mt-2 border-t border-[rgb(var(--tabliodb-border))] pt-2">
          <Button
            className="w-full justify-center gap-2"
            onClick={(event) => {
              event.preventDefault();
              setOpen(false);
              // Workspace creation belongs to the workspace switcher because it changes the collaboration space, not the current diagram.
              onCreateWorkspace();
            }}
            size="sm"
            variant="secondary"
          >
            <Plus className="size-4" />
            New workspace
          </Button>
          {canManageWorkspace ? (
            <button
              className="mt-1 flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--tabliodb-radius-md)] border border-transparent px-3 text-[13px] font-black text-[rgb(var(--tabliodb-ink))] transition hover:border-[rgb(var(--tabliodb-border))] hover:bg-[rgb(var(--tabliodb-surface-raised))] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--tabliodb-focus-ring))]"
              onClick={(event) => {
                event.preventDefault();
                setOpen(false);
                // Workspace settings lives with the workspace switcher because it configures the container, not the active ERD canvas.
                setWorkspaceSettingsOpen(true);
              }}
              type="button"
            >
              <Settings className="size-4" />
              Workspace settings
            </button>
          ) : null}
        </div>
      </DropdownMenuContent>
      {canManageWorkspace ? (
        <WorkspaceSettingsDialog
          currentUserId={currentUserId}
          onOpenChange={setWorkspaceSettingsOpen}
          open={workspaceSettingsOpen}
          organization={activeOrganization}
          trigger={null}
        />
      ) : null}
    </DropdownMenu>
  );
}

const allDiagramFilterId = '__all_diagrams__';
const rootDiagramFilterId = '__root_diagrams__';

type LibraryContextMenuState = {
  left: number;
  top: number;
} & (
  | {
      kind: 'diagram';
      diagramId: string;
    }
  | {
      kind: 'folder';
      projectId: string;
    }
);

function DiagramNavigator({
  activeDiagram,
  activeProject,
  canCreateDiagram,
  canCreateProject,
  canEditDiagram,
  currentUserId,
  diagrams,
  model,
  onCreateDiagram,
  onCreateProject,
  onDiagramLibraryOpenChange,
  onDiagramSelect,
  onDiagramUpdated,
  onProjectArchived,
  open,
  projects,
  stackedDialogOpen,
}: {
  activeDiagram: DiagramResponseDto;
  activeProject: ProjectResponseDto | null;
  canCreateDiagram: boolean;
  canCreateProject: boolean;
  canEditDiagram: boolean;
  currentUserId: string;
  diagrams: DiagramResponseDto[];
  model: DiagramModel;
  onCreateDiagram: (projectId?: string | null) => void;
  onCreateProject: () => void;
  onDiagramLibraryOpenChange: (open: boolean) => void;
  onDiagramSelect: (diagram: DiagramResponseDto) => void;
  onDiagramUpdated: (diagram: DiagramResponseDto) => void;
  onProjectArchived: () => void;
  open: boolean;
  projects: ProjectResponseDto[];
  stackedDialogOpen: boolean;
}) {
  const [diagramSearchTerm, setDiagramSearchTerm] = useState('');
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [selectedFolderFilterId, setSelectedFolderFilterId] = useState<string>(allDiagramFilterId);
  const [diagramSettingsDiagramId, setDiagramSettingsDiagramId] = useState<string | null>(null);
  const [moveDiagramId, setMoveDiagramId] = useState<string | null>(null);
  const [folderSettingsProjectId, setFolderSettingsProjectId] = useState<string | null>(null);
  const [libraryContextMenu, setLibraryContextMenu] = useState<LibraryContextMenuState | null>(null);
  const libraryContextMenuRef = useRef<HTMLDivElement | null>(null);
  const activeFolderName = activeProject?.name ?? 'No folder';
  const diagramSettingsDiagram = diagramSettingsDiagramId
    ? (diagrams.find((diagram) => diagram.id === diagramSettingsDiagramId) ?? null)
    : null;
  const moveDiagram = moveDiagramId ? (diagrams.find((diagram) => diagram.id === moveDiagramId) ?? null) : null;
  const folderSettingsProject = folderSettingsProjectId
    ? (projects.find((project) => project.id === folderSettingsProjectId) ?? null)
    : null;
  const isLibraryStackedDialogOpen =
    stackedDialogOpen || Boolean(diagramSettingsDiagram || moveDiagram || folderSettingsProject || libraryContextMenu);
  const rootDiagramCount = diagrams.filter((diagram) => !diagram.projectId).length;
  const filteredDiagrams = useMemo(() => {
    const search = diagramSearchTerm.trim().toLowerCase();
    const folderFilteredDiagrams = diagrams.filter((diagram) => {
      if (selectedFolderFilterId === allDiagramFilterId) {
        return true;
      }

      if (selectedFolderFilterId === rootDiagramFilterId) {
        return !diagram.projectId;
      }

      return diagram.projectId === selectedFolderFilterId;
    });

    return search
      ? folderFilteredDiagrams.filter((diagram) =>
          [diagram.name, diagram.dialect].some((value) => value.toLowerCase().includes(search)),
        )
      : folderFilteredDiagrams;
  }, [diagrams, diagramSearchTerm, selectedFolderFilterId]);
  const filteredProjects = useMemo(() => {
    const search = projectSearchTerm.trim().toLowerCase();

    return search
      ? projects.filter((project) =>
          [project.name, project.slug, project.description ?? ''].some((value) => value.toLowerCase().includes(search)),
        )
      : projects;
  }, [projectSearchTerm, projects]);
  const selectedFolderLabel = getSelectedFolderLabel(selectedFolderFilterId, projects);
  const selectedProjectIdForCreate =
    selectedFolderFilterId !== allDiagramFilterId &&
    selectedFolderFilterId !== rootDiagramFilterId &&
    projects.some((project) => project.id === selectedFolderFilterId)
      ? selectedFolderFilterId
      : null;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isLibraryStackedDialogOpen) {
      // Nested create/settings dialogs are rendered in their own portal; Radix can report that as an outside close for this parent.
      return;
    }

    onDiagramLibraryOpenChange(nextOpen);

    if (!nextOpen) {
      // Search filters are per visit; folder filter stays sticky while the dialog is open so "New diagram" can inherit it.
      setDiagramSearchTerm('');
      setProjectSearchTerm('');
      setSelectedFolderFilterId(allDiagramFilterId);
    }
  }

  function handleCreateDiagram() {
    onCreateDiagram(selectedProjectIdForCreate);
  }

  function handleCreateProject() {
    onCreateProject();
  }

  function openFolderContextMenu(event: MouseEvent, project: ProjectResponseDto) {
    if (!canManageProjectSettings(project)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setLibraryContextMenu({
      kind: 'folder',
      ...getContextMenuPoint(event.clientX, event.clientY),
      projectId: project.id,
    });
  }

  function openDiagramContextMenu(event: MouseEvent, diagram: DiagramResponseDto) {
    if (!canEditDiagramSettings(diagram)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setLibraryContextMenu({
      kind: 'diagram',
      ...getContextMenuPoint(event.clientX, event.clientY),
      diagramId: diagram.id,
    });
  }

  function openFolderActionMenu(event: MouseEvent<HTMLButtonElement>, project: ProjectResponseDto) {
    if (!canManageProjectSettings(project)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setLibraryContextMenu({
      kind: 'folder',
      ...getContextMenuPoint(rect.right - 220, rect.bottom + 6),
      projectId: project.id,
    });
  }

  function handleOpenFolderSettings(projectId: string) {
    setLibraryContextMenu(null);
    setFolderSettingsProjectId(projectId);
  }

  function handleOpenDiagramSettings(diagramId: string) {
    setLibraryContextMenu(null);
    setDiagramSettingsDiagramId(diagramId);
  }

  function handleOpenMoveDiagram(diagramId: string) {
    setLibraryContextMenu(null);
    setMoveDiagramId(diagramId);
  }

  useEffect(() => {
    if (!libraryContextMenu) {
      return;
    }

    function handlePointerDown(event: Event) {
      if (libraryContextMenuRef.current?.contains(event.target as Node)) {
        return;
      }

      setLibraryContextMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setLibraryContextMenu(null);
      }
    }

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handlePointerDown, true);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handlePointerDown, true);
    };
  }, [libraryContextMenu]);

  return (
    <>
      <div className="flex min-w-0 items-center gap-1 text-[15px] font-semibold">
        <button
          className="h-9 shrink-0 cursor-pointer rounded-[var(--tabliodb-radius-sm)] px-2 text-[rgb(var(--tabliodb-ink-muted))] transition hover:bg-[rgb(var(--tabliodb-surface-raised))] hover:text-[rgb(var(--tabliodb-ink))]"
          onClick={() => onDiagramLibraryOpenChange(true)}
          type="button"
        >
          My diagrams
        </button>
        <span className="shrink-0 text-[rgb(var(--tabliodb-ink-subtle))]">/</span>
        <span className="group flex min-w-0 items-center gap-1 rounded-[var(--tabliodb-radius-sm)] px-1.5 py-1">
          {canEditDiagram ? (
            <DiagramSettingsDialog
              canEdit={canEditDiagram}
              diagram={activeDiagram}
              model={model}
              onUpdated={(diagram) => {
                onDiagramUpdated(diagram);
              }}
              trigger={
                <div className="flex min-w-0 items-center gap-1">
                  <span className="truncate text-[18px] leading-5">{activeDiagram.name}</span>
                  <button
                    aria-label={`Edit ${activeDiagram.name}`}
                    className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-[var(--tabliodb-radius-sm)] text-[rgb(var(--tabliodb-ink-subtle))] opacity-0 transition hover:bg-[rgb(var(--tabliodb-surface-raised))] hover:text-[rgb(var(--tabliodb-ink))] group-hover:opacity-100 focus:opacity-100 focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--tabliodb-focus-ring))]"
                    type="button"
                  >
                    <Pencil className="size-4" />
                  </button>
                </div>
              }
            />
          ) : (
            <span className="truncate text-[18px] leading-5">{activeDiagram.name}</span>
          )}
        </span>
      </div>

      <Dialog modal={!isLibraryStackedDialogOpen} onOpenChange={handleOpenChange} open={open}>
        <DialogContent
          className="h-[min(86dvh,760px)] w-[min(96vw,1040px)] max-w-none max-[640px]:h-[100dvh] max-[640px]:max-h-screen max-[640px]:w-screen max-[640px]:rounded-none max-[640px]:border-0"
          onEscapeKeyDown={(event) => {
            if (isLibraryStackedDialogOpen) {
              // Escape belongs to the top-most child dialog while the dialog stack is active.
              event.preventDefault();
            }
          }}
          onInteractOutside={(event) => {
            if (isLibraryStackedDialogOpen) {
              // Keep the library dialog mounted behind New diagram/New folder so users return to the same filtered list.
              event.preventDefault();
            }
          }}
          onPointerDownOutside={(event) => {
            if (isLibraryStackedDialogOpen) {
              // Pointer events from the child portal should not dismiss the parent dialog.
              event.preventDefault();
            }
          }}
        >
          <DialogHeader className="border-b border-[rgb(var(--tabliodb-border))] pb-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle>My diagrams</DialogTitle>
                <DialogDescription>
                  Choose a diagram to open. Folders only filter this list and never switch the canvas by themselves.
                </DialogDescription>
              </div>
              {canCreateDiagram ? (
                <Button className="shrink-0 gap-2" onClick={handleCreateDiagram}>
                  <Plus className="size-4" />
                  New diagram
                </Button>
              ) : null}
            </div>
          </DialogHeader>

          <DialogBody className="grid min-h-0 flex-1 gap-3 overflow-hidden px-3 py-3 md:grid-cols-[280px_minmax(0,1fr)]">
            <section className="flex min-h-0 flex-col rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))]">
              <div className="shrink-0 border-b border-[rgb(var(--tabliodb-border))] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-[13px] font-black">Folders</h2>
                    <p className="mt-0.5 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                      Optional grouping for larger workspaces.
                    </p>
                  </div>
                  {canCreateProject ? (
                    <Button className="shrink-0 gap-1.5" onClick={handleCreateProject} size="sm" variant="secondary">
                      <FolderPlus className="size-4" />
                      New
                    </Button>
                  ) : null}
                </div>
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--tabliodb-ink-subtle))]" />
                  <Input
                    className="h-9 pl-9 text-[13px]"
                    onChange={(event) => setProjectSearchTerm(event.target.value)}
                    placeholder="Search folders"
                    value={projectSearchTerm}
                  />
                </div>
              </div>
              <div className="tabliodb-scrollbar min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-gutter:stable]">
                <div className="grid gap-1">
                  <FolderFilterButton
                    count={diagrams.length}
                    isSelected={selectedFolderFilterId === allDiagramFilterId}
                    label="All diagrams"
                    onSelect={() => setSelectedFolderFilterId(allDiagramFilterId)}
                    subtitle="Every ERD in this workspace"
                    isFolder={false}
                  />
                  <FolderFilterButton
                    count={rootDiagramCount}
                    isSelected={selectedFolderFilterId === rootDiagramFilterId}
                    label="No folder"
                    onSelect={() => setSelectedFolderFilterId(rootDiagramFilterId)}
                    subtitle="Standalone diagrams"
                    isFolder={false}
                  />
                  {filteredProjects.length === 0 ? (
                    <div className="rounded-[var(--tabliodb-radius-md)] border border-dashed border-[rgb(var(--tabliodb-border))] p-4 text-center text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                      No matching folders
                    </div>
                  ) : (
                    filteredProjects.map((project) => {
                      const canOpenSettings = canManageProjectSettings(project);

                      return (
                        <FolderFilterButton
                          action={
                            canOpenSettings ? (
                              <IconButton
                                className="size-8"
                                icon={MoreHorizontal}
                                label={`Folder actions for ${project.name}`}
                                onClick={(event) => openFolderActionMenu(event, project)}
                                variant="ghost"
                              />
                            ) : null
                          }
                          count={diagrams.filter((diagram) => diagram.projectId === project.id).length}
                          isFolder={true}
                          isSelected={selectedFolderFilterId === project.id}
                          key={project.id}
                          label={project.name}
                          onContextMenu={(event) => openFolderContextMenu(event, project)}
                          onSelect={() => setSelectedFolderFilterId(project.id)}
                          subtitle={project.slug}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            </section>

            <section className="flex min-h-0 flex-col rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border))] bg-white">
              <div className="shrink-0 border-b border-[rgb(var(--tabliodb-border))] p-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[13px] font-black">{selectedFolderLabel}</h2>
                    <p className="mt-0.5 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                      Active canvas: {activeDiagram.name} / {activeFolderName}
                    </p>
                  </div>
                  <Badge className="shrink-0" variant="green">
                    {filteredDiagrams.length} shown
                  </Badge>
                </div>
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--tabliodb-ink-subtle))]" />
                  <Input
                    className="h-9 pl-9 text-[13px]"
                    onChange={(event) => setDiagramSearchTerm(event.target.value)}
                    placeholder="Search diagrams"
                    value={diagramSearchTerm}
                  />
                </div>
              </div>
              <div className="tabliodb-scrollbar min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-gutter:stable]">
                {filteredDiagrams.length === 0 ? (
                  <div className="grid h-full min-h-40 place-items-center rounded-[var(--tabliodb-radius-md)] border border-dashed border-[rgb(var(--tabliodb-border))] p-6 text-center">
                    <div>
                      <FileText className="mx-auto size-8 text-[rgb(var(--tabliodb-ink-subtle))]" />
                      <p className="mt-2 text-sm font-extrabold">No matching diagrams</p>
                      <p className="mt-1 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                        Create a new ERD or adjust the selected folder/search.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredDiagrams.map((diagram) => {
                      const isActive = diagram.id === activeDiagram.id;
                      const folderName = diagram.projectId
                        ? (projects.find((project) => project.id === diagram.projectId)?.name ?? 'Folder')
                        : 'No folder';

                      return (
                        <button
                          className={`flex min-h-28 cursor-pointer flex-col justify-between rounded-[var(--tabliodb-radius-lg)] border p-3 text-left transition ${
                            isActive
                              ? 'border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-selected-surface))]'
                              : 'border-[rgb(var(--tabliodb-border))] bg-white hover:border-[rgb(var(--tabliodb-primary-border))] hover:bg-[rgb(var(--tabliodb-surface-raised))]'
                          }`}
                          key={diagram.id}
                          onClick={() => {
                            if (!isActive) {
                              onDiagramLibraryOpenChange(false);
                              onDiagramSelect(diagram);
                            }
                          }}
                          onContextMenu={(event) => openDiagramContextMenu(event, diagram)}
                          type="button"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] font-black">{diagram.name}</span>
                            <span className="mt-1 block text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                              {folderName}
                            </span>
                          </span>
                          <span className="mt-3 flex items-center justify-between gap-2">
                            <DialectBadge className="min-w-0 shrink" dialect={diagram.dialect} />
                            {isActive ? (
                              <Check className="size-4 shrink-0 text-[rgb(var(--tabliodb-primary-text))]" />
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </DialogBody>
        </DialogContent>
      </Dialog>
      {libraryContextMenu?.kind === 'folder' ? (
        <LibraryContextMenu left={libraryContextMenu.left} menuRef={libraryContextMenuRef} top={libraryContextMenu.top}>
          <LibraryContextMenuItem
            icon={Settings}
            label="Folder settings"
            onSelect={() => handleOpenFolderSettings(libraryContextMenu.projectId)}
          />
        </LibraryContextMenu>
      ) : null}
      {libraryContextMenu?.kind === 'diagram' ? (
        <LibraryContextMenu left={libraryContextMenu.left} menuRef={libraryContextMenuRef} top={libraryContextMenu.top}>
          <LibraryContextMenuItem
            icon={Pencil}
            label="Edit diagram"
            onSelect={() => handleOpenDiagramSettings(libraryContextMenu.diagramId)}
          />
          <LibraryContextMenuItem
            icon={FolderOpen}
            label="Move to folder"
            onSelect={() => handleOpenMoveDiagram(libraryContextMenu.diagramId)}
          />
        </LibraryContextMenu>
      ) : null}
      {diagramSettingsDiagram ? (
        <DiagramSettingsDialog
          canEdit={canEditDiagramSettings(diagramSettingsDiagram)}
          diagram={diagramSettingsDiagram}
          model={diagramSettingsDiagram.id === activeDiagram.id ? model : undefined}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setDiagramSettingsDiagramId(null);
            }
          }}
          onUpdated={(diagram) => {
            if (diagram.id === activeDiagram.id) {
              // Only the active diagram owns the live Yjs model; non-active card edits update list cache through the mutation layer.
              onDiagramUpdated(diagram);
            }
          }}
          open={Boolean(diagramSettingsDiagram)}
          trigger={null}
        />
      ) : null}
      {moveDiagram ? (
        <MoveDiagramDialog
          canMove={canEditDiagramSettings(moveDiagram)}
          diagram={moveDiagram}
          onMoved={(diagram) => {
            if (diagram.id === activeDiagram.id) {
              // Moving the active diagram changes the canonical route segment, so the editor follows the new folder/root location.
              onDiagramUpdated(diagram);
              onDiagramSelect(diagram);
            }
          }}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setMoveDiagramId(null);
            }
          }}
          open={Boolean(moveDiagram)}
          projects={projects}
          trigger={null}
        />
      ) : null}
      {folderSettingsProject ? (
        <ProjectSettingsDialog
          currentUserId={currentUserId}
          onArchived={() => {
            setFolderSettingsProjectId(null);
            onProjectArchived();
          }}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setFolderSettingsProjectId(null);
            }
          }}
          open={Boolean(folderSettingsProject)}
          project={folderSettingsProject}
          trigger={null}
        />
      ) : null}
    </>
  );
}

function FolderFilterButton({
  action,
  count,
  isSelected,
  label,
  onContextMenu,
  onSelect,
  subtitle,
  isFolder,
}: {
  action?: ReactNode;
  count: number;
  isSelected: boolean;
  label: string;
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
  onSelect: () => void;
  subtitle?: string;
  isFolder: boolean;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 cursor-pointer items-center justify-between gap-2 rounded-[var(--tabliodb-radius-md)] border px-3 py-2 text-left transition',
        isSelected
          ? 'border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-selected-surface))]'
          : 'border-transparent bg-white hover:border-[rgb(var(--tabliodb-border))]',
      )}
      onContextMenu={onContextMenu}
    >
      <button
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
        onClick={onSelect}
        type="button"
      >
        <span className="min-w-0 flex items-center gap-2">
          {isFolder ? <FolderOpen className="size-4 shrink-0 text-[rgb(var(--tabliodb-ink-muted))]" /> : null}
          <span className="min-w-0">
            <span className={cn('block truncate text-[13px] font-extrabold', isFolder && 'font-medium')}>{label}</span>
            {!isFolder && (
              <span className="block truncate text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                {subtitle}
              </span>
            )}
          </span>
        </span>
      </button>

      <span className="flex shrink-0 items-center gap-2">
        <Badge variant="neutral">{count}</Badge>
        {isSelected ? <Check className="size-4 text-[rgb(var(--tabliodb-primary-text))]" /> : null}
        {action}
      </span>
    </div>
  );
}

function getSelectedFolderLabel(folderFilterId: string, projects: ProjectResponseDto[]): string {
  if (folderFilterId === allDiagramFilterId) {
    return 'All diagrams';
  }

  if (folderFilterId === rootDiagramFilterId) {
    return 'No folder';
  }

  return projects.find((project) => project.id === folderFilterId)?.name ?? 'Folder';
}

function LibraryContextMenu({
  children,
  left,
  menuRef,
  top,
}: {
  children: ReactNode;
  left: number;
  menuRef: RefObject<HTMLDivElement | null>;
  top: number;
}) {
  return (
    <div
      className="fixed z-[70] w-56 rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border-strong))] bg-white p-1.5 text-[rgb(var(--tabliodb-ink))] shadow-[0_3px_0_rgb(var(--tabliodb-border-strong)),0_14px_32px_rgb(15_23_42/0.12)]"
      onContextMenu={(event) => event.preventDefault()}
      ref={menuRef}
      style={{ left, top }}
    >
      {children}
    </div>
  );
}

function LibraryContextMenuItem({
  icon: Icon,
  label,
  onSelect,
}: {
  icon: (props: { className?: string }) => ReactNode;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-[var(--tabliodb-radius-sm)] px-3 text-left text-[13px] font-bold transition hover:bg-[rgb(var(--tabliodb-selected-surface))] hover:text-[rgb(var(--tabliodb-primary-text))] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--tabliodb-focus-ring))]"
      onClick={onSelect}
      type="button"
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function canManageProjectSettings(project: ProjectResponseDto): boolean {
  // Folder settings currently includes member access, so only roles with member-management permission receive the menu.
  return hasProjectPermission(project.projectRole, Permission.ProjectMemberManage);
}

function canEditDiagramSettings(diagram: DiagramResponseDto): boolean {
  // Diagram settings mutates diagram metadata/review overrides, so context actions follow the effective diagram role from the API.
  return hasProjectPermission(diagram.role as ProjectRoleValue, Permission.DiagramUpdate);
}

function getContextMenuPoint(left: number, top: number) {
  const menuWidth = 224;
  const menuHeight = 104;
  const viewportPadding = 8;

  return {
    left: Math.max(viewportPadding, Math.min(left, window.innerWidth - menuWidth - viewportPadding)),
    top: Math.max(viewportPadding, Math.min(top, window.innerHeight - menuHeight - viewportPadding)),
  };
}

function isOrganizationManager(organization: OrganizationDto): boolean {
  const role = toOrganizationRoleValue(organization.role);

  return role === OrganizationRole.Owner || role === OrganizationRole.Admin;
}

function toOrganizationRoleValue(role: OrganizationRoleValue | SdkOrganizationRole): OrganizationRoleValue {
  // SDK enum dan shared enum memakai value string yang sama, tetapi TypeScript menjaga keduanya sebagai tipe nominal berbeda.
  return role as OrganizationRoleValue;
}

function formatOrganizationRole(role: OrganizationRoleValue | SdkOrganizationRole): string {
  const normalizedRole = toOrganizationRoleValue(role);

  return {
    [OrganizationRole.Admin]: 'Admin',
    [OrganizationRole.Guest]: 'Guest',
    [OrganizationRole.Member]: 'Member',
    [OrganizationRole.Owner]: 'Owner',
  }[normalizedRole];
}

function hasProjectPermission(role: ProjectRoleValue, permission: Permission): boolean {
  return isGranted({
    current: permissionsForProjectRole(role),
    requested: [permission],
  });
}
