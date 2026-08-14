import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import LOGO from '@/assets/logo.svg';
import {
  getTableColumns,
  applyDiagramCommand,
  createDiagramEntityId,
  parseDiagramModel,
  type DatabaseIndex,
  type DatabaseTable,
  type DiagramEntityKind,
  type DiagramModel,
  type DiagramReviewSignal,
} from '@tabliodb/schema-core';
import {
  OrganizationRole,
  Permission,
  ProjectRole,
  isGranted,
  permissionsForOrganizationRole,
  permissionsForProjectRole,
  type OrganizationRoleValue,
  type ProjectRoleValue,
} from '@tabliodb/shared';
import {
  DefaultProjectRole as SdkDefaultProjectRole,
  Mode as SdkImportMode,
  Role as SdkOrganizationMemberRole,
  Role2 as SdkProjectMemberRole,
  Role3 as SdkTeamProjectRole,
  Source as SdkImportSource,
  TabliodbApiError,
  TargetType2 as SdkShareLinkTargetType,
  type AuditLogDtoOutput,
  type CurrentUserEditorPreferenceDtoOutput,
  type CurrentUserEditorPreferenceUpdateDto,
  type DiagramShareLinkCreateDto,
  type DiagramShareLinkCreateResponseDtoOutput,
  type DiagramShareLinkDtoOutput,
  type DiagramResponseDtoOutput,
  type NotificationInboxItemDtoOutput,
  type OrganizationDtoOutput,
  type OrganizationMemberDtoOutput,
  type OrganizationSettingsDtoOutput,
  type ProjectMemberDtoOutput,
  type ProjectResponseDtoOutput,
  type ReviewSignalResponseDtoOutput,
  type SnapshotResponseDtoOutput,
  type TeamMemberDtoOutput,
  type TeamProjectAccessDtoOutput,
  type TeamResponseDtoOutput,
} from '@tabliodb/sdk';
import type { AwarenessState } from '@tabliodb/shared';
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
  DropdownMenuTrigger,
  FieldError,
  IconButton,
  Input,
  Select,
  Surface,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  WithTooltip,
  cn,
  toast,
} from '@tabliodb/ui';
import {
  AtSign,
  Archive,
  Bell,
  Building2,
  ChevronDown,
  ChevronsUpDown,
  Copy,
  Database,
  FileText,
  FileWarning,
  FolderPlus,
  History,
  Loader2,
  LocateFixed,
  Link2,
  LogOut,
  Keyboard,
  MessageSquareText,
  Play,
  Plus,
  Save,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  StickyNote,
  Trash2,
  UserPlus,
  UserRound,
  UsersRound,
  Reply,
  Redo2,
  RotateCcw,
  Undo2,
  X,
  PanelRight,
  PanelLeft,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { routes } from '@/app/routes';
import type {
  DiagramCollaboration,
  DiagramCollaborationStatus,
  RemoteAwarenessState,
} from '@/features/collaboration/collaboration-client';
import { ControlledCheckbox, ControlledInput, ControlledSelect, ControlledTextarea } from '@/features/app/FormControls';
import {
  EmptyState,
  ErrorState,
  InlineErrorState,
  InlineLoadingState,
  LoadingState,
  getErrorMessage,
} from '@/features/app/RouteStates';
import { authQueries, useLogoutMutation, useUpdateCurrentUserEditorPreferenceMutation } from '@/resources/auth';
import { diagramsQueries, useImportDiagramMutation } from '@/resources/diagrams';
import {
  organizationsQueries,
  useRemoveOrganizationMemberMutation,
  useUpdateOrganizationMemberMutation,
  useUpdateOrganizationSettingsMutation,
} from '@/resources/organizations';
import {
  projectsQueries,
  useAddProjectMemberMutation,
  useArchiveProjectMutation,
  useRemoveProjectMemberMutation,
  useUpdateProjectMemberMutation,
  useUpdateProjectMutation,
} from '@/resources/projects';
import { notificationQueries } from '@/resources/notifications';
import { commentQueries } from '@/resources/comments';
import { snapshotsQueries, useCreateSnapshotMutation, useRestoreSnapshotMutation } from '@/resources/snapshots';
import {
  teamsQueries,
  useAddTeamMemberMutation,
  useArchiveTeamMutation,
  useCreateTeamMutation,
  useRemoveTeamMemberMutation,
  useRemoveTeamProjectAccessMutation,
  useUpdateTeamMutation,
  useUpsertTeamProjectAccessMutation,
} from '@/resources/teams';
import {
  reviewSignalKeys,
  reviewSignalQueries,
  useIgnoreReviewSignalMutation,
  useUpdateProjectReviewSignalSettingsMutation,
} from '@/resources/review-signals';
import {
  shareLinkQueries,
  useCreateDiagramShareLinkMutation,
  useRevokeDiagramShareLinkMutation,
} from '@/resources/share-links';
import {
  addTableToDiagramModel,
  createRealtimeColumnPatch,
  createRealtimeColumnStructuralPatch,
  createRealtimeNotePatch,
  createRealtimeRelationshipPatch,
  createRealtimeTablePatch,
  createRemoteSelectionConflict,
  createSeedDiagramModel,
  createSnapshotSaveModel,
  formatColumnType,
  normalizeEditorDiagramModel,
  shouldKeepLocalDiagramModelOverRealtime,
} from './diagram-model';
import { formatCommentTargetType, getCommentTargetTableId, isCommentTargetAvailable } from './comments/comment-targets';
import type { CommentThreadOpenRequest, CommentTypingPresence, EditorCommentTarget } from './comments/types';
import { CollaborationPresence, type CollaboratorPresence } from './collaboration-status';
import {
  createDiagramModelSignature,
  createEmptyEditorModelHistory,
  redoLocalModelChange,
  recordLocalModelChange,
  undoLocalModelChange,
  type EditorModelHistory,
} from './model-history';
import { CommentsDialog } from './components/CommentsDialog';
import { DiagramSettingsDialog } from './components/DiagramSettingsDialog';
import { EditorMoreActionsMenu } from './components/EditorMoreActionsMenu';
import { CreateDiagramDialog, CreateProjectDialog, CreateWorkspaceDialog } from './components/WorkspaceShellDialogs';
import { WorkspaceProjectSwitcher } from './components/WorkspaceProjectSwitcher';
import {
  ImportJsonDialog,
  ImportSqlDialog,
  type EditorImportRequest,
  type EditorImportSource,
} from './components/ImportDialogs';
import { SchemaCanvas, type CanvasViewportRect, type RemoteCanvasCursor } from './components/SchemaCanvas';
import { SchemaInspector } from './components/SchemaInspector';
import { SnapshotHistoryDialog } from './components/SnapshotHistoryDialog';
import { SqlPreviewDialog } from './components/SqlPreviewDialog';
import { TableStructureSidebar } from './components/TableStructureSidebar';
import { UserAvatar, type AvatarIdentity } from './components/UserAvatar';
import { formatDiagramDialect } from './diagram-formatters';
import { sdkDialectByValue, toDatabaseDialect } from './diagram-sdk-mappers';
import { selectClassName } from './editor-form-styles';
import { getDisplayTableColor } from './table-colors';
import { copyTextToClipboard } from './export-utils';
import {
  ReviewSignalSettingsFields,
  getReviewSignalSettingsDefaults,
  reviewSignalSettingsFormSchema,
  toReviewSignalSettingsDto,
  type ReviewSignalSettingsFormState,
} from './review-signal-settings';
import { getSnapshotRealtimeGuard, type SnapshotRealtimeGuard } from './snapshot-realtime-guard';
import { useDiagramExportActions } from './useDiagramExportActions';

type AuditLogDto = AuditLogDtoOutput;
type CurrentUserEditorPreferenceDto = CurrentUserEditorPreferenceDtoOutput;
type CurrentUserEditorPreferenceUpdateDtoInput = CurrentUserEditorPreferenceUpdateDto;
type DiagramResponseDto = DiagramResponseDtoOutput;
type NotificationInboxItemDto = NotificationInboxItemDtoOutput;
type OrganizationDto = OrganizationDtoOutput;
type OrganizationMemberDto = OrganizationMemberDtoOutput;
type OrganizationSettingsDto = OrganizationSettingsDtoOutput;
type ProjectMemberDto = ProjectMemberDtoOutput;
type ProjectResponseDto = ProjectResponseDtoOutput;
type ReviewSignalResponseDto = ReviewSignalResponseDtoOutput;
type SnapshotResponseDto = SnapshotResponseDtoOutput;
type DiagramShareLinkDto = DiagramShareLinkDtoOutput;
type TeamMemberDto = TeamMemberDtoOutput;
type TeamProjectAccessDto = TeamProjectAccessDtoOutput;
type TeamProjectRole = `${SdkTeamProjectRole}`;
type TeamResponseDto = TeamResponseDtoOutput;
type WorkspaceDefaultProjectRole = ProjectRole.Editor | ProjectRole.Commenter | ProjectRole.Viewer;

const sdkDefaultProjectRoleByValue: Record<WorkspaceDefaultProjectRole, SdkDefaultProjectRole> = {
  [ProjectRole.Commenter]: SdkDefaultProjectRole.Commenter,
  [ProjectRole.Editor]: SdkDefaultProjectRole.Editor,
  [ProjectRole.Viewer]: SdkDefaultProjectRole.Viewer,
};

const sdkOrganizationMemberRoleByValue: Record<OrganizationRoleValue, SdkOrganizationMemberRole> = {
  [OrganizationRole.Admin]: SdkOrganizationMemberRole.Admin,
  [OrganizationRole.Guest]: SdkOrganizationMemberRole.Guest,
  [OrganizationRole.Member]: SdkOrganizationMemberRole.Member,
  [OrganizationRole.Owner]: SdkOrganizationMemberRole.Owner,
};

const sdkProjectMemberRoleByValue: Record<ProjectRoleValue, SdkProjectMemberRole> = {
  [ProjectRole.Commenter]: SdkProjectMemberRole.Commenter,
  [ProjectRole.Editor]: SdkProjectMemberRole.Editor,
  [ProjectRole.Owner]: SdkProjectMemberRole.Owner,
  [ProjectRole.Viewer]: SdkProjectMemberRole.Viewer,
};

const sdkTeamProjectRoleByValue: Record<TeamProjectRole, SdkTeamProjectRole> = {
  commenter: SdkTeamProjectRole.Commenter,
  editor: SdkTeamProjectRole.Editor,
  viewer: SdkTeamProjectRole.Viewer,
};

const sdkImportSourceByValue: Record<EditorImportSource, SdkImportSource> = {
  sql: SdkImportSource.Sql,
  tabliodb_json: SdkImportSource.TabliodbJson,
};

type ShareLinkTarget = 'diagram' | 'snapshot';

const sdkShareLinkTargetTypeByValue: Record<ShareLinkTarget, SdkShareLinkTargetType> = {
  diagram: SdkShareLinkTargetType.Diagram,
  snapshot: SdkShareLinkTargetType.Snapshot,
};

function toProjectRoleValue(role: ProjectRoleValue | SdkProjectMemberRole | SdkTeamProjectRole): ProjectRoleValue {
  return role as ProjectRoleValue;
}

function toOrganizationRoleValue(role: OrganizationRoleValue | SdkOrganizationMemberRole): OrganizationRoleValue {
  return role as OrganizationRoleValue;
}

function toWorkspaceDefaultProjectRole(role: SdkDefaultProjectRole): WorkspaceDefaultProjectRole {
  return role as unknown as WorkspaceDefaultProjectRole;
}

const addTableFormSchema = z.object({
  tableName: z.string().trim().max(64, 'Keep the table name under 64 characters.'),
});

type AddTableFormState = z.infer<typeof addTableFormSchema>;

const shareLinkExpiryOptions = ['never', '7', '30'] as const;

const shareLinkFormSchema = z.object({
  expiresInDays: z.enum(shareLinkExpiryOptions),
  label: z.string().trim().max(80, 'Keep the label under 80 characters.'),
  targetType: z.enum(['diagram', 'snapshot']),
});

type ShareLinkFormState = z.infer<typeof shareLinkFormSchema>;

type EditorConfirmAction =
  | {
      tableId: string;
      tableName: string;
      type: 'table-delete';
    }
  | {
      snapshotId: string;
      type: 'snapshot-restore';
    }
  | {
      guard: SnapshotRealtimeGuard;
      type: 'snapshot-save-unsafe';
    };

const projectFormSchema = z.object({
  description: z.string().trim().max(240, 'Keep the description under 240 characters.').optional(),
  name: z.string().trim().min(1, 'Project name is required.').max(80, 'Keep the name under 80 characters.'),
});

type ProjectFormState = z.infer<typeof projectFormSchema>;

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

const teamFormSchema = z.object({
  description: z.string().trim().max(240, 'Keep the description under 240 characters.').optional(),
  name: z.string().trim().min(1, 'Team name is required.').max(80, 'Keep the team name under 80 characters.'),
});

type TeamFormState = z.infer<typeof teamFormSchema>;

const teamFormDefaults: TeamFormState = {
  description: '',
  name: '',
};

const teamMemberFormSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
});

type TeamMemberFormState = z.infer<typeof teamMemberFormSchema>;

const teamMemberFormDefaults: TeamMemberFormState = {
  email: '',
};

const teamProjectAccessRoleOptions = [ProjectRole.Editor, ProjectRole.Commenter, ProjectRole.Viewer] as const;

const teamProjectAccessFormSchema = z.object({
  projectId: z.string().min(1, 'Select a project.'),
  role: z.enum(teamProjectAccessRoleOptions),
});

type TeamProjectAccessFormState = z.infer<typeof teamProjectAccessFormSchema>;

