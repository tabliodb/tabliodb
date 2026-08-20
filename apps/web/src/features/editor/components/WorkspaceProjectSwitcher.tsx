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
  DropdownMenuTrigger,
  Input,
} from '@tabliodb/ui';
import { Building2, Check, ChevronsUpDown, FileText, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

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
  organizations,
}: {
  activeDiagram: DiagramResponseDto;
  activeOrganization: OrganizationDto;
  activeProject: ProjectResponseDto;
  canCreateDiagram: boolean;
  diagrams: DiagramResponseDto[];
  onCreateDiagram: () => void;
  onDiagramSelect: (diagram: DiagramResponseDto) => void;
  onOrganizationSelect: (organization: OrganizationDto) => void;
  organizations: OrganizationDto[];
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 border-l border-[rgb(var(--tabliodb-border))] pl-2 sm:pl-3">
      <WorkspaceSwitcher
        activeOrganization={activeOrganization}
        onOrganizationSelect={onOrganizationSelect}
        organizations={organizations}
      />
      <DiagramSwitcher
        activeDiagram={activeDiagram}
        activeProject={activeProject}
        canCreateDiagram={canCreateDiagram}
        diagrams={diagrams}
        onCreateDiagram={onCreateDiagram}
        onDiagramSelect={onDiagramSelect}
      />
    </div>
  );
}

function WorkspaceSwitcher({
  activeOrganization,
  onOrganizationSelect,
  organizations,
}: {
  activeOrganization: OrganizationDto;
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
        className="max-h-[min(64vh,360px)] w-[min(92vw,320px)] overflow-hidden p-2"
      >
        <div className="px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Switch workspace
        </div>
        <div className="tabliodb-scrollbar mt-1 grid max-h-[min(52vh,300px)] gap-1 overflow-y-auto pr-1">
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DiagramSwitcher({
  activeDiagram,
  activeProject,
  canCreateDiagram,
  diagrams,
  onCreateDiagram,
  onDiagramSelect,
}: {
  activeDiagram: DiagramResponseDto;
  activeProject: ProjectResponseDto;
  canCreateDiagram: boolean;
  diagrams: DiagramResponseDto[];
  onCreateDiagram: () => void;
  onDiagramSelect: (diagram: DiagramResponseDto) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const filteredDiagrams = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return search
      ? diagrams.filter((diagram) =>
          [diagram.name, diagram.dialect].some((value) => value.toLowerCase().includes(search)),
        )
      : diagrams;
  }, [diagrams, searchTerm]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      // Search is local to the open interaction; resetting prevents stale filters from hiding diagrams later.
      setSearchTerm('');
    }
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange} open={open}>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-11 min-w-0 max-w-[min(48vw,360px)] cursor-pointer items-center gap-2 rounded-[var(--tabliodb-radius-md)] px-2 text-left transition hover:bg-[rgb(var(--tabliodb-surface-raised))]"
          type="button"
        >
          <FileText className="size-4 shrink-0 text-[rgb(var(--tabliodb-ink-muted))]" />
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-extrabold leading-5">{activeDiagram.name}</span>
            <span className="block truncate text-[12px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
              {activeDiagram.dialect} / {activeProject.name}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-[rgb(var(--tabliodb-ink-muted))]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-[min(76vh,560px)] w-[min(94vw,460px)] overflow-hidden p-0"
      >
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
                // Diagram creation is kept inside the diagram control only, so it is never confused with workspace switching.
                onCreateDiagram();
              }}
            >
              <FileText className="size-4" />
              New diagram
            </Button>
          ) : null}
        </div>

        <div className="p-2">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--tabliodb-ink-subtle))]" />
            <Input
              className="h-9 pl-9 text-[13px]"
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
              placeholder="Search diagrams"
              value={searchTerm}
            />
          </div>
          {filteredDiagrams.length === 0 ? (
            <div className="rounded-[var(--tabliodb-radius-md)] border border-dashed border-[rgb(var(--tabliodb-border))] p-4 text-center text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
              No matching diagrams
            </div>
          ) : (
            <div className="tabliodb-scrollbar grid max-h-[min(50vh,340px)] gap-1 overflow-y-auto pr-1">
              {filteredDiagrams.map((diagram) => {
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
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-extrabold">{diagram.name}</span>
                      <span className="block truncate text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                        {diagram.dialect}
                      </span>
                    </span>
                    {isActive ? <Check className="size-4 text-[rgb(var(--tabliodb-primary-text))]" /> : null}
                  </DropdownMenuItem>
                );
              })}
            </div>
          )}
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
