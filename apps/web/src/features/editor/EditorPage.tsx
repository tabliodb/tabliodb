import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyDiagramCommand,
  createDiagramEntityId,
  parseDiagramModel,
  type DiagramEntityKind,
  type DiagramModel,
  type DiagramReviewSignal,
} from '@tabliodb/schema-core';
import {
  Permission,
  isGranted,
  permissionsForOrganizationRole,
  permissionsForProjectRole,
  type OrganizationRoleValue,
  type ProjectRoleValue,
} from '@tabliodb/shared';
import {
  Mode as SdkImportMode,
  Source as SdkImportSource,
  TabliodbApiError,
  type CurrentUserEditorPreferenceDtoOutput,
  type CurrentUserEditorPreferenceUpdateDto,
  type DiagramResponseDtoOutput,
  type OrganizationDtoOutput,
  type ProjectResponseDtoOutput,
  type ReviewSignalResponseDtoOutput,
  type SnapshotResponseDtoOutput,
} from '@tabliodb/sdk';
import type { AwarenessState } from '@tabliodb/shared';
import { Button, IconButton, Surface, toast } from '@tabliodb/ui';
import {
  Building2,
  FileText,
  FolderPlus,
  Plus,
  StickyNote,
  UsersRound,
  RotateCcw,
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
import { Navigate, useNavigate, useParams } from 'react-router';
import { routes } from '@/app/routes';
import type {
  DiagramCollaboration,
  DiagramCollaborationStatus,
  RemoteAwarenessState,
} from '@/features/collaboration/collaboration-client';
import { EmptyState, ErrorState, LoadingState, getErrorMessage } from '@/features/app/RouteStates';
import { authQueries, useLogoutMutation, useUpdateCurrentUserEditorPreferenceMutation } from '@/resources/auth';
import { diagramsQueries, useImportDiagramMutation } from '@/resources/diagrams';
import { organizationsQueries } from '@/resources/organizations';
import { projectsQueries } from '@/resources/projects';
import { notificationQueries } from '@/resources/notifications';
import { commentQueries } from '@/resources/comments';
import { snapshotsQueries, useCreateSnapshotMutation, useRestoreSnapshotMutation } from '@/resources/snapshots';
import { reviewSignalKeys, reviewSignalQueries, useIgnoreReviewSignalMutation } from '@/resources/review-signals';
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
  normalizeEditorDiagramModel,
  shouldKeepLocalDiagramModelOverRealtime,
} from './diagram-model';
import { getCommentTargetTableId } from './comments/comment-targets';
import type { EditorCommentTarget } from './comments/types';
import {
  areCommentTypingStatesEqual,
  areRemoteAwarenessStatesEqual,
  createCollaboratorPresenceList,
  createEditorAwarenessState,
  createRemoteCanvasCursorList,
  createRemoteCommentTypingPresenceList,
  idleCollaborationStatus,
} from './collaboration-awareness';
import { createDiagramModelSignature } from './model-history';
import { AddTableDialog } from './components/AddTableDialog';
import { CommentsDialog } from './components/CommentsDialog';
import { DiagramTablesSidebar } from './components/DiagramTablesSidebar';
import { EditorHeader } from './components/EditorHeader';
import type { NotificationInboxItem } from './components/EditorHeaderMenus';
import {
  EditorConfirmDialog,
  KeyboardShortcutsDialog,
  type EditorConfirmAction,
} from './components/EditorShellDialogs';
import { CreateDiagramDialog, CreateProjectDialog, CreateWorkspaceDialog } from './components/WorkspaceShellDialogs';
import {
  ImportJsonDialog,
  ImportSqlDialog,
  type EditorImportRequest,
  type EditorImportSource,
} from './components/ImportDialogs';
import { SchemaCanvas, type CanvasViewportRect } from './components/SchemaCanvas';
import { SchemaInspector } from './components/SchemaInspector';
import { SnapshotHistoryDialog } from './components/SnapshotHistoryDialog';
import { ShareLinksDialog } from './components/ShareLinksDialog';
import { SqlPreviewDialog } from './components/SqlPreviewDialog';
import { TableDocsDialog } from './components/TableDocsDialog';
import { formatDiagramDialect } from './diagram-formatters';
import { sdkDialectByValue, toDatabaseDialect } from './diagram-sdk-mappers';
import { selectClassName } from './editor-form-styles';
import { copyTextToClipboard } from './export-utils';
import { getSnapshotRealtimeGuard } from './snapshot-realtime-guard';
import { useDiagramExportActions } from './useDiagramExportActions';
import { useEditorModelHistory } from './useEditorModelHistory';
import { getOrganizationSlug, getWorkspaceSlug, useEditorRouteActions } from './useEditorRouteActions';
import { useEditorSelection } from './useEditorSelection';

