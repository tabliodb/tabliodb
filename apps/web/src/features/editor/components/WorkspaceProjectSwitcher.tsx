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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparatorItem,
  DropdownMenuTrigger,
  Input,
} from '@tabliodb/ui';
import { Building2, Check, ChevronDown, ChevronsUpDown, FileText, Folder, Search } from 'lucide-react';
import { useState } from 'react';

type DiagramResponseDto = DiagramResponseDtoOutput;
type OrganizationDto = OrganizationDtoOutput;
type ProjectResponseDto = ProjectResponseDtoOutput;

export function WorkspaceProjectSwitcher({
  activeDiagram,
  activeOrganization,
  activeProject,
  canCreateDiagram,
  diagrams,
  onCreateDiagram,
  onDiagramSelect,
  onOrganizationSelect,
  onProjectSearchChange,
  onProjectSelect,
  organizations,
  projectSearchTerm,
  projects,
}: {
  activeDiagram: DiagramResponseDto;
  activeOrganization: OrganizationDto;
  activeProject: ProjectResponseDto;
  canCreateDiagram: boolean;
  diagrams: DiagramResponseDto[];
  onCreateDiagram: () => void;
  onDiagramSelect: (diagram: DiagramResponseDto) => void;
  onOrganizationSelect: (organization: OrganizationDto) => void;
  onProjectSearchChange: (value: string) => void;
  onProjectSelect: (project: ProjectResponseDto) => void;
  organizations: OrganizationDto[];
  projectSearchTerm: string;
  projects: ProjectResponseDto[];
}) {
  const [open, setOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      // Location is secondary context, so every fresh open returns to the diagram-first decision surface.
      setLocationOpen(false);
    }
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange} open={open}>
      <DropdownMenuTrigger asChild>
        <button
          className="flex min-w-0 max-w-full cursor-pointer items-center gap-2 border-l border-[rgb(var(--tabliodb-border))] py-1 pl-2 text-left transition hover:text-[rgb(var(--tabliodb-primary-text))] sm:pl-3"
          type="button"
        >
          <div className="min-w-0">
            <h1 className="truncate text-[14px] font-extrabold leading-5">{activeDiagram.name}</h1>
            <p className="truncate text-[12px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
              {activeProject.name} / {activeDiagram.dialect} / {activeOrganization.name}
            </p>
          </div>
          <ChevronsUpDown className="size-4 shrink-0 text-[rgb(var(--tabliodb-ink-muted))]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[min(92vw,400px)] overflow-hidden p-0">
        <div className="border-b border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] p-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Current diagram
              </div>
              <div className="mt-1 truncate text-[15px] font-black leading-5 text-[rgb(var(--tabliodb-ink))]">
                {activeDiagram.name}
              </div>
              <div className="truncate text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                {activeDiagram.dialect} / {activeProject.name}
              </div>
            </div>
            <Badge className="shrink-0" variant="green">
              {activeDiagram.dialect}
            </Badge>
          </div>
          {canCreateDiagram ? (
            <Button
              className="mt-3 w-full justify-center gap-2"
              onClick={(event) => {
                event.preventDefault();
                setOpen(false);
                // Diagram creation is the only primary action in this switcher so users do not confuse ERD creation with workspace/folder management.
                onCreateDiagram();
              }}
            >
              <FileText className="size-4" />
              New diagram
            </Button>
          ) : null}
        </div>

        <div className="p-2">
          <div className="mb-2 px-1 text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
            Diagrams
          </div>
          {diagrams.length === 0 ? (
            <div className="rounded-[var(--tabliodb-radius-md)] border border-dashed border-[rgb(var(--tabliodb-border))] p-3 text-center text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
              No diagrams yet
            </div>
          ) : (
            <div className="tabliodb-scrollbar grid max-h-52 gap-1 overflow-y-auto pr-1">
              {diagrams.map((diagram) => {
                const isActive = diagram.id === activeDiagram.id;

                return (
                  <DropdownMenuItem
                    className="justify-between"
                    key={diagram.id}
                    onSelect={() => {
                      if (!isActive) {
                        onDiagramSelect(diagram);
                      }

                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0 truncate text-[13px] font-extrabold">{diagram.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant="neutral">{diagram.dialect}</Badge>
                      {isActive ? <Check className="size-4 text-[rgb(var(--tabliodb-primary-text))]" /> : null}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </div>
          )}
        </div>

        <DropdownMenuSeparatorItem />

        <div className="p-2">
          <button
            className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--tabliodb-radius-md)] px-2 py-2 text-left hover:bg-[rgb(var(--tabliodb-surface-raised))]"
            onClick={() => setLocationOpen((current) => !current)}
            type="button"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Folder className="size-4 shrink-0 text-[rgb(var(--tabliodb-ink-muted))]" />
              <span className="min-w-0">
                <span className="block text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Location
                </span>
                <span className="block truncate text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                  {activeOrganization.name} / {activeProject.name}
                </span>
              </span>
            </span>
            <ChevronDown
              className={`size-4 shrink-0 text-[rgb(var(--tabliodb-ink-muted))] transition-transform ${
                locationOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {locationOpen ? (
            <div className="mt-2 grid gap-3 rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-border))] bg-white p-2">
              <div>
                <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  <Building2 className="size-3.5" />
                  Workspace
                </div>
                <div className="tabliodb-scrollbar grid max-h-32 gap-1 overflow-y-auto pr-1">
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
              </div>

              <div>
                <div className="mb-1 px-1 text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Project folders
                </div>
                <div className="relative mb-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--tabliodb-ink-subtle))]" />
                  <Input
                    className="h-9 pl-9 text-[13px]"
                    onChange={(event) => onProjectSearchChange(event.target.value)}
                    onKeyDown={(event) => event.stopPropagation()}
                    placeholder="Search folders"
                    value={projectSearchTerm}
                  />
                </div>
                {projects.length === 0 ? (
                  <div className="rounded-[var(--tabliodb-radius-md)] border border-dashed border-[rgb(var(--tabliodb-border))] p-3 text-center text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                    No matching folders
                  </div>
                ) : (
                  <div className="tabliodb-scrollbar grid max-h-40 gap-1 overflow-y-auto pr-1">
                    {projects.map((project) => {
                      const isActive = project.id === activeProject.id;

                      return (
                        <DropdownMenuItem
                          className="justify-between"
                          key={project.id}
                          onSelect={() => {
                            if (!isActive) {
                              onProjectSelect(project);
                            }

                            setOpen(false);
                          }}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-extrabold">{project.name}</span>
                            <span className="block truncate text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                              {project.slug}
                            </span>
                          </span>
                          {isActive ? <Check className="size-4 text-[rgb(var(--tabliodb-primary-text))]" /> : null}
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
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
