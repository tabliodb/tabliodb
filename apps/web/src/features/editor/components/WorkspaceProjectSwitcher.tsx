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
import { Building2, Check, ChevronsUpDown, FileText, FolderPlus, Search } from 'lucide-react';
import { useState } from 'react';

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
  canCreateProject: boolean;
  diagrams: DiagramResponseDto[];
  onCreateDiagram: () => void;
  onCreateProject: () => void;
  onCreateWorkspace: () => void;
  onDiagramSelect: (diagram: DiagramResponseDto) => void;
  onOrganizationSelect: (organization: OrganizationDto) => void;
  onProjectSearchChange: (value: string) => void;
  onProjectSelect: (project: ProjectResponseDto) => void;
  organizations: OrganizationDto[];
  projectSearchTerm: string;
  projects: ProjectResponseDto[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
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
      <DropdownMenuContent align="start" className="w-[min(92vw,380px)] p-2">
        <div className="px-2 py-1">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Workspace
            </div>
            <Button
              onClick={(event) => {
                event.preventDefault();
                setOpen(false);
                // Dialog workspace sengaja dibuka dari parent supaya Radix tidak membuat dua focus trap hidup bersamaan.
                onCreateWorkspace();
              }}
              size="sm"
              variant="soft"
            >
              <Building2 className="size-3.5" />
              Workspace
            </Button>
          </div>
          <div className="tabliodb-scrollbar mt-1 grid max-h-36 gap-1 overflow-y-auto pr-1">
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

        <DropdownMenuSeparatorItem />

        <div className="px-2 py-1.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Projects
            </div>
            {canCreateProject ? (
              <Button
                onClick={(event) => {
                  event.preventDefault();
                  setOpen(false);
                  // Dialog project tetap dimiliki parent karena parent yang tahu workspace aktif dan invalidasi query setelah create.
                  onCreateProject();
                }}
                size="sm"
                variant="soft"
              >
                <FolderPlus className="size-3.5" />
                Project
              </Button>
            ) : null}
          </div>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--tabliodb-ink-subtle))]" />
            <Input
              className="h-9 pl-9 text-[13px]"
              onChange={(event) => onProjectSearchChange(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
              placeholder="Search projects"
              value={projectSearchTerm}
            />
          </div>
          {projects.length === 0 ? (
            <div className="rounded-[var(--tabliodb-radius-md)] border border-dashed border-[rgb(var(--tabliodb-border))] p-3 text-center text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
              No matching projects
            </div>
          ) : (
            <div className="tabliodb-scrollbar grid max-h-52 gap-1 overflow-y-auto pr-1">
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

        {diagrams.length > 0 || canCreateDiagram ? (
          <>
            <DropdownMenuSeparatorItem />
            <div className="px-2 py-1.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Diagrams
                </div>
                {canCreateDiagram ? (
                  <Button
                    onClick={(event) => {
                      event.preventDefault();
                      setOpen(false);
                      // Create diagram dipicu eksplisit agar switch project tidak pernah ikut membuat data tanpa niat user.
                      onCreateDiagram();
                    }}
                    size="sm"
                    variant="soft"
                  >
                    <FileText className="size-3.5" />
                    Diagram
                  </Button>
                ) : null}
              </div>
              {diagrams.length === 0 ? (
                <div className="rounded-[var(--tabliodb-radius-md)] border border-dashed border-[rgb(var(--tabliodb-border))] p-3 text-center text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                  No diagrams yet
                </div>
              ) : (
                <div className="tabliodb-scrollbar grid max-h-40 gap-1 overflow-y-auto pr-1">
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
                          <Badge variant="green">{diagram.dialect}</Badge>
                          {isActive ? <Check className="size-4 text-[rgb(var(--tabliodb-primary-text))]" /> : null}
                        </span>
                      </DropdownMenuItem>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : null}
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
