import type { DiagramModel } from '@tabliodb/schema-core';
import type {
  DiagramResponseDtoOutput,
  OrganizationDtoOutput,
  FolderResponseDtoOutput,
  SnapshotResponseDtoOutput,
} from '@tabliodb/sdk';
import { Badge, Button, IconButton } from '@tabliodb/ui';
import { History, LocateFixed, Loader2, MessageSquareText, Play, Redo2, Save, Undo2 } from 'lucide-react';
import LOGO from '@/assets/logo.svg';
import type { DiagramCollaborationStatus } from '@/features/collaboration/collaboration-client';
import { CollaborationPresence, type CollaboratorPresence } from '../collaboration-status';
import { DiagramAccessDialog } from './DiagramAccessDialog';
import { NotificationInboxMenu, UserAccountMenu, type NotificationInboxItem } from './EditorHeaderMenus';
import { EditorMoreActionsMenu } from './EditorMoreActionsMenu';
import type { AvatarIdentity } from './UserAvatar';
import { WorkspaceFolderSwitcher } from './WorkspaceFolderSwitcher';

type DiagramResponseDto = DiagramResponseDtoOutput;
type OrganizationDto = OrganizationDtoOutput;
type FolderResponseDto = FolderResponseDtoOutput;
type SnapshotResponseDto = SnapshotResponseDtoOutput;
type HeaderAction = () => Promise<void> | void;

