import {
  OrganizationRole,
  Permission,
  isGranted,
  permissionsForAccessRole,
  type OrganizationRoleValue,
  type AccessRoleValue,
} from '@tabliodb/shared';
import type { DiagramModel } from '@tabliodb/schema-core';
import {
  Role as SdkOrganizationRole,
  type DiagramResponseDtoOutput,
  type OrganizationDtoOutput,
  type FolderResponseDtoOutput,
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
import { FolderSettingsDialog } from './FolderSettingsDialog';
import { WorkspaceSettingsDialog } from './WorkspaceSettingsDialog';

type DiagramResponseDto = DiagramResponseDtoOutput;
type OrganizationDto = OrganizationDtoOutput;
type FolderResponseDto = FolderResponseDtoOutput;

export function WorkspaceFolderSwitcher({
  activeDiagram,
  activeOrganization,
  activeFolder,
  canCreateDiagram,
  canCreateFolder,
  canEditDiagram,
  canManageWorkspace,
  currentUserId,
  diagramLibraryOpen,
  diagrams,
  model,
  onCreateDiagram,
  onCreateFolder,
  onCreateWorkspace,
  onDiagramSelect,
  onDiagramLibraryOpenChange,
  onDiagramUpdated,
  onOrganizationSelect,
  onFolderArchived,
  organizations,
  folders,
  stackedDialogOpen,
}: {
  activeDiagram: DiagramResponseDto;
  activeOrganization: OrganizationDto;
  activeFolder: FolderResponseDto | null;
  canCreateDiagram: boolean;
  canCreateFolder: boolean;
  canEditDiagram: boolean;
  canManageWorkspace: boolean;
  currentUserId: string;
  diagramLibraryOpen: boolean;
  diagrams: DiagramResponseDto[];
  model: DiagramModel;
  onCreateDiagram: (folderId?: string | null) => void;
  onCreateFolder: () => void;
  onCreateWorkspace: () => void;
  onDiagramSelect: (diagram: DiagramResponseDto) => void;
  onDiagramLibraryOpenChange: (open: boolean) => void;
  onDiagramUpdated: (diagram: DiagramResponseDto) => void;
  onOrganizationSelect: (organization: OrganizationDto) => void;
  onFolderArchived: () => void;
  organizations: OrganizationDto[];
  folders: FolderResponseDto[];
  stackedDialogOpen: boolean;
}) {
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);

  return (
    <>
      <div className="flex min-w-0 items-center gap-2 border-l border-[rgb(var(--tabliodb-border))] pl-2 sm:pl-3">
        <WorkspaceSwitcher
          activeOrganization={activeOrganization}
          canManageWorkspace={canManageWorkspace}
          onCreateWorkspace={onCreateWorkspace}
          onOpenWorkspaceSettings={() => setWorkspaceSettingsOpen(true)}
          onOrganizationSelect={onOrganizationSelect}
          organizations={organizations}
        />
        <DiagramNavigator
          activeDiagram={activeDiagram}
          activeOrganization={activeOrganization}
          activeFolder={activeFolder}
          canCreateDiagram={canCreateDiagram}
          canCreateFolder={canCreateFolder}
          canEditDiagram={canEditDiagram}
          currentUserId={currentUserId}
          diagrams={diagrams}
          model={model}
          onCreateDiagram={onCreateDiagram}
          onCreateFolder={onCreateFolder}
          onDiagramSelect={onDiagramSelect}
          onDiagramLibraryOpenChange={onDiagramLibraryOpenChange}
          onDiagramUpdated={onDiagramUpdated}
          onFolderArchived={onFolderArchived}
          open={diagramLibraryOpen}
          folders={folders}
          stackedDialogOpen={stackedDialogOpen}
        />
      </div>
      {canManageWorkspace ? (
        <WorkspaceSettingsDialog
          currentUserId={currentUserId}
          onOpenChange={setWorkspaceSettingsOpen}
          open={workspaceSettingsOpen}
          organization={activeOrganization}
          trigger={null}
        />
      ) : null}
    </>
  );
}

