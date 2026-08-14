import type { DiagramModel } from '@tabliodb/schema-core';
import { ProjectRole, type ProjectRoleValue } from '@tabliodb/shared';
import type {
  DiagramResponseDtoOutput,
  OrganizationDtoOutput,
  ProjectResponseDtoOutput,
  SnapshotResponseDtoOutput,
} from '@tabliodb/sdk';
import { Badge, Button, IconButton } from '@tabliodb/ui';
import { History, Keyboard, LocateFixed, Loader2, MessageSquareText, Play, Redo2, Save, Undo2 } from 'lucide-react';
import LOGO from '@/assets/logo.svg';
import type { DiagramCollaborationStatus } from '@/features/collaboration/collaboration-client';
import { CollaborationPresence, type CollaboratorPresence } from '../collaboration-status';
import { DiagramSettingsDialog } from './DiagramSettingsDialog';
import { NotificationInboxMenu, UserAccountMenu, type NotificationInboxItem } from './EditorHeaderMenus';
import { EditorMoreActionsMenu } from './EditorMoreActionsMenu';
import { ProjectSettingsDialog } from './ProjectSettingsDialog';
import type { AvatarIdentity } from './UserAvatar';
import { WorkspaceProjectSwitcher } from './WorkspaceProjectSwitcher';
import { WorkspaceSettingsDialog } from './WorkspaceSettingsDialog';

type DiagramResponseDto = DiagramResponseDtoOutput;
type OrganizationDto = OrganizationDtoOutput;
type ProjectResponseDto = ProjectResponseDtoOutput;
type SnapshotResponseDto = SnapshotResponseDtoOutput;
type HeaderAction = () => Promise<void> | void;