export function EditorHeader({
  activeDiagram,
  activeOrganization,
  activeFolder,
  canCommentDiagram,
  canCreateDiagram,
  canCreateFolder,
  canCreateSnapshot,
  canEditDiagram,
  canManageDiagramMembers,
  canManageWorkspace,
  canRedoModelChange,
  canUndoModelChange,
  collaborators,
  collaborationStatus,
  currentDraftPersisted,
  currentUser,
  diagramLibraryOpen,
  diagramLibraryStackOpen,
  diagrams,
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
  onCreateFolder,
  onCreateSnapshot,
  onCreateWorkspace,
  onDiagramSelect,
  onDiagramLibraryOpenChange,
  onDiagramUpdated,
  onDownloadSql,
  onExportJson,
  onExportMarkdown,
  onExportMermaid,
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
  onFolderArchived,
  onRedo,
  onUndo,
  onUserLogout,
  openCommentThreadCount,
  organizations,
  folders,
  snapshotHistoryLoading,
  snapshotSavePending,
  unreadNotificationCount,
}: {
  activeDiagram: DiagramResponseDto;
  activeOrganization: OrganizationDto;
  activeFolder: FolderResponseDto | null;
  canCommentDiagram: boolean;
  canCreateDiagram: boolean;
  canCreateFolder: boolean;
  canCreateSnapshot: boolean;
  canEditDiagram: boolean;
  canManageDiagramMembers: boolean;
  canManageWorkspace: boolean;
  canRedoModelChange: boolean;
  canUndoModelChange: boolean;
  collaborators: CollaboratorPresence[];
  collaborationStatus: DiagramCollaborationStatus;
  currentDraftPersisted: boolean;
  currentUser: AvatarIdentity & { email: string; id: string; instanceRole?: 'owner' | 'admin' | null };
  diagramLibraryOpen: boolean;
  diagramLibraryStackOpen: boolean;
  diagrams: DiagramResponseDto[];
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
  onCreateDiagram: (folderId?: string | null) => void;
  onCreateFolder: () => void;
  onCreateSnapshot: () => void;
  onCreateWorkspace: () => void;
  onDiagramSelect: (diagram: DiagramResponseDto) => void;
  onDiagramLibraryOpenChange: (open: boolean) => void;
  onDiagramUpdated: (diagram: DiagramResponseDto) => void;
  onDownloadSql: HeaderAction;
  onExportJson: HeaderAction;
  onExportMarkdown: HeaderAction;
  onExportMermaid: HeaderAction;
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
  onFolderArchived: () => void;
  onRedo: () => void;
  onToggleMinimap: () => void;
  onUndo: () => void;
  onUserLogout: () => void;
  openCommentThreadCount: number;
  organizations: OrganizationDto[];
  folders: FolderResponseDto[];
  snapshotHistoryLoading: boolean;
  snapshotSavePending: boolean;
  unreadNotificationCount: number;
}) {
  const canOpenAdmin = currentUser.instanceRole === 'owner' || currentUser.instanceRole === 'admin';

  return (
    <header className="flex h-(--tabliodb-header-height) shrink-0 items-center gap-2 border-b border-[rgb(var(--tabliodb-border))] bg-white px-2 sm:gap-3 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <div className="flex h-9 w-32 shrink-0 items-center overflow-hidden max-[560px]:w-9">
          <img src={LOGO} alt="Tabliodb" className="h-9 w-32 max-w-none" />
        </div>
        <WorkspaceFolderSwitcher
          activeDiagram={activeDiagram}
          activeOrganization={activeOrganization}
          activeFolder={activeFolder}
          canCreateDiagram={canCreateDiagram}
          canCreateFolder={canCreateFolder}
          canEditDiagram={canEditDiagram}
          canManageWorkspace={canManageWorkspace}
          currentUserId={currentUser.id}
          diagramLibraryOpen={diagramLibraryOpen}
          diagrams={diagrams}
          model={model}
          onCreateDiagram={onCreateDiagram}
          onCreateFolder={onCreateFolder}
          onCreateWorkspace={onCreateWorkspace}
          onDiagramSelect={onDiagramSelect}
          onDiagramLibraryOpenChange={onDiagramLibraryOpenChange}
          onDiagramUpdated={onDiagramUpdated}
          onOrganizationSelect={onOrganizationSelect}
          onFolderArchived={onFolderArchived}
          organizations={organizations}
          folders={folders}
          stackedDialogOpen={diagramLibraryStackOpen}
        />
      </div>

      {/* Header hanya menerima callback dari parent; route reset, mutation reset, dan model sync tetap berada di EditorPage sebagai orchestration boundary. */}
      <div className="tabliodb-scrollbar flex min-w-0 max-w-[64vw] shrink-0 items-center gap-1 overflow-x-auto py-1 max-[700px]:max-w-[58vw]">
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
        {canManageDiagramMembers ? (
          <DiagramAccessDialog
            canManage={canManageDiagramMembers}
            currentUserId={currentUser.id}
            diagram={activeDiagram}
          />
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
          label="Saved versions"
          onClick={onOpenSnapshotHistory}
        />
        <IconButton className="hidden xl:inline-flex" icon={LocateFixed} label="Fit diagram" onClick={onFitDiagram} />
        {canCreateSnapshot ? (
          <Button className="gap-2 px-3" disabled={snapshotSavePending} onClick={onCreateSnapshot}>
            {snapshotSavePending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            <span className="hidden xl:inline">Save</span>
          </Button>
        ) : null}
        <Button className="gap-2 px-3" onClick={onOpenSqlPreview} variant="sky">
          <Play className="size-4" />
          <span className="hidden xl:inline">SQL</span>
        </Button>
        <UserAccountMenu
          canOpenAdmin={canOpenAdmin}
          isLoggingOut={logoutPending}
          onAdmin={onAdmin}
          onLogout={onUserLogout}
          onProfile={onOpenProfile}
          user={currentUser}
        />
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
          onExportMermaid={onExportMermaid}
          onExportPng={onExportPng}
          onExportSvg={onExportSvg}
          onImportJson={onImportJson}
          onImportSql={onImportSql}
          onOpenKeyboardShortcuts={onOpenKeyboardShortcuts}
          onRedo={onRedo}
          onShareReadOnlyLink={onOpenShareLinks}
          onUndo={onUndo}
        />
      </div>
    </header>
  );
}