type CurrentUserEditorPreferenceDto = CurrentUserEditorPreferenceDtoOutput;
type CurrentUserEditorPreferenceUpdateDtoInput = CurrentUserEditorPreferenceUpdateDto;
type DiagramResponseDto = DiagramResponseDtoOutput;
type OrganizationDto = OrganizationDtoOutput;
type ProjectResponseDto = ProjectResponseDtoOutput;
type ReviewSignalResponseDto = ReviewSignalResponseDtoOutput;
type SnapshotResponseDto = SnapshotResponseDtoOutput;

const sdkImportSourceByValue: Record<EditorImportSource, SdkImportSource> = {
  sql: SdkImportSource.Sql,
  tabliodb_json: SdkImportSource.TabliodbJson,
};

const reviewSignalPageQuery = { limit: 50 } as const;
const notificationInboxPageQuery = { limit: 8 } as const;
const emptyNotifications: NotificationInboxItem[] = [];
const emptySnapshots: SnapshotResponseDto[] = [];
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
  const {
    canRedo: canRedoModelChange,
    canUndo: canUndoModelChange,
    redo: redoModelHistory,
    record: recordModelHistory,
    reset: resetModelHistory,
    undo: undoModelHistory,
  } = useEditorModelHistory();
  const persistedDraftSignatureRef = useRef<string | null>(null);
  const loadedSnapshotIdRef = useRef<string | null>(null);
  const canvasViewportRef = useRef<CanvasViewportRect | null>(null);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const {
    applyRemoteSelectionFallback,
    clearSelection,
    commentThreadOpenRequest,
    reconcileModelSelection,
    repairInvalidCommentTarget,
    requestCommentThreadOpen,
    selectedCommentTarget,
    selectedCommentTargetRef,
    selectedTableId,
    selectedTableIdRef,
    selectTable,
    setSelectedCommentTarget,
    setSelectedTableId,
  } = useEditorSelection();
  const editorRouteActions = useEditorRouteActions({
    clearSelection,
    modelRef,
    navigate,
    persistedDraftSignatureRef,
    setModel,
    setProjectSearchTerm,
    snapshotRecoveryModelRef,
  });
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

  const applyRemoteSelectionConflict = useCallback(
    (conflict: NonNullable<ReturnType<typeof createRemoteSelectionConflict>>) => {
      applyRemoteSelectionFallback(conflict.fallbackTarget);

      toast.warning({
        description: conflict.description,
        title: conflict.title,
      });
    },
    [applyRemoteSelectionFallback],
  );

  const handleUndoModelChange = useCallback(() => {
    if (!canEditDiagram) {
      return;
    }

    const nextModel = undoModelHistory(modelRef.current);

    if (!nextModel) {
      return;
    }

    modelRef.current = nextModel;
    snapshotRecoveryModelRef.current = nextModel;
    setModel(nextModel);
    syncModelToCollaboration(nextModel);
    reconcileModelSelection(nextModel);
  }, [canEditDiagram, reconcileModelSelection, syncModelToCollaboration, undoModelHistory]);

  const handleRedoModelChange = useCallback(() => {
    if (!canEditDiagram) {
      return;
    }

    const nextModel = redoModelHistory(modelRef.current);

    if (!nextModel) {
      return;
    }

    modelRef.current = nextModel;
    snapshotRecoveryModelRef.current = nextModel;
    setModel(nextModel);
    syncModelToCollaboration(nextModel);
    reconcileModelSelection(nextModel);
  }, [canEditDiagram, reconcileModelSelection, redoModelHistory, syncModelToCollaboration]);

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
        clearSelection();
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
        clearSelection();
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
        editorRouteActions.goLogin({ replace: true });
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

      recordModelHistory(currentModel, safeNextModel);

      // Keep the latest draft model synchronously available for snapshot clicks that happen immediately after an input blur.
      modelRef.current = safeNextModel;
      snapshotRecoveryModelRef.current = safeNextModel;
      setModel(safeNextModel);
      syncModelToCollaboration(safeNextModel, currentModel);
    },
    [canEditDiagram, recordModelHistory, syncModelToCollaboration],
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

  const handleSelectedTableChange = useCallback(
    (tableId: string | null) => {
      selectTable(tableId);

      if (tableId) {
        // Selecting a table promotes the left sidebar into structure-edit mode, even if the user hid it earlier.
        setLeftSidebarOpen(true);
      }
    },
    [selectTable],
  );

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
        createEditorAwarenessState({
          commentTyping,
          currentUser,
          cursor,
          diagramId: activeDiagram.id,
          selectedTarget: selectedCommentTarget,
        }),
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

  const handleCommentMarkerOpen = useCallback(
    (target: EditorCommentTarget) => {
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
      requestCommentThreadOpen(target);
    },
    [requestCommentThreadOpen, setSelectedCommentTarget, setSelectedTableId],
  );

  const handleNotificationOpen = useCallback(
    (notification: NotificationInboxItem) => {
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
        requestCommentThreadOpen(target);
        return;
      }

      setSelectedTableId(null);
      setSelectedCommentTarget(target);
      setCommentsOpen(false);
      editorRouteActions.goToDiagram(
        {
          diagramId: notification.diagram.id,
          projectId: notification.project.id,
          workspaceSlug: notification.project.organizationSlug || notification.project.organizationId,
        },
        { clearSelection: false },
      );
    },
    [
      activeDiagram?.id,
      activeProject?.id,
      editorRouteActions,
      requestCommentThreadOpen,
      setSelectedCommentTarget,
      setSelectedTableId,
    ],
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
        createEditorAwarenessState({
          commentTyping: latestCommentTypingRef.current,
          currentUser,
          cursor: latestCursorRef.current,
          diagramId: activeDiagram.id,
          selectedTarget: selectedCommentTarget,
        }),
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
    clearSelection();
    resetModelHistory();
  }, [clearSelection, latestSnapshot, resetModelHistory, syncModelToCollaboration]);

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
    clearSelection();
    resetModelHistory();
  }, [activeDiagram, clearSelection, latestSnapshot, resetModelHistory, snapshotsQuery.data, snapshotsQuery.isPending]);

  useEffect(() => {
    if (!model) {
      return;
    }

    repairInvalidCommentTarget(model);
  }, [model, repairInvalidCommentTarget]);

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
    // Table baru langsung menjadi target komentar aktif agar review pertama jatuh ke entity yang baru dibuat.
    selectTable(nextTableId);
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
          clearSelection();
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
              editorRouteActions.goToWorkspace(organization);
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
                editorRouteActions.goToProject(project);
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
                editorRouteActions.goToDiagram({
                  diagramId: diagram.id,
                  projectId: activeProject.id,
                  workspaceSlug: getWorkspaceSlug(activeProject),
                });
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
      <EditorHeader
        activeDiagram={activeDiagram}
        activeOrganization={activeOrganization}
        activeProject={activeProject}
        canCommentDiagram={canCommentDiagram}
        canCreateDiagram={canCreateDiagram}
        canCreateProject={canCreateProject}
        canCreateSnapshot={canCreateSnapshot}
        canEditDiagram={canEditDiagram}
        canManageProject={canManageProject}
        canManageWorkspace={canManageWorkspace}
        canRedoModelChange={canRedoModelChange}
        canUndoModelChange={canUndoModelChange}
        collaborationStatus={collaborationStatus}
        collaborators={collaborators}
        currentDraftPersisted={currentDraftPersisted}
        currentUser={currentUser}
        diagrams={diagrams}
        filteredProjects={filteredProjects}
        importDiagramPending={importDiagramMutation.isPending}
        isExporting={diagramExportActions.isExporting}
        latestSnapshot={latestSnapshot}
        logoutPending={logoutMutation.isPending}
        model={model}
        notificationError={notificationInboxQuery.error}
        notificationHasNextPage={Boolean(notificationInboxQuery.data?.nextCursor)}
        notificationIsLoading={notificationInboxQuery.isPending}
        notifications={inboxNotifications}
        notificationsOpen={notificationsOpen}
        onAdmin={editorRouteActions.goToAdminUsers}
        onCopySql={diagramExportActions.copySql}
        onCreateDiagram={() => setCreateDiagramOpen(true)}
        onCreateProject={() => setCreateProjectOpen(true)}
        onCreateSnapshot={() => handleSaveSnapshot()}
        onCreateWorkspace={() => setCreateWorkspaceOpen(true)}
        onDiagramSelect={(diagram) => {
          editorRouteActions.goToDiagram({
            diagramId: diagram.id,
            projectId: activeProject.id,
            workspaceSlug: getWorkspaceSlug(activeProject),
          });
        }}
        onDiagramUpdated={(diagram) => {
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
        onNotificationOpenChange={setNotificationsOpen}
        onNotificationRetry={() => void notificationInboxQuery.refetch()}
        onNotificationSelect={handleNotificationOpen}
        onOpenComments={() => setCommentsOpen(true)}
        onOpenKeyboardShortcuts={() => setKeyboardShortcutsOpen(true)}
        onOpenProfile={editorRouteActions.goToProfile}
        onOpenShareLinks={() => setShareLinksOpen(true)}
        onOpenSnapshotHistory={() => setSnapshotHistoryOpen(true)}
        onOpenSqlPreview={() => setSqlPreviewOpen(true)}
        onOrganizationSelect={(organization) => {
          editorRouteActions.goToWorkspace(organization, { clearProjectSearch: true });
        }}
        onProjectArchived={() => {
          editorRouteActions.goHome({ replace: true });
        }}
        onProjectSearchChange={setProjectSearchTerm}
        onProjectSelect={(project) => {
          editorRouteActions.goToProject(project);
        }}
        onRedo={handleRedoModelChange}
        onToggleMinimap={() => setMinimapToggleSignal((value) => value + 1)}
        onUndo={handleUndoModelChange}
        onUserLogout={() => logoutMutation.mutate(undefined)}
        openCommentThreadCount={openCommentThreadCount}
        organizations={organizations}
        projectSearchTerm={projectSearchTerm}
        snapshotHistoryLoading={snapshotsQuery.isPending}
        snapshotSavePending={saveSnapshotMutation.isPending}
        unreadNotificationCount={unreadNotificationCount}
      />

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
          setCreateWorkspaceOpen(false);
          editorRouteActions.goToWorkspace(organization, { clearProjectSearch: true });
        }}
        onOpenChange={setCreateWorkspaceOpen}
        open={createWorkspaceOpen}
        trigger={null}
      />

      {canCreateProject ? (
        <CreateProjectDialog
          onCreated={(project) => {
            setCreateProjectOpen(false);
            editorRouteActions.goToProject(project);
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
            setCreateDiagramOpen(false);
            editorRouteActions.goToDiagram({
              diagramId: diagram.id,
              projectId: activeProject.id,
              workspaceSlug: getWorkspaceSlug(activeProject),
            });
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