function WorkspaceSwitcher({
  activeOrganization,
  canManageWorkspace,
  onCreateWorkspace,
  onOpenWorkspaceSettings,
  onOrganizationSelect,
  organizations,
}: {
  activeOrganization: OrganizationDto;
  canManageWorkspace: boolean;
  onCreateWorkspace: () => void;
  onOpenWorkspaceSettings: () => void;
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
        <div className="mt-2 grid gap-1 border-t border-[rgb(var(--tabliodb-border))] pt-2">
          {canManageWorkspace ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setOpen(false);
                // Workspace settings lives in the workspace switcher so it reads as account/workspace context, not editor tooling.
                onOpenWorkspaceSettings();
              }}
            >
              <Settings className="size-4" />
              Workspace settings
            </DropdownMenuItem>
          ) : null}
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
      folderId: string;
    }
);

function DiagramNavigator({
  activeDiagram,
  activeOrganization,
  activeFolder,
  canCreateDiagram,
  canCreateFolder,
  canEditDiagram,
  currentUserId,
  diagrams,
  model,
  onCreateDiagram,
  onCreateFolder,
  onDiagramLibraryOpenChange,
  onDiagramSelect,
  onDiagramUpdated,
  onFolderArchived,
  open,
  folders,
  stackedDialogOpen,
}: {
  activeDiagram: DiagramResponseDto;
  activeOrganization: OrganizationDto;
  activeFolder: FolderResponseDto | null;
  canCreateDiagram: boolean;
  canCreateFolder: boolean;
  canEditDiagram: boolean;
  currentUserId: string;
  diagrams: DiagramResponseDto[];
  model: DiagramModel;
  onCreateDiagram: (folderId?: string | null) => void;
  onCreateFolder: () => void;
  onDiagramLibraryOpenChange: (open: boolean) => void;
  onDiagramSelect: (diagram: DiagramResponseDto) => void;
  onDiagramUpdated: (diagram: DiagramResponseDto) => void;
  onFolderArchived: () => void;
  open: boolean;
  folders: FolderResponseDto[];
  stackedDialogOpen: boolean;
}) {
  const [diagramSearchTerm, setDiagramSearchTerm] = useState('');
  const [folderSearchTerm, setFolderSearchTerm] = useState('');
  const [selectedFolderFilterId, setSelectedFolderFilterId] = useState<string>(allDiagramFilterId);
  const [diagramSettingsDiagramId, setDiagramSettingsDiagramId] = useState<string | null>(null);
  const [moveDiagramId, setMoveDiagramId] = useState<string | null>(null);
  const [folderSettingsFolderId, setFolderSettingsFolderId] = useState<string | null>(null);
  const [libraryContextMenu, setLibraryContextMenu] = useState<LibraryContextMenuState | null>(null);
  const libraryContextMenuRef = useRef<HTMLDivElement | null>(null);
  const activeFolderName = activeFolder?.name ?? 'No folder';
  const diagramSettingsDiagram = diagramSettingsDiagramId
    ? (diagrams.find((diagram) => diagram.id === diagramSettingsDiagramId) ?? null)
    : null;
  const moveDiagram = moveDiagramId ? (diagrams.find((diagram) => diagram.id === moveDiagramId) ?? null) : null;
  const folderSettingsFolder = folderSettingsFolderId
    ? (folders.find((folder) => folder.id === folderSettingsFolderId) ?? null)
    : null;
  const isLibraryStackedDialogOpen =
    stackedDialogOpen ||
    Boolean(diagramSettingsDiagram || moveDiagram || folderSettingsFolder || libraryContextMenu);
  const rootDiagramCount = diagrams.filter((diagram) => !diagram.folderId).length;
  const filteredDiagrams = useMemo(() => {
    const search = diagramSearchTerm.trim().toLowerCase();
    const folderFilteredDiagrams = diagrams.filter((diagram) => {
      if (selectedFolderFilterId === allDiagramFilterId) {
        return true;
      }

      if (selectedFolderFilterId === rootDiagramFilterId) {
        return !diagram.folderId;
      }

      return diagram.folderId === selectedFolderFilterId;
    });

    return search
      ? folderFilteredDiagrams.filter((diagram) =>
          [diagram.name, diagram.dialect].some((value) => value.toLowerCase().includes(search)),
        )
      : folderFilteredDiagrams;
  }, [diagrams, diagramSearchTerm, selectedFolderFilterId]);
  const filteredFolders = useMemo(() => {
    const search = folderSearchTerm.trim().toLowerCase();

    return search
      ? folders.filter((folder) =>
          [folder.name, folder.slug, folder.description ?? ''].some((value) => value.toLowerCase().includes(search)),
        )
      : folders;
  }, [folderSearchTerm, folders]);
  const selectedFolderLabel = getSelectedFolderLabel(selectedFolderFilterId, folders);
  const selectedFolderIdForCreate =
    selectedFolderFilterId !== allDiagramFilterId &&
    selectedFolderFilterId !== rootDiagramFilterId &&
    folders.some((folder) => folder.id === selectedFolderFilterId)
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
      setFolderSearchTerm('');
      setSelectedFolderFilterId(allDiagramFilterId);
    }
  }

  function handleCreateDiagram() {
    onCreateDiagram(selectedFolderIdForCreate);
  }

  function handleCreateFolder() {
    onCreateFolder();
  }

  function openFolderContextMenu(event: MouseEvent, folder: FolderResponseDto) {
    if (!canManageFolderSettings(folder)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setLibraryContextMenu({
      kind: 'folder',
      ...getContextMenuPoint(event.clientX, event.clientY),
      folderId: folder.id,
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

  function openDiagramActionMenu(event: MouseEvent<HTMLButtonElement>, diagram: DiagramResponseDto) {
    if (!canEditDiagramSettings(diagram)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setLibraryContextMenu({
      kind: 'diagram',
      ...getContextMenuPoint(rect.right - 220, rect.bottom + 6),
      diagramId: diagram.id,
    });
  }

  function openFolderActionMenu(event: MouseEvent<HTMLButtonElement>, folder: FolderResponseDto) {
    if (!canManageFolderSettings(folder)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setLibraryContextMenu({
      kind: 'folder',
      ...getContextMenuPoint(rect.right - 220, rect.bottom + 6),
      folderId: folder.id,
    });
  }

  function handleOpenFolderSettings(folderId: string) {
    setLibraryContextMenu(null);
    setFolderSettingsFolderId(folderId);
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
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                      Folders
                    </p>
                    <h2 className="truncate text-[13px] font-black">{activeOrganization.name}</h2>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {canCreateFolder ? (
                      <Button className="shrink-0 gap-1.5" onClick={handleCreateFolder} size="sm" variant="secondary">
                        <FolderPlus className="size-4" />
                        Folder
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--tabliodb-ink-subtle))]" />
                  <Input
                    className="h-9 pl-9 text-[13px]"
                    onChange={(event) => setFolderSearchTerm(event.target.value)}
                    placeholder="Search folders"
                    value={folderSearchTerm}
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
                  {filteredFolders.length === 0 ? (
                    <div className="rounded-[var(--tabliodb-radius-md)] border border-dashed border-[rgb(var(--tabliodb-border))] p-4 text-center text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                      No matching folders
                    </div>
                  ) : (
                    filteredFolders.map((folder) => {
                      const canOpenSettings = canManageFolderSettings(folder);

                      return (
                        <FolderFilterButton
                          action={
                            canOpenSettings ? (
                              <IconButton
                                className="size-8"
                                icon={MoreHorizontal}
                                label={`Folder actions for ${folder.name}`}
                                onClick={(event) => openFolderActionMenu(event, folder)}
                                variant="ghost"
                              />
                            ) : null
                          }
                          count={diagrams.filter((diagram) => diagram.folderId === folder.id).length}
                          isFolder={true}
                          isSelected={selectedFolderFilterId === folder.id}
                          key={folder.id}
                          label={folder.name}
                          onContextMenu={(event) => openFolderContextMenu(event, folder)}
                          onSelect={() => setSelectedFolderFilterId(folder.id)}
                          subtitle={folder.slug}
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
                      Active: {activeDiagram.name} / {activeFolderName}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                    {filteredDiagrams.length} diagrams
                  </span>
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
                      const folderName = diagram.folderId
                        ? (folders.find((folder) => folder.id === diagram.folderId)?.name ?? 'Folder')
                        : 'No folder';
                      const canOpenDiagramActions = canEditDiagramSettings(diagram);

                      return (
                        <div
                          className={`group relative flex min-h-28 min-w-0 flex-col rounded-[var(--tabliodb-radius-lg)] border text-left transition ${
                            isActive
                              ? 'border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-selected-surface))]'
                              : 'border-[rgb(var(--tabliodb-border))] bg-white hover:border-[rgb(var(--tabliodb-primary-border))] hover:bg-[rgb(var(--tabliodb-surface-raised))]'
                          }`}
                          key={diagram.id}
                          onContextMenu={(event) => openDiagramContextMenu(event, diagram)}
                        >
                          <button
                            className="flex min-h-28 w-full min-w-0 cursor-pointer flex-1 flex-col justify-between rounded-[var(--tabliodb-radius-lg)] p-3 text-left outline-none transition focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--tabliodb-focus-ring))]"
                            onClick={() => {
                              if (!isActive) {
                                onDiagramLibraryOpenChange(false);
                                onDiagramSelect(diagram);
                              }
                            }}
                            type="button"
                          >
                            <span className="min-w-0 pr-9">
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
                          {canOpenDiagramActions ? (
                            <IconButton
                              className="absolute right-2 top-2 size-8 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                              icon={MoreHorizontal}
                              label={`Diagram actions for ${diagram.name}`}
                              onClick={(event) => openDiagramActionMenu(event, diagram)}
                              variant="ghost"
                            />
                          ) : null}
                        </div>
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
            onSelect={() => handleOpenFolderSettings(libraryContextMenu.folderId)}
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
          folders={folders}
          trigger={null}
        />
      ) : null}
      {folderSettingsFolder ? (
        <FolderSettingsDialog
          currentUserId={currentUserId}
          onArchived={() => {
            setFolderSettingsFolderId(null);
            onFolderArchived();
          }}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setFolderSettingsFolderId(null);
            }
          }}
          open={Boolean(folderSettingsFolder)}
          folder={folderSettingsFolder}
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

function getSelectedFolderLabel(folderFilterId: string, folders: FolderResponseDto[]): string {
  if (folderFilterId === allDiagramFilterId) {
    return 'All diagrams';
  }

  if (folderFilterId === rootDiagramFilterId) {
    return 'No folder';
  }

  return folders.find((folder) => folder.id === folderFilterId)?.name ?? 'Folder';
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

function canManageFolderSettings(folder: FolderResponseDto): boolean {
  // Folder settings currently includes member access, so only roles with member-management permission receive the menu.
  return hasFolderPermission(folder.folderRole, Permission.FolderAccessManage);
}

function canEditDiagramSettings(diagram: DiagramResponseDto): boolean {
  // Diagram settings mutates diagram metadata/review overrides, so context actions follow the effective diagram role from the API.
  return hasFolderPermission(diagram.role as AccessRoleValue, Permission.DiagramUpdate);
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

function hasFolderPermission(role: AccessRoleValue, permission: Permission): boolean {
  return isGranted({
    current: permissionsForAccessRole(role),
    requested: [permission],
  });
}
