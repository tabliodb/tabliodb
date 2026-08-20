import { OrganizationRole, type OrganizationRoleValue } from '@tabliodb/shared';
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
} from '@tabliodb/ui';
import { Building2, Check, ChevronsUpDown, FileText, FolderPlus, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

type DiagramResponseDto = DiagramResponseDtoOutput;
type OrganizationDto = OrganizationDtoOutput;
type ProjectResponseDto = ProjectResponseDtoOutput;

export function WorkspaceProjectSwitcher({
  activeDiagram,
  activeOrganization,
  activeProject,
  canCreateDiagram,
  canCreateProject,
  diagrams,
  onCreateDiagram,
  onCreateProject,
  onCreateWorkspace,
  onDiagramSelect,
  onOrganizationSelect,
  onProjectSelect,
  organizations,
  projects,
}: {
  activeDiagram: DiagramResponseDto;
  activeOrganization: OrganizationDto;
  activeProject: ProjectResponseDto;
  canCreateDiagram: boolean;
  canCreateProject: boolean;
  diagrams: DiagramResponseDto[];
  onCreateDiagram: () => void;
  onCreateProject: () => void;
  onCreateWorkspace: () => void;
  onDiagramSelect: (diagram: DiagramResponseDto) => void;
  onOrganizationSelect: (organization: OrganizationDto) => void;
  onProjectSelect: (project: ProjectResponseDto) => void;
  organizations: OrganizationDto[];
  projects: ProjectResponseDto[];
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
        diagrams={diagrams}
        onCreateDiagram={onCreateDiagram}
        onCreateProject={onCreateProject}
        onDiagramSelect={onDiagramSelect}
        onProjectSelect={onProjectSelect}
        projects={projects}
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
      <DropdownMenuContent
        align="start"
        className="max-h-[min(72vh,420px)] w-[min(92vw,320px)] overflow-hidden p-2"
      >
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

function DiagramNavigator({
  activeDiagram,
  activeProject,
  canCreateDiagram,
  canCreateProject,
  diagrams,
  onCreateDiagram,
  onCreateProject,
  onDiagramSelect,
  onProjectSelect,
  projects,
}: {
  activeDiagram: DiagramResponseDto;
  activeProject: ProjectResponseDto;
  canCreateDiagram: boolean;
  canCreateProject: boolean;
  diagrams: DiagramResponseDto[];
  onCreateDiagram: () => void;
  onCreateProject: () => void;
  onDiagramSelect: (diagram: DiagramResponseDto) => void;
  onProjectSelect: (project: ProjectResponseDto) => void;
  projects: ProjectResponseDto[];
}) {
  const [open, setOpen] = useState(false);
  const [diagramSearchTerm, setDiagramSearchTerm] = useState('');
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const filteredDiagrams = useMemo(() => {
    const search = diagramSearchTerm.trim().toLowerCase();

    return search
      ? diagrams.filter((diagram) =>
          [diagram.name, diagram.dialect].some((value) => value.toLowerCase().includes(search)),
        )
      : diagrams;
  }, [diagrams, diagramSearchTerm]);
  const filteredProjects = useMemo(() => {
    const search = projectSearchTerm.trim().toLowerCase();

    return search
      ? projects.filter((project) =>
          [project.name, project.slug, project.description ?? ''].some((value) => value.toLowerCase().includes(search)),
        )
      : projects;
  }, [projectSearchTerm, projects]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      // Dialog filters are per visit; stale filters should not make data look missing when the user opens it later.
      setDiagramSearchTerm('');
      setProjectSearchTerm('');
    }
  }

  function handleCreateDiagram() {
    setOpen(false);
    onCreateDiagram();
  }

  function handleCreateProject() {
    setOpen(false);
    onCreateProject();
  }

  return (
    <>
      <div className="flex min-w-0 items-center gap-1.5">
        <button
          className="flex h-11 min-w-0 max-w-[min(42vw,340px)] cursor-pointer items-center gap-2 rounded-[var(--tabliodb-radius-md)] px-2 text-left transition hover:bg-[rgb(var(--tabliodb-surface-raised))]"
          onClick={() => setOpen(true)}
          type="button"
        >
          <FileText className="size-4 shrink-0 text-[rgb(var(--tabliodb-ink-muted))]" />
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-extrabold leading-5">{activeDiagram.name}</span>
            <span className="block truncate text-[12px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
              {activeProject.name} / {activeDiagram.dialect}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-[rgb(var(--tabliodb-ink-muted))]" />
        </button>
        {canCreateDiagram ? (
          <Button className="hidden gap-2 md:inline-flex" onClick={handleCreateDiagram} size="sm">
            <Plus className="size-4" />
            New diagram
          </Button>
        ) : null}
      </div>

      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="h-[min(86dvh,760px)] w-[min(96vw,1040px)] max-w-none max-[640px]:h-[100dvh] max-[640px]:max-h-screen max-[640px]:w-screen max-[640px]:rounded-none max-[640px]:border-0">
          <DialogHeader className="border-b border-[rgb(var(--tabliodb-border))] pb-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle>Database diagrams</DialogTitle>
                <DialogDescription>
                  Open an existing ERD, create a new diagram, or move to another project folder.
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

          <DialogBody className="grid min-h-0 flex-1 gap-3 overflow-hidden px-3 py-3 md:grid-cols-[300px_minmax(0,1fr)]">
            <section className="flex min-h-0 flex-col rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))]">
              <div className="shrink-0 border-b border-[rgb(var(--tabliodb-border))] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-[13px] font-black">Project folders</h2>
                    <p className="mt-0.5 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                      Group diagrams by app, client, or product area.
                    </p>
                  </div>
                  {canCreateProject ? (
                    <Button className="shrink-0 gap-1.5" onClick={handleCreateProject} size="sm" variant="secondary">
                      <FolderPlus className="size-4" />
                      Folder
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
                {filteredProjects.length === 0 ? (
                  <div className="rounded-[var(--tabliodb-radius-md)] border border-dashed border-[rgb(var(--tabliodb-border))] p-4 text-center text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                    No matching folders
                  </div>
                ) : (
                  <div className="grid gap-1">
                    {filteredProjects.map((project) => {
                      const isActive = project.id === activeProject.id;

                      return (
                        <button
                          className={`flex min-w-0 cursor-pointer items-center justify-between gap-2 rounded-[var(--tabliodb-radius-md)] border px-3 py-2 text-left transition ${
                            isActive
                              ? 'border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-selected-surface))]'
                              : 'border-transparent bg-white hover:border-[rgb(var(--tabliodb-border))]'
                          }`}
                          key={project.id}
                          onClick={() => {
                            if (!isActive) {
                              setOpen(false);
                              onProjectSelect(project);
                            }
                          }}
                          type="button"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-extrabold">{project.name}</span>
                            <span className="block truncate text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                              {project.slug}
                            </span>
                          </span>
                          {isActive ? <Check className="size-4 shrink-0 text-[rgb(var(--tabliodb-primary-text))]" /> : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <section className="flex min-h-0 flex-col rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border))] bg-white">
              <div className="shrink-0 border-b border-[rgb(var(--tabliodb-border))] p-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[13px] font-black">Diagrams in {activeProject.name}</h2>
                    <p className="mt-0.5 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                      These are the ERD documents inside the selected folder.
                    </p>
                  </div>
                  <Badge className="shrink-0" variant="green">
                    {diagrams.length} total
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
                        Create a new ERD or adjust your search.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredDiagrams.map((diagram) => {
                      const isActive = diagram.id === activeDiagram.id;

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
                              setOpen(false);
                              onDiagramSelect(diagram);
                            }
                          }}
                          type="button"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] font-black">{diagram.name}</span>
                            <span className="mt-1 block text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                              {diagram.dialect}
                            </span>
                          </span>
                          <span className="mt-3 flex items-center justify-between gap-2">
                            <Badge variant={isActive ? 'green' : 'neutral'}>{isActive ? 'Open' : 'Diagram'}</Badge>
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