const teamProjectAccessFormDefaults: TeamProjectAccessFormState = {
  projectId: '',
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
const teamPageQuery = { limit: 50 } as const;
const teamMemberPageQuery = { limit: 50 } as const;
const teamProjectAccessPageQuery = { limit: 50 } as const;
const reviewSignalPageQuery = { limit: 50 } as const;
const notificationInboxPageQuery = { limit: 8 } as const;
const workspaceMemberPageQuery = { limit: 50 } as const;
const workspaceAuditLogQuery = { limit: 8 } as const;
const emptyNotifications: NotificationInboxItemDto[] = [];
const emptyProjectMembers: ProjectMemberDto[] = [];
const emptySnapshots: SnapshotResponseDto[] = [];
const idleCollaborationStatus: DiagramCollaborationStatus = {
  connection: 'idle',
  pendingPersistence: false,
  synced: false,
  unsyncedChanges: 0,
};

const editorMobileBreakpointPx = 640;
const editorTabletBreakpointPx = 900;
const editorCollapsedSidebarWidthPx = 44;
const editorDesktopSidebarWidthPx = 320;

export function EditorPage() {
  const navigate = useNavigate();
  const params = useParams();
  const queryClient = useQueryClient();
  const [sqlPreviewOpen, setSqlPreviewOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [snapshotHistoryOpen, setSnapshotHistoryOpen] = useState(false);
  const [importJsonOpen, setImportJsonOpen] = useState(false);
  const [importSqlOpen, setImportSqlOpen] = useState(false);
  const [shareLinksOpen, setShareLinksOpen] = useState(false);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createDiagramOpen, setCreateDiagramOpen] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  const [minimapToggleSignal, setMinimapToggleSignal] = useState(0);
  const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = useState(false);
  const [tableDocsTableId, setTableDocsTableId] = useState<string | null>(null);
  const [model, setModel] = useState<DiagramModel | null>(null);
  const modelRef = useRef<DiagramModel | null>(null);
  const snapshotRecoveryModelRef = useRef<DiagramModel | null>(null);
  const modelHistoryRef = useRef<EditorModelHistory>(createEmptyEditorModelHistory());
  const persistedDraftSignatureRef = useRef<string | null>(null);
  const loadedSnapshotIdRef = useRef<string | null>(null);
  const canvasViewportRef = useRef<CanvasViewportRect | null>(null);
  const [modelHistoryRevision, setModelHistoryRevision] = useState(0);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedCommentTarget, setSelectedCommentTarget] = useState<EditorCommentTarget | null>(null);
  const selectedTableIdRef = useRef<string | null>(null);
  const selectedCommentTargetRef = useRef<EditorCommentTarget | null>(null);
  const [commentThreadOpenRequest, setCommentThreadOpenRequest] = useState<CommentThreadOpenRequest | null>(null);
  const [editorConfirmAction, setEditorConfirmAction] = useState<EditorConfirmAction | null>(null);
  const [editorViewportWidth, setEditorViewportWidth] = useState(getEditorViewportWidth);
  const editorResizeFrameRef = useRef<number | null>(null);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(() => !isCompactEditorViewport(getEditorViewportWidth()));
  // Inspector starts collapsed so the editor opens with more canvas room while keeping the right rail discoverable.
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [remoteAwarenessStates, setRemoteAwarenessStates] = useState<RemoteAwarenessState[]>([]);
  const [collaborationStatus, setCollaborationStatus] = useState<DiagramCollaborationStatus>(idleCollaborationStatus);
  const collaborationRef = useRef<DiagramCollaboration | null>(null);
  const latestCursorRef = useRef<AwarenessState['cursor']>(undefined);
  const latestCommentTypingRef = useRef<AwarenessState['commentTyping']>(undefined);
  const latestAwarenessSentAtRef = useRef(0);
  const commentThreadOpenRequestIdRef = useRef(0);
  const submittedEditorPreferenceKeyRef = useRef<string | null>(null);

  const currentUserQuery = useQuery(authQueries.me());
  const editorPreferenceQuery = useQuery(authQueries.editorPreference());
  const { mutate: updateEditorPreference } = useUpdateCurrentUserEditorPreferenceMutation();
  const organizationsQuery = useQuery(organizationsQueries.list({ limit: 50 }));
  const organizations = organizationsQuery.data?.items ?? [];
  const routeWorkspaceSlug = params.workspaceSlug ?? null;
  const routeProjectId = params.projectId ?? null;
  const routeDiagramId = params.diagramId ?? null;
  const rememberedEditorTarget = editorPreferenceQuery.data ?? null;
  const activeOrganization = useMemo(() => {
    if (organizations.length === 0) {
      return null;
    }

    if (routeWorkspaceSlug) {
      return organizations.find((organization) => matchesWorkspaceRoute(organization, routeWorkspaceSlug)) ?? null;
    }

    if (rememberedEditorTarget) {
      return (
        organizations.find((organization) => matchesRememberedWorkspace(organization, rememberedEditorTarget)) ?? null
      );
    }

    return null;
  }, [organizations, rememberedEditorTarget, routeWorkspaceSlug]);

  const projectsQuery = useQuery(projectsQueries.listByOrganization(activeOrganization));

  const projects = projectsQuery.data ?? [];
  const filteredProjects = useMemo(() => {
    const search = projectSearchTerm.trim().toLowerCase();

    return search
      ? projects.filter((project) =>
          [project.name, project.slug, project.description ?? ''].some((value) => value.toLowerCase().includes(search)),
        )
      : projects;
  }, [projectSearchTerm, projects]);
  const activeProject = useMemo(() => {
    if (!routeProjectId) {
      return null;
    }

    return projects.find((project) => project.id === routeProjectId) ?? null;
  }, [projects, routeProjectId]);

  const diagramsQuery = useQuery(diagramsQueries.listForProject(activeProject));

  const diagrams = diagramsQuery.data ?? [];
  const activeDiagram = useMemo(() => {
    if (!routeDiagramId) {
      return null;
    }

    return diagrams.find((diagram) => diagram.id === routeDiagramId) ?? null;
  }, [diagrams, routeDiagramId]);
  const currentUser = currentUserQuery.data ?? null;
  const canEditDiagram = activeProject
    ? hasProjectPermission(activeProject.projectRole, Permission.DiagramUpdate)
    : false;
  const canCreateSnapshot = activeProject
    ? hasProjectPermission(activeProject.projectRole, Permission.SnapshotCreate)
    : false;
  const canCommentDiagram = activeProject
    ? hasProjectPermission(activeProject.projectRole, Permission.DiagramComment)
    : false;
  const canManageWorkspace = activeOrganization
    ? hasOrganizationPermission(activeOrganization.role, Permission.OrganizationManage)
    : false;
  const canCreateProject = activeOrganization
    ? hasOrganizationPermission(activeOrganization.role, Permission.ProjectCreate)
    : false;
  const canCreateDiagram = activeProject
    ? hasProjectPermission(activeProject.projectRole, Permission.DiagramCreate)
    : false;
  const canManageProject = activeProject
    ? hasProjectPermission(activeProject.projectRole, Permission.ProjectUpdate)
    : false;

  const snapshotsQuery = useQuery(
    snapshotsQueries.listOrCreateInitial(activeDiagram, activeProject, (diagram) =>
      createSeedDiagramModel(diagram.name),
    ),
  );
  const reviewSignalsQuery = useQuery(
    reviewSignalQueries.listByDiagram(activeDiagram?.id ?? '', reviewSignalPageQuery),
  );
  const reviewSignalSettingsQuery = useQuery(reviewSignalQueries.diagramSettings(activeDiagram?.id ?? ''));
  const commentSummaryQueryOptions = commentQueries.diagramSummary(activeDiagram?.id ?? '');
  const commentSummaryQuery = useQuery({
    ...commentSummaryQueryOptions,
    // Canvas dan toolbar cukup memakai agregasi target; thread list lengkap baru dimuat ketika dialog komentar dibuka.
    enabled: Boolean(activeDiagram) && commentSummaryQueryOptions.enabled !== false,
  });
  const notificationSummaryQueryOptions = notificationQueries.summary();
  const notificationSummaryQuery = useQuery({
    ...notificationSummaryQueryOptions,
    // Summary notification murah dan current-user scoped; query ditahan sampai session user valid.
    enabled: Boolean(currentUser) && notificationSummaryQueryOptions.enabled !== false,
  });
  const notificationInboxQueryOptions = notificationQueries.inbox(notificationInboxPageQuery);
  const notificationInboxQuery = useQuery({
    ...notificationInboxQueryOptions,
    // Inbox detail baru dimuat ketika menu dibuka agar editor canvas tidak membawa payload diskusi global saat initial render.
    enabled: Boolean(currentUser) && notificationsOpen && notificationInboxQueryOptions.enabled !== false,
  });
  const shareLinksQueryOptions = shareLinkQueries.listByDiagram(activeDiagram?.id ?? '', { limit: 50 });
  const shareLinksQuery = useQuery({
    ...shareLinksQueryOptions,
    // Share links hanya dibutuhkan ketika dialog dibuka; public sharing tidak ikut memperlambat editor utama.
    enabled: Boolean(activeDiagram) && shareLinksOpen && shareLinksQueryOptions.enabled !== false,
  });
  const diagramExportActions = useDiagramExportActions({
    activeDiagramId: activeDiagram?.id ?? null,
    diagramName: activeDiagram?.name,
    model,
    // Signature persisted disimpan di ref karena update-nya mengikuti lifecycle snapshot/import, bukan input form biasa.
    persistedDraftSignature: persistedDraftSignatureRef.current,
    projectName: activeProject?.name,
  });

  const snapshots = snapshotsQuery.data ?? emptySnapshots;
  const latestSnapshot = snapshots[0] ?? null;
  const currentDraftPersisted = model ? isCurrentDraftPersisted(model) : false;
  const shareLinks = shareLinksQuery.data?.items ?? [];
  const commentTargetSummaries = commentSummaryQuery.data?.targets ?? [];
  const openCommentThreadCount = commentSummaryQuery.data?.openCount ?? 0;
  const inboxNotifications = notificationInboxQuery.data?.items ?? emptyNotifications;
  const unreadNotificationCount = notificationSummaryQuery.data?.unreadCount ?? 0;
  const persistedReviewSignals = useMemo(() => {
    if (!model || !isCurrentDraftPersisted(model)) {
      return null;
    }

    // Server-backed review signals hanya dipakai untuk draft persisted; edit lokal tetap memakai lint langsung dari model UI.
    return reviewSignalsQuery.data?.items.flatMap(mapReviewSignalResponseToDomainSignal) ?? null;
  }, [model, reviewSignalsQuery.data?.items]);
  const collaborators = useMemo(
    () => createCollaboratorPresenceList(remoteAwarenessStates, currentUser?.id ?? null),
    [currentUser?.id, remoteAwarenessStates],
  );
  const remoteCanvasCursors = useMemo(
    () => createRemoteCanvasCursorList(remoteAwarenessStates, currentUser?.id ?? null),
    [currentUser?.id, remoteAwarenessStates],
  );
  const remoteCommentTypingPresences = useMemo(
    () => createRemoteCommentTypingPresenceList(remoteAwarenessStates, currentUser?.id ?? null),
    [currentUser?.id, remoteAwarenessStates],
  );
  const [canUndoModelChange, canRedoModelChange] = useMemo(
    () => [modelHistoryRef.current.past.length > 0, modelHistoryRef.current.future.length > 0] as const,
    [modelHistoryRevision],
  );

  useEffect(() => {
    selectedTableIdRef.current = selectedTableId;
  }, [selectedTableId]);

  useEffect(() => {
    selectedCommentTargetRef.current = selectedCommentTarget;
  }, [selectedCommentTarget]);

  const syncModelToCollaboration = useCallback(
    (nextModel: DiagramModel, previousModel: DiagramModel | null = null) => {
      if (!canEditDiagram) {
        return;
      }

      const tablePatch = createRealtimeTablePatch(previousModel, nextModel);

      if (tablePatch && collaborationRef.current?.writeTablePatch(tablePatch)) {
        return;
      }

      const columnStructuralPatch = createRealtimeColumnStructuralPatch(previousModel, nextModel);

      if (columnStructuralPatch && collaborationRef.current?.writeColumnStructuralPatch(columnStructuralPatch)) {
        return;
      }

      const columnPatch = createRealtimeColumnPatch(previousModel, nextModel);

      if (columnPatch && collaborationRef.current?.writeColumnPatch(columnPatch)) {
        return;
      }

      const relationshipPatch = createRealtimeRelationshipPatch(previousModel, nextModel);

      if (relationshipPatch && collaborationRef.current?.writeRelationshipPatch(relationshipPatch)) {
        return;
      }

      const notePatch = createRealtimeNotePatch(previousModel, nextModel);

      if (notePatch && collaborationRef.current?.writeNotePatch(notePatch)) {
        return;
      }

      // Complex edits still use the canonical full-model writer until each command gets its own operation-level Yjs patch.
      collaborationRef.current?.writeModel(nextModel);
    },
    [canEditDiagram],
  );

  const resetModelHistory = useCallback(() => {
    modelHistoryRef.current = createEmptyEditorModelHistory();
    setModelHistoryRevision((revision) => revision + 1);
  }, []);

  const reconcileModelSelection = useCallback((nextModel: DiagramModel) => {
    setSelectedTableId((currentTableId) => {
      const nextTableId = currentTableId && nextModel.tables[currentTableId] ? currentTableId : null;

      // Realtime callbacks read refs instead of render-time closure values, so reconciliation keeps both state layers aligned.
      selectedTableIdRef.current = nextTableId;

      return nextTableId;
    });
    setSelectedCommentTarget((currentTarget) => {
      const nextTarget = currentTarget && isCommentTargetAvailable(nextModel, currentTarget) ? currentTarget : null;

      selectedCommentTargetRef.current = nextTarget;

      return nextTarget;
    });
  }, []);

  const applyRemoteSelectionConflict = useCallback(
    (conflict: NonNullable<ReturnType<typeof createRemoteSelectionConflict>>) => {
      const fallbackTarget = conflict.fallbackTarget;

      if (fallbackTarget?.targetType === 'table' && fallbackTarget.targetId) {
        const nextTarget = { targetId: fallbackTarget.targetId, targetType: 'table' } satisfies EditorCommentTarget;

        selectedTableIdRef.current = fallbackTarget.targetId;
        selectedCommentTargetRef.current = nextTarget;
        setSelectedTableId(fallbackTarget.targetId);
        setSelectedCommentTarget(nextTarget);
      } else {
        selectedTableIdRef.current = null;
        selectedCommentTargetRef.current = null;
        setSelectedTableId(null);
        setSelectedCommentTarget(null);
      }

      toast.warning({
        description: conflict.description,
        title: conflict.title,
      });
    },
    [],
  );

  const handleUndoModelChange = useCallback(() => {
    if (!canEditDiagram) {
      return;
    }

    const result = undoLocalModelChange(modelHistoryRef.current, modelRef.current);

    if (!result) {
      return;
    }

    modelHistoryRef.current = result.history;
    modelRef.current = result.model;
    snapshotRecoveryModelRef.current = result.model;
    setModel(result.model);
    syncModelToCollaboration(result.model);
    reconcileModelSelection(result.model);
    setModelHistoryRevision((revision) => revision + 1);
  }, [canEditDiagram, reconcileModelSelection, syncModelToCollaboration]);

  const handleRedoModelChange = useCallback(() => {
    if (!canEditDiagram) {
      return;
    }

    const result = redoLocalModelChange(modelHistoryRef.current, modelRef.current);

    if (!result) {
      return;
    }

    modelHistoryRef.current = result.history;
    modelRef.current = result.model;
    snapshotRecoveryModelRef.current = result.model;
    setModel(result.model);
    syncModelToCollaboration(result.model);
    reconcileModelSelection(result.model);
    setModelHistoryRevision((revision) => revision + 1);
  }, [canEditDiagram, reconcileModelSelection, syncModelToCollaboration]);

  const saveSnapshotMutation = useCreateSnapshotMutation({
    mutationConfig: {
      onError: (error) => {
        toast.warning({
          // Snapshot save tidak selalu berada di dialog, jadi kegagalan harus muncul sebagai feedback global yang langsung terlihat.
          description: getErrorMessage(error),
          title: 'Snapshot was not saved',
        });
      },
      onSuccess: (snapshot) => {
        const snapshotModel = normalizeEditorDiagramModel(snapshot.snapshot);

        // Snapshot creation returns the canonical versioned model while live editing remains a separate persistence concern.
        loadedSnapshotIdRef.current = snapshot.id;
        modelRef.current = snapshotModel;
        snapshotRecoveryModelRef.current = snapshotModel;
        persistedDraftSignatureRef.current = createDiagramModelSignature(snapshotModel);
        setModel(snapshotModel);
        syncModelToCollaboration(snapshotModel);
        queryClient.invalidateQueries({ queryKey: reviewSignalKeys.lists() });
      },
    },
  });
  const restoreSnapshotMutation = useRestoreSnapshotMutation({
    mutationConfig: {
      onSuccess: (snapshot) => {
        const snapshotModel = normalizeEditorDiagramModel(snapshot.snapshot);

        // Restore membuat snapshot baru dari versi lama; local draft langsung mengikuti checkpoint baru itu.
        loadedSnapshotIdRef.current = snapshot.id;
        modelRef.current = snapshotModel;
        snapshotRecoveryModelRef.current = snapshotModel;
        persistedDraftSignatureRef.current = createDiagramModelSignature(snapshotModel);
        setModel(snapshotModel);
        syncModelToCollaboration(snapshotModel);
        setSelectedTableId(null);
        setSelectedCommentTarget(null);
        resetModelHistory();
        setSnapshotHistoryOpen(false);
        queryClient.invalidateQueries({ queryKey: reviewSignalKeys.lists() });
      },
    },
  });

  // Ignore dipisahkan dari mutasi snapshot/import karena aksi ini hanya mengubah visibility review signal yang sudah persist di server.
  const ignoreReviewSignalMutation = useIgnoreReviewSignalMutation();
  const importDiagramMutation = useImportDiagramMutation({
    mutationConfig: {
      onSuccess: (response) => {
        const importedModel = normalizeEditorDiagramModel(parseDiagramModel(response.model));

        // Server import writes the same model into diagram_documents, so this signature marks the local draft as persisted.
        loadedSnapshotIdRef.current = latestSnapshot?.id ?? loadedSnapshotIdRef.current;
        modelRef.current = importedModel;
        snapshotRecoveryModelRef.current = importedModel;
        persistedDraftSignatureRef.current = createDiagramModelSignature(importedModel);
        setModel(importedModel);
        syncModelToCollaboration(importedModel);
        setSelectedTableId(null);
        setSelectedCommentTarget(null);
        resetModelHistory();
        queryClient.invalidateQueries({ queryKey: reviewSignalKeys.lists() });
      },
    },
  });
  const createShareLinkMutation = useCreateDiagramShareLinkMutation({
    mutationConfig: {
      onSuccess: (response) => {
        void copyTextToClipboard(response.url).catch(() => {
          toast.warning({
            description: 'The link was created, but the browser did not allow clipboard access.',
            title: 'Copy share link manually',
          });
        });
        toast.success({
          description: 'The public read-only URL was copied to your clipboard.',
          title: 'Share link created',
        });
      },
    },
  });
  const revokeShareLinkMutation = useRevokeDiagramShareLinkMutation({
    mutationConfig: {
      onSuccess: () => {
        toast.success({
          description: 'The public URL can no longer open this diagram.',
          title: 'Share link revoked',
        });
      },
    },
  });

  const logoutMutation = useLogoutMutation({
    mutationConfig: {
      onSuccess: () => {
        modelRef.current = null;
        snapshotRecoveryModelRef.current = null;
        persistedDraftSignatureRef.current = null;
        setModel(null);
        setSelectedTableId(null);
        setSelectedCommentTarget(null);
        navigate(routes.login.to(), { replace: true });
      },
    },
  });

  const handleModelChange = useCallback(
    (nextModel: DiagramModel) => {
      if (!canEditDiagram) {
        return;
      }

      const safeNextModel = normalizeEditorDiagramModel(nextModel);
      const currentModel = modelRef.current;

      const localHistory = recordLocalModelChange(modelHistoryRef.current, currentModel, safeNextModel);

      if (localHistory.changed) {
        modelHistoryRef.current = localHistory.history;
        setModelHistoryRevision((revision) => revision + 1);
      }

      // Keep the latest draft model synchronously available for snapshot clicks that happen immediately after an input blur.
      modelRef.current = safeNextModel;
      snapshotRecoveryModelRef.current = safeNextModel;
      setModel(safeNextModel);
      syncModelToCollaboration(safeNextModel, currentModel);
    },
    [canEditDiagram, syncModelToCollaboration],
  );

  useEffect(() => {
    if (!model) {
      return;
    }

    const safeModel = normalizeEditorDiagramModel(model);

    if (createDiagramModelSignature(model) === createDiagramModelSignature(safeModel)) {
      return;
    }

    // Model lama atau echo Yjs yang kehilangan column entity langsung direpair di state utama agar canvas, sidebar, inspector, dan snapshot membaca struktur yang sama.
    modelRef.current = safeModel;
    snapshotRecoveryModelRef.current = safeModel;
    setModel(safeModel);
    reconcileModelSelection(safeModel);
    syncModelToCollaboration(safeModel);
  }, [model, reconcileModelSelection, syncModelToCollaboration]);

  const handleCanvasViewportChange = useCallback((viewport: CanvasViewportRect) => {
    // Disimpan di ref supaya tombol Add Table/Note bisa membaca viewport terbaru tanpa membuat editor re-render tiap pan/zoom.
    canvasViewportRef.current = viewport;
  }, []);

  const handleSelectedTableChange = useCallback((tableId: string | null) => {
    setSelectedTableId(tableId);
    setSelectedCommentTarget(tableId ? { targetId: tableId, targetType: 'table' } : null);

    if (tableId) {
      // Selecting a table promotes the left sidebar into structure-edit mode, even if the user hid it earlier.
      setLeftSidebarOpen(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleViewportResize = () => {
      if (editorResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(editorResizeFrameRef.current);
      }

      editorResizeFrameRef.current = window.requestAnimationFrame(() => {
        // Canvas overlay offsets depend on the real viewport because CSS sidebar width uses responsive min() rules.
        setEditorViewportWidth(getEditorViewportWidth());
        editorResizeFrameRef.current = null;
      });
    };

    window.addEventListener('resize', handleViewportResize);

    return () => {
      window.removeEventListener('resize', handleViewportResize);

      if (editorResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(editorResizeFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    loadedSnapshotIdRef.current = null;
    snapshotRecoveryModelRef.current = null;
    canvasViewportRef.current = null;
  }, [activeDiagram?.id]);

  useEffect(() => {
    const handleEditorKeyboardShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      const key = event.key.toLowerCase();
      const hasHistoryModifier = event.ctrlKey || event.metaKey;

      if (event.key === '?' && !isInteractiveShortcutTarget(event.target)) {
        event.preventDefault();
        setKeyboardShortcutsOpen(true);
        return;
      }

      if (hasHistoryModifier && key === 'z' && !event.shiftKey && !isEditableShortcutTarget(event.target)) {
        event.preventDefault();
        handleUndoModelChange();
        return;
      }

      if (
        hasHistoryModifier &&
        ((key === 'z' && event.shiftKey) || key === 'y') &&
        !isEditableShortcutTarget(event.target)
      ) {
        event.preventDefault();
        handleRedoModelChange();
        return;
      }

      if (hasHistoryModifier && key === 'k' && canCommentDiagram && !isEditableShortcutTarget(event.target)) {
        event.preventDefault();
        setCommentsOpen(true);
        return;
      }

      if (hasHistoryModifier && key === 's' && canCreateSnapshot && !isEditableShortcutTarget(event.target)) {
        event.preventDefault();
        handleSaveSnapshot();
        return;
      }

      if (!hasHistoryModifier && key === 'f' && !isInteractiveShortcutTarget(event.target)) {
        event.preventDefault();
        setFitSignal((value) => value + 1);
        return;
      }

      if (!hasHistoryModifier && key === 'm' && !isInteractiveShortcutTarget(event.target)) {
        event.preventDefault();
        setMinimapToggleSignal((value) => value + 1);
        return;
      }

      if (!hasHistoryModifier && event.key === '[' && !isInteractiveShortcutTarget(event.target)) {
        event.preventDefault();
        setLeftSidebarOpen((open) => !open);
        return;
      }

      if (!hasHistoryModifier && event.key === ']' && !isInteractiveShortcutTarget(event.target)) {
        event.preventDefault();
        setRightSidebarOpen((open) => !open);
        return;
      }

      if (
        canEditDiagram &&
        selectedTableId &&
        (event.key === 'Delete' || event.key === 'Backspace') &&
        !isInteractiveShortcutTarget(event.target)
      ) {
        const currentModel = modelRef.current;
        const tableToDelete = currentModel?.tables[selectedTableId];

        if (!currentModel || !tableToDelete) {
          return;
        }

        event.preventDefault();

        setEditorConfirmAction({
          tableId: selectedTableId,
          tableName: tableToDelete.name,
          type: 'table-delete',
        });
      }
    };

    window.addEventListener('keydown', handleEditorKeyboardShortcut);

    return () => {
      window.removeEventListener('keydown', handleEditorKeyboardShortcut);
    };
  }, [
    canCommentDiagram,
    canCreateSnapshot,
    canEditDiagram,
    handleRedoModelChange,
    handleSaveSnapshot,
    handleUndoModelChange,
    selectedTableId,
  ]);

  const publishAwareness = useCallback(
    (
      cursor: AwarenessState['cursor'] = latestCursorRef.current,
      commentTyping: AwarenessState['commentTyping'] = latestCommentTypingRef.current,
    ) => {
      if (!currentUser || !activeDiagram) {
        return;
      }

      collaborationRef.current?.setAwareness(
        createEditorAwarenessState(currentUser, activeDiagram.id, selectedCommentTarget, cursor, commentTyping),
      );
    },
    [activeDiagram, currentUser, selectedCommentTarget],
  );

  const handleCanvasCursorChange = useCallback(
    (cursor: AwarenessState['cursor']) => {
      const now = Date.now();

      latestCursorRef.current = cursor;

      if (cursor && now - latestAwarenessSentAtRef.current < 90) {
        return;
      }

      latestAwarenessSentAtRef.current = now;
      publishAwareness(cursor);
    },
    [publishAwareness],
  );

  const handleCommentTypingChange = useCallback(
    (commentTyping: AwarenessState['commentTyping']) => {
      if (areCommentTypingStatesEqual(latestCommentTypingRef.current, commentTyping)) {
        return;
      }

      latestCommentTypingRef.current = commentTyping;
      publishAwareness(latestCursorRef.current, commentTyping);
    },
    [publishAwareness],
  );

  const handleCommentMarkerOpen = useCallback((target: EditorCommentTarget) => {
    if (!modelRef.current) {
      return;
    }

    const tableId = getCommentTargetTableId(modelRef.current, target);

    if (tableId) {
      setSelectedTableId(tableId);
      setLeftSidebarOpen(true);
    }

    setSelectedCommentTarget(target);
    setCommentsOpen(true);
    // Request id membuat dialog bisa membedakan klik marker berulang pada target yang sama.
    commentThreadOpenRequestIdRef.current += 1;
    setCommentThreadOpenRequest({
      requestId: commentThreadOpenRequestIdRef.current,
      target,
    });
  }, []);

  const handleNotificationOpen = useCallback(
    (notification: NotificationInboxItemDto) => {
      const target = {
        targetId: notification.thread.targetId,
        targetType: notification.thread.targetType,
      };

      if (activeProject?.id === notification.project.id && activeDiagram?.id === notification.diagram.id) {
        const tableId = modelRef.current ? getCommentTargetTableId(modelRef.current, target) : null;

        if (tableId) {
          setSelectedTableId(tableId);
          setLeftSidebarOpen(true);
        }

        setSelectedCommentTarget(target);
        setCommentsOpen(true);
        // Sama seperti marker canvas, request id membuat klik notification berulang tetap membuka thread terbaru.
        commentThreadOpenRequestIdRef.current += 1;
        setCommentThreadOpenRequest({
          requestId: commentThreadOpenRequestIdRef.current,
          target,
        });
        return;
      }

      modelRef.current = null;
      snapshotRecoveryModelRef.current = null;
      persistedDraftSignatureRef.current = null;
      setModel(null);
      setSelectedTableId(null);
      setSelectedCommentTarget(target);
      setCommentsOpen(false);
      navigate(
        routes.diagram.to({
          diagramId: notification.diagram.id,
          projectId: notification.project.id,
          workspaceSlug: notification.project.organizationSlug || notification.project.organizationId,
        }),
      );
    },
    [activeDiagram?.id, activeProject?.id, navigate],
  );

  useEffect(() => {
    if (!activeDiagram || !currentUser) {
      setRemoteAwarenessStates([]);
      setCollaborationStatus(idleCollaborationStatus);
      latestCommentTypingRef.current = undefined;
      return;
    }

    let disposed = false;
    let collaboration: DiagramCollaboration | null = null;
    let unsubscribeAwareness: () => void = () => undefined;
    let unsubscribeModel: () => void = () => undefined;
    let unsubscribeStatus: () => void = () => undefined;

    void import('@/features/collaboration/collaboration-client').then(({ createDiagramCollaboration }) => {
      if (disposed) {
        return;
      }

      // Hocuspocus/Yjs is loaded only after a real diagram is active so the editor route chunk stays focused on first paint.
      collaboration = createDiagramCollaboration({ diagramId: activeDiagram.id });
      collaborationRef.current = collaboration;
      unsubscribeStatus = collaboration.subscribeStatus((status) => {
        // Status changes are tiny and user-facing, so the editor owns this state instead of hiding reconnects in the provider wrapper.
        setCollaborationStatus(status);
      });
      unsubscribeModel = collaboration.subscribeModel((nextModel) => {
        const safeNextModel = normalizeEditorDiagramModel(nextModel);
        const currentModel = modelRef.current;
        const currentSignature = currentModel ? createDiagramModelSignature(currentModel) : null;
        const rawNextSignature = createDiagramModelSignature(nextModel);
        const nextSignature = createDiagramModelSignature(safeNextModel);

        if (currentSignature === nextSignature) {
          return;
        }

        if (shouldKeepLocalDiagramModelOverRealtime(currentModel, safeNextModel)) {
          // Hocuspocus can hydrate an older Yjs document after the user already edited the local draft; keep the fresher draft and write it back.
          if (currentModel) {
            syncModelToCollaboration(currentModel);
          }
          return;
        }

        const remoteSelectionConflict = currentModel
          ? createRemoteSelectionConflict(currentModel, safeNextModel, {
              selectedTableId: selectedTableIdRef.current,
              selectedTarget: selectedCommentTargetRef.current,
            })
          : null;

        // Remote Yjs updates become the visible editor model, but they do not enter this user's local undo stack.
        modelRef.current = safeNextModel;
        snapshotRecoveryModelRef.current = safeNextModel;
        persistedDraftSignatureRef.current = null;
        setModel(safeNextModel);
        if (remoteSelectionConflict) {
          applyRemoteSelectionConflict(remoteSelectionConflict);
        } else {
          reconcileModelSelection(safeNextModel);
        }
        if (rawNextSignature !== nextSignature) {
          // Old realtime drafts can contain table.columnIds without column entities; write the repaired model back once.
          syncModelToCollaboration(safeNextModel);
        }
        resetModelHistory();
      });
      unsubscribeAwareness = collaboration.subscribeAwareness((states) => {
        const nextStates = states.filter((state) => !state.isLocal);

        // Local awareness writes can still trigger the subscription; React state only changes when the visible remote payload changes.
        setRemoteAwarenessStates((currentStates) =>
          areRemoteAwarenessStatesEqual(currentStates, nextStates) ? currentStates : nextStates,
        );
      });
      collaboration.setAwareness(
        createEditorAwarenessState(
          currentUser,
          activeDiagram.id,
          selectedCommentTarget,
          latestCursorRef.current,
          latestCommentTypingRef.current,
        ),
      );
    });

    return () => {
      disposed = true;
      unsubscribeAwareness();
      unsubscribeModel();
      unsubscribeStatus();
      collaboration?.destroy();

      if (collaborationRef.current === collaboration) {
        collaborationRef.current = null;
      }

      setRemoteAwarenessStates([]);
      setCollaborationStatus(idleCollaborationStatus);
      latestCommentTypingRef.current = undefined;
    };
  }, [
    activeDiagram?.id,
    applyRemoteSelectionConflict,
    currentUser?.avatarUrl,
    currentUser?.cursorColor,
    currentUser?.id,
    currentUser?.name,
    reconcileModelSelection,
    resetModelHistory,
    syncModelToCollaboration,
  ]);

  useEffect(() => {
    publishAwareness();
  }, [publishAwareness]);

  useEffect(() => {
    if (organizations.length === 0 || organizationsQuery.isPending) {
      return;
    }

    if (!routeWorkspaceSlug && editorPreferenceQuery.isPending) {
      return;
    }

    if (!routeWorkspaceSlug) {
      const organization =
        (rememberedEditorTarget
          ? organizations.find((item) => matchesRememberedWorkspace(item, rememberedEditorTarget))
          : null) ??
        organizations[0] ??
        null;

      if (!organization) {
        return;
      }

      navigate(routes.workspace.to({ workspaceSlug: getOrganizationSlug(organization) }), {
        replace: true,
      });

      return;
    }

    if (!organizations.some((organization) => matchesWorkspaceRoute(organization, routeWorkspaceSlug))) {
      navigate(routes.home.to(), { replace: true });
    }
  }, [
    editorPreferenceQuery.isPending,
    navigate,
    organizations,
    organizationsQuery.isPending,
    rememberedEditorTarget,
    routeWorkspaceSlug,
  ]);

  useEffect(() => {
    if (!activeOrganization || projectsQuery.isPending) {
      return;
    }

    if (!routeProjectId && editorPreferenceQuery.isPending) {
      return;
    }

    if (routeProjectId && !projects.some((project) => project.id === routeProjectId)) {
      navigate(routes.workspace.to({ workspaceSlug: getOrganizationSlug(activeOrganization) }), {
        replace: true,
      });

      return;
    }

    if (!routeProjectId && projects.length > 0) {
      const rememberedProject =
        rememberedEditorTarget?.organizationId === activeOrganization.id
          ? (projects.find((project) => project.id === rememberedEditorTarget.projectId) ?? null)
          : null;
      const project = rememberedProject ?? projects[0];

      navigate(routes.project.to({ projectId: project.id, workspaceSlug: getWorkspaceSlug(project) }), {
        replace: true,
      });
    }
  }, [
    activeOrganization,
    editorPreferenceQuery.isPending,
    navigate,
    projects,
    projectsQuery.isPending,
    rememberedEditorTarget,
    routeProjectId,
  ]);

  useEffect(() => {
    if (!activeProject || diagramsQuery.isPending) {
      return;
    }

    if (!routeDiagramId && editorPreferenceQuery.isPending) {
      return;
    }

    if (routeDiagramId && !diagrams.some((diagram) => diagram.id === routeDiagramId)) {
      navigate(
        routes.project.to({
          projectId: activeProject.id,
          workspaceSlug: getWorkspaceSlug(activeProject),
        }),
        { replace: true },
      );

      return;
    }

    if (!routeDiagramId && diagrams.length > 0) {
      const rememberedDiagram =
        rememberedEditorTarget?.projectId === activeProject.id
          ? (diagrams.find((diagram) => diagram.id === rememberedEditorTarget.diagramId) ?? null)
          : null;
      const diagram = rememberedDiagram ?? diagrams[0];

      navigate(
        routes.diagram.to({
          diagramId: diagram.id,
          projectId: activeProject.id,
          workspaceSlug: getWorkspaceSlug(activeProject),
        }),
        { replace: true },
      );
    }
  }, [
    activeProject,
    diagrams,
    diagramsQuery.isPending,
    editorPreferenceQuery.isPending,
    navigate,
    rememberedEditorTarget,
    routeDiagramId,
  ]);

  useEffect(() => {
    if (!activeOrganization) {
      return;
    }

    if (routeProjectId && !activeProject) {
      return;
    }

    if (routeDiagramId && !activeDiagram) {
      return;
    }

    const canPersistWorkspaceOnly =
      !routeProjectId && !projectsQuery.isPending && projects.length === 0 && !activeProject;

    if (!activeProject && !canPersistWorkspaceOnly) {
      return;
    }

    const target: CurrentUserEditorPreferenceUpdateDtoInput = {
      diagramId: activeDiagram?.id ?? null,
      organizationId: activeOrganization.id,
      projectId: activeProject?.id ?? null,
    };
    const targetKey = createEditorPreferenceKey(target);
    const currentKey = rememberedEditorTarget?.organizationId
      ? createEditorPreferenceKey({
          diagramId: rememberedEditorTarget.diagramId,
          organizationId: rememberedEditorTarget.organizationId,
          projectId: rememberedEditorTarget.projectId,
        })
      : null;

    if (targetKey === currentKey || submittedEditorPreferenceKeyRef.current === targetKey) {
      return;
    }

    submittedEditorPreferenceKeyRef.current = targetKey;
    updateEditorPreference(target, {
      onError: () => {
        if (submittedEditorPreferenceKeyRef.current === targetKey) {
          submittedEditorPreferenceKeyRef.current = null;
        }
      },
    });
  }, [
    activeDiagram?.id,
    activeOrganization?.id,
    activeProject?.id,
    projects.length,
    projectsQuery.isPending,
    rememberedEditorTarget?.diagramId,
    rememberedEditorTarget?.organizationId,
    rememberedEditorTarget?.projectId,
    routeDiagramId,
    routeProjectId,
    updateEditorPreference,
  ]);

  useEffect(() => {
    if (!latestSnapshot) {
      return;
    }

    if (loadedSnapshotIdRef.current === latestSnapshot.id) {
      return;
    }

    const currentModel = modelRef.current;
    const currentDraftIsDirty =
      currentModel && persistedDraftSignatureRef.current !== createDiagramModelSignature(currentModel);

    if (loadedSnapshotIdRef.current && currentDraftIsDirty) {
      // Snapshot list refetches after saves/restores; never let that background response stomp an in-progress canvas draft.
      return;
    }

    const snapshotModel = normalizeEditorDiagramModel(latestSnapshot.snapshot);
    const snapshotSignature = createDiagramModelSignature(snapshotModel);

    loadedSnapshotIdRef.current = latestSnapshot.id;
    modelRef.current = snapshotModel;
    snapshotRecoveryModelRef.current = snapshotModel;
    persistedDraftSignatureRef.current = snapshotSignature;
    setModel(snapshotModel);
    if (createDiagramModelSignature(latestSnapshot.snapshot) !== snapshotSignature) {
      // Refresh dari snapshot lama yang rusak langsung memperbaiki realtime draft supaya sidebar dan canvas membaca model yang sama.
      syncModelToCollaboration(snapshotModel);
    }
    setSelectedTableId(null);
    setSelectedCommentTarget(null);
    resetModelHistory();
  }, [latestSnapshot, resetModelHistory, syncModelToCollaboration]);

  useEffect(() => {
    if (!activeDiagram || snapshotsQuery.isPending || snapshotsQuery.data === undefined || latestSnapshot) {
      return;
    }

    // Empty read-only diagrams cannot create an initial snapshot, so the editor renders an unsaved empty model instead of spinning forever.
    const seedModel = normalizeEditorDiagramModel(createSeedDiagramModel(activeDiagram.name));
    loadedSnapshotIdRef.current = null;
    modelRef.current = seedModel;
    snapshotRecoveryModelRef.current = seedModel;
    persistedDraftSignatureRef.current = null;
    setModel(seedModel);
    setSelectedTableId(null);
    setSelectedCommentTarget(null);
    resetModelHistory();
  }, [activeDiagram, latestSnapshot, resetModelHistory, snapshotsQuery.data, snapshotsQuery.isPending]);

  useEffect(() => {
    if (!model || !selectedCommentTarget || isCommentTargetAvailable(model, selectedCommentTarget)) {
      return;
    }

    // Target komentar mengikuti entity yang benar-benar masih ada, sehingga import/delete tidak meninggalkan anchor stale.
    setSelectedCommentTarget(
      selectedTableId && model.tables[selectedTableId] ? { targetId: selectedTableId, targetType: 'table' } : null,
    );
  }, [model, selectedCommentTarget, selectedTableId]);

  function isCurrentDraftPersisted(currentModel: DiagramModel): boolean {
    return persistedDraftSignatureRef.current === createDiagramModelSignature(currentModel);
  }

  async function handleImportDraftModel(importRequest: EditorImportRequest) {
    if (!activeDiagram || !canEditDiagram) {
      return;
    }

    // Import melewati backend agar validasi, update diagram_documents, dan bentuk response-nya sama dengan SDK publik.
    await importDiagramMutation.mutateAsync({
      body: {
        content: importRequest.content,
        dialect: importRequest.dialect ? sdkDialectByValue[importRequest.dialect] : undefined,
        // Enum generated dipakai di boundary SDK supaya perubahan OpenAPI akan dikomplain saat compile.
        mode: SdkImportMode.Replace,
        source: sdkImportSourceByValue[importRequest.source],
      },
      diagramId: activeDiagram.id,
    });
  }

  function handleAddTable(tableName?: string) {
    if (!canEditDiagram || !model) {
      return;
    }

    const tablePosition = createCanvasInsertionPosition(canvasViewportRef.current, {
      existingCount: Object.keys(model.tables).length,
      height: 96,
      width: 288,
    });
    const nextModel = addTableToDiagramModel(model, tableName, tablePosition);
    const nextTableId = Object.keys(nextModel.tables).find((tableId) => !model.tables[tableId]) ?? null;

    handleModelChange(nextModel);
    setSelectedTableId(nextTableId);
    // Table baru langsung menjadi target komentar aktif agar review pertama jatuh ke entity yang baru dibuat.
    setSelectedCommentTarget(nextTableId ? { targetId: nextTableId, targetType: 'table' } : null);
  }

  function handleAddNote() {
    if (!canEditDiagram || !model) {
      return;
    }

    const noteId = createDiagramEntityId('note');
    const notePosition =
      createCanvasInsertionPosition(canvasViewportRef.current, {
        existingCount: Object.keys(model.notes).length,
        height: 120,
        width: 260,
      }) ?? createNextNotePosition(model, selectedTableId);

    handleModelChange(
      applyDiagramCommand(model, {
        color: '#ffc800',
        noteId,
        position: notePosition,
        text: 'New note',
        type: 'note.create',
        width: 260,
      }),
    );
    setSelectedTableId(null);
    // Note yang baru dibuat langsung menjadi target komentar aktif agar diskusi bisa diarahkan ke annotation tersebut.
    setSelectedCommentTarget({ targetId: noteId, targetType: 'note' });
  }

  function handleSaveSnapshot(options: { bypassRealtimeGuard?: boolean } = {}) {
    if (!activeDiagram || !canCreateSnapshot || saveSnapshotMutation.isPending) {
      return;
    }

    if (!options.bypassRealtimeGuard) {
      const guard = getSnapshotRealtimeGuard(collaborationStatus);

      if (guard) {
        setEditorConfirmAction({
          guard,
          type: 'snapshot-save-unsafe',
        });
        return;
      }
    }

    const requestedModel = modelRef.current;

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    window.setTimeout(() => {
      const modelToSave = createSnapshotSaveModel(requestedModel, modelRef.current, snapshotRecoveryModelRef.current);

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

  function handleRestoreSnapshot(snapshotId: string) {
    const currentModel = modelRef.current;

    if (!canCreateSnapshot || restoreSnapshotMutation.isPending) {
      return;
    }

    if (currentModel && !isCurrentDraftPersisted(currentModel)) {
      setEditorConfirmAction({
        snapshotId,
        type: 'snapshot-restore',
      });
      return;
    }

    restoreSnapshotMutation.mutate(snapshotId);
  }

  function handleEditorConfirmAction() {
    const action = editorConfirmAction;

    if (!action) {
      return;
    }

    if (action.type === 'table-delete') {
      const currentModel = modelRef.current;

      if (canEditDiagram && currentModel?.tables[action.tableId]) {
        // Dialog confirmation menggantikan window.confirm supaya destructive keyboard shortcut tetap terasa native di design system Tabliodb.
        handleModelChange(
          applyDiagramCommand(currentModel, {
            tableId: action.tableId,
            type: 'table.delete',
          }),
        );

        if (selectedTableId === action.tableId) {
          setSelectedTableId(null);
          setSelectedCommentTarget(null);
        }
      }

      setEditorConfirmAction(null);
      return;
    }

    if (action.type === 'snapshot-restore') {
      if (canCreateSnapshot && !restoreSnapshotMutation.isPending) {
        restoreSnapshotMutation.mutate(action.snapshotId);
      }

      setEditorConfirmAction(null);
      return;
    }

    if (action.type === 'snapshot-save-unsafe') {
      setEditorConfirmAction(null);
      // User sudah membaca realtime guard dan memilih checkpoint manual secara sadar.
      handleSaveSnapshot({ bypassRealtimeGuard: true });
    }
  }

  if (isUnauthorized(projectsQuery.error)) {
    return <Navigate replace to={routes.login.to()} />;
  }

  if (isUnauthorized(currentUserQuery.error)) {
    return <Navigate replace to={routes.login.to()} />;
  }

  if (isUnauthorized(organizationsQuery.error)) {
    return <Navigate replace to={routes.login.to()} />;
  }

  const blockingError =
    currentUserQuery.error ??
    organizationsQuery.error ??
    projectsQuery.error ??
    diagramsQuery.error ??
    snapshotsQuery.error;

  if (blockingError) {
    return <ErrorState error={blockingError} onRetry={() => queryClient.invalidateQueries()} />;
  }

  if (!currentUserQuery.isPending && !organizationsQuery.isPending && organizations.length === 0) {
    return (
      <EditorEmptyAccessState
        action={
          <CreateWorkspaceDialog
            onCreated={(organization) => {
              setCreateWorkspaceOpen(false);
              navigate(routes.workspace.to({ workspaceSlug: getOrganizationSlug(organization) }));
            }}
            onOpenChange={setCreateWorkspaceOpen}
            open={createWorkspaceOpen}
            trigger={
              <Button className="gap-2">
                <Building2 className="size-4" />
                Create workspace
              </Button>
            }
          />
        }
        description="Create a workspace first, then add projects and diagrams inside it. Invited users will only see workspaces assigned by an owner or admin."
        icon={Building2}
        onRetry={() => void queryClient.invalidateQueries()}
        title="No workspace yet"
      />
    );
  }

  const isLoadingWorkspace =
    currentUserQuery.isPending ||
    organizationsQuery.isPending ||
    Boolean(activeOrganization && projectsQuery.isPending) ||
    Boolean(activeProject && diagramsQuery.isPending) ||
    Boolean(activeDiagram && snapshotsQuery.isPending) ||
    Boolean(activeProject && activeDiagram && !model);

  if (isLoadingWorkspace) {
    return <LoadingState message="Loading diagram workspace" />;
  }

  if (!projectsQuery.isPending && activeOrganization && projects.length === 0) {
    return (
      <EditorEmptyAccessState
        action={
          canCreateProject ? (
            <CreateProjectDialog
              onCreated={(project) => {
                navigate(routes.project.to({ projectId: project.id, workspaceSlug: getWorkspaceSlug(project) }));
              }}
              organizationId={activeOrganization.id}
              trigger={
                <Button className="gap-2">
                  <FolderPlus className="size-4" />
                  Create project
                </Button>
              }
            />
          ) : undefined
        }
        description={
          canCreateProject
            ? 'This workspace is ready. Create a project for a product, service, or bounded schema area to start designing.'
            : 'Your account is in this workspace, but an owner or admin has not connected you to a project or team yet.'
        }
        icon={canCreateProject ? FolderPlus : UsersRound}
        onRetry={() => void queryClient.invalidateQueries()}
        title={canCreateProject ? 'No projects yet' : 'Waiting for project access'}
      />
    );
  }

  if (!diagramsQuery.isPending && activeProject && diagrams.length === 0) {
    return (
      <EditorEmptyAccessState
        action={
          canCreateDiagram ? (
            <CreateDiagramDialog
              defaultDialect="postgresql"
              onCreated={(diagram) => {
                modelRef.current = null;
                snapshotRecoveryModelRef.current = null;
                persistedDraftSignatureRef.current = null;
                setModel(null);
                navigate(
                  routes.diagram.to({
                    diagramId: diagram.id,
                    projectId: activeProject.id,
                    workspaceSlug: getWorkspaceSlug(activeProject),
                  }),
                );
              }}
              projectId={activeProject.id}
              trigger={
                <Button className="gap-2">
                  <FileText className="size-4" />
                  Create diagram
                </Button>
              }
            />
          ) : undefined
        }
        description={
          canCreateDiagram
            ? 'This project is ready. Create the first diagram and choose the database dialect before drawing tables.'
            : 'Your project role can view assigned diagrams, but there is no diagram available for this project yet.'
        }
        icon={FileText}
        onRetry={() => void queryClient.invalidateQueries()}
        title={canCreateDiagram ? 'No diagrams yet' : 'No diagram access yet'}
      />
    );
  }

  if (!currentUser || !activeOrganization || !activeProject || !activeDiagram || !model) {
    return <LoadingState message="Preparing editor" />;
  }

  const selectedTable = selectedTableId ? (model.tables[selectedTableId] ?? null) : null;
  const selectedColumnId = selectedCommentTarget?.targetType === 'column' ? selectedCommentTarget.targetId : null;
  const sqlPreview = diagramExportActions.sqlPreview;
  // Expanded sidebars share one comfortable width so table controls do not collapse into cramped rows.
  const expandedSidebarWidth = 'var(--tabliodb-sidebar-width)';
  const collapsedSidebarWidth = '44px';
  const expandedSidebarWidthPx = getResponsiveEditorSidebarWidthPx(editorViewportWidth);
  const collapsedSidebarWidthPx = editorCollapsedSidebarWidthPx;
  const leftSidebarWidth = leftSidebarOpen ? expandedSidebarWidth : collapsedSidebarWidth;
  const rightSidebarWidth = rightSidebarOpen ? expandedSidebarWidth : collapsedSidebarWidth;
  // Floating canvas controls menghormati rail/sidebar yang sedang terlihat agar toolbar dan minimap tidak tertutup panel.
  const canvasToolbarOffsetLeftPx = getEditorOverlayOffsetPx({
    expanded: leftSidebarOpen,
    expandedWidthPx: expandedSidebarWidthPx,
    minVisibleSpacePx: 176,
    viewportWidth: editorViewportWidth,
  });
  const canvasMinimapOffsetRightPx = getEditorOverlayOffsetPx({
    expanded: rightSidebarOpen,
    expandedWidthPx: expandedSidebarWidthPx,
    minVisibleSpacePx: 160,
    viewportWidth: editorViewportWidth,
  });
  const canvasToolbarOffsetLeft = `${canvasToolbarOffsetLeftPx}px`;
  const canvasMinimapOffsetRight = `${canvasMinimapOffsetRightPx}px`;
  const canvasFloatingInsetLeft = (leftSidebarOpen ? expandedSidebarWidthPx : collapsedSidebarWidthPx) + 16;
  const canvasFloatingInsetRight = (rightSidebarOpen ? expandedSidebarWidthPx : collapsedSidebarWidthPx) + 16;
  const canvasToolbar = canEditDiagram ? (
    <div
      className="tabliodb-editor-chrome tabliodb-scrollbar flex items-center gap-2 overflow-x-auto rounded-[var(--tabliodb-radius-lg)] p-1.5"
      style={{
        maxWidth: `max(9rem, calc(100vw - ${canvasToolbarOffsetLeftPx}px - ${canvasMinimapOffsetRightPx}px - 12px))`,
      }}
    >
      <AddTableDialog disabled={!canEditDiagram} onCreate={handleAddTable} triggerSize="sm" />
      <Button className="gap-2" disabled={!canEditDiagram} onClick={handleAddNote} size="sm" variant="secondary">
        <StickyNote className="size-4" />
        <span className="hidden sm:inline">Note</span>
      </Button>
    </div>
  ) : null;

  return (
    <main className="flex h-screen flex-col bg-[rgb(var(--tabliodb-surface))] text-[rgb(var(--tabliodb-ink))]">
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
            onCreateDiagram={() => setCreateDiagramOpen(true)}
            onCreateProject={() => setCreateProjectOpen(true)}
            onCreateWorkspace={() => setCreateWorkspaceOpen(true)}
            onDiagramSelect={(diagram) => {
              modelRef.current = null;
              snapshotRecoveryModelRef.current = null;
              persistedDraftSignatureRef.current = null;
              setModel(null);
              setSelectedTableId(null);
              setSelectedCommentTarget(null);
              navigate(
                routes.diagram.to({
                  diagramId: diagram.id,
                  projectId: activeProject.id,
                  workspaceSlug: getWorkspaceSlug(activeProject),
                }),
              );
            }}
            onOrganizationSelect={(organization) => {
              modelRef.current = null;
              snapshotRecoveryModelRef.current = null;
              persistedDraftSignatureRef.current = null;
              setModel(null);
              setSelectedTableId(null);
              setSelectedCommentTarget(null);
              setProjectSearchTerm('');
              navigate(routes.workspace.to({ workspaceSlug: getOrganizationSlug(organization) }));
            }}
            onProjectSearchChange={setProjectSearchTerm}
            onProjectSelect={(project) => {
              modelRef.current = null;
              snapshotRecoveryModelRef.current = null;
              persistedDraftSignatureRef.current = null;
              setModel(null);
              setSelectedTableId(null);
              setSelectedCommentTarget(null);
              navigate(routes.project.to({ projectId: project.id, workspaceSlug: getWorkspaceSlug(project) }));
            }}
            organizations={organizations}
            projectSearchTerm={projectSearchTerm}
            projects={filteredProjects}
          />
        </div>
        {/* Aksi sekunder tetap tersedia di More menu, lalu disembunyikan bertahap di header supaya identitas project tidak terdesak. */}
        <div className="tabliodb-scrollbar flex min-w-0 max-w-[64vw] shrink-0 items-center gap-1 overflow-x-auto py-1 max-[700px]:max-w-[58vw]">
          <Badge className="hidden md:inline-flex" variant={canEditDiagram ? 'green' : 'yellow'}>
            {formatProjectRole(activeProject.projectRole)}
          </Badge>
          {canEditDiagram ? (
            <div className="hidden items-center gap-1 xl:flex">
              <IconButton
                disabled={!canUndoModelChange}
                icon={Undo2}
                label="Undo last edit"
                onClick={handleUndoModelChange}
              />
              <IconButton
                disabled={!canRedoModelChange}
                icon={Redo2}
                label="Redo last edit"
                onClick={handleRedoModelChange}
              />
            </div>
          ) : null}
          <CollaborationPresence
            collaborators={collaborators}
            draftPersisted={currentDraftPersisted}
            latestSnapshot={latestSnapshot}
            snapshotSavePending={saveSnapshotMutation.isPending}
            status={collaborationStatus}
          />
          {canCommentDiagram ? (
            <div className="relative">
              <IconButton icon={MessageSquareText} label="Comments" onClick={() => setCommentsOpen(true)} />
              {openCommentThreadCount > 0 ? (
                <span className="pointer-events-none absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-[rgb(var(--tabliodb-red))] px-1 text-[9px] font-extrabold leading-4 text-white [text-shadow:var(--tabliodb-solid-text-shadow)]">
                  {openCommentThreadCount > 99 ? '99+' : openCommentThreadCount}
                </span>
              ) : null}
            </div>
          ) : null}
          <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button aria-label="Notifications" className="relative" size="icon" type="button" variant="ghost">
                    {/* Dropdown trigger dibuat sebagai button langsung agar Radix bisa mengelola focus, keyboard open, dan aria-expanded tanpa melewati wrapper non-interaktif. */}
                    <Bell aria-hidden="true" className="size-4" />
                    {unreadNotificationCount > 0 ? (
                      <span className="pointer-events-none absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-[rgb(var(--tabliodb-red))] px-1 text-[9px] font-extrabold leading-4 text-white [text-shadow:var(--tabliodb-solid-text-shadow)]">
                        {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                      </span>
                    ) : null}
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Notifications</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-[min(92vw,380px)] p-2">
              <div className="flex items-start justify-between gap-3 px-2 py-1.5">
                <div className="min-w-0">
                  <div className="text-[13px] font-extrabold">Notifications</div>
                  <p className="mt-0.5 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                    Mentions and direct replies across your projects
                  </p>
                </div>
                <Badge variant={unreadNotificationCount > 0 ? 'yellow' : 'neutral'}>
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount} unread
                </Badge>
              </div>
              <DropdownMenuSeparatorItem />
              {notificationInboxQuery.isPending ? (
                <InlineLoadingState className="mx-1 my-2 px-3 py-3 text-xs" message="Loading inbox" />
              ) : notificationInboxQuery.error ? (
                <InlineErrorState
                  className="mx-1 my-2 px-3 py-3 text-xs"
                  error={notificationInboxQuery.error}
                  onRetry={() => void notificationInboxQuery.refetch()}
                  title="Could not load notifications"
                />
              ) : inboxNotifications.length === 0 ? (
                <EmptyState
                  className="mx-1 my-2 rounded-[var(--tabliodb-radius-md)] border border-dashed border-[rgb(var(--tabliodb-border))] px-3 py-5"
                  description="Mentions, replies, and review updates will land here."
                  title="No notifications yet"
                />
              ) : (
                <div className="tabliodb-scrollbar grid max-h-[min(60dvh,420px)] gap-1 overflow-y-auto pr-1">
                  {inboxNotifications.map((notification) => (
                    <NotificationInboxMenuItem
                      key={notification.id}
                      notification={notification}
                      onSelect={handleNotificationOpen}
                    />
                  ))}
                </div>
              )}
              {notificationInboxQuery.data?.nextCursor ? (
                <>
                  <DropdownMenuSeparatorItem />
                  <div className="px-2 py-1 text-center text-[11px] font-extrabold text-[rgb(var(--tabliodb-ink-subtle))]">
                    Showing latest {inboxNotifications.length} notifications
                  </div>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          <IconButton
            className="hidden lg:inline-flex"
            disabled={snapshotsQuery.isPending}
            icon={History}
            label="Snapshot history"
            onClick={() => setSnapshotHistoryOpen(true)}
          />
          <IconButton
            className="hidden xl:inline-flex"
            icon={LocateFixed}
            label="Fit diagram"
            onClick={() => setFitSignal((value) => value + 1)}
          />
          <IconButton
            className="hidden 2xl:inline-flex"
            icon={Keyboard}
            label="Keyboard shortcuts"
            onClick={() => setKeyboardShortcutsOpen(true)}
          />
          {activeProject ? (
            <>
              {canManageWorkspace ? (
                <WorkspaceSettingsDialog organization={activeOrganization} project={activeProject} />
              ) : null}
              {canManageProject ? (
                <ProjectSettingsDialog
                  onArchived={() => {
                    modelRef.current = null;
                    snapshotRecoveryModelRef.current = null;
                    persistedDraftSignatureRef.current = null;
                    setModel(null);
                    setSelectedTableId(null);
                    setSelectedCommentTarget(null);
                    navigate(routes.home.to(), { replace: true });
                  }}
                  project={activeProject}
                />
              ) : null}
              {canEditDiagram ? (
                <DiagramSettingsDialog
                  canEdit={canEditDiagram}
                  diagram={activeDiagram}
                  model={model}
                  onUpdated={(diagram) => {
                    setModel((current) => {
                      if (!current) {
                        return current;
                      }

                      const nextModel = updateLiveModelFromDiagram(current, diagram, modelRef);
                      snapshotRecoveryModelRef.current = nextModel;

                      syncModelToCollaboration(nextModel);

                      return nextModel;
                    });
                  }}
                />
              ) : null}
            </>
          ) : null}
          {canCreateSnapshot ? (
            <Button
              className="gap-2 px-3"
              disabled={saveSnapshotMutation.isPending}
              onClick={() => handleSaveSnapshot()}
            >
              {saveSnapshotMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              <span className="hidden xl:inline">Snapshot</span>
            </Button>
          ) : null}
          <Button className="gap-2 px-3" onClick={() => setSqlPreviewOpen(true)} variant="sky">
            <Play className="size-4" />
            <span className="hidden xl:inline">SQL</span>
          </Button>
          <EditorMoreActionsMenu
            canEdit={canEditDiagram}
            canRedo={canRedoModelChange}
            canUndo={canUndoModelChange}
            isExporting={diagramExportActions.isExporting}
            isImporting={importDiagramMutation.isPending}
            onCopySql={diagramExportActions.copySql}
            onDownloadSql={diagramExportActions.downloadSql}
            onExportJson={diagramExportActions.exportJson}
            onExportMarkdown={diagramExportActions.exportMarkdown}
            onExportPng={diagramExportActions.exportPng}
            onExportSvg={diagramExportActions.exportSvg}
            onFitDiagram={() => setFitSignal((value) => value + 1)}
            onImportJson={() => {
              importDiagramMutation.reset();
              setImportJsonOpen(true);
            }}
            onImportSql={() => {
              importDiagramMutation.reset();
              setImportSqlOpen(true);
            }}
            onOpenKeyboardShortcuts={() => setKeyboardShortcutsOpen(true)}
            onRedo={handleRedoModelChange}
            onShareReadOnlyLink={() => setShareLinksOpen(true)}
            onToggleMinimap={() => setMinimapToggleSignal((value) => value + 1)}
            onUndo={handleUndoModelChange}
          />
          <UserAccountMenu
            canOpenAdmin={canManageWorkspace}
            isLoggingOut={logoutMutation.isPending}
            onAdmin={() => navigate(routes.adminUsers.to())}
            onLogout={() => logoutMutation.mutate(undefined)}
            onProfile={() => navigate(routes.profile.to())}
            user={currentUser}
          />
        </div>
      </header>

      <SqlPreviewDialog
        copied={diagramExportActions.copiedSql}
        dialect={model.dialect}
        onCopy={() => void diagramExportActions.copySql()}
        onDownload={() => void diagramExportActions.downloadSql()}
        onOpenChange={setSqlPreviewOpen}
        open={sqlPreviewOpen}
        sql={sqlPreview.sql}
        warnings={sqlPreview.warnings}
      />

      <TableDocsDialog
        model={model}
        onCopy={(content) =>
          copyTextToClipboard(content)
            .then(() => {
              toast.success({
                description: 'The table documentation is now on your clipboard.',
                title: 'Docs copied',
              });
            })
            .catch(() => {
              toast.warning({
                description: 'Your browser blocked clipboard access.',
                title: 'Copy manually',
              });
            })
        }
        onOpenChange={(open) => {
          if (!open) {
            setTableDocsTableId(null);
          }
        }}
        tableId={tableDocsTableId}
      />

      <KeyboardShortcutsDialog
        canComment={canCommentDiagram}
        canEdit={canEditDiagram}
        canSnapshot={canCreateSnapshot}
        onOpenChange={setKeyboardShortcutsOpen}
        open={keyboardShortcutsOpen}
      />

      <EditorConfirmDialog
        action={editorConfirmAction}
        disabled={restoreSnapshotMutation.isPending || saveSnapshotMutation.isPending}
        onCancel={() => setEditorConfirmAction(null)}
        onConfirm={handleEditorConfirmAction}
      />

      <ShareLinksDialog
        createError={createShareLinkMutation.error}
        disabled={!canEditDiagram}
        isCreating={createShareLinkMutation.isPending}
        isLoading={shareLinksQuery.isPending}
        isRevoking={revokeShareLinkMutation.isPending}
        latestSnapshot={latestSnapshot}
        listError={shareLinksQuery.error}
        onCopy={(url) =>
          copyTextToClipboard(url)
            .then(() => {
              toast.success({
                description: 'The public read-only URL is now on your clipboard.',
                title: 'Share link copied',
              });
            })
            .catch(() => {
              toast.warning({
                description: 'Your browser blocked clipboard access.',
                title: 'Copy manually',
              });
            })
        }
        onCreate={(input) => createShareLinkMutation.mutateAsync({ body: input, diagramId: activeDiagram.id })}
        onOpenChange={(open) => {
          if (open) {
            createShareLinkMutation.reset();
            revokeShareLinkMutation.reset();
          }

          setShareLinksOpen(open);
        }}
        onRetry={() => void shareLinksQuery.refetch()}
        onRevoke={(shareLinkId) => revokeShareLinkMutation.mutateAsync({ diagramId: activeDiagram.id, shareLinkId })}
        open={shareLinksOpen}
        revokeError={revokeShareLinkMutation.error}
        shareLinks={shareLinks}
      />

      <ImportJsonDialog
        currentDiagramName={activeDiagram.name}
        disabled={!canEditDiagram || importDiagramMutation.isPending}
        importError={importDiagramMutation.error}
        isImporting={importDiagramMutation.isPending}
        onImport={handleImportDraftModel}
        onOpenChange={(open) => {
          // Membuka ulang dialog membersihkan error mutation lama supaya user tidak melihat error stale dari import sebelumnya.
          if (open) {
            importDiagramMutation.reset();
          }

          setImportJsonOpen(open);
        }}
        open={importJsonOpen}
      />

      <ImportSqlDialog
        currentDiagramName={activeDiagram.name}
        defaultDialect={model.dialect}
        disabled={!canEditDiagram || importDiagramMutation.isPending}
        importError={importDiagramMutation.error}
        isImporting={importDiagramMutation.isPending}
        onImport={handleImportDraftModel}
        onOpenChange={(open) => {
          // Error import SQL dan JSON berbagi mutation yang sama, jadi reset saat dialog dibuka menjaga konteks pesan tetap tepat.
          if (open) {
            importDiagramMutation.reset();
          }

          setImportSqlOpen(open);
        }}
        open={importSqlOpen}
      />

      <SnapshotHistoryDialog
        canRestore={canCreateSnapshot}
        isRestoring={restoreSnapshotMutation.isPending}
        latestSnapshot={latestSnapshot}
        onOpenChange={(open) => {
          if (open) {
            restoreSnapshotMutation.reset();
          }

          setSnapshotHistoryOpen(open);
        }}
        onRestore={handleRestoreSnapshot}
        open={snapshotHistoryOpen}
        restoreError={restoreSnapshotMutation.error}
        snapshots={snapshots}
      />

      <CommentsDialog
        canComment={canCommentDiagram}
        canModerateComments={canEditDiagram}
        currentUserId={currentUser.id}
        diagramId={activeDiagram.id}
        model={model}
        onFocusTable={handleSelectedTableChange}
        onCommentTargetSelect={setSelectedCommentTarget}
        openRequest={commentThreadOpenRequest}
        onOpenChange={setCommentsOpen}
        onTypingChange={handleCommentTypingChange}
        open={commentsOpen}
        projectId={activeProject.id}
        remoteTypingPresences={remoteCommentTypingPresences}
        selectedCommentTarget={selectedCommentTarget}
        selectedTableId={selectedTable?.id ?? null}
      />

      <CreateWorkspaceDialog
        onCreated={(organization) => {
          modelRef.current = null;
          snapshotRecoveryModelRef.current = null;
          persistedDraftSignatureRef.current = null;
          setModel(null);
          setSelectedTableId(null);
          setSelectedCommentTarget(null);
          setProjectSearchTerm('');
          setCreateWorkspaceOpen(false);
          navigate(routes.workspace.to({ workspaceSlug: getOrganizationSlug(organization) }));
        }}
        onOpenChange={setCreateWorkspaceOpen}
        open={createWorkspaceOpen}
        trigger={null}
      />

      {canCreateProject ? (
        <CreateProjectDialog
          onCreated={(project) => {
            modelRef.current = null;
            snapshotRecoveryModelRef.current = null;
            persistedDraftSignatureRef.current = null;
            setModel(null);
            setSelectedTableId(null);
            setSelectedCommentTarget(null);
            setCreateProjectOpen(false);
            navigate(routes.project.to({ projectId: project.id, workspaceSlug: getWorkspaceSlug(project) }));
          }}
          onOpenChange={setCreateProjectOpen}
          open={createProjectOpen}
          organizationId={activeOrganization.id}
          trigger={null}
        />
      ) : null}

      {canCreateDiagram ? (
        <CreateDiagramDialog
          defaultDialect={model.dialect}
          onCreated={(diagram) => {
            modelRef.current = null;
            snapshotRecoveryModelRef.current = null;
            persistedDraftSignatureRef.current = null;
            setModel(null);
            setSelectedTableId(null);
            setSelectedCommentTarget(null);
            setCreateDiagramOpen(false);
            navigate(
              routes.diagram.to({
                diagramId: diagram.id,
                projectId: activeProject.id,
                workspaceSlug: getWorkspaceSlug(activeProject),
              }),
            );
          }}
          onOpenChange={setCreateDiagramOpen}
          open={createDiagramOpen}
          projectId={activeProject.id}
          trigger={null}
        />
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <section className="absolute inset-0 flex min-h-0 min-w-0">
          <SchemaCanvas
            commentTargetSummaries={commentTargetSummaries}
            fitKey={activeDiagram?.id ?? 'empty'}
            fitSignal={fitSignal}
            floatingInsetLeft={canvasFloatingInsetLeft}
            floatingInsetRight={canvasFloatingInsetRight}
            minimapToggleSignal={minimapToggleSignal}
            minimapOffsetRight={canvasMinimapOffsetRight}
            model={model}
            onCommentTargetOpen={handleCommentMarkerOpen}
            onColumnSelect={(columnId) => setSelectedCommentTarget({ targetId: columnId, targetType: 'column' })}
            onLocalCursorChange={handleCanvasCursorChange}
            onModelChange={handleModelChange}
            onSelectedTableChange={handleSelectedTableChange}
            onTableDocsOpen={setTableDocsTableId}
            onViewportChange={handleCanvasViewportChange}
            readOnly={!canEditDiagram}
            remoteCursors={remoteCanvasCursors}
            selectedColumnId={selectedColumnId}
            selectedTableId={selectedTableId}
            toolbar={canvasToolbar}
            toolbarOffsetLeft={canvasToolbarOffsetLeft}
          />
        </section>

        <aside
          className="tabliodb-editor-chrome-soft absolute inset-y-0 left-0 z-30 min-w-0 overflow-hidden border-r border-[rgb(var(--tabliodb-border))] transition-[width] duration-200"
          style={{ width: leftSidebarWidth }}
        >
          {!leftSidebarOpen ? (
            <SidebarRail icon={PanelLeft} label="Show left sidebar" onClick={() => setLeftSidebarOpen(true)} />
          ) : (
            <DiagramTablesSidebar
              model={model}
              onClearTableSelection={() => handleSelectedTableChange(null)}
              onHide={() => setLeftSidebarOpen(false)}
              onColumnSelect={(columnId) => setSelectedCommentTarget({ targetId: columnId, targetType: 'column' })}
              onModelChange={handleModelChange}
              onTableSelect={handleSelectedTableChange}
              readOnly={!canEditDiagram}
              selectedColumnId={selectedColumnId}
              selectedTableId={selectedTableId}
            />
          )}
        </aside>

        {rightSidebarOpen ? (
          <div
            className="tabliodb-editor-chrome-soft absolute inset-y-0 right-0 z-30 min-w-0 transition-[width] duration-200"
            style={{ width: rightSidebarWidth }}
          >
            <SchemaInspector
              // Tombol ignore hanya aktif untuk signal server-backed; draft lokal tetap menampilkan lint langsung supaya user tidak bisa ignore state yang belum tersimpan.
              canIgnoreReviewSignals={canEditDiagram && persistedReviewSignals !== null}
              className="h-full w-full"
              commentTargetSummaries={commentTargetSummaries}
              isIgnoringReviewSignal={ignoreReviewSignalMutation.isPending}
              latestSnapshotVersion={latestSnapshot?.version ?? 0}
              model={model}
              onHide={() => setRightSidebarOpen(false)}
              onModelChange={handleModelChange}
              onCommentTargetSelect={setSelectedCommentTarget}
              onReviewSignalIgnore={(signalId) => ignoreReviewSignalMutation.mutate(signalId)}
              onTableSelect={handleSelectedTableChange}
              readOnly={!canEditDiagram}
              reviewSettings={reviewSignalSettingsQuery.data?.effective}
              reviewSignals={persistedReviewSignals}
              selectedTableId={selectedTableId}
            />
          </div>
        ) : (
          <aside
            className="tabliodb-editor-chrome-soft absolute inset-y-0 right-0 z-30 min-w-0 overflow-hidden border-l border-[rgb(var(--tabliodb-border))] transition-[width] duration-200"
            style={{ width: rightSidebarWidth }}
          >
            <SidebarRail icon={PanelRight} label="Show inspector" onClick={() => setRightSidebarOpen(true)} />
          </aside>
        )}
      </div>
    </main>
  );
}

function getEditorViewportWidth(): number {
  if (typeof window === 'undefined') {
    return editorDesktopSidebarWidthPx * 4;
  }

  return window.innerWidth;
}

function isCompactEditorViewport(viewportWidth: number): boolean {
  return viewportWidth <= editorMobileBreakpointPx;
}

function getResponsiveEditorSidebarWidthPx(viewportWidth: number): number {
  if (viewportWidth <= editorMobileBreakpointPx) {
    // Keep the same math as --tabliodb-sidebar-width in CSS so React safe-area numbers match the visual panel width.
    return Math.min(300, Math.max(editorCollapsedSidebarWidthPx, viewportWidth - 54));
  }

  if (viewportWidth <= editorTabletBreakpointPx) {
    return Math.min(editorDesktopSidebarWidthPx, Math.max(editorCollapsedSidebarWidthPx, viewportWidth - 64));
  }

  return editorDesktopSidebarWidthPx;
}

function getEditorOverlayOffsetPx({
  expanded,
  expandedWidthPx,
  minVisibleSpacePx,
  viewportWidth,
}: {
  expanded: boolean;
  expandedWidthPx: number;
  minVisibleSpacePx: number;
  viewportWidth: number;
}): number {
  if (!expanded) {
    return editorCollapsedSidebarWidthPx + 12;
  }

  // Floating controls should clear an open sidebar, but on narrow screens they still need enough visible area to remain usable.
  return Math.min(
    expandedWidthPx + 16,
    Math.max(editorCollapsedSidebarWidthPx + 12, viewportWidth - minVisibleSpacePx),
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

function matchesRememberedWorkspace(
  organization: OrganizationDto,
  rememberedTarget: CurrentUserEditorPreferenceDto,
): boolean {
  return Boolean(
    rememberedTarget.organizationId &&
    (organization.id === rememberedTarget.organizationId || organization.slug === rememberedTarget.workspaceSlug),
  );
}

function createEditorPreferenceKey(target: {
  diagramId?: string | null;
  organizationId: string | null;
  projectId?: string | null;
}): string {
  return [target.organizationId ?? '', target.projectId ?? '', target.diagramId ?? ''].join(':');
}

function createCanvasInsertionPosition(
  viewport: CanvasViewportRect | null,
  options: { existingCount: number; height: number; width: number },
): { x: number; y: number } | undefined {
  if (!viewport) {
    return undefined;
  }

  const stagger = (options.existingCount % 6) * 24;

  return {
    // Newly created items land near the center of the currently visible canvas and stay aligned to the 12px dot grid.
    x: snapEditorCanvasCoordinate(viewport.x + viewport.width / 2 - options.width / 2 + stagger),
    y: snapEditorCanvasCoordinate(viewport.y + viewport.height / 2 - options.height / 2 + stagger),
  };
}

function snapEditorCanvasCoordinate(value: number): number {
  return Math.round(value / 12) * 12;
}

function createNextNotePosition(model: DiagramModel, selectedTableId: string | null): { x: number; y: number } {
  const selectedTable = selectedTableId ? (model.tables[selectedTableId] ?? null) : null;

  if (selectedTable) {
    return {
      x: selectedTable.position.x + Math.max(selectedTable.width, 288) + 48,
      y: selectedTable.position.y,
    };
  }

  const positionedEntities = [
    ...Object.values(model.tables).map((table) => ({
      height: 36 + table.columnIds.length * 24 + 12,
      width: Math.max(table.width, 288),
      x: table.position.x,
      y: table.position.y,
    })),
    ...Object.values(model.notes).map((note) => ({
      height: 120,
      width: Math.max(note.width ?? 260, 180),
      x: note.position.x,
      y: note.position.y,
    })),
  ];

  if (positionedEntities.length === 0) {
    return { x: 120, y: 120 };
  }

  const right = Math.max(...positionedEntities.map((entity) => entity.x + entity.width));
  const top = Math.min(...positionedEntities.map((entity) => entity.y));

  return {
    x: right + 48,
    y: top,
  };
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  const element = target instanceof Element ? target : null;

  return Boolean(element?.closest('input, textarea, select, [contenteditable="true"], [data-lexical-editor="true"]'));
}

function isInteractiveShortcutTarget(target: EventTarget | null): boolean {
  const element = target instanceof Element ? target : null;

  return Boolean(
    element?.closest(
      'input, textarea, select, button, a, [contenteditable="true"], [data-lexical-editor="true"], [role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]',
    ),
  );
}

function KeyboardShortcutsDialog({
  canComment,
  canEdit,
  canSnapshot,
  onOpenChange,
  open,
}: {
  canComment: boolean;
  canEdit: boolean;
  canSnapshot: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const shortcutGroups = [
    {
      items: [
        { action: 'Open shortcut palette', keys: ['?'] },
        { action: 'Fit diagram', keys: ['F'] },
        { action: 'Toggle minimap', keys: ['M'] },
        { action: 'Toggle left sidebar', keys: ['['] },
        { action: 'Toggle right sidebar', keys: [']'] },
      ],
      title: 'Canvas',
    },
    {
      items: [
        ...(canEdit
          ? [
              { action: 'Undo last edit', keys: [getPrimaryModifierKey(), 'Z'] },
              { action: 'Redo last edit', keys: [getPrimaryModifierKey(), 'Shift', 'Z'] },
              { action: 'Delete selected table', keys: ['Delete'] },
            ]
          : []),
        ...(canComment ? [{ action: 'Open comments', keys: [getPrimaryModifierKey(), 'K'] }] : []),
        ...(canSnapshot ? [{ action: 'Create snapshot', keys: [getPrimaryModifierKey(), 'S'] }] : []),
      ],
      title: 'Editor',
    },
  ].filter((group) => group.items.length > 0);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="w-[min(94vw,620px)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-5 text-[rgb(var(--tabliodb-primary-text))]" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>Fast editor actions that stay disabled while typing in form fields.</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          {shortcutGroups.map((group) => (
            <section
              className="rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border))] bg-white p-3 shadow-[0_2px_0_rgb(var(--tabliodb-border))]"
              key={group.title}
            >
              <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                {group.title}
              </h3>
              <div className="grid gap-2">
                {group.items.map((item) => (
                  <div className="flex items-center justify-between gap-3" key={`${group.title}:${item.action}`}>
                    <span className="min-w-0 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))]">
                      {item.action}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map((key) => (
                        <ShortcutKey key={`${item.action}:${key}`}>{key}</ShortcutKey>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button" variant="secondary">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutKey({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-7 min-w-7 items-center justify-center rounded-[9px] border border-[rgb(var(--tabliodb-border-strong))] bg-[rgb(var(--tabliodb-surface-raised))] px-2 text-[11px] font-black text-[rgb(var(--tabliodb-ink))] shadow-[0_2px_0_rgb(var(--tabliodb-border-strong))]">
      {children}
    </kbd>
  );
}

function getPrimaryModifierKey(): string {
  if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)) {
    return 'Cmd';
  }

  return 'Ctrl';
}

function EditorConfirmDialog({
  action,
  disabled,
  onCancel,
  onConfirm,
}: {
  action: EditorConfirmAction | null;
  disabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isTableDelete = action?.type === 'table-delete';
  const isSnapshotGuard = action?.type === 'snapshot-save-unsafe';
  const title = isTableDelete ? 'Delete table?' : isSnapshotGuard ? action.guard.title : 'Restore snapshot?';
  const description = isTableDelete
    ? `Table "${action.tableName}" and its relationships will be removed from this draft.`
    : isSnapshotGuard
      ? action.guard.description
      : 'Your current unsaved draft will be replaced by the selected snapshot.';
  const confirmIcon = isTableDelete ? (
    <Trash2 className="size-4" />
  ) : isSnapshotGuard ? (
    <Save className="size-4" />
  ) : (
    <RotateCcw className="size-4" />
  );
  const confirmLabel = isTableDelete ? 'Delete table' : isSnapshotGuard ? 'Save anyway' : 'Restore';

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
      open={Boolean(action)}
    >
      <DialogContent className="w-[min(92vw,420px)]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {isSnapshotGuard ? (
          <div className="rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] p-3 text-sm font-bold leading-6 text-[rgb(var(--tabliodb-gold-text))]">
            <div className="mb-1 flex items-center gap-2 text-[13px] font-extrabold">
              <FileWarning className="size-4" />
              Realtime guard
            </div>
            <p>{action.guard.detail}</p>
          </div>
        ) : null}
        <DialogFooter>
          <Button disabled={disabled} onClick={onCancel} type="button" variant="secondary">
            Cancel
          </Button>
          <Button
            className="gap-2"
            disabled={disabled}
            onClick={onConfirm}
            type="button"
            variant={isSnapshotGuard ? 'primary' : 'danger'}
          >
            {confirmIcon}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShareLinksDialog({
  createError,
  disabled,
  isCreating,
  isLoading,
  isRevoking,
  latestSnapshot,
  listError,
  onCopy,
  onCreate,
  onOpenChange,
  onRetry,
  onRevoke,
  open,
  revokeError,
  shareLinks,
}: {
  createError: Error | null;
  disabled: boolean;
  isCreating: boolean;
  isLoading: boolean;
  isRevoking: boolean;
  latestSnapshot: SnapshotResponseDto | null;
  listError: Error | null;
  onCopy: (url: string) => void;
  onCreate: (input: DiagramShareLinkCreateDto) => Promise<DiagramShareLinkCreateResponseDtoOutput>;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  onRevoke: (shareLinkId: string) => Promise<unknown>;
  open: boolean;
  revokeError: Error | null;
  shareLinks: DiagramShareLinkDto[];
}) {
  const [lastCreatedUrl, setLastCreatedUrl] = useState<string | null>(null);
  const [shareLinkToRevoke, setShareLinkToRevoke] = useState<DiagramShareLinkDto | null>(null);
  const form = useForm<ShareLinkFormState>({
    defaultValues: {
      expiresInDays: 'never',
      label: '',
      targetType: 'diagram',
    },
    resolver: zodResolver(shareLinkFormSchema),
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      expiresInDays: 'never',
      label: '',
      // Snapshot option hanya dipilih otomatis jika ada snapshot dan user memilihnya sendiri setelah dialog terbuka.
      targetType: 'diagram',
    });
    setLastCreatedUrl(null);
    setShareLinkToRevoke(null);
  }, [form, open]);

  async function handleSubmit(values: ShareLinkFormState) {
    if (disabled) {
      return;
    }

    const expiresAt = values.expiresInDays === 'never' ? null : createExpiryIsoDate(Number(values.expiresInDays));
    const response = await onCreate({
      expiresAt,
      label: values.label.trim() || undefined,
      snapshotId: values.targetType === 'snapshot' ? latestSnapshot?.id : undefined,
      targetType: sdkShareLinkTargetTypeByValue[values.targetType],
    });

    setLastCreatedUrl(response.url);
  }

  function handleRevoke(shareLink: DiagramShareLinkDto) {
    if (isRevoking) {
      return;
    }

    setShareLinkToRevoke(shareLink);
  }

  async function handleConfirmRevoke() {
    if (!shareLinkToRevoke || isRevoking) {
      return;
    }

    try {
      // Revoke tetap lewat mutation parent agar list invalidation, toast, dan error panel existing tidak berubah perilakunya.
      await onRevoke(shareLinkToRevoke.id);
      setShareLinkToRevoke(null);
    } catch {
      // Error mutation sudah dirender melalui revokeError, jadi dialog tetap terbuka tanpa throw yang membuat promise rejection bocor ke console.
    }
  }

  return (
    <>
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="h-[min(86dvh,720px)] w-[min(94vw,980px)] max-w-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="size-5 text-[rgb(var(--tabliodb-primary-text))]" />
              Share read-only link
            </DialogTitle>
            <DialogDescription>
              Create public links for stakeholders who only need to inspect this diagram.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid min-h-0 gap-4 lg:grid-cols-[minmax(260px,360px)_1fr]">
            <form
              className="grid content-start gap-4"
              onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}
            >
              <Surface className="grid gap-3 p-4">
                <div>
                  <p className="text-sm font-black text-[rgb(var(--tabliodb-ink))]">New public link</p>
                  <p className="mt-1 text-xs font-bold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
                    Anyone with the URL can view the diagram without signing in.
                  </p>
                </div>

                <label className="grid gap-1.5 text-xs font-extrabold uppercase text-[rgb(var(--tabliodb-ink-muted))]">
                  Label
                  <ControlledInput
                    autoComplete="off"
                    control={form.control}
                    name="label"
                    placeholder="Stakeholder review"
                  />
                  <FieldError>{form.formState.errors.label?.message}</FieldError>
                </label>

                <label className="grid gap-1.5 text-xs font-extrabold uppercase text-[rgb(var(--tabliodb-ink-muted))]">
                  Target
                  <ControlledSelect
                    control={form.control}
                    name="targetType"
                    options={[
                      { label: 'Live diagram', value: 'diagram' },
                      {
                        disabled: !latestSnapshot,
                        label: latestSnapshot ? `Snapshot v${latestSnapshot.version}` : 'Snapshot unavailable',
                        value: 'snapshot',
                      },
                    ]}
                  />
                  <FieldError>{form.formState.errors.targetType?.message}</FieldError>
                </label>

                <label className="grid gap-1.5 text-xs font-extrabold uppercase text-[rgb(var(--tabliodb-ink-muted))]">
                  Expiry
                  <ControlledSelect
                    control={form.control}
                    name="expiresInDays"
                    options={[
                      { label: 'Never expires', value: 'never' },
                      { label: '7 days', value: '7' },
                      { label: '30 days', value: '30' },
                    ]}
                  />
                  <FieldError>{form.formState.errors.expiresInDays?.message}</FieldError>
                </label>

                {createError ? <InlineErrorState error={createError} title="Could not create share link" /> : null}

                <Button className="gap-2" disabled={disabled || isCreating} type="submit">
                  {isCreating ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                  Create link
                </Button>
              </Surface>

              {lastCreatedUrl ? (
                <Surface className="grid gap-3 border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] p-4">
                  <div>
                    <p className="text-sm font-black text-[rgb(var(--tabliodb-primary-text))]">Link copied</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
                      This URL is shown only now because Tabliodb stores the token as a hash.
                    </p>
                  </div>
                  <div className="min-w-0 rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-primary-border))] bg-white px-3 py-2 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                    <span className="block truncate">{lastCreatedUrl}</span>
                  </div>
                  <Button className="gap-2" onClick={() => onCopy(lastCreatedUrl)} type="button" variant="secondary">
                    <Copy className="size-4" />
                    Copy again
                  </Button>
                </Surface>
              ) : null}
            </form>

            <Surface className="flex min-h-0 flex-col overflow-hidden p-0">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[rgb(var(--tabliodb-border))] px-4 py-3">
                <div>
                  <p className="text-sm font-black text-[rgb(var(--tabliodb-ink))]">Existing links</p>
                  <p className="text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                    {shareLinks.length} link{shareLinks.length === 1 ? '' : 's'} for this diagram
                  </p>
                </div>
                <Badge variant="green">Read-only</Badge>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {isLoading ? (
                  <InlineLoadingState message="Loading share links" />
                ) : listError ? (
                  <InlineErrorState error={listError} onRetry={onRetry} title="Could not load share links" />
                ) : shareLinks.length === 0 ? (
                  <EmptyState
                    description="Create a public link when stakeholders need to review a schema without joining the workspace."
                    icon={Share2}
                    title="No share links yet"
                  />
                ) : (
                  <div className="grid gap-3">
                    {shareLinks.map((shareLink) => (
                      <ShareLinkListItem
                        isRevoking={isRevoking}
                        key={shareLink.id}
                        onRevoke={handleRevoke}
                        shareLink={shareLink}
                      />
                    ))}
                  </div>
                )}

                {revokeError ? (
                  <InlineErrorState className="mt-4" error={revokeError} title="Could not revoke link" />
                ) : null}
              </div>
            </Surface>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="secondary">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setShareLinkToRevoke(null);
          }
        }}
        open={Boolean(shareLinkToRevoke)}
      >
        <DialogContent className="w-[min(92vw,420px)]">
          <DialogHeader>
            <DialogTitle>Revoke share link?</DialogTitle>
            <DialogDescription>
              This read-only URL will stop working immediately. People who already have the link will lose access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button disabled={isRevoking} onClick={() => setShareLinkToRevoke(null)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button
              className="gap-2"
              disabled={isRevoking}
              onClick={() => void handleConfirmRevoke()}
              type="button"
              variant="danger"
            >
              {isRevoking ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Revoke link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ShareLinkListItem({
  isRevoking,
  onRevoke,
  shareLink,
}: {
  isRevoking: boolean;
  onRevoke: (shareLink: DiagramShareLinkDto) => void;
  shareLink: DiagramShareLinkDto;
}) {
  const isActive = shareLink.status === 'active';

  return (
    <article className="rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border))] bg-white p-3 shadow-[0_2px_0_rgb(var(--tabliodb-border))]">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-black text-[rgb(var(--tabliodb-ink))]">
              {shareLink.label || formatShareLinkTarget(shareLink)}
            </p>
            <ShareLinkStatusBadge status={shareLink.status} />
          </div>
          <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
            {formatShareLinkTarget(shareLink)} / created by {shareLink.createdByName}
          </p>
        </div>
        <Button
          className="shrink-0 gap-2"
          disabled={!isActive || isRevoking}
          onClick={() => onRevoke(shareLink)}
          size="sm"
          type="button"
          variant="secondary"
        >
          {isRevoking ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
          Revoke
        </Button>
      </div>
      <dl className="mt-3 grid gap-2 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))] sm:grid-cols-3">
        <div>
          <dt className="font-extrabold uppercase text-[rgb(var(--tabliodb-ink-subtle))]">Created</dt>
          <dd>{formatDateTime(shareLink.createdAt)}</dd>
        </div>
        <div>
          <dt className="font-extrabold uppercase text-[rgb(var(--tabliodb-ink-subtle))]">Expires</dt>
          <dd>{shareLink.expiresAt ? formatDateTime(shareLink.expiresAt) : 'Never'}</dd>
        </div>
        <div>
          <dt className="font-extrabold uppercase text-[rgb(var(--tabliodb-ink-subtle))]">Opens</dt>
          <dd>{shareLink.accessCount}</dd>
        </div>
      </dl>
    </article>
  );
}

function ShareLinkStatusBadge({ status }: { status: DiagramShareLinkDto['status'] }) {
  if (status === 'active') {
    return <Badge variant="green">Active</Badge>;
  }

  if (status === 'expired') {
    return <Badge variant="yellow">Expired</Badge>;
  }

  return <Badge variant="neutral">Revoked</Badge>;
}

function formatShareLinkTarget(shareLink: DiagramShareLinkDto): string {
  return shareLink.targetType === 'snapshot' ? 'Snapshot link' : 'Live diagram link';
}

function createExpiryIsoDate(days: number): string {
  // Expiry dihitung di client untuk preview cepat; backend tetap memvalidasi bahwa tanggalnya berada di masa depan.
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function updateLiveModelFromDiagram(
  currentModel: DiagramModel,
  diagram: DiagramResponseDto,
  modelRef: { current: DiagramModel | null },
): DiagramModel {
  const nextModel = {
    ...currentModel,
    dialect: toDatabaseDialect(diagram.dialect),
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

function NotificationInboxMenuItem({
  notification,
  onSelect,
}: {
  notification: NotificationInboxItemDto;
  onSelect: (notification: NotificationInboxItemDto) => void;
}) {
  const Icon = notification.type === 'mention' ? AtSign : Reply;
  const targetLabel = formatCommentTargetType(notification.thread.targetType);
  const actionLabel = notification.type === 'mention' ? 'mentioned you' : 'replied to you';

  return (
    <DropdownMenuItem
      className={cn('items-start gap-2.5 p-2.5', notification.isUnread && 'bg-[rgb(var(--tabliodb-selected-surface))]')}
      onSelect={() => onSelect(notification)}
    >
      <span
        className={cn(
          'mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl border text-white shadow-[0_2px_0_rgb(var(--tabliodb-border-strong))]',
          notification.type === 'mention'
            ? 'border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky))]'
            : 'border-[rgb(var(--tabliodb-lavender-border))] bg-[rgb(var(--tabliodb-lavender))]',
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[13px] font-extrabold">
            {notification.comment.author.name} {actionLabel}
          </span>
          {notification.isUnread ? <Badge variant="yellow">New</Badge> : null}
        </span>
        <span className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs font-semibold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
          {notification.comment.bodyText || 'No preview available.'}
        </span>
        <span className="mt-1 block truncate text-[11px] font-extrabold text-[rgb(var(--tabliodb-ink-subtle))]">
          {notification.project.name} / {notification.diagram.name} / {targetLabel} /{' '}
          {formatDateTime(notification.createdAt)}
        </span>
      </span>
    </DropdownMenuItem>
  );
}

function SidebarRail({
  icon,
  label,
  onClick,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 items-start justify-center bg-white/70 pt-3 backdrop-blur">
      <IconButton size="lg" icon={icon} label={label} onClick={onClick} variant="ghost" />
    </div>
  );
}

function UserAccountMenu({
  canOpenAdmin,
  isLoggingOut,
  onAdmin,
  onLogout,
  onProfile,
  user,
}: {
  canOpenAdmin: boolean;
  isLoggingOut: boolean;
  onAdmin: () => void;
  onLogout: () => void;
  onProfile: () => void;
  user: AvatarIdentity & { email: string };
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="ml-1 flex h-[var(--tabliodb-control-lg)] max-w-54 cursor-pointer items-center gap-2 rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border-strong))] bg-white px-2 pr-3 text-left shadow-[0_3px_0_rgb(var(--tabliodb-border-strong))] transition hover:bg-[rgb(var(--tabliodb-surface-raised))] active:translate-y-0.5 active:shadow-[0_1px_0_rgb(var(--tabliodb-border-strong))] max-[640px]:ml-0 max-[640px]:w-10 max-[640px]:justify-center max-[640px]:px-0"
          type="button"
        >
          <UserAvatar className="size-8 rounded-full text-[11px]" user={user} />
          <span className="hidden min-w-0 lg:block">
            <span className="block truncate text-[12px] font-extrabold leading-4">{user.name}</span>
            <span className="block truncate text-[11px] font-bold leading-4 text-[rgb(var(--tabliodb-ink-muted))]">
              {user.email}
            </span>
          </span>
          <ChevronsUpDown className="hidden size-4 shrink-0 text-[rgb(var(--tabliodb-ink-muted))] sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,288px)] p-2">
        <div className="flex items-center gap-3 px-2 py-2">
          <UserAvatar className="size-10 rounded-[14px] text-xs" user={user} />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-extrabold">{user.name}</div>
            <div className="truncate text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">{user.email}</div>
          </div>
        </div>
        <DropdownMenuSeparatorItem />
        <DropdownMenuItem onSelect={onProfile}>
          <UserRound className="size-4" />
          Profile
        </DropdownMenuItem>
        {canOpenAdmin ? (
          <DropdownMenuItem onSelect={onAdmin}>
            <ShieldCheck className="size-4" />
            Admin users
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparatorItem />
        <DropdownMenuItem disabled={isLoggingOut} onSelect={onLogout}>
          <LogOut className="size-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DiagramTablesSidebar({
  model: rawModel,
  onClearTableSelection,
  onColumnSelect,
  onHide,
  onModelChange,
  onTableSelect,
  readOnly,
  selectedColumnId,
  selectedTableId,
}: {
  model: DiagramModel;
  onClearTableSelection: () => void;
  onColumnSelect?: (columnId: string) => void;
  onHide: () => void;
  onModelChange: (model: DiagramModel) => void;
  onTableSelect: (tableId: string | null) => void;
  readOnly: boolean;
  selectedColumnId: string | null;
  selectedTableId: string | null;
}) {
  const model = useMemo(() => normalizeEditorDiagramModel(rawModel), [rawModel]);
  const [tableSearchTerm, setTableSearchTerm] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const tables = useMemo(
    () => Object.values(model.tables).sort((left, right) => left.name.localeCompare(right.name)),
    [model.tables],
  );
  const filteredTables = useMemo(() => {
    const search = tableSearchTerm.trim().toLowerCase();

    return search
      ? tables.filter((table) => {
          const group = table.groupId ? model.groups[table.groupId] : null;

          return [table.name, table.schema ?? '', group?.name ?? ''].some((value) =>
            value.toLowerCase().includes(search),
          );
        })
      : tables;
  }, [model.groups, tableSearchTerm, tables]);
  const selectedTable = selectedTableId ? (model.tables[selectedTableId] ?? null) : null;
  const visibleTables = useMemo(() => {
    if (!selectedTable || filteredTables.some((table) => table.id === selectedTable.id)) {
      return filteredTables;
    }

    // Table yang dipilih dari canvas tetap tampil walau search term sedang memfilter list agar user tidak kehilangan konteks.
    return [selectedTable, ...filteredTables];
  }, [filteredTables, selectedTable]);

  useEffect(() => {
    if (!selectedTableId) {
      return;
    }

    window.requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-tabliodb-table-item-id="${CSS.escape(selectedTableId)}"]`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }, [selectedTableId, visibleTables.length]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[rgb(var(--tabliodb-surface-raised))]">
      <div className="flex h-[var(--tabliodb-header-height)] shrink-0 items-center gap-2.5 border-b border-[rgb(var(--tabliodb-border))] bg-white/80 px-3 backdrop-blur">
        <div className="grid size-8 shrink-0 place-items-center rounded-[13px] bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))] shadow-[0_2px_0_rgb(var(--tabliodb-primary-border))]">
          <Database className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
            Tables
          </div>
          <div className="truncate text-[13px] font-extrabold leading-5">
            {tables.length} table{tables.length === 1 ? '' : 's'}
          </div>
        </div>
        {selectedTable ? (
          <IconButton icon={X} label="Clear table selection" onClick={onClearTableSelection} variant="ghost" />
        ) : null}
        <IconButton size="lg" icon={PanelLeft} label="Hide left sidebar" onClick={onHide} variant="ghost" />
      </div>

      <div className="border-b border-[rgb(var(--tabliodb-border))] bg-white/60 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--tabliodb-ink-subtle))]" />
          <Input
            className="h-9 pl-9 text-[13px]"
            onChange={(event) => setTableSearchTerm(event.target.value)}
            placeholder="Search tables"
            value={tableSearchTerm}
          />
        </div>
      </div>

      <div ref={listRef} className="tabliodb-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-2 p-2">
          {visibleTables.length === 0 ? (
            <div className="rounded-[var(--tabliodb-radius-md)] border border-dashed border-[rgb(var(--tabliodb-border))] p-3 text-center text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
              No matching tables
            </div>
          ) : (
            visibleTables.map((table) => (
              <TableAccordionItem
                key={table.id}
                model={model}
                onClearTableSelection={onClearTableSelection}
                onColumnSelect={onColumnSelect}
                onModelChange={onModelChange}
                onSelect={() => (table.id === selectedTable?.id ? onTableSelect(null) : onTableSelect(table.id))}
                readOnly={readOnly}
                selected={table.id === selectedTable?.id}
                selectedColumnId={selectedColumnId}
                table={table}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function TableAccordionItem({
  model,
  onClearTableSelection,
  onColumnSelect,
  onModelChange,
  onSelect,
  readOnly,
  selected,
  selectedColumnId,
  table,
}: {
  model: DiagramModel;
  onClearTableSelection: () => void;
  onColumnSelect?: (columnId: string) => void;
  onModelChange: (model: DiagramModel) => void;
  onSelect: () => void;
  readOnly: boolean;
  selected: boolean;
  selectedColumnId: string | null;
  table: DatabaseTable;
}) {
  const columnCount = Math.max(getTableColumns(model, table.id).length, table.columnIds.length);
  const group = table.groupId ? model.groups[table.groupId] : null;
  const [bodyMounted, setBodyMounted] = useState(selected);
  const [bodyOpen, setBodyOpen] = useState(selected);

  useEffect(() => {
    if (selected) {
      setBodyMounted(true);
      const frameId = window.requestAnimationFrame(() => {
        // Mount satu frame lebih dulu supaya CSS grid bisa menganimasikan transisi dari 0fr ke 1fr dengan halus.
        setBodyOpen(true);
      });

      return () => window.cancelAnimationFrame(frameId);
    }

    setBodyOpen(false);
    const timeoutId = window.setTimeout(() => {
      // Body form dilepas setelah animasi close selesai agar list table tetap ringan walau jumlah tabel makin banyak.
      setBodyMounted(false);
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [selected]);

  return (
    <article
      className={cn(
        'overflow-hidden rounded-[var(--tabliodb-radius-lg)] border bg-white transition',
        selected
          ? 'border-[rgb(var(--tabliodb-active-chip-border))] bg-[rgb(var(--tabliodb-selected-surface))] shadow-[0_2px_0_rgb(var(--tabliodb-active-chip-border))]'
          : 'border-[rgb(var(--tabliodb-border))] shadow-[0_1px_0_rgb(var(--tabliodb-border))] hover:border-[rgb(var(--tabliodb-border-strong))] hover:bg-[rgb(var(--tabliodb-surface-raised))]',
      )}
      data-tabliodb-table-item-id={table.id}
    >
      <button
        aria-expanded={selected}
        className="flex min-h-13 w-full cursor-pointer items-center gap-2.5 px-2.5 py-2 text-left transition"
        onClick={onSelect}
        type="button"
      >
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: getDisplayTableColor(table.color) }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-extrabold leading-5">{table.name}</span>
          <span className="block truncate text-[11px] font-bold leading-4 text-[rgb(var(--tabliodb-ink-muted))]">
            {group?.name ?? table.schema ?? 'Main schema'}
          </span>
        </span>
        <Badge variant={selected ? 'green' : 'neutral'}>{columnCount}</Badge>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-[rgb(var(--tabliodb-ink-muted))] transition-transform',
            selected ? 'rotate-180 text-[rgb(var(--tabliodb-primary-text))]' : undefined,
          )}
        />
      </button>
      {bodyMounted ? (
        <div
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
            bodyOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="min-h-0 overflow-hidden border-t border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface))]">
            <TableStructureSidebar
              activeColumnId={selectedColumnId}
              model={model}
              onClearTableSelection={onClearTableSelection}
              onColumnSelect={onColumnSelect}
              onHide={() => undefined}
              onModelChange={onModelChange}
              readOnly={readOnly}
              selectedTableId={table.id}
              showHeader={false}
              variant="accordion"
            />
          </div>
        </div>
      ) : null}
    </article>
  );
}

function TableDocsDialog({
  model,
  onCopy,
  onOpenChange,
  tableId,
}: {
  model: DiagramModel;
  onCopy: (content: string) => void;
  onOpenChange: (open: boolean) => void;
  tableId: string | null;
}) {
  const table = tableId ? (model.tables[tableId] ?? null) : null;
  const docs = table ? createTableDocsMarkdown(model, table) : '';
  const columns = table ? getTableColumns(model, table.id) : [];
  const indexes = table ? getDocsTableIndexes(model, table) : [];

  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(table)}>
      {table ? (
        <DialogContent className="w-[min(94vw,760px)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5 text-[rgb(var(--tabliodb-sky-text))]" />
              {table.name} docs
            </DialogTitle>
            <DialogDescription>
              Quick table documentation for columns, indexes, and relationship count in the current draft.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="grid gap-4">
            <section className="grid gap-3 rounded-[18px] border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] p-4 sm:grid-cols-3">
              <TableDocsMetric label="Columns" value={columns.length} />
              <TableDocsMetric label="Indexes" value={indexes.length} />
              <TableDocsMetric label="Relationships" value={getTableRelationshipCount(model, table.id)} />
            </section>

            <pre className="tabliodb-scrollbar max-h-[52dvh] overflow-auto rounded-[18px] border-2 border-[rgb(var(--tabliodb-ink))] bg-[rgb(var(--tabliodb-ink))] p-4 text-[12px] font-semibold leading-5 text-white shadow-[0_4px_0_rgb(var(--tabliodb-border-strong))]">
              <code>{docs}</code>
            </pre>
          </DialogBody>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="secondary">
              Close
            </Button>
            <Button onClick={() => onCopy(docs)} type="button" variant="sky">
              <Copy className="size-4" />
              Copy docs
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function TableDocsMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[14px] border border-[rgb(var(--tabliodb-border))] bg-white px-3 py-2">
      <div className="text-[11px] font-extrabold uppercase text-[rgb(var(--tabliodb-ink-muted))]">{label}</div>
      <div className="mt-1 text-xl font-black text-[rgb(var(--tabliodb-ink))]">{value}</div>
    </div>
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
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const canManageWorkspace = isOrganizationManager(organization);
  const form = useForm<WorkspaceSettingsFormState>({
    defaultValues: getWorkspaceSettingsDefaults(project),
    mode: 'onBlur',
    resolver: zodResolver(workspaceSettingsFormSchema),
  });
  const teamForm = useForm<TeamFormState>({
    defaultValues: teamFormDefaults,
    mode: 'onBlur',
    resolver: zodResolver(teamFormSchema),
  });
  const selectedTeamForm = useForm<TeamFormState>({
    defaultValues: teamFormDefaults,
    mode: 'onBlur',
    resolver: zodResolver(teamFormSchema),
  });
  const teamMemberForm = useForm<TeamMemberFormState>({
    defaultValues: teamMemberFormDefaults,
    mode: 'onBlur',
    resolver: zodResolver(teamMemberFormSchema),
  });
  const teamProjectAccessForm = useForm<TeamProjectAccessFormState>({
    defaultValues: teamProjectAccessFormDefaults,
    mode: 'onBlur',
    resolver: zodResolver(teamProjectAccessFormSchema),
  });
  const { errors } = form.formState;
  const { errors: teamErrors } = teamForm.formState;
  const { errors: selectedTeamErrors } = selectedTeamForm.formState;
  const { errors: teamMemberErrors } = teamMemberForm.formState;
  const { errors: teamProjectAccessErrors } = teamProjectAccessForm.formState;
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
  const teamsQueryOptions = teamsQueries.list({ ...teamPageQuery, organizationId: project.organizationId });
  const teamsQuery = useQuery({
    ...teamsQueryOptions,
    // Teams are workspace-admin data and are only needed in the settings dialog.
    enabled: open && canManageWorkspace && teamsQueryOptions.enabled !== false,
  });
  const selectedTeamMembersQueryOptions = teamsQueries.members(selectedTeamId ?? '', teamMemberPageQuery);
  const selectedTeamMembersQuery = useQuery({
    ...selectedTeamMembersQueryOptions,
    enabled: open && canManageWorkspace && Boolean(selectedTeamId) && selectedTeamMembersQueryOptions.enabled !== false,
  });
  const selectedTeamProjectAccessesQueryOptions = teamsQueries.projectAccesses(
    selectedTeamId ?? '',
    teamProjectAccessPageQuery,
  );
  const selectedTeamProjectAccessesQuery = useQuery({
    ...selectedTeamProjectAccessesQueryOptions,
    enabled:
      open &&
      canManageWorkspace &&
      Boolean(selectedTeamId) &&
      selectedTeamProjectAccessesQueryOptions.enabled !== false,
  });
  const teamProjectOptionsQuery = useQuery({
    ...projectsQueries.list({ limit: 50, organizationId: project.organizationId }),
    // Project options are used only when granting a team access to a project.
    enabled: open && canManageWorkspace,
  });
  const auditLogs = auditLogsQuery.data?.items ?? [];
  const workspaceMembers = membersQuery.data?.items ?? [];
  const teams = teamsQuery.data?.items ?? [];
  const selectedTeam = selectedTeamId ? (teams.find((team) => team.id === selectedTeamId) ?? null) : null;
  const selectedTeamMembers = selectedTeamMembersQuery.data?.items ?? [];
  const selectedTeamProjectAccesses = selectedTeamProjectAccessesQuery.data?.items ?? [];
  const teamProjectOptions = teamProjectOptionsQuery.data?.items ?? [];
  const teamProjectSelectOptions = teamProjectOptions.map((projectOption) => ({
    disabled: selectedTeamProjectAccesses.some((access) => access.projectId === projectOption.id),
    label: projectOption.name,
    value: projectOption.id,
  }));
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
  const createTeamMutation = useCreateTeamMutation({
    mutationConfig: {
      onSuccess: (team) => {
        teamForm.reset(teamFormDefaults);
        setSelectedTeamId(team.id);
      },
    },
  });
  const updateTeamMutation = useUpdateTeamMutation({
    mutationConfig: {
      onSuccess: (team) => {
        // The editable detail form follows the saved response so stale local edits do not linger after submit.
        selectedTeamForm.reset({ description: team.description ?? '', name: team.name });
      },
    },
  });
  const archiveTeamMutation = useArchiveTeamMutation({
    mutationConfig: {
      onSuccess: () => {
        setSelectedTeamId(null);
        selectedTeamForm.reset(teamFormDefaults);
      },
    },
  });
  const addTeamMemberMutation = useAddTeamMemberMutation({
    mutationConfig: {
      onSuccess: () => {
        teamMemberForm.reset(teamMemberFormDefaults);
      },
    },
  });
  const removeTeamMemberMutation = useRemoveTeamMemberMutation();
  const upsertTeamProjectAccessMutation = useUpsertTeamProjectAccessMutation({
    mutationConfig: {
      onSuccess: () => {
        teamProjectAccessForm.reset(teamProjectAccessFormDefaults);
      },
    },
  });
  const removeTeamProjectAccessMutation = useRemoveTeamProjectAccessMutation();
  const isTeamMutationPending =
    createTeamMutation.isPending ||
    updateTeamMutation.isPending ||
    archiveTeamMutation.isPending ||
    addTeamMemberMutation.isPending ||
    removeTeamMemberMutation.isPending ||
    upsertTeamProjectAccessMutation.isPending ||
    removeTeamProjectAccessMutation.isPending;

  useEffect(() => {
    if (open) {
      form.reset(getWorkspaceSettingsDefaults(project, settingsQuery.data));
      updateSettingsMutation.reset();
      updateMemberMutation.reset();
      removeMemberMutation.reset();
      createTeamMutation.reset();
      updateTeamMutation.reset();
      archiveTeamMutation.reset();
      addTeamMemberMutation.reset();
      removeTeamMemberMutation.reset();
      upsertTeamProjectAccessMutation.reset();
      removeTeamProjectAccessMutation.reset();
    }
  }, [form, open, project, settingsQuery.data]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!selectedTeam) {
      selectedTeamForm.reset(teamFormDefaults);
      return;
    }

    // Selection drives the detail form, so switching teams always shows the currently saved team metadata.
    selectedTeamForm.reset({ description: selectedTeam.description ?? '', name: selectedTeam.name });
  }, [open, selectedTeam?.description, selectedTeam?.id, selectedTeam?.name, selectedTeamForm]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && (updateSettingsMutation.isPending || isWorkspaceMemberMutationPending || isTeamMutationPending)) {
      return;
    }

    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset(getWorkspaceSettingsDefaults(project, settingsQuery.data));
      updateSettingsMutation.reset();
      updateMemberMutation.reset();
      removeMemberMutation.reset();
      createTeamMutation.reset();
      updateTeamMutation.reset();
      archiveTeamMutation.reset();
      addTeamMemberMutation.reset();
      removeTeamMemberMutation.reset();
      upsertTeamProjectAccessMutation.reset();
      removeTeamProjectAccessMutation.reset();
      setSelectedTeamId(null);
      teamForm.reset(teamFormDefaults);
      selectedTeamForm.reset(teamFormDefaults);
      teamMemberForm.reset(teamMemberFormDefaults);
      teamProjectAccessForm.reset(teamProjectAccessFormDefaults);
    }
  }

  function handleSubmit(values: WorkspaceSettingsFormState) {
    if (!canManageWorkspace) {
      return;
    }

    updateSettingsMutation.mutate({
      body: {
        allowMemberProjectCreate: values.allowMemberProjectCreate,
        defaultProjectRole:
          values.defaultProjectRole === 'none' ? null : sdkDefaultProjectRoleByValue[values.defaultProjectRole],
        name: values.name,
      },
      organizationId: project.organizationId,
    });
  }

  function handleUpdateWorkspaceMemberRole(member: OrganizationMemberDto, role: OrganizationRoleValue) {
    if (member.role === role) {
      return;
    }

    updateMemberMutation.mutate({
      body: { role: sdkOrganizationMemberRoleByValue[role] },
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

  function handleCreateTeam(values: TeamFormState) {
    if (!canManageWorkspace) {
      return;
    }

    createTeamMutation.mutate({
      description: toOptionalDescription(values.description),
      name: values.name,
      organizationId: project.organizationId,
    });
  }

  function handleArchiveTeam(team: TeamResponseDto) {
    archiveTeamMutation.mutate({
      organizationId: project.organizationId,
      teamId: team.id,
    });
  }

  function handleUpdateTeam(values: TeamFormState) {
    if (!selectedTeam) {
      return;
    }

    updateTeamMutation.mutate({
      body: {
        description: toOptionalDescription(values.description) ?? null,
        name: values.name,
      },
      teamId: selectedTeam.id,
    });
  }

  function handleAddTeamMember(values: TeamMemberFormState) {
    if (!selectedTeam) {
      return;
    }

    addTeamMemberMutation.mutate({
      body: {
        email: values.email,
      },
      organizationId: project.organizationId,
      teamId: selectedTeam.id,
    });
  }

  function handleRemoveTeamMember(member: TeamMemberDto) {
    if (!selectedTeam) {
      return;
    }

    removeTeamMemberMutation.mutate({
      organizationId: project.organizationId,
      teamId: selectedTeam.id,
      userId: member.userId,
    });
  }

  function handleUpsertTeamProjectAccess(values: TeamProjectAccessFormState) {
    if (!selectedTeam) {
      return;
    }

    upsertTeamProjectAccessMutation.mutate({
      body: {
        projectId: values.projectId,
        role: sdkTeamProjectRoleByValue[values.role as TeamProjectRole],
      },
      organizationId: project.organizationId,
      teamId: selectedTeam.id,
    });
  }

  function handleRemoveTeamProjectAccess(access: TeamProjectAccessDto) {
    if (!selectedTeam) {
      return;
    }

    removeTeamProjectAccessMutation.mutate({
      organizationId: project.organizationId,
      projectId: access.projectId,
      teamId: selectedTeam.id,
    });
  }

  function handleUpdateTeamProjectAccessRole(access: TeamProjectAccessDto, role: TeamProjectRole) {
    if (!selectedTeam || access.role === role) {
      return;
    }

    upsertTeamProjectAccessMutation.mutate({
      body: {
        projectId: access.projectId,
        role: sdkTeamProjectRoleByValue[role],
      },
      organizationId: project.organizationId,
      teamId: selectedTeam.id,
    });
  }

  const memberMutationError = updateMemberMutation.error ?? removeMemberMutation.error;
  const teamMutationError =
    createTeamMutation.error ??
    updateTeamMutation.error ??
    archiveTeamMutation.error ??
    addTeamMemberMutation.error ??
    removeTeamMemberMutation.error ??
    upsertTeamProjectAccessMutation.error ??
    removeTeamProjectAccessMutation.error;
  const updatingUserId = updateMemberMutation.isPending ? updateMemberMutation.variables?.userId : null;
  const removingUserId = removeMemberMutation.isPending ? removeMemberMutation.variables?.userId : null;
  const removingTeamMemberUserId = removeTeamMemberMutation.isPending
    ? removeTeamMemberMutation.variables?.userId
    : null;
  const removingTeamProjectId = removeTeamProjectAccessMutation.isPending
    ? removeTeamProjectAccessMutation.variables?.projectId
    : null;

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <IconButton icon={Building2} label="Workspace settings" variant="ghost" />
      </DialogTrigger>
      <DialogContent className="w-[min(96vw,920px)]">
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
              <div className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
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
                <div className="mt-4 flex items-center gap-2 rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white p-4 text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                  <Loader2 className="size-4 animate-spin" />
                  Loading members
                </div>
              ) : membersQuery.error ? (
                <div className="mt-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                  {getErrorMessage(membersQuery.error)}
                </div>
              ) : workspaceMembers.length === 0 ? (
                <div className="mt-4 rounded-2xl border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-4 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                  No workspace members yet
                </div>
              ) : (
                <div className="tabliodb-scrollbar mt-4 max-h-72 overflow-y-auto rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white">
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
                <div className="mt-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                  {getErrorMessage(memberMutationError)}
                </div>
              ) : null}
            </section>
          ) : (
            <section className="border-t-2 border-[rgb(var(--tabliodb-border))] pt-5">
              <div className="rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white p-4 text-sm font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                Your workspace role is {formatOrganizationRole(organization.role)}. Owner or Admin access is required to
                manage workspace settings and members.
              </div>
            </section>
          )}

          {canManageWorkspace ? (
            <section className="border-t-2 border-[rgb(var(--tabliodb-border))] pt-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-extrabold">
                    <UsersRound className="size-4 text-[rgb(var(--tabliodb-primary-text))]" />
                    Teams
                  </h3>
                  <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                    Manage reusable groups before granting project access.
                  </p>
                </div>
                <Badge variant="green">{teamsQuery.data?.totalCount ?? teams.length} teams</Badge>
              </div>

              <form
                className="mt-4 grid gap-3 rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface))] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                onSubmit={teamForm.handleSubmit(handleCreateTeam)}
              >
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                    Team name
                  </span>
                  <ControlledInput
                    aria-invalid={Boolean(teamErrors.name)}
                    control={teamForm.control}
                    disabled={isTeamMutationPending}
                    name="name"
                    placeholder="Backend team"
                  />
                  <FieldError>{teamErrors.name?.message}</FieldError>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                    Description
                  </span>
                  <ControlledInput
                    aria-invalid={Boolean(teamErrors.description)}
                    control={teamForm.control}
                    disabled={isTeamMutationPending}
                    name="description"
                    placeholder="Optional team context"
                  />
                  <FieldError>{teamErrors.description?.message}</FieldError>
                </label>
                <Button className="self-start sm:mt-6" disabled={isTeamMutationPending} type="submit">
                  {createTeamMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Team
                </Button>
              </form>

              {teamsQuery.isPending ? (
                <div className="mt-4 flex items-center gap-2 rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white p-4 text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                  <Loader2 className="size-4 animate-spin" />
                  Loading teams
                </div>
              ) : teamsQuery.error ? (
                <div className="mt-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                  {getErrorMessage(teamsQuery.error)}
                </div>
              ) : (
                <div className="mt-4 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="tabliodb-scrollbar max-h-128 overflow-y-auto rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white p-2">
                    {teams.length === 0 ? (
                      <div className="grid min-h-28 place-items-center rounded-[14px] border-2 border-dashed border-[rgb(var(--tabliodb-border))] px-4 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                        No teams yet
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        {teams.map((team) => (
                          <TeamListItem
                            isSelected={team.id === selectedTeamId}
                            key={team.id}
                            onSelect={(nextTeam) => setSelectedTeamId(nextTeam.id)}
                            team={team}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white">
                    {selectedTeam ? (
                      <div className="grid gap-4 p-4">
                        <div className="flex flex-col gap-3 border-b-2 border-[rgb(var(--tabliodb-border))] pb-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h4 className="truncate text-sm font-extrabold">{selectedTeam.name}</h4>
                            <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                              {selectedTeam.memberCount} members / {selectedTeam.projectAccessCount} project grants
                            </p>
                          </div>
                          <WithTooltip content={`Archive ${selectedTeam.name}`}>
                            <Button
                              aria-label={`Archive ${selectedTeam.name}`}
                              disabled={isTeamMutationPending}
                              onClick={() => handleArchiveTeam(selectedTeam)}
                              size="sm"
                              type="button"
                              variant="secondary"
                            >
                              {archiveTeamMutation.isPending ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Archive className="size-4" />
                              )}
                              Archive
                            </Button>
                          </WithTooltip>
                        </div>

                        <form
                          className="grid gap-3 rounded-[14px] bg-[rgb(var(--tabliodb-surface))] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                          onSubmit={selectedTeamForm.handleSubmit(handleUpdateTeam)}
                        >
                          <label className="block text-sm">
                            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                              Name
                            </span>
                            <ControlledInput
                              aria-invalid={Boolean(selectedTeamErrors.name)}
                              control={selectedTeamForm.control}
                              disabled={isTeamMutationPending}
                              name="name"
                            />
                            <FieldError>{selectedTeamErrors.name?.message}</FieldError>
                          </label>
                          <label className="block text-sm">
                            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                              Description
                            </span>
                            <ControlledInput
                              aria-invalid={Boolean(selectedTeamErrors.description)}
                              control={selectedTeamForm.control}
                              disabled={isTeamMutationPending}
                              name="description"
                              placeholder="Optional team context"
                            />
                            <FieldError>{selectedTeamErrors.description?.message}</FieldError>
                          </label>
                          <Button
                            className="self-start sm:mt-6"
                            disabled={isTeamMutationPending}
                            size="sm"
                            type="submit"
                          >
                            {updateTeamMutation.isPending ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Save className="size-4" />
                            )}
                            Save
                          </Button>
                        </form>

                        <div className="grid gap-4 xl:grid-cols-2">
                          <section className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <h5 className="text-sm font-extrabold">Members</h5>
                                <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                                  People inherited by this team
                                </p>
                              </div>
                              <Badge>{selectedTeamMembers.length} loaded</Badge>
                            </div>

                            <form
                              className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
                              onSubmit={teamMemberForm.handleSubmit(handleAddTeamMember)}
                            >
                              <label className="block text-sm">
                                <span className="sr-only">Member email</span>
                                <ControlledInput
                                  aria-invalid={Boolean(teamMemberErrors.email)}
                                  autoComplete="email"
                                  control={teamMemberForm.control}
                                  disabled={isTeamMutationPending}
                                  name="email"
                                  placeholder="teammate@example.com"
                                  type="email"
                                />
                                <FieldError>{teamMemberErrors.email?.message}</FieldError>
                              </label>
                              <Button disabled={isTeamMutationPending} size="sm" type="submit">
                                {addTeamMemberMutation.isPending ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <UserPlus className="size-4" />
                                )}
                                Add
                              </Button>
                            </form>

                            {selectedTeamMembersQuery.isPending ? (
                              <div className="mt-3 flex items-center gap-2 rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] p-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                                <Loader2 className="size-4 animate-spin" />
                                Loading members
                              </div>
                            ) : selectedTeamMembers.length === 0 ? (
                              <div className="mt-3 rounded-[14px] border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-3 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                                No members in this team
                              </div>
                            ) : (
                              <div className="tabliodb-scrollbar mt-3 max-h-64 overflow-y-auto rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))]">
                                <div className="divide-y divide-[rgb(var(--tabliodb-border))]">
                                  {selectedTeamMembers.map((member) => (
                                    <TeamMemberRow
                                      isRemoving={removingTeamMemberUserId === member.userId}
                                      key={member.userId}
                                      member={member}
                                      onRemove={handleRemoveTeamMember}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </section>

                          <section className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <h5 className="text-sm font-extrabold">Project access</h5>
                                <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                                  Grants inherited by team members
                                </p>
                              </div>
                              <Badge>{selectedTeamProjectAccesses.length} loaded</Badge>
                            </div>

                            <form
                              className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_auto]"
                              onSubmit={teamProjectAccessForm.handleSubmit(handleUpsertTeamProjectAccess)}
                            >
                              <label className="block text-sm">
                                <span className="sr-only">Project</span>
                                <ControlledSelect
                                  aria-invalid={Boolean(teamProjectAccessErrors.projectId)}
                                  className={selectClassName}
                                  control={teamProjectAccessForm.control}
                                  disabled={isTeamMutationPending || teamProjectOptionsQuery.isPending}
                                  name="projectId"
                                  options={teamProjectSelectOptions}
                                  placeholder="Select project"
                                />
                                <FieldError>{teamProjectAccessErrors.projectId?.message}</FieldError>
                              </label>
                              <label className="block text-sm">
                                <span className="sr-only">Role</span>
                                <ControlledSelect
                                  aria-invalid={Boolean(teamProjectAccessErrors.role)}
                                  className={selectClassName}
                                  control={teamProjectAccessForm.control}
                                  disabled={isTeamMutationPending}
                                  name="role"
                                  options={teamProjectAccessRoleOptions.map((role) => ({
                                    label: formatProjectRole(role),
                                    value: role,
                                  }))}
                                />
                              </label>
                              <Button disabled={isTeamMutationPending} size="sm" type="submit">
                                {upsertTeamProjectAccessMutation.isPending ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <ShieldCheck className="size-4" />
                                )}
                                Grant
                              </Button>
                            </form>

                            {selectedTeamProjectAccessesQuery.isPending ? (
                              <div className="mt-3 flex items-center gap-2 rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] p-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                                <Loader2 className="size-4 animate-spin" />
                                Loading project access
                              </div>
                            ) : selectedTeamProjectAccesses.length === 0 ? (
                              <div className="mt-3 rounded-[14px] border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-3 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                                No project grants yet
                              </div>
                            ) : (
                              <div className="tabliodb-scrollbar mt-3 max-h-64 overflow-y-auto rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))]">
                                <div className="divide-y divide-[rgb(var(--tabliodb-border))]">
                                  {selectedTeamProjectAccesses.map((access) => (
                                    <TeamProjectAccessRow
                                      access={access}
                                      isRemoving={removingTeamProjectId === access.projectId}
                                      key={access.projectId}
                                      onRemove={handleRemoveTeamProjectAccess}
                                      onRoleChange={handleUpdateTeamProjectAccessRole}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </section>
                        </div>
                      </div>
                    ) : (
                      <div className="grid min-h-96 place-items-center p-6 text-center">
                        <div>
                          <UsersRound className="mx-auto size-8 text-[rgb(var(--tabliodb-primary-text))]" />
                          <h4 className="mt-3 text-sm font-extrabold">Select a team</h4>
                          <p className="mt-1 max-w-sm text-sm font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                            Pick a team to manage members and project grants, or create a new one above.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {teamMutationError || selectedTeamMembersQuery.error || selectedTeamProjectAccessesQuery.error ? (
                <div className="mt-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                  {getErrorMessage(
                    teamMutationError ?? selectedTeamMembersQuery.error ?? selectedTeamProjectAccessesQuery.error,
                  )}
                </div>
              ) : null}
            </section>
          ) : null}

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
                <div className="mt-4 flex items-center gap-2 rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white p-4 text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                  <Loader2 className="size-4 animate-spin" />
                  Loading activity
                </div>
              ) : auditLogsQuery.error ? (
                <div className="mt-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                  {getErrorMessage(auditLogsQuery.error)}
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="mt-4 rounded-2xl border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-4 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                  No activity yet
                </div>
              ) : (
                <div className="tabliodb-scrollbar mt-4 max-h-72 overflow-y-auto rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white">
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
            disabled={updateSettingsMutation.isPending || isWorkspaceMemberMutationPending || isTeamMutationPending}
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
              isTeamMutationPending ||
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
  const canManageProject = hasProjectPermission(project.projectRole, Permission.ProjectUpdate);
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
  const reviewSettingsForm = useForm<ReviewSignalSettingsFormState>({
    defaultValues: getReviewSignalSettingsDefaults(),
    mode: 'onBlur',
    resolver: zodResolver(reviewSignalSettingsFormSchema),
  });
  const { errors } = form.formState;
  const { errors: memberErrors } = memberForm.formState;
  const membersQueryOptions = projectsQueries.members(project.id, projectMemberPageQuery);
  const membersQuery = useQuery({
    ...membersQueryOptions,
    // Member list is only needed while the modal is visible, so opening settings becomes the fetch boundary.
    enabled: open && membersQueryOptions.enabled !== false,
  });
  const projectReviewSettingsQueryOptions = reviewSignalQueries.projectSettings(project.id);
  const projectReviewSettingsQuery = useQuery({
    ...projectReviewSettingsQueryOptions,
    // Review rule defaults hanya dibutuhkan saat settings dibuka, jadi dialog tetap menjadi fetch boundary yang ringan.
    enabled: open && projectReviewSettingsQueryOptions.enabled !== false,
  });
  const members = membersQuery.data?.items ?? [];

  useEffect(() => {
    if (open) {
      // Opening settings always reflects the latest project data from query cache.
      form.reset(getProjectFormDefaults(project));
      memberForm.reset(memberFormDefaults);
      reviewSettingsForm.reset(getReviewSignalSettingsDefaults(projectReviewSettingsQuery.data));
      setConfirmArchive(false);
    }
  }, [form, memberForm, open, project, projectReviewSettingsQuery.data, reviewSettingsForm]);

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
  const updateProjectReviewSettingsMutation = useUpdateProjectReviewSignalSettingsMutation({
    mutationConfig: {
      onSuccess: (settings) => {
        // Response server sudah dinormalisasi, jadi form rule defaults diselaraskan dari payload itu setelah save.
        reviewSettingsForm.reset(getReviewSignalSettingsDefaults(settings));
      },
    },
  });
  const isProjectMutationPending = updateProjectMutation.isPending || archiveProjectMutation.isPending;
  const isMemberMutationPending =
    addProjectMemberMutation.isPending ||
    updateProjectMemberMutation.isPending ||
    removeProjectMemberMutation.isPending;
  const isReviewSettingsMutationPending = updateProjectReviewSettingsMutation.isPending;
  const isReviewSettingsPending = projectReviewSettingsQuery.isFetching || isReviewSettingsMutationPending;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && (isProjectMutationPending || isMemberMutationPending || isReviewSettingsMutationPending)) {
      return;
    }

    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset(getProjectFormDefaults(project));
      memberForm.reset(memberFormDefaults);
      reviewSettingsForm.reset(getReviewSignalSettingsDefaults(projectReviewSettingsQuery.data));
      setConfirmArchive(false);
      updateProjectMutation.reset();
      archiveProjectMutation.reset();
      addProjectMemberMutation.reset();
      updateProjectMemberMutation.reset();
      removeProjectMemberMutation.reset();
      updateProjectReviewSettingsMutation.reset();
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
        role: sdkProjectMemberRoleByValue[values.role],
      },
      projectId: project.id,
    });
  }

  function handleReviewSettingsSubmit(values: ReviewSignalSettingsFormState) {
    updateProjectReviewSettingsMutation.mutate({
      projectId: project.id,
      settings: toReviewSignalSettingsDto(values),
    });
  }

  function handleUpdateMemberRole(member: ProjectMemberDto, role: ProjectRoleValue) {
    if (member.role === role) {
      return;
    }

    updateProjectMemberMutation.mutate({
      body: { role: sdkProjectMemberRoleByValue[role] },
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
        <IconButton icon={Settings} label="Project settings" variant="ghost" />
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
                className="min-h-24 w-full resize-none rounded-2xl border-2 border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 py-2 text-sm font-semibold outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
                control={form.control}
                disabled={isProjectMutationPending}
                name="description"
              />
              <FieldError>{errors.description?.message}</FieldError>
            </label>

            {mutationError ? (
              <div className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                {getErrorMessage(mutationError)}
              </div>
            ) : null}
          </form>

          <section className="border-t-2 border-[rgb(var(--tabliodb-border))] pt-5">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-extrabold">Review rule defaults</h3>
                <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                  Disabled rules become the baseline for every diagram in this project.
                </p>
              </div>
              <Badge variant="blue">{projectReviewSettingsQuery.isPending ? 'Loading' : 'Project'}</Badge>
            </div>
            <form
              className="grid gap-3"
              id="project-review-settings-form"
              onSubmit={reviewSettingsForm.handleSubmit(handleReviewSettingsSubmit)}
            >
              <ReviewSignalSettingsFields
                control={reviewSettingsForm.control}
                disabled={isReviewSettingsPending || !canManageProject}
              />
              {updateProjectReviewSettingsMutation.error ? (
                <div className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                  {getErrorMessage(updateProjectReviewSettingsMutation.error)}
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button
                  disabled={isReviewSettingsPending || !canManageProject}
                  size="sm"
                  type="submit"
                  variant="secondary"
                >
                  {updateProjectReviewSettingsMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save rules
                </Button>
              </div>
            </form>
          </section>

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
              <div className="mt-4 flex items-center gap-2 rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white p-4 text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                <Loader2 className="size-4 animate-spin" />
                Loading members
              </div>
            ) : membersQuery.error ? (
              <div className="mt-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                {getErrorMessage(membersQuery.error)}
              </div>
            ) : members.length === 0 ? (
              <div className="mt-4 rounded-2xl border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-4 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                No project members yet
              </div>
            ) : (
              <div className="tabliodb-scrollbar mt-4 max-h-72 overflow-y-auto rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white">
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
              <div className="mt-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
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
    defaultProjectRole: settings?.defaultProjectRole
      ? toWorkspaceDefaultProjectRole(settings.defaultProjectRole)
      : 'none',
    name: settings?.name ?? project.organizationName,
  };
}

function toOptionalDescription(value: string | undefined): string | undefined {
  const description = value?.trim();
  return description ? description : undefined;
}

function TeamListItem({
  isSelected,
  onSelect,
  team,
}: {
  isSelected: boolean;
  onSelect: (team: TeamResponseDto) => void;
  team: TeamResponseDto;
}) {
  return (
    <button
      className={cn(
        'grid cursor-pointer gap-2 rounded-[14px] border-2 p-3 text-left transition hover:bg-[rgb(var(--tabliodb-selected-surface))]',
        isSelected
          ? 'border-[rgb(var(--tabliodb-primary))] bg-[rgb(var(--tabliodb-selected-surface))]'
          : 'border-transparent bg-white',
      )}
      onClick={() => onSelect(team)}
      type="button"
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{team.name}</span>
        <Badge className="shrink-0" variant={isSelected ? 'green' : 'neutral'}>
          {team.memberCount} users
        </Badge>
      </div>
      <p className="line-clamp-2 min-h-8 wrap-break-word text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
        {team.description || 'No description yet'}
      </p>
      <div className="truncate text-xs font-extrabold text-[rgb(var(--tabliodb-ink-subtle))]">
        {team.projectAccessCount} project grants
      </div>
    </button>
  );
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
      <Badge className="justify-self-start sm:justify-self-end" variant={getAuditLogTone(auditLog.action)}>
        {formatAuditLogAction(auditLog.action)}
      </Badge>
    </article>
  );
}

function TeamMemberRow({
  isRemoving,
  member,
  onRemove,
}: {
  isRemoving: boolean;
  member: TeamMemberDto;
  onRemove: (member: TeamMemberDto) => void;
}) {
  return (
    <article className="grid gap-3 p-3 transition hover:bg-[rgb(var(--tabliodb-surface))] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar className="size-9 rounded-xl text-[11px]" user={member} />
        <div className="min-w-0">
          <h6 className="truncate text-sm font-extrabold">{member.name}</h6>
          <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">{member.email}</p>
        </div>
      </div>
      <WithTooltip content={`Remove ${member.name} from this team`}>
        <Button
          aria-label={`Remove ${member.name} from this team`}
          disabled={isRemoving}
          onClick={() => onRemove(member)}
          size="icon"
          variant="ghost"
        >
          {isRemoving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </Button>
      </WithTooltip>
    </article>
  );
}

function TeamProjectAccessRow({
  access,
  isRemoving,
  onRemove,
  onRoleChange,
}: {
  access: TeamProjectAccessDto;
  isRemoving: boolean;
  onRemove: (access: TeamProjectAccessDto) => void;
  onRoleChange: (access: TeamProjectAccessDto, role: TeamProjectRole) => void;
}) {
  return (
    <article className="grid gap-3 p-3 transition hover:bg-[rgb(var(--tabliodb-surface))] sm:grid-cols-[minmax(0,1fr)_130px_auto] sm:items-center">
      <div className="min-w-0">
        <h6 className="truncate text-sm font-extrabold">{access.projectName}</h6>
        <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">/{access.projectSlug}</p>
      </div>
      <Select
        className={selectClassName}
        disabled={isRemoving}
        onValueChange={(role) => onRoleChange(access, role as TeamProjectRole)}
        options={teamProjectAccessRoleOptions.map((role) => ({
          label: formatProjectRole(role),
          value: role,
        }))}
        value={access.role}
      />
      <WithTooltip content={`Remove ${access.projectName} access from this team`}>
        <Button
          aria-label={`Remove ${access.projectName} access from this team`}
          disabled={isRemoving}
          onClick={() => onRemove(access)}
          size="icon"
          variant="ghost"
        >
          {isRemoving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </Button>
      </WithTooltip>
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
  onRoleChange: (member: ProjectMemberDto, role: ProjectRoleValue) => void;
}) {
  const isBusy = isRemoving || isUpdating;

  return (
    <article className="grid gap-3 p-3 transition hover:bg-[rgb(var(--tabliodb-surface))] sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar className="size-10 rounded-[14px] text-xs" user={member} />
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h4 className="min-w-0 max-w-full truncate text-sm font-extrabold">{member.name}</h4>
            <ProjectRoleBadge role={member.role} />
          </div>
          <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">{member.email}</p>
        </div>
      </div>
      <Select
        className={selectClassName}
        disabled={isBusy}
        onValueChange={(role) => onRoleChange(member, toProjectRoleValue(role as SdkProjectMemberRole))}
        options={projectRoleOptions.map((role) => ({
          label: formatProjectRole(role),
          value: role,
        }))}
        value={member.role}
      />
      <WithTooltip content={`Remove ${member.name} from this project`}>
        <Button
          aria-label={`Remove ${member.name}`}
          disabled={isBusy}
          onClick={() => onRemove(member)}
          size="icon"
          variant="ghost"
        >
          {isRemoving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </Button>
      </WithTooltip>
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
  onRoleChange: (member: OrganizationMemberDto, role: OrganizationRoleValue) => void;
}) {
  const isBusy = isRemoving || isUpdating;

  return (
    <article className="grid gap-3 p-3 transition hover:bg-[rgb(var(--tabliodb-surface))] sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar className="size-10 rounded-[14px] text-xs" user={member} />
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h4 className="min-w-0 max-w-full truncate text-sm font-extrabold">{member.name}</h4>
            <OrganizationRoleBadge role={member.role} />
          </div>
          <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">{member.email}</p>
        </div>
      </div>
      <Select
        className={selectClassName}
        disabled={isBusy}
        onValueChange={(role) => onRoleChange(member, toOrganizationRoleValue(role as SdkOrganizationMemberRole))}
        options={organizationRoleOptions.map((role) => ({
          label: formatOrganizationRole(role),
          value: role,
        }))}
        value={member.role}
      />
      <WithTooltip content={`Remove ${member.name} from this workspace`}>
        <Button
          aria-label={`Remove ${member.name}`}
          disabled={isBusy}
          onClick={() => onRemove(member)}
          size="icon"
          variant="ghost"
        >
          {isRemoving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </Button>
      </WithTooltip>
    </article>
  );
}

function ProjectRoleBadge({ role }: { role: ProjectRoleValue }) {
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

function OrganizationRoleBadge({ role }: { role: OrganizationRoleValue }) {
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

function formatProjectRole(role: ProjectRoleValue): string {
  return {
    [ProjectRole.Commenter]: 'Commenter',
    [ProjectRole.Editor]: 'Editor',
    [ProjectRole.Owner]: 'Owner',
    [ProjectRole.Viewer]: 'Viewer',
  }[role];
}

function formatOrganizationRole(role: OrganizationRoleValue): string {
  return {
    [OrganizationRole.Admin]: 'Admin',
    [OrganizationRole.Guest]: 'Guest',
    [OrganizationRole.Member]: 'Member',
    [OrganizationRole.Owner]: 'Owner',
  }[role];
}

function EditorEmptyAccessState({
  action,
  description,
  icon,
  onRetry,
  title,
}: {
  action?: ReactNode;
  description: string;
  icon: ComponentType<{ className?: string }>;
  onRetry: () => void;
  title: string;
}) {
  return (
    <main className="grid h-screen place-items-center bg-[rgb(var(--tabliodb-surface))] px-6 text-[rgb(var(--tabliodb-ink))]">
      <Surface className="w-full max-w-lg p-5" depth="md">
        <EmptyState
          action={
            action ?? (
              <Button className="gap-2" onClick={onRetry} variant="secondary">
                <RotateCcw className="size-4" />
                Refresh access
              </Button>
            )
          }
          description={description}
          icon={icon}
          title={title}
        />
      </Surface>
    </main>
  );
}

function isOrganizationManager(organization: OrganizationDto): boolean {
  return organization.role === 'owner' || organization.role === 'admin';
}

function hasOrganizationPermission(role: OrganizationRoleValue, permission: Permission): boolean {
  return isGranted({
    current: permissionsForOrganizationRole(role),
    requested: [permission],
  });
}

function hasProjectPermission(role: ProjectRoleValue, permission: Permission): boolean {
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

  if (auditLog.action === 'team.created') {
    return `Created team ${readMetadataString(auditLog.metadata, 'name', 'team')}`;
  }

  if (auditLog.action === 'team.updated') {
    const changes = readMetadataRecord(auditLog.metadata, 'changes');
    const changedFields = Object.keys(changes);
    return changedFields.length > 0 ? `Updated team ${changedFields.join(', ')}` : 'Updated team details';
  }

  if (auditLog.action === 'team.archived') {
    return `Archived team ${readMetadataString(auditLog.metadata, 'name', 'team')}`;
  }

  if (auditLog.action === 'team.member_added') {
    return `Added ${readMetadataString(auditLog.metadata, 'email', 'member')} to ${readMetadataString(
      auditLog.metadata,
      'teamName',
      'team',
    )}`;
  }

  if (auditLog.action === 'team.member_removed') {
    return `Removed ${readMetadataString(auditLog.metadata, 'email', 'member')} from ${readMetadataString(
      auditLog.metadata,
      'teamName',
      'team',
    )}`;
  }

  if (auditLog.action === 'team.project_access_updated') {
    const role = auditLog.metadata.role;
    const teamName = readMetadataString(auditLog.metadata, 'teamName', 'team');
    const projectName = readMetadataString(auditLog.metadata, 'projectName', 'project');

    if (role && typeof role === 'object' && !Array.isArray(role)) {
      return `Changed ${teamName} access to ${projectName} from ${formatProjectRoleValue(
        readMetadataString(role as Record<string, unknown>, 'before', ProjectRole.Viewer),
      )} to ${formatProjectRoleValue(readMetadataString(role as Record<string, unknown>, 'after', ProjectRole.Viewer))}`;
    }

    return `Granted ${teamName} ${formatProjectRoleValue(String(role ?? ProjectRole.Viewer))} on ${projectName}`;
  }

  if (auditLog.action === 'team.project_access_removed') {
    return `Removed ${readMetadataString(auditLog.metadata, 'teamName', 'team')} access from ${readMetadataString(
      auditLog.metadata,
      'projectName',
      'project',
    )}`;
  }

  if (auditLog.action === 'comment.deleted') {
    return readMetadataBoolean(auditLog.metadata, 'deletedByAuthor') ? 'Deleted own comment' : 'Moderated a comment';
  }

  if (auditLog.action === 'comment.edited') {
    return 'Edited a comment';
  }

  if (auditLog.action === 'comment_thread.resolved') {
    return 'Resolved a comment thread';
  }

  if (auditLog.action === 'comment_thread.reopened') {
    return 'Reopened a comment thread';
  }

  if (auditLog.action === 'diagram_review.approved') {
    return 'Approved diagram review';
  }

  if (auditLog.action === 'diagram_review.changes_requested') {
    return 'Requested diagram changes';
  }

  if (auditLog.action === 'diagram_review.commented') {
    return 'Started diagram review discussion';
  }

  if (auditLog.action === 'user.disabled') {
    return `Disabled user ${readMetadataString(auditLog.metadata, 'email', 'user')}`;
  }

  if (auditLog.action === 'user.enabled') {
    return `Enabled user ${readMetadataString(auditLog.metadata, 'email', 'user')}`;
  }

  if (auditLog.action === 'user.password_reset') {
    return `Reset password for ${readMetadataString(auditLog.metadata, 'email', 'user')}`;
  }

  if (auditLog.action === 'user.sessions_revoked') {
    return `Revoked sessions for ${readMetadataString(auditLog.metadata, 'email', 'user')}`;
  }

  return auditLog.action;
}

function formatAuditLogAction(action: string): string {
  return (
    {
      'organization.settings_updated': 'Workspace',
      'organization.member_removed': 'Removed',
      'organization.member_role_updated': 'Role',
      'team.archived': 'Team',
      'team.created': 'Team',
      'team.member_added': 'Team user',
      'team.member_removed': 'Removed',
      'team.project_access_removed': 'Access',
      'team.project_access_updated': 'Access',
      'team.updated': 'Team',
      'comment.deleted': 'Comment',
      'comment.edited': 'Comment',
      'comment_thread.reopened': 'Reopened',
      'comment_thread.resolved': 'Resolved',
      'diagram_review.approved': 'Approved',
      'diagram_review.changes_requested': 'Changes',
      'diagram_review.commented': 'Review',
      'project.archived': 'Archived',
      'project.created': 'Created',
      'project.member_added': 'Member',
      'project.member_removed': 'Removed',
      'project.member_role_updated': 'Role',
      'user.disabled': 'Disabled',
      'user.enabled': 'Enabled',
      'user.password_reset': 'Password',
      'user.sessions_revoked': 'Sessions',
    }[action] ?? 'Audit'
  );
}

function getAuditLogTone(action: string): 'blue' | 'green' | 'neutral' | 'yellow' {
  if (
    action === 'comment_thread.resolved' ||
    action === 'diagram_review.approved' ||
    action === 'project.created' ||
    action === 'project.member_added' ||
    action === 'team.created' ||
    action === 'team.member_added' ||
    action === 'team.project_access_updated' ||
    action === 'user.enabled'
  ) {
    return 'green';
  }

  if (
    action === 'organization.member_removed' ||
    action === 'comment.deleted' ||
    action === 'diagram_review.changes_requested' ||
    action === 'project.archived' ||
    action === 'project.member_removed' ||
    action === 'team.archived' ||
    action === 'team.member_removed' ||
    action === 'team.project_access_removed' ||
    action === 'user.disabled'
  ) {
    return 'yellow';
  }

  if (
    action === 'organization.member_role_updated' ||
    action === 'organization.settings_updated' ||
    action === 'comment.edited' ||
    action === 'comment_thread.reopened' ||
    action === 'diagram_review.commented' ||
    action === 'project.member_role_updated' ||
    action === 'team.updated' ||
    action === 'user.password_reset' ||
    action === 'user.sessions_revoked'
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

function readMetadataBoolean(metadata: Record<string, unknown>, key: string): boolean {
  return metadata[key] === true;
}

function formatProjectRoleValue(role: string): string {
  if (Object.values(ProjectRole).includes(role as ProjectRole)) {
    return formatProjectRole(role as ProjectRoleValue);
  }

  return role;
}

function formatOrganizationRoleValue(role: string): string {
  if (Object.values(OrganizationRole).includes(role as OrganizationRole)) {
    return formatOrganizationRole(role as OrganizationRoleValue);
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

type CurrentAwarenessUser = {
  avatarUrl: string | null;
  cursorColor: string;
  email: string;
  id: string;
  name: string;
};

function createEditorAwarenessState(
  currentUser: CurrentAwarenessUser,
  diagramId: string,
  selectedTarget: EditorCommentTarget | null,
  cursor?: AwarenessState['cursor'],
  commentTyping?: AwarenessState['commentTyping'],
): AwarenessState {
  return {
    commentTyping,
    cursor,
    selection: selectedTarget
      ? {
          targetId: selectedTarget.targetId,
          targetType: selectedTarget.targetType,
        }
      : {
          targetId: diagramId,
          targetType: 'diagram',
        },
    user: {
      avatarUrl: currentUser.avatarUrl,
      cursorColor: currentUser.cursorColor,
      id: currentUser.id,
      name: currentUser.name,
    },
  };
}

function areCommentTypingStatesEqual(
  left: AwarenessState['commentTyping'],
  right: AwarenessState['commentTyping'],
): boolean {
  if (!left || !right) {
    return left === right;
  }

  return (
    left.parentCommentId === right.parentCommentId &&
    left.threadId === right.threadId &&
    left.updatedAt === right.updatedAt
  );
}

function areRemoteAwarenessStatesEqual(left: RemoteAwarenessState[], right: RemoteAwarenessState[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((leftState, index) => {
    const rightState = right[index];

    if (!rightState || leftState.clientId !== rightState.clientId) {
      return false;
    }

    // Awareness state berisi payload kecil; serial comparison menjaga callback realtime tetap idempotent tanpa membuat cache turunan baru.
    return JSON.stringify(leftState.state) === JSON.stringify(rightState.state);
  });
}

function createCollaboratorPresenceList(
  states: RemoteAwarenessState[],
  currentUserId: string | null,
): CollaboratorPresence[] {
  const collaboratorsByUser = new Map<string, CollaboratorPresence>();

  for (const awareness of states) {
    const user = awareness.state.user;

    if (user.id === currentUserId) {
      continue;
    }

    const existing = collaboratorsByUser.get(user.id);

    if (existing) {
      existing.clientIds.push(awareness.clientId);
      existing.cursor = awareness.state.cursor ?? existing.cursor;
      existing.selection = awareness.state.selection ?? existing.selection;
      continue;
    }

    collaboratorsByUser.set(user.id, {
      clientIds: [awareness.clientId],
      cursor: awareness.state.cursor,
      selection: awareness.state.selection,
      user: {
        ...user,
        email: '',
      },
    });
  }

  return Array.from(collaboratorsByUser.values()).sort((left, right) => left.user.name.localeCompare(right.user.name));
}

function createRemoteCanvasCursorList(
  states: RemoteAwarenessState[],
  currentUserId: string | null,
): RemoteCanvasCursor[] {
  const cursorsByUser = new Map<string, RemoteCanvasCursor>();

  for (const awareness of states) {
    const { cursor, user } = awareness.state;

    if (!cursor || user.id === currentUserId) {
      continue;
    }

    const existing = cursorsByUser.get(user.id);

    if (existing) {
      existing.clientIds.push(awareness.clientId);
      // Satu user bisa membuka beberapa tab; posisi terakhir yang aktif dipakai supaya overlay tidak menggambar nama yang sama berkali-kali.
      existing.cursor = cursor;
      continue;
    }

    cursorsByUser.set(user.id, {
      clientIds: [awareness.clientId],
      cursor,
      user,
    });
  }

  return Array.from(cursorsByUser.values()).sort((left, right) => left.user.name.localeCompare(right.user.name));
}

function createRemoteCommentTypingPresenceList(
  states: RemoteAwarenessState[],
  currentUserId: string | null,
): CommentTypingPresence[] {
  const typingByUser = new Map<string, CommentTypingPresence>();

  for (const awareness of states) {
    const { commentTyping, user } = awareness.state;

    if (!commentTyping || user.id === currentUserId) {
      continue;
    }

    const existing = typingByUser.get(user.id);

    if (existing) {
      existing.clientIds.push(awareness.clientId);
      existing.parentCommentId = commentTyping.parentCommentId;
      existing.threadId = commentTyping.threadId;
      existing.updatedAt = Math.max(existing.updatedAt, commentTyping.updatedAt);
      continue;
    }

    typingByUser.set(user.id, {
      clientIds: [awareness.clientId],
      parentCommentId: commentTyping.parentCommentId,
      threadId: commentTyping.threadId,
      updatedAt: commentTyping.updatedAt,
      user,
    });
  }

  return Array.from(typingByUser.values()).sort((left, right) => left.user.name.localeCompare(right.user.name));
}

function AddTableDialog({
  disabled = false,
  onCreate,
  triggerClassName,
  triggerSize = 'sm',
  triggerVariant = 'secondary',
}: {
  disabled?: boolean;
  onCreate: (tableName?: string) => void;
  triggerClassName?: string;
  triggerSize?: 'default' | 'sm' | 'lg';
  triggerVariant?: 'primary' | 'secondary' | 'soft';
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
        <Button
          className={cn('gap-2', triggerClassName)}
          disabled={disabled}
          size={triggerSize}
          variant={triggerVariant}
        >
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

function createTableDocsMarkdown(model: DiagramModel, table: DatabaseTable): string {
  const columns = getTableColumns(model, table.id);
  const indexes = getDocsTableIndexes(model, table);
  const relationships = Object.values(model.relationships).filter(
    (relationship) => relationship.sourceTableId === table.id || relationship.targetTableId === table.id,
  );
  const lines = [
    `# Table: ${table.name}`,
    '',
    `- Schema: ${table.schema ?? 'Main schema'}`,
    `- Columns: ${columns.length}`,
    `- Indexes: ${indexes.length}`,
    `- Relationships: ${relationships.length}`,
  ];

  if (table.comment) {
    lines.push(`- Comment: ${table.comment}`);
  }

  lines.push('', '## Columns', '', '| Name | Type | Nullable | Key | Unique | Default | Comment |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');

  if (columns.length === 0) {
    lines.push('| _No columns_ | - | - | - | - | - | - |');
  } else {
    for (const column of columns) {
      lines.push(
        `| ${[
          escapeMarkdownCell(column.name),
          escapeMarkdownCell(formatColumnType(column.type)),
          column.nullable ? 'Yes' : 'No',
          column.primaryKey ? 'PK' : '-',
          column.unique ? 'Yes' : 'No',
          escapeMarkdownCell(column.defaultValue ?? '-'),
          escapeMarkdownCell(column.comment ?? '-'),
        ].join(' | ')} |`,
      );
    }
  }

  lines.push('', '## Indexes', '');

  if (indexes.length === 0) {
    lines.push('- No indexes');
  } else {
    indexes.forEach((index) => {
      lines.push(`- ${formatTableDocsIndex(model, index)}`);
    });
  }

  lines.push('', '## Relationships', '');

  if (relationships.length === 0) {
    lines.push('- No relationships');
  } else {
    relationships.forEach((relationship) => {
      const sourceTable = model.tables[relationship.sourceTableId];
      const targetTable = model.tables[relationship.targetTableId];
      const sourceColumns = relationship.sourceColumnIds
        .map((columnId) => model.columns[columnId]?.name ?? columnId)
        .join(', ');
      const targetColumns = relationship.targetColumnIds
        .map((columnId) => model.columns[columnId]?.name ?? columnId)
        .join(', ');

      lines.push(
        `- ${sourceTable?.name ?? relationship.sourceTableId}.${sourceColumns || '?'} -> ${targetTable?.name ?? relationship.targetTableId}.${targetColumns || '?'} (${formatRelationshipCardinality(relationship.cardinality)})`,
      );
    });
  }

  return lines.join('\n');
}

function getDocsTableIndexes(model: DiagramModel, table: DatabaseTable): DatabaseIndex[] {
  return table.indexIds.flatMap((indexId) => {
    const index = model.indexes[indexId];

    return index ? [index] : [];
  });
}

function getTableRelationshipCount(model: DiagramModel, tableId: string): number {
  return Object.values(model.relationships).filter(
    (relationship) => relationship.sourceTableId === tableId || relationship.targetTableId === tableId,
  ).length;
}

function formatTableDocsIndex(model: DiagramModel, index: DatabaseIndex): string {
  const columnNames = index.columns.map((column) => model.columns[column.columnId]?.name ?? column.columnId).join(', ');
  const uniquePrefix = index.unique ? 'unique ' : '';
  const methodSuffix = index.method ? ` using ${index.method}` : '';

  return `${index.name}: ${uniquePrefix}(${columnNames || '?'})${methodSuffix}`;
}

function formatRelationshipCardinality(cardinality: DiagramModel['relationships'][string]['cardinality']): string {
  if (cardinality === 'one_to_one') {
    return '1:1';
  }

  if (cardinality === 'many_to_many') {
    return 'N:N';
  }

  return '1:N';
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, '<br />');
}

const reviewSignalTargetTypes = [
  'table',
  'column',
  'relationship',
  'index',
  'enum',
  'check',
  'note',
  'group',
] as const satisfies readonly DiagramEntityKind[];

const reviewSignalSeverities = [
  'info',
  'warning',
  'error',
] as const satisfies readonly DiagramReviewSignal['severity'][];

function mapReviewSignalResponseToDomainSignal(signal: ReviewSignalResponseDto): DiagramReviewSignal[] {
  if (!signal.targetId || !isReviewSignalTargetType(signal.targetType) || !isReviewSignalSeverity(signal.severity)) {
    return [];
  }

  return [
    {
      code: signal.code as DiagramReviewSignal['code'],
      id: signal.id,
      message: signal.message,
      severity: signal.severity,
      target: {
        id: signal.targetId,
        type: signal.targetType,
      },
      title: signal.title,
    },
  ];
}

function isReviewSignalTargetType(value: string): value is DiagramEntityKind {
  return (reviewSignalTargetTypes as readonly string[]).includes(value);
}

function isReviewSignalSeverity(value: string): value is DiagramReviewSignal['severity'] {
  return (reviewSignalSeverities as readonly string[]).includes(value);
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof TabliodbApiError && error.status === 401;
}
