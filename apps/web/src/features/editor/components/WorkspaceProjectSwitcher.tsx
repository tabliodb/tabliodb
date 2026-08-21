import { OrganizationRole, type OrganizationRoleValue } from '@tabliodb/shared';
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
  Input,
  cn,
} from '@tabliodb/ui';
import { Building2, Check, ChevronsUpDown, FileText, FolderPlus, Pencil, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DiagramSettingsDialog } from './DiagramSettingsDialog';
import { DialectBadge } from './DialectIcon';

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
  organizations: OrganizationDto[];
  projects: ProjectResponseDto[];
  stackedDialogOpen: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 border-l border-[rgb(var(--tabliodb-border))] pl-2 sm:pl-3">
      <WorkspaceSwitcher
        activeOrganization={activeOrganization}
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
        diagrams={diagrams}
        model={model}
        onCreateDiagram={onCreateDiagram}
        onCreateProject={onCreateProject}
        onDiagramSelect={onDiagramSelect}
        onDiagramLibraryOpenChange={onDiagramLibraryOpenChange}
        onDiagramUpdated={onDiagramUpdated}
        open={diagramLibraryOpen}
        projects={projects}
        stackedDialogOpen={stackedDialogOpen}
      />
    </div>
  );
}

function WorkspaceSwitcher({
  activeOrganization,
  onCreateWorkspace,
  onOrganizationSelect,
  organizations,
}: {
  activeOrganization: OrganizationDto;
  onCreateWorkspace: () => void;
  onOrganizationSelect: (organization: OrganizationDto) => void;
  organizations: OrganizationDto[];
}) {
  const [open, setOpen] = useState(false);

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
                  <span className="block truncate text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
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
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const allDiagramFilterId = '__all_diagrams__';
const rootDiagramFilterId = '__root_diagrams__';

function DiagramNavigator({
  activeDiagram,
  activeProject,
  canCreateDiagram,
  canCreateProject,
  canEditDiagram,
  diagrams,
  model,
  onCreateDiagram,
  onCreateProject,
  onDiagramLibraryOpenChange,
  onDiagramSelect,
  onDiagramUpdated,
  open,
  projects,
  stackedDialogOpen,
}: {
  activeDiagram: DiagramResponseDto;
  activeProject: ProjectResponseDto | null;
  canCreateDiagram: boolean;
  canCreateProject: boolean;
  canEditDiagram: boolean;
  diagrams: DiagramResponseDto[];
  model: DiagramModel;
  onCreateDiagram: (projectId?: string | null) => void;
  onCreateProject: () => void;
  onDiagramLibraryOpenChange: (open: boolean) => void;
  onDiagramSelect: (diagram: DiagramResponseDto) => void;
  onDiagramUpdated: (diagram: DiagramResponseDto) => void;
  open: boolean;
  projects: ProjectResponseDto[];
  stackedDialogOpen: boolean;
}) {
  const [diagramSearchTerm, setDiagramSearchTerm] = useState('');
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [selectedFolderFilterId, setSelectedFolderFilterId] = useState<string>(allDiagramFilterId);
  const activeFolderName = activeProject?.name ?? 'No folder';
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
    if (!nextOpen && stackedDialogOpen) {
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
              onUpdated={onDiagramUpdated}
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

      <Dialog modal={!stackedDialogOpen} onOpenChange={handleOpenChange} open={open}>
        <DialogContent
          className="h-[min(86dvh,760px)] w-[min(96vw,1040px)] max-w-none max-[640px]:h-[100dvh] max-[640px]:max-h-screen max-[640px]:w-screen max-[640px]:rounded-none max-[640px]:border-0"
          onEscapeKeyDown={(event) => {
            if (stackedDialogOpen) {
              // Escape belongs to the top-most child dialog while the dialog stack is active.
              event.preventDefault();
            }
          }}
          onInteractOutside={(event) => {
            if (stackedDialogOpen) {
              // Keep the library dialog mounted behind New diagram/New folder so users return to the same filtered list.
              event.preventDefault();
            }
          }}
          onPointerDownOutside={(event) => {
            if (stackedDialogOpen) {
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
                  />
                  <FolderFilterButton
                    count={rootDiagramCount}
                    isSelected={selectedFolderFilterId === rootDiagramFilterId}
                    label="No folder"
                    onSelect={() => setSelectedFolderFilterId(rootDiagramFilterId)}
                    subtitle="Standalone diagrams"
                  />
                  {filteredProjects.length === 0 ? (
                    <div className="rounded-[var(--tabliodb-radius-md)] border border-dashed border-[rgb(var(--tabliodb-border))] p-4 text-center text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                      No matching folders
                    </div>
                  ) : (
                    filteredProjects.map((project) => (
                      <FolderFilterButton
                        count={diagrams.filter((diagram) => diagram.projectId === project.id).length}
                        isSelected={selectedFolderFilterId === project.id}
                        key={project.id}
                        label={project.name}
                        onSelect={() => setSelectedFolderFilterId(project.id)}
                        subtitle={project.slug}
                      />
                    ))
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
    </>
  );
}

function FolderFilterButton({
  count,
  isSelected,
  label,
  onSelect,
  subtitle,
}: {
  count: number;
  isSelected: boolean;
  label: string;
  onSelect: () => void;
  subtitle: string;
}) {
  return (
    <button
      className={cn(
        'flex min-w-0 cursor-pointer items-center justify-between gap-2 rounded-[var(--tabliodb-radius-md)] border px-3 py-2 text-left transition',
        isSelected
          ? 'border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-selected-surface))]'
          : 'border-transparent bg-white hover:border-[rgb(var(--tabliodb-border))]',
      )}
      onClick={onSelect}
      type="button"
    >
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-extrabold">{label}</span>
        <span className="block truncate text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">{subtitle}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <Badge variant="neutral">{count}</Badge>
        {isSelected ? <Check className="size-4 text-[rgb(var(--tabliodb-primary-text))]" /> : null}
      </span>
    </button>
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