export function EditorHeader({
  activeDiagram,
  activeOrganization,
  activeProject,
  canCommentDiagram,
  canCreateDiagram,
  canCreateProject,
  canCreateSnapshot,
  canEditDiagram,
  canManageProject,
  canManageWorkspace,
  canRedoModelChange,
  canUndoModelChange,
  collaborators,
  collaborationStatus,
  currentDraftPersisted,
  currentUser,
  diagrams,
  filteredProjects,
  importDiagramPending,
  isExporting,
  latestSnapshot,
  logoutPending,
  model,
  notificationError,
  notificationHasNextPage,
  notificationIsLoading,
  notifications,
  notificationsOpen,
  onAdmin,
  onCopySql,
  onCreateDiagram,
  onCreateProject,
  onCreateSnapshot,
  onCreateWorkspace,
  onDiagramSelect,
  onDiagramUpdated,
  onDownloadSql,
  onExportJson,
  onExportMarkdown,
  onExportPng,
  onExportSvg,
  onFitDiagram,
  onImportJson,
  onImportSql,
  onNotificationOpenChange,
  onNotificationRetry,
  onNotificationSelect,
  onOpenComments,
  onOpenKeyboardShortcuts,
  onOpenProfile,
  onOpenShareLinks,
  onOpenSnapshotHistory,
  onOpenSqlPreview,
  onOrganizationSelect,
  onProjectArchived,
  onProjectSearchChange,
  onProjectSelect,
  onRedo,
  onToggleMinimap,
  onUndo,
  onUserLogout,
  openCommentThreadCount,
  organizations,
  projectSearchTerm,
  snapshotHistoryLoading,
  snapshotSavePending,
  unreadNotificationCount,
}: {
  activeDiagram: DiagramResponseDto;
  activeOrganization: OrganizationDto;
  activeProject: ProjectResponseDto;
  canCommentDiagram: boolean;
  canCreateDiagram: boolean;
  canCreateProject: boolean;
  canCreateSnapshot: boolean;
  canEditDiagram: boolean;
  canManageProject: boolean;
  canManageWorkspace: boolean;
  canRedoModelChange: boolean;
  canUndoModelChange: boolean;
  collaborators: CollaboratorPresence[];
  collaborationStatus: DiagramCollaborationStatus;
  currentDraftPersisted: boolean;
  currentUser: AvatarIdentity & { email: string };
  diagrams: DiagramResponseDto[];
  filteredProjects: ProjectResponseDto[];
  importDiagramPending: boolean;
  isExporting: boolean;
  latestSnapshot: SnapshotResponseDto | null;
  logoutPending: boolean;
  model: DiagramModel;
  notificationError: Error | null;
  notificationHasNextPage: boolean;
  notificationIsLoading: boolean;
  notifications: NotificationInboxItem[];
  notificationsOpen: boolean;
  onAdmin: () => void;
  onCopySql: HeaderAction;
  onCreateDiagram: () => void;
  onCreateProject: () => void;
  onCreateSnapshot: () => void;
  onCreateWorkspace: () => void;
  onDiagramSelect: (diagram: DiagramResponseDto) => void;
  onDiagramUpdated: (diagram: DiagramResponseDto) => void;
  onDownloadSql: HeaderAction;
  onExportJson: HeaderAction;
  onExportMarkdown: HeaderAction;
  onExportPng: HeaderAction;
  onExportSvg: HeaderAction;
  onFitDiagram: () => void;
  onImportJson: () => void;
  onImportSql: () => void;
  onNotificationOpenChange: (open: boolean) => void;
  onNotificationRetry: () => void;
  onNotificationSelect: (notification: NotificationInboxItem) => void;
  onOpenComments: () => void;
  onOpenKeyboardShortcuts: () => void;
  onOpenProfile: () => void;
  onOpenShareLinks: () => void;
  onOpenSnapshotHistory: () => void;
  onOpenSqlPreview: () => void;
  onOrganizationSelect: (organization: OrganizationDto) => void;
  onProjectArchived: () => void;
  onProjectSearchChange: (value: string) => void;
  onProjectSelect: (project: ProjectResponseDto) => void;
  onRedo: () => void;
  onToggleMinimap: () => void;
  onUndo: () => void;
  onUserLogout: () => void;
  openCommentThreadCount: number;
  organizations: OrganizationDto[];
  projectSearchTerm: string;
  snapshotHistoryLoading: boolean;
  snapshotSavePending: boolean;
  unreadNotificationCount: number;
}) {
  return (
    <header className="flex h-(--tabliodb-header-height) shrink-0 items-center gap-2 border-b border-[rgb(var(--tabliodb-border))] bg-white px-2 sm:gap-3 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <div className="flex h-9 w-32 shrink-0 items-center overflow-hidden max-[560px]:w-9">
          <img src={LOGO} alt="Tabliodb" className="h-9 w-32 max-w-none" />
        </div>
        <WorkspaceProjectSwitcher
          activeDiagram={activeDiagram}
          activeOrganization={activeOrganization}
          activeProject={activeProject}
          canCreateDiagram={canCreateDiagram}
          canCreateProject={canCreateProject}
          diagrams={diagrams}
          onCreateDiagram={onCreateDiagram}
          onCreateProject={onCreateProject}
          onCreateWorkspace={onCreateWorkspace}
          onDiagramSelect={onDiagramSelect}
          onOrganizationSelect={onOrganizationSelect}
          onProjectSearchChange={onProjectSearchChange}
          onProjectSelect={onProjectSelect}
          organizations={organizations}
          projectSearchTerm={projectSearchTerm}
          projects={filteredProjects}
        />
      </div>

      {/* Header hanya menerima callback dari parent; route reset, mutation reset, dan model sync tetap berada di EditorPage sebagai orchestration boundary. */}
      <div className="tabliodb-scrollbar flex min-w-0 max-w-[64vw] shrink-0 items-center gap-1 overflow-x-auto py-1 max-[700px]:max-w-[58vw]">
        <Badge className="hidden md:inline-flex" variant={canEditDiagram ? 'green' : 'yellow'}>
          {formatProjectRole(activeProject.projectRole)}
        </Badge>
        {canEditDiagram ? (
          <div className="hidden items-center gap-1 xl:flex">
            <IconButton disabled={!canUndoModelChange} icon={Undo2} label="Undo last edit" onClick={onUndo} />
            <IconButton disabled={!canRedoModelChange} icon={Redo2} label="Redo last edit" onClick={onRedo} />
          </div>
        ) : null}
        <CollaborationPresence
          collaborators={collaborators}
          draftPersisted={currentDraftPersisted}
          latestSnapshot={latestSnapshot}
          snapshotSavePending={snapshotSavePending}
          status={collaborationStatus}
        />
        {canCommentDiagram ? (
          <div className="relative">
            <IconButton icon={MessageSquareText} label="Comments" onClick={onOpenComments} />
            {openCommentThreadCount > 0 ? (
              <span className="pointer-events-none absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-[rgb(var(--tabliodb-red))] px-1 text-[9px] font-extrabold leading-4 text-white [text-shadow:var(--tabliodb-solid-text-shadow)]">
                {openCommentThreadCount > 99 ? '99+' : openCommentThreadCount}
              </span>
            ) : null}
          </div>
        ) : null}
        <NotificationInboxMenu
          error={notificationError}
          hasNextPage={notificationHasNextPage}
          isLoading={notificationIsLoading}
          notifications={notifications}
          onOpenChange={onNotificationOpenChange}
          onRetry={onNotificationRetry}
          onSelect={onNotificationSelect}
          open={notificationsOpen}
          unreadCount={unreadNotificationCount}
        />
        <IconButton
          className="hidden lg:inline-flex"
          disabled={snapshotHistoryLoading}
          icon={History}
          label="Snapshot history"
          onClick={onOpenSnapshotHistory}
        />
        <IconButton className="hidden xl:inline-flex" icon={LocateFixed} label="Fit diagram" onClick={onFitDiagram} />
        <IconButton
          className="hidden 2xl:inline-flex"
          icon={Keyboard}
          label="Keyboard shortcuts"
          onClick={onOpenKeyboardShortcuts}
        />
        {canManageWorkspace ? (
          <WorkspaceSettingsDialog organization={activeOrganization} project={activeProject} />
        ) : null}
        {canManageProject ? <ProjectSettingsDialog onArchived={onProjectArchived} project={activeProject} /> : null}
        {canEditDiagram ? (
          <DiagramSettingsDialog
            canEdit={canEditDiagram}
            diagram={activeDiagram}
            model={model}
            onUpdated={onDiagramUpdated}
          />
        ) : null}
        {canCreateSnapshot ? (
          <Button className="gap-2 px-3" disabled={snapshotSavePending} onClick={onCreateSnapshot}>
            {snapshotSavePending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            <span className="hidden xl:inline">Snapshot</span>
          </Button>
        ) : null}
        <Button className="gap-2 px-3" onClick={onOpenSqlPreview} variant="sky">
          <Play className="size-4" />
          <span className="hidden xl:inline">SQL</span>
        </Button>
        <EditorMoreActionsMenu
          canEdit={canEditDiagram}
          canRedo={canRedoModelChange}
          canUndo={canUndoModelChange}
          isExporting={isExporting}
          isImporting={importDiagramPending}
          onCopySql={onCopySql}
          onDownloadSql={onDownloadSql}
          onExportJson={onExportJson}
          onExportMarkdown={onExportMarkdown}
          onExportPng={onExportPng}
          onExportSvg={onExportSvg}
          onFitDiagram={onFitDiagram}
          onImportJson={onImportJson}
          onImportSql={onImportSql}
          onOpenKeyboardShortcuts={onOpenKeyboardShortcuts}
          onRedo={onRedo}
          onShareReadOnlyLink={onOpenShareLinks}
          onToggleMinimap={onToggleMinimap}
          onUndo={onUndo}
        />
        <UserAccountMenu
          canOpenAdmin={canManageWorkspace}
          isLoggingOut={logoutPending}
          onAdmin={onAdmin}
          onLogout={onUserLogout}
          onProfile={onOpenProfile}
          user={currentUser}
        />
      </div>
    </header>
  );
}

function formatProjectRole(role: ProjectRoleValue): string {
  return {
    [ProjectRole.Commenter]: 'Commenter',
    [ProjectRole.Editor]: 'Editor',
    [ProjectRole.Owner]: 'Owner',
    [ProjectRole.Viewer]: 'Viewer',
  }[role];
}
