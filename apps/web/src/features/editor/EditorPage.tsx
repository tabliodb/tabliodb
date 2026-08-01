import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  diagramReviewRuleDefinitions,
  diagramReviewSignalCodes,
  getDiagramModelIntegrityWarnings,
  getRelationshipColumnPairs,
  parseDiagramModel,
  stringifyDiagramModel,
  type DatabaseDialect,
  type DiagramEntityKind,
  type DiagramModel,
  type DiagramModelIntegrityWarning,
  type DiagramReviewSignalCode,
  type DiagramReviewSignal,
} from '@tabliodb/schema-core';
import { generateDiagramMarkdown } from '@tabliodb/docs';
import { generateDiagramSvg } from '@tabliodb/render';
import { OrganizationRole, Permission, ProjectRole, isGranted, permissionsForProjectRole } from '@tabliodb/shared';
import {
  TabliodbApiError,
  type AuditLogDto,
  type DiagramExportQuery,
  type DiagramExportResponseDto,
  type DiagramImportDto,
  type DiagramResponseDto,
  type OrganizationDto,
  type OrganizationMemberDto,
  type OrganizationSettingsDto,
  type ProjectMemberDto,
  type ProjectResponseDto,
  type CommentResponseDto,
  type CommentTargetType,
  type CommentLexicalDocumentDto,
  type CommentThreadReaderDto,
  type CommentThreadListItemDto,
  type ReviewSignalEffectiveSettingsDto,
  type ReviewSignalResponseDto,
  type ReviewSignalSettingsDto,
} from '@tabliodb/sdk';
import type { AwarenessState } from '@tabliodb/shared';
import {
  generateCreateSchemaSqlWithWarnings,
  parseCreateSchemaSql,
  type SqlGenerationWarning,
  type SqlImportWarning,
} from '@tabliodb/sql';
import {
  Badge,
  Button,
  Checkbox,
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
  FieldError,
  DropdownMenuTrigger,
  IconButton,
  Input,
  Select,
  WithTooltip,
  cn,
} from '@tabliodb/ui';
import {
  Archive,
  Building2,
  Check,
  ChevronsUpDown,
  CircleCheck,
  CircleDot,
  Code2,
  Copy,
  Database,
  Download,
  FileImage,
  FileJson,
  FileText,
  FileUp,
  FileWarning,
  FolderPlus,
  GitBranch,
  History,
  ImageDown,
  Loader2,
  LocateFixed,
  LogOut,
  MessageSquareText,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  Play,
  Plus,
  Save,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from 'react';
import { Controller, useForm, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Navigate, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { routes } from '@/app/routes';
import type { DiagramCollaboration, RemoteAwarenessState } from '@/features/collaboration/collaboration-client';
import { ControlledCheckbox, ControlledInput, ControlledSelect, ControlledTextarea } from '@/features/app/FormControls';
import { ErrorState, LoadingState, getErrorMessage } from '@/features/app/RouteStates';
import { authQueries, useLogoutMutation } from '@/resources/auth';
import {
  defaultDiagramName,
  diagramsQueries,
  useExportDiagramMutation,
  useImportDiagramMutation,
  useUpdateDiagramMutation,
} from '@/resources/diagrams';
import {
  organizationsQueries,
  useRemoveOrganizationMemberMutation,
  useUpdateOrganizationMemberMutation,
  useUpdateOrganizationSettingsMutation,
} from '@/resources/organizations';
import {
  defaultProjectName,
  projectsQueries,
  useAddProjectMemberMutation,
  useArchiveProjectMutation,
  useCreateProjectMutation,
  useRemoveProjectMemberMutation,
  useUpdateProjectMemberMutation,
  useUpdateProjectMutation,
} from '@/resources/projects';
import {
  commentQueries,
  useCreateCommentThreadMutation,
  useDeleteCommentMutation,
  useMarkCommentThreadReadMutation,
  useReplyToCommentThreadMutation,
  useResolveCommentThreadMutation,
  useUnresolveCommentThreadMutation,
  useUpdateCommentMutation,
} from '@/resources/comments';
import { snapshotsQueries, useCreateSnapshotMutation } from '@/resources/snapshots';
import {
  reviewSignalKeys,
  reviewSignalQueries,
  useIgnoreReviewSignalMutation,
  useUpdateDiagramReviewSignalSettingsMutation,
  useUpdateProjectReviewSignalSettingsMutation,
} from '@/resources/review-signals';
import { addTableToDiagramModel, createSeedDiagramModel } from './diagram-model';
import { createEmptyCommentFormBody } from './comment-body';
import { SchemaCanvas, type RemoteCanvasCursor } from './components/SchemaCanvas';
import { SchemaInspector } from './components/SchemaInspector';
import { TableStructureSidebar } from './components/TableStructureSidebar';

const CommentComposer = lazy(() => import('./components/CommentComposer'));

const addTableFormSchema = z.object({
  tableName: z.string().trim().max(64, 'Keep the table name under 64 characters.'),
});

type AddTableFormState = z.infer<typeof addTableFormSchema>;

const importJsonFormSchema = z.object({
  json: z.string().trim().min(1, 'Paste exported Tabliodb JSON or upload a .json file.'),
});

type ImportJsonFormState = z.infer<typeof importJsonFormSchema>;

const diagramDialectOptions = [
  'postgresql',
  'mysql',
  'sqlite',
  'mariadb',
  'sqlserver',
] as const satisfies readonly DatabaseDialect[];

const importSqlFormSchema = z.object({
  dialect: z.enum(diagramDialectOptions),
  sql: z.string().trim().min(1, 'Paste SQL DDL or upload a .sql file.'),
});

type ImportSqlFormState = z.infer<typeof importSqlFormSchema>;

type EditorImportRequest = Pick<DiagramImportDto, 'content' | 'dialect' | 'source'>;

type EditorCommentTarget = {
  targetId: string | null;
  targetType: CommentTargetType;
};

type CommentTargetReference = {
  targetId: string | null;
  targetType: CommentTargetType;
};

type CommentThreadOpenRequest = {
  requestId: number;
  target: EditorCommentTarget;
};

const commentFormSchema = z.object({
  body: z.string().trim().min(1, 'Write a comment first.').max(4000, 'Keep the comment under 4000 characters.'),
  bodyJson: z.custom<CommentLexicalDocumentDto>(),
});

type CommentFormState = z.infer<typeof commentFormSchema>;

type DiagramExportWarningInput = {
  code: string;
  message: string;
  statement?: string;
  target?: {
    id: string;
    type: string;
  };
};

const projectFormSchema = z.object({
  description: z.string().trim().max(240, 'Keep the description under 240 characters.').optional(),
  name: z.string().trim().min(1, 'Project name is required.').max(80, 'Keep the name under 80 characters.'),
});

type ProjectFormState = z.infer<typeof projectFormSchema>;

const diagramSettingsFormSchema = z.object({
  dialect: z.enum(diagramDialectOptions),
  disabledRuleKeys: z.array(z.enum(diagramReviewSignalCodes)),
  name: z.string().trim().min(1, 'Diagram name is required.').max(80, 'Keep the name under 80 characters.'),
});

type DiagramSettingsFormState = z.infer<typeof diagramSettingsFormSchema>;

const reviewSignalSettingsFormSchema = z.object({
  disabledRuleKeys: z.array(z.enum(diagramReviewSignalCodes)),
});

type ReviewSignalSettingsFormState = z.infer<typeof reviewSignalSettingsFormSchema>;

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

const projectRoleOptions = [ProjectRole.Owner, ProjectRole.Editor, ProjectRole.Commenter, ProjectRole.Viewer] as const;
const organizationRoleOptions = [
  OrganizationRole.Owner,
  OrganizationRole.Admin,
  OrganizationRole.Member,
  OrganizationRole.Guest,
] as const;

const projectMemberPageQuery = { limit: 50 } as const;
const reviewSignalPageQuery = { limit: 50 } as const;
const commentThreadPageQuery = { limit: 50 } as const;
const commentReplyPageQuery = { limit: 50 } as const;
const commentTypingFreshnessMs = 8000;
const commentTypingTimeoutMs = 6500;
const workspaceMemberPageQuery = { limit: 50 } as const;
const workspaceAuditLogQuery = { limit: 8 } as const;
const emptyCommentThreads: CommentThreadListItemDto[] = [];
const emptyComments: CommentResponseDto[] = [];
const emptyProjectMembers: ProjectMemberDto[] = [];

const selectClassName =
  'h-[var(--tabliodb-control-md)] w-full cursor-pointer rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 text-[13px] font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-[3px] focus:ring-[rgb(var(--tabliodb-focus-ring))] disabled:cursor-not-allowed disabled:opacity-50';

export function EditorPage() {
  const navigate = useNavigate();
  const params = useParams();
  const queryClient = useQueryClient();
  const [copiedSql, setCopiedSql] = useState(false);
  const [sqlPreviewOpen, setSqlPreviewOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [importJsonOpen, setImportJsonOpen] = useState(false);
  const [importSqlOpen, setImportSqlOpen] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  const [model, setModel] = useState<DiagramModel | null>(null);
  const modelRef = useRef<DiagramModel | null>(null);
  const persistedDraftSignatureRef = useRef<string | null>(null);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedCommentTarget, setSelectedCommentTarget] = useState<EditorCommentTarget | null>(null);
  const [commentThreadOpenRequest, setCommentThreadOpenRequest] = useState<CommentThreadOpenRequest | null>(null);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  // Inspector starts collapsed so the editor opens with more canvas room while keeping the right rail discoverable.
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [remoteAwarenessStates, setRemoteAwarenessStates] = useState<RemoteAwarenessState[]>([]);
  const collaborationRef = useRef<DiagramCollaboration | null>(null);
  const latestCursorRef = useRef<AwarenessState['cursor']>(undefined);
  const latestCommentTypingRef = useRef<AwarenessState['commentTyping']>(undefined);
  const latestAwarenessSentAtRef = useRef(0);
  const commentThreadOpenRequestIdRef = useRef(0);

  const currentUserQuery = useQuery(authQueries.me());
  const organizationsQuery = useQuery(organizationsQueries.list({ limit: 50 }));
  const organizations = organizationsQuery.data?.items ?? [];
  const routeWorkspaceSlug = params.workspaceSlug ?? null;
  const activeOrganization = useMemo(() => {
    if (organizations.length === 0) {
      return null;
    }

    return (
      organizations.find((organization) => matchesWorkspaceRoute(organization, routeWorkspaceSlug)) ??
      organizations[0] ??
      null
    );
  }, [organizations, routeWorkspaceSlug]);

  const projectsQuery = useQuery(projectsQueries.listOrCreateStarter(activeOrganization?.id ?? null));

  const projects = projectsQuery.data ?? [];
  const filteredProjects = useMemo(() => {
    const search = projectSearchTerm.trim().toLowerCase();

    return search
      ? projects.filter((project) =>
          [project.name, project.slug, project.description ?? ''].some((value) => value.toLowerCase().includes(search)),
        )
      : projects;
  }, [projectSearchTerm, projects]);
  const routeProjectId = params.projectId ?? null;
  const routeDiagramId = params.diagramId ?? null;
  const activeProject = projects.find((project) => project.id === routeProjectId) ?? projects[0] ?? null;

  const diagramsQuery = useQuery(diagramsQueries.listOrCreateStarter(activeProject));

  const diagrams = diagramsQuery.data ?? [];
  const activeDiagram = diagrams.find((diagram) => diagram.id === routeDiagramId) ?? diagrams[0] ?? null;
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

  const latestSnapshot = snapshotsQuery.data?.[0] ?? null;
  const commentTargetSummaries = commentSummaryQuery.data?.targets ?? [];
  const openCommentThreadCount = commentSummaryQuery.data?.openCount ?? 0;
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

  const saveSnapshotMutation = useCreateSnapshotMutation({
    mutationConfig: {
      onSuccess: (snapshot) => {
        // Snapshot creation returns the canonical versioned model while live editing remains a separate persistence concern.
        modelRef.current = snapshot.snapshot;
        persistedDraftSignatureRef.current = createDiagramModelSignature(snapshot.snapshot);
        setModel(snapshot.snapshot);
        queryClient.invalidateQueries({ queryKey: reviewSignalKeys.lists() });
      },
    },
  });

  const exportDiagramMutation = useExportDiagramMutation();
  // Ignore dipisahkan dari mutasi snapshot/import karena aksi ini hanya mengubah visibility review signal yang sudah persist di server.
  const ignoreReviewSignalMutation = useIgnoreReviewSignalMutation();
  const importDiagramMutation = useImportDiagramMutation({
    mutationConfig: {
      onSuccess: (response) => {
        const importedModel = parseDiagramModel(response.model);

        // Server import writes the same model into diagram_documents, so this signature marks the local draft as persisted.
        modelRef.current = importedModel;
        persistedDraftSignatureRef.current = createDiagramModelSignature(importedModel);
        setModel(importedModel);
        setSelectedTableId(null);
        setSelectedCommentTarget(null);
        queryClient.invalidateQueries({ queryKey: reviewSignalKeys.lists() });
      },
    },
  });

  const logoutMutation = useLogoutMutation({
    mutationConfig: {
      onSuccess: () => {
        modelRef.current = null;
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

      // Keep the latest draft model synchronously available for snapshot clicks that happen immediately after an input blur.
      modelRef.current = nextModel;
      setModel(nextModel);
    },
    [canEditDiagram],
  );

  const handleSelectedTableChange = useCallback((tableId: string | null) => {
    setSelectedTableId(tableId);
    setSelectedCommentTarget(tableId ? { targetId: tableId, targetType: 'table' } : null);

    if (tableId) {
      // Selecting a table promotes the left sidebar into structure-edit mode, even if the user hid it earlier.
      setLeftSidebarOpen(true);
    }
  }, []);

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

  useEffect(() => {
    if (!activeDiagram || !currentUser) {
      setRemoteAwarenessStates([]);
      latestCommentTypingRef.current = undefined;
      return;
    }

    let disposed = false;
    let collaboration: DiagramCollaboration | null = null;
    let unsubscribe: () => void = () => undefined;

    void import('@/features/collaboration/collaboration-client').then(({ createDiagramCollaboration }) => {
      if (disposed) {
        return;
      }

      // Hocuspocus/Yjs is loaded only after a real diagram is active so the editor route chunk stays focused on first paint.
      collaboration = createDiagramCollaboration({ diagramId: activeDiagram.id });
      collaborationRef.current = collaboration;
      unsubscribe = collaboration.subscribeAwareness((states) => {
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
      unsubscribe();
      collaboration?.destroy();

      if (collaborationRef.current === collaboration) {
        collaborationRef.current = null;
      }

      setRemoteAwarenessStates([]);
      latestCommentTypingRef.current = undefined;
    };
  }, [activeDiagram?.id, currentUser?.avatarUrl, currentUser?.cursorColor, currentUser?.id, currentUser?.name]);

  useEffect(() => {
    publishAwareness();
  }, [publishAwareness]);

  useEffect(() => {
    if (organizations.length === 0 || organizationsQuery.isPending) {
      return;
    }

    if (
      !routeWorkspaceSlug ||
      !organizations.some((organization) => matchesWorkspaceRoute(organization, routeWorkspaceSlug))
    ) {
      const organization = organizations[0];
      navigate(routes.workspace.to({ workspaceSlug: getOrganizationSlug(organization) }), {
        replace: true,
      });
    }
  }, [navigate, organizations, organizationsQuery.isPending, routeWorkspaceSlug]);

  useEffect(() => {
    if (!activeOrganization) {
      return;
    }

    if (projects.length > 0 && (!routeProjectId || !projects.some((project) => project.id === routeProjectId))) {
      const project = projects[0];
      navigate(routes.project.to({ projectId: project.id, workspaceSlug: getOrganizationSlug(activeOrganization) }), {
        replace: true,
      });
    }
  }, [activeOrganization, navigate, projects, routeProjectId]);

  useEffect(() => {
    if (
      activeProject &&
      diagrams.length > 0 &&
      (!routeDiagramId || !diagrams.some((diagram) => diagram.id === routeDiagramId))
    ) {
      const diagram = diagrams[0];
      navigate(
        routes.diagram.to({
          diagramId: diagram.id,
          projectId: activeProject.id,
          workspaceSlug: getWorkspaceSlug(activeProject),
        }),
        { replace: true },
      );
    }
  }, [activeProject, diagrams, navigate, routeDiagramId]);

  useEffect(() => {
    if (!latestSnapshot) {
      return;
    }

    modelRef.current = latestSnapshot.snapshot;
    persistedDraftSignatureRef.current = createDiagramModelSignature(latestSnapshot.snapshot);
    setModel(latestSnapshot.snapshot);
    setSelectedTableId(null);
    setSelectedCommentTarget(null);
  }, [latestSnapshot]);

  useEffect(() => {
    if (!activeDiagram || snapshotsQuery.isPending || snapshotsQuery.data === undefined || latestSnapshot) {
      return;
    }

    // Empty read-only diagrams cannot create an initial snapshot, so the editor renders an unsaved empty model instead of spinning forever.
    const seedModel = createSeedDiagramModel(activeDiagram.name);
    modelRef.current = seedModel;
    persistedDraftSignatureRef.current = null;
    setModel(seedModel);
    setSelectedTableId(null);
    setSelectedCommentTarget(null);
  }, [activeDiagram, latestSnapshot, snapshotsQuery.data, snapshotsQuery.isPending]);

  useEffect(() => {
    if (!model || !selectedCommentTarget || isCommentTargetAvailable(model, selectedCommentTarget)) {
      return;
    }

    // Target komentar mengikuti entity yang benar-benar masih ada, sehingga import/delete tidak meninggalkan anchor stale.
    setSelectedCommentTarget(
      selectedTableId && model.tables[selectedTableId] ? { targetId: selectedTableId, targetType: 'table' } : null,
    );
  }, [model, selectedCommentTarget, selectedTableId]);

  async function handleExportSql() {
    if (!model) {
      return;
    }

    const payload = await resolveDiagramExport(
      {
        dialect: model.dialect,
        format: 'sql',
      },
      () => {
        const generatedSql = generateCreateSchemaSqlWithWarnings(model, { dialect: model.dialect });

        return {
          content: generatedSql.sql,
          filename: `${getExportFileStem()}.${model.dialect}.sql`,
          format: 'sql',
          mediaType: 'application/sql',
          warnings: toDiagramExportWarnings(generatedSql.warnings),
        };
      },
    );

    // Copy SQL selalu memakai payload final, baik dari server maupun fallback lokal saat ada perubahan yang belum tersimpan.
    await navigator.clipboard.writeText(payload.content);
    setCopiedSql(true);
    window.setTimeout(() => setCopiedSql(false), 1600);
  }

  async function handleDownloadSql() {
    if (!model) {
      return;
    }

    const payload = await resolveDiagramExport(
      {
        dialect: model.dialect,
        format: 'sql',
      },
      () => {
        const generatedSql = generateCreateSchemaSqlWithWarnings(model, { dialect: model.dialect });

        return {
          content: generatedSql.sql,
          filename: `${getExportFileStem()}.${model.dialect}.sql`,
          format: 'sql',
          mediaType: 'application/sql',
          warnings: toDiagramExportWarnings(generatedSql.warnings),
        };
      },
    );

    downloadTextFile(payload.filename, payload.content, `${payload.mediaType};charset=utf-8`);
  }

  async function handleExportJson() {
    if (!model) {
      return;
    }

    const payload = await resolveDiagramExport({ format: 'tabliodb_json' }, () => ({
      content: `${stringifyDiagramModel(model)}\n`,
      filename: `${getExportFileStem()}.tabliodb.json`,
      format: 'tabliodb_json',
      mediaType: 'application/json',
      warnings: toDiagramExportWarnings(getDiagramModelIntegrityWarnings(model)),
    }));

    downloadTextFile(payload.filename, payload.content, `${payload.mediaType};charset=utf-8`);
  }

  async function handleExportMarkdown() {
    if (!model) {
      return;
    }

    const payload = await resolveDiagramExport({ format: 'markdown' }, () => ({
      content: generateDiagramMarkdown(model),
      filename: `${getExportFileStem()}.schema.md`,
      format: 'markdown',
      mediaType: 'text/markdown',
      warnings: toDiagramExportWarnings(getDiagramModelIntegrityWarnings(model)),
    }));

    downloadTextFile(payload.filename, payload.content, `${payload.mediaType};charset=utf-8`);
  }

  async function handleExportSvg() {
    if (!model) {
      return;
    }

    const payload = await resolveDiagramExport({ format: 'svg' }, () => ({
      content: generateDiagramSvg(model),
      filename: `${getExportFileStem()}.diagram.svg`,
      format: 'svg',
      mediaType: 'image/svg+xml',
      warnings: toDiagramExportWarnings(getDiagramModelIntegrityWarnings(model)),
    }));

    downloadTextFile(payload.filename, payload.content, `${payload.mediaType};charset=utf-8`);
  }

  async function resolveDiagramExport(
    query: DiagramExportQuery,
    createLocalPayload: () => DiagramExportResponseDto,
  ): Promise<DiagramExportResponseDto> {
    if (model && activeDiagram && isCurrentDraftPersisted(model)) {
      try {
        // Draft yang sudah tersimpan memakai endpoint resmi supaya UI export dan SDK publik berbagi kontrak yang sama.
        return await exportDiagramMutation.mutateAsync({
          diagramId: activeDiagram.id,
          query,
        });
      } catch (error) {
        window.alert(`Server export failed, using the current local draft instead. ${getErrorMessage(error)}`);
      }
    }

    // Draft lokal yang belum tersimpan harus tetap mengekspor persis diagram yang sedang dilihat user di canvas.
    return createLocalPayload();
  }

  function isCurrentDraftPersisted(currentModel: DiagramModel): boolean {
    return persistedDraftSignatureRef.current === createDiagramModelSignature(currentModel);
  }
  async function handleExportPng() {
    if (!model) {
      return;
    }

    try {
      const svg = generateDiagramSvg(model);
      const pngBlob = await createPngBlobFromSvg(svg);

      // PNG dibuat dari SVG yang sama supaya export image punya visual dan bounds yang konsisten.
      downloadBlobFile(`${getExportFileStem()}.diagram.png`, pngBlob);
    } catch (error) {
      console.error(error);
      window.alert('PNG export failed. Please try exporting SVG instead.');
    }
  }

  async function handleImportDraftModel(importRequest: EditorImportRequest) {
    if (!activeDiagram || !canEditDiagram) {
      return;
    }

    // Import melewati backend agar validasi, update diagram_documents, dan bentuk response-nya sama dengan SDK publik.
    await importDiagramMutation.mutateAsync({
      body: {
        ...importRequest,
        mode: 'replace',
      },
      diagramId: activeDiagram.id,
    });
  }

  function getExportFileStem() {
    return createExportFileStem(activeProject?.name, activeDiagram?.name ?? model?.metadata.name);
  }

  function handleAddTable(tableName?: string) {
    if (!canEditDiagram || !model) {
      return;
    }

    const nextModel = addTableToDiagramModel(model, tableName);
    const nextTableId = Object.keys(nextModel.tables).find((tableId) => !model.tables[tableId]) ?? null;

    modelRef.current = nextModel;
    setModel(nextModel);
    setSelectedTableId(nextTableId);
    // Table baru langsung menjadi target komentar aktif agar review pertama jatuh ke entity yang baru dibuat.
    setSelectedCommentTarget(nextTableId ? { targetId: nextTableId, targetType: 'table' } : null);
  }

  function handleSaveSnapshot() {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    window.setTimeout(() => {
      const modelToSave = modelRef.current;

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

  if (!organizationsQuery.isPending && organizations.length === 0) {
    return <ErrorState error={new Error('No workspace found')} onRetry={() => queryClient.invalidateQueries()} />;
  }

  const isLoadingWorkspace =
    currentUserQuery.isPending ||
    organizationsQuery.isPending ||
    Boolean(activeOrganization && projectsQuery.isPending) ||
    Boolean(activeProject && diagramsQuery.isPending) ||
    Boolean(activeDiagram && snapshotsQuery.isPending) ||
    Boolean(activeProject && activeDiagram && !model);

  if (isLoadingWorkspace) {
    return <LoadingState />;
  }

  if (!diagramsQuery.isPending && activeProject && diagrams.length === 0) {
    return (
      <ErrorState
        error={
          new Error(canEditDiagram ? 'No diagram found' : 'No diagram is available for your current project role yet')
        }
        onRetry={() => queryClient.invalidateQueries()}
      />
    );
  }

  if (!currentUser || !activeOrganization || !activeProject || !activeDiagram || !model) {
    return <LoadingState />;
  }

  const selectedTable = selectedTableId ? (model.tables[selectedTableId] ?? null) : null;
  const sqlPreview = generateCreateSchemaSqlWithWarnings(model, { dialect: model.dialect });
  // Expanded sidebars share one comfortable width so table controls do not collapse into cramped rows.
  const expandedSidebarWidth = 'var(--tabliodb-sidebar-width)';
  const collapsedSidebarWidth = '44px';
  const leftSidebarWidth = leftSidebarOpen ? expandedSidebarWidth : collapsedSidebarWidth;
  const rightSidebarWidth = rightSidebarOpen ? expandedSidebarWidth : collapsedSidebarWidth;

  return (
    <main className="flex h-screen flex-col bg-[rgb(var(--tabliodb-surface))] text-[rgb(var(--tabliodb-ink))]">
      <header className="flex h-(--tabliodb-header-height) shrink-0 items-center justify-between border-b border-[rgb(var(--tabliodb-border))] bg-white px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 items-center gap-2">
            <div className="grid size-8 place-items-center rounded-[13px] bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]">
              <Database className="size-4.5" />
            </div>
            <span className="text-[15px] font-extrabold">Tabliodb</span>
          </div>
          <div className="min-w-0 border-l border-[rgb(var(--tabliodb-border))] pl-3">
            <h1 className="truncate text-[14px] font-extrabold leading-5">
              {activeProject?.name ?? defaultProjectName}
            </h1>
            <p className="truncate text-[12px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
              {activeDiagram?.name ?? defaultDiagramName} / {model.dialect} / snapshot v{latestSnapshot?.version ?? 0}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant={canEditDiagram ? 'green' : 'yellow'}>{formatProjectRole(activeProject.projectRole)}</Badge>
          <CollaborationPresence collaborators={collaborators} />
          <div className="relative">
            <IconButton icon={MessageSquareText} label="Comments" onClick={() => setCommentsOpen(true)} />
            {openCommentThreadCount > 0 ? (
              <span className="pointer-events-none absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full border border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky-soft))] px-1 text-[9px] font-extrabold leading-4 text-[rgb(var(--tabliodb-sky-text))] shadow-[0_1px_0_rgb(var(--tabliodb-sky-border))]">
                {openCommentThreadCount > 99 ? '99+' : openCommentThreadCount}
              </span>
            ) : null}
          </div>
          <IconButton disabled icon={History} label="History coming soon" />
          <IconButton disabled icon={GitBranch} label="Branches coming soon" />
          <IconButton icon={LocateFixed} label="Fit diagram" onClick={() => setFitSignal((value) => value + 1)} />
          {activeProject ? (
            <>
              <WorkspaceSettingsDialog organization={activeOrganization} project={activeProject} />
              <ProjectSettingsDialog
                onArchived={() => {
                  modelRef.current = null;
                  persistedDraftSignatureRef.current = null;
                  setModel(null);
                  setSelectedTableId(null);
                  setSelectedCommentTarget(null);
                  navigate(routes.home.to(), { replace: true });
                }}
                project={activeProject}
              />
              <DiagramSettingsDialog
                canEdit={canEditDiagram}
                diagram={activeDiagram}
                model={model}
                onUpdated={(diagram) => {
                  setModel((current) => (current ? updateLiveModelFromDiagram(current, diagram, modelRef) : current));
                }}
              />
            </>
          ) : null}
          <AddTableDialog disabled={!canEditDiagram} onCreate={handleAddTable} />
          <Button
            className="gap-2"
            disabled={saveSnapshotMutation.isPending || !canCreateSnapshot}
            onClick={handleSaveSnapshot}
          >
            {saveSnapshotMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Snapshot
          </Button>
          <Button className="gap-2" onClick={() => setSqlPreviewOpen(true)} variant="sky">
            <Play className="size-4" />
            SQL
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton icon={MoreHorizontal} label="More actions" variant="secondary" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setFitSignal((value) => value + 1)}>
                <LocateFixed className="size-4" />
                Fit diagram
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canEditDiagram || importDiagramMutation.isPending}
                onSelect={() => {
                  importDiagramMutation.reset();
                  setImportJsonOpen(true);
                }}
              >
                <FileUp className="size-4" />
                Import Tabliodb JSON
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canEditDiagram || importDiagramMutation.isPending}
                onSelect={() => {
                  importDiagramMutation.reset();
                  setImportSqlOpen(true);
                }}
              >
                <Code2 className="size-4" />
                Import SQL DDL
              </DropdownMenuItem>
              <DropdownMenuSeparatorItem />
              <DropdownMenuItem disabled={exportDiagramMutation.isPending} onSelect={() => void handleExportSql()}>
                <Copy className="size-4" />
                Copy SQL
              </DropdownMenuItem>
              <DropdownMenuItem disabled={exportDiagramMutation.isPending} onSelect={() => void handleDownloadSql()}>
                <Download className="size-4" />
                Download SQL
              </DropdownMenuItem>
              <DropdownMenuItem disabled={exportDiagramMutation.isPending} onSelect={() => void handleExportJson()}>
                <FileJson className="size-4" />
                Export Tabliodb JSON
              </DropdownMenuItem>
              <DropdownMenuItem disabled={exportDiagramMutation.isPending} onSelect={() => void handleExportMarkdown()}>
                <FileText className="size-4" />
                Export Markdown docs
              </DropdownMenuItem>
              <DropdownMenuItem disabled={exportDiagramMutation.isPending} onSelect={() => void handleExportSvg()}>
                <FileImage className="size-4" />
                Export SVG diagram
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleExportPng()}>
                <ImageDown className="size-4" />
                Export PNG diagram
              </DropdownMenuItem>
              <DropdownMenuSeparatorItem />
              <DropdownMenuItem disabled>
                <Share2 className="size-4" />
                Share workspace coming soon
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate(routes.profile.to())}>
                <UserRound className="size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate(routes.adminUsers.to())}>
                <ShieldCheck className="size-4" />
                Admin users
              </DropdownMenuItem>
              <DropdownMenuSeparatorItem />
              <DropdownMenuItem disabled={logoutMutation.isPending} onSelect={() => logoutMutation.mutate(undefined)}>
                <LogOut className="size-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <SqlPreviewDialog
        copied={copiedSql}
        dialect={model.dialect}
        onCopy={() => void handleExportSql()}
        onDownload={() => void handleDownloadSql()}
        onOpenChange={setSqlPreviewOpen}
        open={sqlPreviewOpen}
        sql={sqlPreview.sql}
        warnings={sqlPreview.warnings}
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

      <div
        className="grid min-h-0 flex-1 transition-[grid-template-columns] duration-200"
        style={{ gridTemplateColumns: `${leftSidebarWidth} minmax(0,1fr) ${rightSidebarWidth}` }}
      >
        <aside className="relative min-w-0 overflow-hidden border-r border-[rgb(var(--tabliodb-border))] bg-white">
          {!leftSidebarOpen ? (
            <SidebarRail
              icon={PanelLeftOpen}
              label="Show left sidebar"
              onClick={() => setLeftSidebarOpen(true)}
              side="left"
            />
          ) : selectedTable ? (
            <TableStructureSidebar
              model={model}
              onClearTableSelection={() => handleSelectedTableChange(null)}
              onHide={() => setLeftSidebarOpen(false)}
              onColumnSelect={(columnId) => setSelectedCommentTarget({ targetId: columnId, targetType: 'column' })}
              onModelChange={handleModelChange}
              readOnly={!canEditDiagram}
              selectedTableId={selectedTable.id}
            />
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex h-(--tabliodb-header-height) shrink-0 items-center gap-3 border-b border-[rgb(var(--tabliodb-border))] px-4">
                <div className="grid size-8 place-items-center rounded-[13px] bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]">
                  <Database className="size-4" />
                </div>
                <span className="min-w-0 flex-1 truncate text-[14px] font-extrabold">Workspace</span>
                <IconButton icon={PanelLeftClose} label="Hide left sidebar" onClick={() => setLeftSidebarOpen(false)} />
              </div>
              <div className="tabliodb-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
                <WorkspaceSwitcher
                  activeOrganization={activeOrganization}
                  onSelect={(organization) => {
                    modelRef.current = null;
                    persistedDraftSignatureRef.current = null;
                    setModel(null);
                    setSelectedTableId(null);
                    setSelectedCommentTarget(null);
                    setProjectSearchTerm('');
                    navigate(routes.workspace.to({ workspaceSlug: getOrganizationSlug(organization) }));
                  }}
                  organizations={organizations}
                />
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                    Projects
                  </span>
                  <CreateProjectDialog
                    organizationId={activeOrganization?.id ?? null}
                    onCreated={(project) => {
                      modelRef.current = null;
                      persistedDraftSignatureRef.current = null;
                      setModel(null);
                      setSelectedTableId(null);
                      setSelectedCommentTarget(null);
                      navigate(routes.project.to({ projectId: project.id, workspaceSlug: getWorkspaceSlug(project) }));
                    }}
                  />
                </div>
                <div className="relative mb-4">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--tabliodb-ink-subtle))]" />
                  <Input
                    className="pl-9"
                    onChange={(event) => setProjectSearchTerm(event.target.value)}
                    placeholder="Search projects"
                    value={projectSearchTerm}
                  />
                </div>
                {filteredProjects.length === 0 ? (
                  <div className="rounded-(--tabliodb-radius-md) border border-dashed border-[rgb(var(--tabliodb-border))] p-3 text-center text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                    No matching projects
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredProjects.map((project) => (
                      <button
                        className={`flex w-full cursor-pointer items-center justify-between rounded-(--tabliodb-radius-md) border px-3 py-2 text-left text-[13px] font-bold transition ${
                          project.id === activeProject?.id
                            ? 'border-[rgb(var(--tabliodb-primary))] bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))] shadow-[0_2px_0_rgb(var(--tabliodb-primary-border))]'
                            : 'border-transparent text-[rgb(var(--tabliodb-ink-muted))] hover:border-[rgb(var(--tabliodb-border))] hover:bg-[rgb(var(--tabliodb-surface))]'
                        }`}
                        key={project.id}
                        onClick={() => {
                          modelRef.current = null;
                          persistedDraftSignatureRef.current = null;
                          setModel(null);
                          setSelectedTableId(null);
                          setSelectedCommentTarget(null);
                          navigate(
                            routes.project.to({ projectId: project.id, workspaceSlug: getWorkspaceSlug(project) }),
                          );
                        }}
                        type="button"
                      >
                        <span className="min-w-0 truncate">{project.name}</span>
                        <span className="text-xs opacity-70">{project.slug}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>

        <section className="flex min-h-0 min-w-0">
          <SchemaCanvas
            commentTargetSummaries={commentTargetSummaries}
            fitKey={activeDiagram?.id ?? 'empty'}
            fitSignal={fitSignal}
            model={model}
            onCommentTargetOpen={handleCommentMarkerOpen}
            onLocalCursorChange={handleCanvasCursorChange}
            onModelChange={handleModelChange}
            onSelectedTableChange={handleSelectedTableChange}
            readOnly={!canEditDiagram}
            remoteCursors={remoteCanvasCursors}
            selectedTableId={selectedTableId}
          />
        </section>

        {rightSidebarOpen ? (
          <SchemaInspector
            // Tombol ignore hanya aktif untuk signal server-backed; draft lokal tetap menampilkan lint langsung supaya user tidak bisa ignore state yang belum tersimpan.
            canIgnoreReviewSignals={canEditDiagram && persistedReviewSignals !== null}
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
        ) : (
          <aside className="min-w-0 overflow-hidden border-l border-[rgb(var(--tabliodb-border))] bg-white">
            <SidebarRail
              icon={PanelRightOpen}
              label="Show inspector"
              onClick={() => setRightSidebarOpen(true)}
              side="right"
            />
          </aside>
        )}
      </div>
    </main>
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

function updateLiveModelFromDiagram(
  currentModel: DiagramModel,
  diagram: DiagramResponseDto,
  modelRef: { current: DiagramModel | null },
): DiagramModel {
  const nextModel = {
    ...currentModel,
    dialect: diagram.dialect,
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

function CommentsDialog({
  canComment,
  canModerateComments,
  currentUserId,
  diagramId,
  model,
  onCommentTargetSelect,
  onFocusTable,
  onOpenChange,
  onTypingChange,
  open,
  openRequest,
  projectId,
  remoteTypingPresences,
  selectedCommentTarget,
  selectedTableId,
}: {
  canComment: boolean;
  canModerateComments: boolean;
  currentUserId: string;
  diagramId: string;
  model: DiagramModel;
  onCommentTargetSelect: (target: EditorCommentTarget) => void;
  onFocusTable: (tableId: string | null) => void;
  onOpenChange: (open: boolean) => void;
  onTypingChange: (typing: AwarenessState['commentTyping']) => void;
  open: boolean;
  openRequest: CommentThreadOpenRequest | null;
  projectId: string;
  remoteTypingPresences: CommentTypingPresence[];
  selectedCommentTarget: EditorCommentTarget | null;
  selectedTableId: string | null;
}) {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [deleteConfirmCommentId, setDeleteConfirmCommentId] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<CommentResponseDto | null>(null);
  const [replyParentComment, setReplyParentComment] = useState<CommentResponseDto | null>(null);
  const [typingTick, setTypingTick] = useState(0);
  const typingStopTimeoutRef = useRef<number | null>(null);
  const localCommentTypingRef = useRef<AwarenessState['commentTyping']>(undefined);
  const lastMarkedReadSignatureRef = useRef<string | null>(null);
  const handledOpenRequestIdRef = useRef<number | null>(null);
  const createForm = useForm<CommentFormState>({
    defaultValues: createEmptyCommentFormBody(),
    mode: 'onBlur',
    resolver: zodResolver(commentFormSchema),
  });
  const replyForm = useForm<CommentFormState>({
    defaultValues: createEmptyCommentFormBody(),
    mode: 'onBlur',
    resolver: zodResolver(commentFormSchema),
  });
  const editForm = useForm<CommentFormState>({
    defaultValues: createEmptyCommentFormBody(),
    mode: 'onBlur',
    resolver: zodResolver(commentFormSchema),
  });
  const activeTarget = useMemo(
    () => getActiveCommentTarget(model, selectedTableId, selectedCommentTarget),
    [model, selectedCommentTarget, selectedTableId],
  );
  const threadQueryOptions = commentQueries.listThreads(diagramId, commentThreadPageQuery);
  const threadsQuery = useQuery({
    ...threadQueryOptions,
    // Comments panel menjadi fetch boundary supaya editor awal tidak membawa traffic diskusi ketika user belum membukanya.
    enabled: open && threadQueryOptions.enabled !== false,
  });
  const threads = threadsQuery.data?.items ?? emptyCommentThreads;
  const activeThread = activeThreadId ? (threads.find((thread) => thread.id === activeThreadId) ?? null) : null;
  const threadCommentsQueryOptions = commentQueries.listThreadComments(activeThreadId ?? '', commentReplyPageQuery);
  const threadCommentsQuery = useQuery({
    ...threadCommentsQueryOptions,
    enabled: open && Boolean(activeThreadId) && threadCommentsQueryOptions.enabled !== false,
  });
  const threadReadStateQueryOptions = commentQueries.readState(activeThread?.id ?? '');
  const threadReadStateQuery = useQuery({
    ...threadReadStateQueryOptions,
    // Read receipt hanya diambil untuk thread yang sedang dibuka agar dialog tidak melakukan request tambahan untuk semua thread.
    enabled: open && Boolean(activeThread) && threadReadStateQueryOptions.enabled !== false,
  });
  const mentionMembersQueryOptions = projectsQueries.members(projectId, projectMemberPageQuery);
  const mentionMembersQuery = useQuery({
    ...mentionMembersQueryOptions,
    // Mention suggestions memakai project members dan baru dibutuhkan ketika dialog komentar dibuka.
    enabled: open && mentionMembersQueryOptions.enabled !== false,
  });
  const comments = threadCommentsQuery.data?.items ?? emptyComments;
  const commentTree = useMemo(() => createCommentTree(comments), [comments]);
  const visibleTypingPresences = useMemo(
    () => getFreshCommentTypingPresences(remoteTypingPresences, typingTick),
    [remoteTypingPresences, typingTick],
  );
  const typingPresencesByThreadId = useMemo(
    () => groupTypingPresencesByThreadId(visibleTypingPresences),
    [visibleTypingPresences],
  );
  const activeThreadTypingPresences = activeThreadId ? (typingPresencesByThreadId.get(activeThreadId) ?? []) : [];
  const mentionUsers = mentionMembersQuery.data?.items ?? emptyProjectMembers;
  const createThreadMutation = useCreateCommentThreadMutation();
  const deleteCommentMutation = useDeleteCommentMutation();
  const replyMutation = useReplyToCommentThreadMutation();
  const resolveThreadMutation = useResolveCommentThreadMutation();
  const unresolveThreadMutation = useUnresolveCommentThreadMutation();
  const markThreadReadMutation = useMarkCommentThreadReadMutation();
  const updateCommentMutation = useUpdateCommentMutation();
  const isMutationPending =
    createThreadMutation.isPending ||
    deleteCommentMutation.isPending ||
    replyMutation.isPending ||
    resolveThreadMutation.isPending ||
    unresolveThreadMutation.isPending ||
    updateCommentMutation.isPending;

  useEffect(() => {
    if (!open) {
      setActiveThreadId(null);
      handledOpenRequestIdRef.current = null;
      stopCommentTyping();
      return;
    }

    if (activeThreadId && !threads.some((thread) => thread.id === activeThreadId)) {
      setActiveThreadId(null);
    }
  }, [activeThreadId, open, threads]);

  useEffect(() => {
    if (!open || !openRequest || threadsQuery.isPending || threadsQuery.error) {
      return;
    }

    if (handledOpenRequestIdRef.current === openRequest.requestId) {
      return;
    }

    handledOpenRequestIdRef.current = openRequest.requestId;
    const matchingThread = findCommentThreadForTarget(model, threads, openRequest.target);

    if (!matchingThread) {
      setActiveThreadId(null);
      return;
    }

    handleThreadSelect(matchingThread);
  }, [model, open, openRequest, threads, threadsQuery.error, threadsQuery.isPending]);

  useEffect(() => {
    lastMarkedReadSignatureRef.current = null;
  }, [activeThreadId, open]);

  useEffect(() => {
    if (
      !open ||
      !activeThread ||
      threadCommentsQuery.isPending ||
      threadCommentsQuery.error ||
      markThreadReadMutation.isPending
    ) {
      return;
    }

    const readSignature = `${activeThread.id}:${activeThread.updatedAt}:${
      threadCommentsQuery.data?.totalCount ?? comments.length
    }`;

    if (lastMarkedReadSignatureRef.current === readSignature) {
      return;
    }

    lastMarkedReadSignatureRef.current = readSignature;
    markThreadReadMutation.mutate(activeThread.id);
  }, [
    activeThread,
    comments.length,
    markThreadReadMutation,
    open,
    threadCommentsQuery.data?.totalCount,
    threadCommentsQuery.error,
    threadCommentsQuery.isPending,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const intervalId = window.setInterval(() => setTypingTick((value) => value + 1), 2000);

    return () => window.clearInterval(intervalId);
  }, [open]);

  useEffect(() => {
    // Parent reply selalu scoped ke thread aktif; pindah thread menghapus quote preview agar payload tidak mengarah ke thread lama.
    stopCommentTyping();
    setEditingComment(null);
    setDeleteConfirmCommentId(null);
    setReplyParentComment(null);
    editForm.reset(createEmptyCommentFormBody());
    replyForm.reset(createEmptyCommentFormBody());
  }, [activeThreadId, editForm, replyForm]);

  useEffect(() => {
    return () => {
      stopCommentTyping();
    };
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isMutationPending) {
      return;
    }

    onOpenChange(nextOpen);

    if (!nextOpen) {
      createForm.reset(createEmptyCommentFormBody());
      editForm.reset(createEmptyCommentFormBody());
      replyForm.reset(createEmptyCommentFormBody());
      setDeleteConfirmCommentId(null);
      setEditingComment(null);
      setReplyParentComment(null);
      stopCommentTyping();
      createThreadMutation.reset();
      deleteCommentMutation.reset();
      replyMutation.reset();
      resolveThreadMutation.reset();
      unresolveThreadMutation.reset();
      updateCommentMutation.reset();
    }
  }

  function handleCreateThread(values: CommentFormState) {
    if (!canComment) {
      return;
    }

    createThreadMutation.mutate(
      {
        body: {
          bodyJson: values.bodyJson,
          diagramId,
          targetId: activeTarget.targetId,
          targetType: activeTarget.targetType,
        },
      },
      {
        onSuccess: (response) => {
          setActiveThreadId(response.thread.id);
          createForm.reset(createEmptyCommentFormBody());
        },
      },
    );
  }

  function handleReply(values: CommentFormState) {
    if (!canComment || !activeThread) {
      return;
    }

    replyMutation.mutate(
      {
        body: {
          bodyJson: values.bodyJson,
          parentCommentId: replyParentComment?.id ?? null,
        },
        threadId: activeThread.id,
      },
      {
        onSuccess: () => {
          replyForm.reset(createEmptyCommentFormBody());
          setReplyParentComment(null);
          stopCommentTyping();
        },
      },
    );
  }

  function handleReplyTargetSelect(comment: CommentResponseDto) {
    if (!canComment) {
      return;
    }

    setEditingComment(null);
    setDeleteConfirmCommentId(null);
    editForm.reset(createEmptyCommentFormBody());

    if (replyParentComment?.id !== comment.id) {
      replyForm.reset(createEmptyCommentFormBody());
      replyMutation.reset();
    }

    stopCommentTyping();
    setReplyParentComment(comment);
  }

  function handleEditTargetSelect(comment: CommentResponseDto) {
    if (!canComment || comment.deletedAt || comment.createdById !== currentUserId) {
      return;
    }

    stopCommentTyping();
    setReplyParentComment(null);
    setDeleteConfirmCommentId(null);
    replyForm.reset(createEmptyCommentFormBody());
    replyMutation.reset();
    updateCommentMutation.reset();
    editForm.reset({
      body: comment.body,
      bodyJson: comment.bodyJson,
    });
    setEditingComment(comment);
  }

  function handleEditCancel() {
    editForm.reset(createEmptyCommentFormBody());
    updateCommentMutation.reset();
    setEditingComment(null);
  }

  function handleDeleteTargetSelect(comment: CommentResponseDto) {
    if (!canComment || comment.deletedAt || (comment.createdById !== currentUserId && !canModerateComments)) {
      return;
    }

    setEditingComment(null);
    setReplyParentComment(null);
    editForm.reset(createEmptyCommentFormBody());
    replyForm.reset(createEmptyCommentFormBody());
    replyMutation.reset();
    deleteCommentMutation.reset();
    stopCommentTyping();
    setDeleteConfirmCommentId(comment.id);
  }

  function handleDeleteCancel() {
    deleteCommentMutation.reset();
    setDeleteConfirmCommentId(null);
  }

  function handleDeleteConfirm(comment: CommentResponseDto) {
    if (!canComment || comment.deletedAt || deleteCommentMutation.isPending) {
      return;
    }

    deleteCommentMutation.mutate(comment.id, {
      onSuccess: () => {
        setDeleteConfirmCommentId(null);
      },
    });
  }

  function handleEditComment(values: CommentFormState) {
    if (!canComment || !editingComment) {
      return;
    }

    updateCommentMutation.mutate(
      {
        body: {
          bodyJson: values.bodyJson,
        },
        commentId: editingComment.id,
      },
      {
        onSuccess: () => {
          editForm.reset(createEmptyCommentFormBody());
          setEditingComment(null);
        },
      },
    );
  }

  function handleInlineReplyCancel() {
    replyForm.reset(createEmptyCommentFormBody());
    replyMutation.reset();
    setReplyParentComment(null);
    stopCommentTyping();
  }

  function handleToggleResolved() {
    if (!activeThread || !canComment) {
      return;
    }

    if (activeThread.status === 'resolved') {
      unresolveThreadMutation.mutate(activeThread.id);
      return;
    }

    resolveThreadMutation.mutate(activeThread.id);
  }

  function handleThreadSelect(thread: CommentThreadListItemDto) {
    setActiveThreadId(thread.id);
    stopCommentTyping();
    setReplyParentComment(null);
    focusCommentTarget(model, thread, onFocusTable);
    // Fokus canvas dapat memilih table induk; target komentar dipasang setelahnya agar anchor detail tidak tertimpa fallback table.
    onCommentTargetSelect({ targetId: thread.targetId, targetType: thread.targetType });
  }

  function handleReplyComposerChange(
    value: string,
    bodyJson: CommentLexicalDocumentDto,
    onChange: (value: string) => void,
  ) {
    onChange(value);
    replyForm.setValue('bodyJson', bodyJson, { shouldDirty: true });

    if (!activeThread || !canComment || replyMutation.isPending || value.trim().length === 0) {
      stopCommentTyping();
      return;
    }

    publishCommentTyping(activeThread.id, replyParentComment?.id ?? null);
  }

  function handleReplyComposerBlur(onBlur?: () => void) {
    onBlur?.();
    stopCommentTyping();
  }

  function publishCommentTyping(threadId: string, parentCommentId: string | null) {
    clearTypingStopTimeout();
    const nextTyping = {
      parentCommentId,
      threadId,
      updatedAt: Date.now(),
    };

    localCommentTypingRef.current = nextTyping;
    onTypingChange(nextTyping);
    // Typing presence should disappear even if the user stops moving focus without submitting.
    typingStopTimeoutRef.current = window.setTimeout(() => {
      localCommentTypingRef.current = undefined;
      onTypingChange(undefined);
      typingStopTimeoutRef.current = null;
    }, commentTypingTimeoutMs);
  }

  function stopCommentTyping() {
    clearTypingStopTimeout();

    if (localCommentTypingRef.current === undefined) {
      return;
    }

    localCommentTypingRef.current = undefined;
    onTypingChange(undefined);
  }

  function clearTypingStopTimeout() {
    if (typingStopTimeoutRef.current !== null) {
      window.clearTimeout(typingStopTimeoutRef.current);
      typingStopTimeoutRef.current = null;
    }
  }

  const mutationError =
    createThreadMutation.error ?? replyMutation.error ?? resolveThreadMutation.error ?? unresolveThreadMutation.error;
  const activeThreadTargetLabel = activeThread ? getCommentThreadTargetLabel(model, activeThread) : null;
  const readReceiptText = formatReadReceiptText(
    getVisibleThreadReaders(threadReadStateQuery.data?.readers ?? [], currentUserId),
    getVisibleThreadReaderCount(
      threadReadStateQuery.data?.readers ?? [],
      threadReadStateQuery.data?.totalReaderCount ?? 0,
      currentUserId,
    ),
  );
  const replyPlaceholder = activeThread
    ? canComment
      ? replyParentComment
        ? `Reply to ${replyParentComment.author.name} with @teammate`
        : 'Reply with @teammate'
      : 'Your role can read this thread only'
    : 'Select a thread before replying';

  function renderInlineReplyComposer(comment: CommentResponseDto): ReactNode {
    if (replyParentComment?.id !== comment.id) {
      return null;
    }

    return (
      <form
        className="mt-1 rounded-(--tabliodb-radius-md) border-2 border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky-soft))] p-2"
        onSubmit={replyForm.handleSubmit(handleReply)}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0 text-xs font-extrabold text-[rgb(var(--tabliodb-sky-text))]">
            Replying to {comment.author.name}
          </div>
          <button
            className="shrink-0 cursor-pointer rounded-full px-2 py-1 text-xs font-extrabold text-[rgb(var(--tabliodb-sky-text))] hover:bg-white/70"
            onClick={handleInlineReplyCancel}
            type="button"
          >
            Cancel
          </button>
        </div>
        <div className="mb-2 flex gap-2 rounded-(--tabliodb-radius-sm) border border-[rgb(var(--tabliodb-sky-border))] bg-white/75 px-2.5 py-2">
          <MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-[rgb(var(--tabliodb-sky-text))]" />
          <div className="min-w-0">
            <div className="truncate text-[11px] font-extrabold text-[rgb(var(--tabliodb-sky-text))]">
              {comment.author.name}
            </div>
            <p className="line-clamp-2 whitespace-pre-wrap wrap-break-word text-xs font-semibold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
              {getCommentQuotePreview(comment)}
            </p>
          </div>
        </div>
        <Controller
          control={replyForm.control}
          name="body"
          render={({ field }) => (
            <Suspense
              fallback={
                <CommentComposerFallback
                  density="compact"
                  invalid={Boolean(replyForm.formState.errors.body)}
                  placeholder={replyPlaceholder}
                />
              }
            >
              <CommentComposer
                aria-invalid={Boolean(replyForm.formState.errors.body)}
                density="compact"
                disabled={!activeThread || !canComment || replyMutation.isPending}
                mentionUsers={mentionUsers}
                onBlur={() => handleReplyComposerBlur(field.onBlur)}
                onChange={(value, bodyJson) => handleReplyComposerChange(value, bodyJson, field.onChange)}
                placeholder={replyPlaceholder}
                value={field.value}
              />
            </Suspense>
          )}
        />
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-h-5">
            <FieldError>{replyForm.formState.errors.body?.message}</FieldError>
            {mutationError ? <FieldError>{getErrorMessage(mutationError)}</FieldError> : null}
          </div>
          <Button disabled={!activeThread || !canComment || replyMutation.isPending} size="sm" type="submit">
            {replyMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MessageSquareText className="size-4" />
            )}
            Reply
          </Button>
        </div>
      </form>
    );
  }

  function renderInlineEditComposer(comment: CommentResponseDto): ReactNode {
    if (editingComment?.id !== comment.id) {
      return null;
    }

    return (
      <form
        className="mt-2 rounded-(--tabliodb-radius-md) border-2 border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] p-2"
        onSubmit={editForm.handleSubmit(handleEditComment)}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0 text-xs font-extrabold text-[rgb(var(--tabliodb-primary-text))]">Editing comment</div>
          <button
            className="shrink-0 cursor-pointer rounded-full px-2 py-1 text-xs font-extrabold text-[rgb(var(--tabliodb-primary-text))] hover:bg-white/70"
            onClick={handleEditCancel}
            type="button"
          >
            Cancel
          </button>
        </div>
        <Controller
          control={editForm.control}
          name="body"
          render={({ field }) => (
            <Suspense
              fallback={
                <CommentComposerFallback
                  density="compact"
                  invalid={Boolean(editForm.formState.errors.body)}
                  placeholder="Update your comment"
                />
              }
            >
              <CommentComposer
                aria-invalid={Boolean(editForm.formState.errors.body)}
                density="compact"
                disabled={updateCommentMutation.isPending}
                mentionUsers={mentionUsers}
                onBlur={field.onBlur}
                onChange={(value, bodyJson) => {
                  field.onChange(value);
                  editForm.setValue('bodyJson', bodyJson, { shouldDirty: true });
                }}
                placeholder="Update your comment"
                value={field.value}
              />
            </Suspense>
          )}
        />
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-h-5">
            <FieldError>{editForm.formState.errors.body?.message}</FieldError>
            {updateCommentMutation.error ? (
              <FieldError>{getErrorMessage(updateCommentMutation.error)}</FieldError>
            ) : null}
          </div>
          <Button disabled={updateCommentMutation.isPending} size="sm" type="submit">
            {updateCommentMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Save edit
          </Button>
        </div>
      </form>
    );
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="h-[calc(100dvh-32px)] w-[min(96vw,1440px)] max-w-none">
        <DialogHeader className="border-b border-[rgb(var(--tabliodb-border))] pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle>Comments</DialogTitle>
              <DialogDescription>
                Discuss the diagram, table, column, and schema details without losing editor context.
              </DialogDescription>
            </div>
            <IconButton
              disabled={isMutationPending}
              icon={X}
              label="Close comments"
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="secondary"
            />
          </div>
        </DialogHeader>

        <DialogBody className="grid min-h-0 flex-1 grid-rows-[minmax(190px,0.72fr)_minmax(420px,1.28fr)] gap-3 overflow-hidden px-3 py-3 lg:grid-cols-[300px_minmax(0,1fr)] lg:grid-rows-none">
          <section className="flex min-h-0 flex-col gap-3 overflow-hidden">
            <form
              className="shrink-0 rounded-(--tabliodb-radius-lg) border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface))] p-2.5"
              onSubmit={createForm.handleSubmit(handleCreateThread)}
            >
              <div className="mb-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-extrabold">New thread</div>
                  <p className="mt-1 truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                    {activeTarget.detail}: {activeTarget.label}
                  </p>
                </div>
                <Badge variant={activeTarget.targetType === 'table' ? 'green' : 'blue'}>
                  {formatCommentTargetType(activeTarget.targetType)}
                </Badge>
              </div>
              <Controller
                control={createForm.control}
                name="body"
                render={({ field }) => (
                  <Suspense
                    fallback={
                      <CommentComposerFallback
                        density="compact"
                        invalid={Boolean(createForm.formState.errors.body)}
                        placeholder={canComment ? 'Leave a note with @teammate' : 'Your role can read comments only'}
                      />
                    }
                  >
                    <CommentComposer
                      aria-invalid={Boolean(createForm.formState.errors.body)}
                      density="compact"
                      disabled={!canComment || createThreadMutation.isPending}
                      mentionUsers={mentionUsers}
                      onBlur={field.onBlur}
                      onChange={(value, bodyJson) => {
                        field.onChange(value);
                        createForm.setValue('bodyJson', bodyJson, { shouldDirty: true });
                      }}
                      placeholder={canComment ? 'Leave a note with @teammate' : 'Your role can read comments only'}
                      value={field.value}
                    />
                  </Suspense>
                )}
              />
              <FieldError>{createForm.formState.errors.body?.message}</FieldError>
              <Button className="mt-2.5 w-full" disabled={!canComment || createThreadMutation.isPending} type="submit">
                {createThreadMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MessageSquareText className="size-4" />
                )}
                Start thread
              </Button>
            </form>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-(--tabliodb-radius-lg) border-2 border-[rgb(var(--tabliodb-border))] bg-white">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[rgb(var(--tabliodb-border))] px-3 py-2">
                <div>
                  <div className="text-[13px] font-extrabold">Threads</div>
                  <p className="text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                    {threadsQuery.data?.totalCount ?? threads.length} total
                  </p>
                </div>
                <Badge variant="neutral">{threadsQuery.isFetching ? 'Syncing' : 'Live'}</Badge>
              </div>
              <div className="tabliodb-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 scrollbar-gutter-stable">
                {threadsQuery.isPending ? (
                  <div className="flex items-center gap-2 rounded-(--tabliodb-radius-md) p-3 text-sm font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                    <Loader2 className="size-4 animate-spin" />
                    Loading threads
                  </div>
                ) : threadsQuery.error ? (
                  <div className="rounded-(--tabliodb-radius-md) border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                    {getErrorMessage(threadsQuery.error)}
                  </div>
                ) : threads.length === 0 ? (
                  <div className="rounded-(--tabliodb-radius-md) border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-4 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                    No comments yet
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {threads.map((thread) => {
                      const threadTypingPresences = typingPresencesByThreadId.get(thread.id) ?? [];

                      return (
                        <button
                          aria-pressed={activeThreadId === thread.id}
                          className={cn(
                            'w-full cursor-pointer rounded-(--tabliodb-radius-md) border-2 p-3 text-left transition',
                            activeThreadId === thread.id
                              ? 'border-[rgb(var(--tabliodb-active-chip-border))] bg-[rgb(var(--tabliodb-selected-surface))]'
                              : 'border-[rgb(var(--tabliodb-border))] hover:bg-[rgb(var(--tabliodb-surface))]',
                          )}
                          key={thread.id}
                          onClick={() => handleThreadSelect(thread)}
                          type="button"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-extrabold">
                                {getCommentThreadTargetLabel(model, thread)}
                              </div>
                              <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                                {threadTypingPresences.length > 0
                                  ? formatTypingPresenceText(threadTypingPresences)
                                  : formatDateTime(thread.updatedAt)}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-wrap justify-end gap-1">
                              {thread.unreadCount > 0 ? (
                                <Badge variant="yellow">{formatUnreadCount(thread.unreadCount)}</Badge>
                              ) : null}
                              <Badge
                                className={cn(
                                  'flex items-center gap-1 text-white',
                                  thread.status === 'resolved'
                                    ? 'bg-[rgb(var(--tabliodb-lavender))]'
                                    : 'bg-[rgb(var(--tabliodb-primary))]',
                                )}
                              >
                                {thread.status === 'resolved' ? (
                                  <CircleCheck strokeWidth={3} size={12} />
                                ) : (
                                  <CircleDot strokeWidth={3} size={12} />
                                )}
                                {formatCommentThreadStatus(thread.status)}
                              </Badge>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-(--tabliodb-radius-lg) border-2 border-[rgb(var(--tabliodb-border))] bg-white">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[rgb(var(--tabliodb-border))] px-4 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold">{activeThreadTargetLabel ?? 'Select a thread'}</div>
                <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                  {activeThread
                    ? `${formatCommentTargetType(activeThread.targetType)} discussion`
                    : 'Choose a thread from the list or start a new one.'}
                </p>
              </div>
              {activeThread ? (
                <Button
                  disabled={!canComment || isMutationPending}
                  onClick={handleToggleResolved}
                  size="sm"
                  type="button"
                  variant={activeThread.status === 'resolved' ? 'secondary' : 'purple'}
                >
                  {resolveThreadMutation.isPending || unresolveThreadMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  {activeThread.status === 'resolved' ? 'Reopen' : 'Resolve'}
                </Button>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex shrink-0 items-center justify-between gap-3 bg-[rgb(var(--tabliodb-surface))] px-4 py-1.5">
                <div className="min-w-0">
                  <span className="text-xs font-extrabold uppercase text-[rgb(var(--tabliodb-ink-muted))]">
                    Messages
                  </span>
                  {readReceiptText ? (
                    <p className="mt-0.5 truncate text-[11px] font-bold text-[rgb(var(--tabliodb-ink-subtle))]">
                      {readReceiptText}
                    </p>
                  ) : null}
                </div>
                <Badge variant="neutral">
                  {threadCommentsQuery.data?.totalCount ?? comments.length}
                  {comments.length === 1 ? ' message' : ' messages'}
                </Badge>
              </div>
              {activeThreadTypingPresences.length > 0 ? (
                <div className="flex shrink-0 items-center gap-2 border-t border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-sky-soft))] px-4 py-2 text-xs font-extrabold text-[rgb(var(--tabliodb-sky-text))]">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-2 animate-ping rounded-full bg-[rgb(var(--tabliodb-sky))] opacity-50" />
                    <span className="relative inline-flex size-2 rounded-full bg-[rgb(var(--tabliodb-sky))]" />
                  </span>
                  {formatTypingPresenceText(activeThreadTypingPresences)}
                </div>
              ) : null}
              <div className="tabliodb-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 scrollbar-gutter-stable">
                {!activeThread ? (
                  <div className="grid h-full place-items-center rounded-(--tabliodb-radius-md) border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-6 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                    Comments stay anchored to the diagram objects your team is reviewing.
                  </div>
                ) : threadCommentsQuery.isPending ? (
                  <div className="flex items-center gap-2 rounded-(--tabliodb-radius-md) p-3 text-sm font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                    <Loader2 className="size-4 animate-spin" />
                    Loading replies
                  </div>
                ) : threadCommentsQuery.error ? (
                  <div className="rounded-(--tabliodb-radius-md) border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                    {getErrorMessage(threadCommentsQuery.error)}
                  </div>
                ) : comments.length === 0 ? (
                  <div className="grid h-full place-items-center rounded-(--tabliodb-radius-md) border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-6 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                    This thread is ready for the first reply.
                  </div>
                ) : (
                  <div className="grid gap-1">
                    {commentTree.map((comment) => (
                      <ThreadCommentItem
                        canModerateComments={canModerateComments}
                        canComment={canComment}
                        comment={comment}
                        currentUserId={currentUserId}
                        deleteConfirmCommentId={deleteConfirmCommentId}
                        deleteError={deleteCommentMutation.error}
                        deletingCommentId={
                          deleteCommentMutation.isPending ? (deleteCommentMutation.variables ?? null) : null
                        }
                        depth={0}
                        key={comment.id}
                        onDeleteCancel={handleDeleteCancel}
                        onDeleteConfirm={handleDeleteConfirm}
                        onDelete={handleDeleteTargetSelect}
                        onEdit={handleEditTargetSelect}
                        onReply={handleReplyTargetSelect}
                        renderEditComposer={renderInlineEditComposer}
                        renderReplyComposer={renderInlineReplyComposer}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {replyParentComment ? null : (
              <form
                className="shrink-0 border-t border-[rgb(var(--tabliodb-border))] bg-white/95 p-2.5"
                onSubmit={replyForm.handleSubmit(handleReply)}
              >
                <Controller
                  control={replyForm.control}
                  name="body"
                  render={({ field }) => (
                    <Suspense
                      fallback={
                        <CommentComposerFallback
                          density="compact"
                          invalid={Boolean(replyForm.formState.errors.body)}
                          placeholder={replyPlaceholder}
                        />
                      }
                    >
                      <CommentComposer
                        aria-invalid={Boolean(replyForm.formState.errors.body)}
                        density="compact"
                        disabled={!activeThread || !canComment || replyMutation.isPending}
                        mentionUsers={mentionUsers}
                        menuPlacement="top"
                        onBlur={() => handleReplyComposerBlur(field.onBlur)}
                        onChange={(value, bodyJson) => handleReplyComposerChange(value, bodyJson, field.onChange)}
                        placeholder={replyPlaceholder}
                        value={field.value}
                      />
                    </Suspense>
                  )}
                />
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-h-5">
                    <FieldError>{replyForm.formState.errors.body?.message}</FieldError>
                    {mutationError ? <FieldError>{getErrorMessage(mutationError)}</FieldError> : null}
                  </div>
                  <Button disabled={!activeThread || !canComment || replyMutation.isPending} size="sm" type="submit">
                    {replyMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <MessageSquareText className="size-4" />
                    )}
                    Reply
                  </Button>
                </div>
              </form>
            )}
          </section>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

type ThreadCommentNode = CommentResponseDto & {
  replies: ThreadCommentNode[];
};

function ThreadCommentItem({
  canModerateComments,
  canComment,
  comment,
  currentUserId,
  deleteConfirmCommentId,
  deleteError,
  deletingCommentId,
  depth,
  onDelete,
  onDeleteCancel,
  onDeleteConfirm,
  onEdit,
  onReply,
  renderEditComposer,
  renderReplyComposer,
}: {
  canModerateComments: boolean;
  canComment: boolean;
  comment: ThreadCommentNode;
  currentUserId: string;
  deleteConfirmCommentId: string | null;
  deleteError: unknown;
  deletingCommentId: string | null;
  depth: number;
  onDelete: (comment: CommentResponseDto) => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: (comment: CommentResponseDto) => void;
  onEdit: (comment: CommentResponseDto) => void;
  onReply: (comment: CommentResponseDto) => void;
  renderEditComposer: (comment: CommentResponseDto) => ReactNode;
  renderReplyComposer: (comment: CommentResponseDto) => ReactNode;
}) {
  const hasReplies = comment.replies.length > 0;
  const isDeleted = Boolean(comment.deletedAt);
  const [areRepliesExpanded, setAreRepliesExpanded] = useState(true);
  const canEdit = canComment && !isDeleted && comment.createdById === currentUserId;
  const canDelete = canComment && !isDeleted && (comment.createdById === currentUserId || canModerateComments);
  const isDeleteConfirming = deleteConfirmCommentId === comment.id;
  const isDeleting = deletingCommentId === comment.id;
  const inlineEditComposer = isDeleted ? null : renderEditComposer(comment);
  const inlineReplyComposer = isDeleted ? null : renderReplyComposer(comment);
  // Replies dibuka secara default agar thread lama tetap terasa familiar, tetapi cabang ramai bisa ditutup per comment.
  const hasVisibleReplies = hasReplies && areRepliesExpanded;
  const avatarBottomClass = depth === 0 ? 'top-[44px]' : 'top-[40px]';
  const avatarCenterClass = depth === 0 ? 'left-[26px]' : 'left-[24px]';
  const replySpineIndentClass = depth === 0 ? 'ml-[26px]' : 'ml-[24px]';
  const inlineReplyIndentClass = depth === 0 ? 'ml-[56px]' : 'ml-[52px]';

  return (
    <div
      className={cn('relative', depth > 4 && 'rounded-l-(--tabliodb-radius-sm) bg-[rgb(var(--tabliodb-surface))]/60')}
    >
      {depth > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -left-8.5 top-0 h-6 w-11 rounded-bl-[18px] border-b-2 border-l-2 border-[rgb(var(--tabliodb-border-strong))]"
        />
      ) : null}

      <article
        className={cn(
          'group relative flex items-start gap-3 rounded-(--tabliodb-radius-md) px-2 py-2 transition hover:bg-[rgb(var(--tabliodb-surface))]',
          isDeleted && 'text-[rgb(var(--tabliodb-ink-muted))]',
        )}
      >
        {hasVisibleReplies ? (
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute -bottom-1.5 w-px bg-[rgb(var(--tabliodb-border-strong))]',
              avatarBottomClass,
              avatarCenterClass,
            )}
          />
        ) : null}
        {isDeleted ? (
          <span
            className={cn(
              'relative z-10 grid shrink-0 place-items-center rounded-full border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface))] text-[rgb(var(--tabliodb-ink-subtle))] shadow-[0_2px_0_rgb(var(--tabliodb-border))]',
              depth === 0 ? 'size-9' : 'size-8',
            )}
          >
            <MessageSquareText className="size-4" />
          </span>
        ) : (
          <UserAvatar
            className={cn(
              'relative z-10 rounded-full border-[rgb(var(--tabliodb-border))] text-[11px] shadow-[0_2px_0_rgb(var(--tabliodb-border))]',
              depth === 0 ? 'size-9' : 'size-8',
            )}
            user={comment.author}
          />
        )}
        <div className="relative z-10 min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[13px] font-extrabold text-[rgb(var(--tabliodb-ink))]">
              {isDeleted ? 'Deleted comment' : comment.author.name}
            </span>
            <span className="text-[11px] font-bold text-[rgb(var(--tabliodb-ink-subtle))]">
              {formatDateTime(comment.createdAt)}
            </span>
            {!isDeleted && comment.editedAt ? (
              <span className="text-[11px] font-extrabold text-[rgb(var(--tabliodb-ink-subtle))]">edited</span>
            ) : null}
          </div>
          {inlineEditComposer ? (
            inlineEditComposer
          ) : (
            <>
              <p
                className={cn(
                  'mt-1 whitespace-pre-wrap wrap-break-word text-[13px] font-semibold leading-6',
                  isDeleted ? 'italic text-[rgb(var(--tabliodb-ink-muted))]' : 'text-[rgb(var(--tabliodb-ink))]',
                )}
              >
                {isDeleted ? 'This comment was deleted.' : comment.body}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                {!isDeleted ? (
                  <button
                    className={cn(
                      'rounded-full px-2 py-1 text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))] transition',
                      canComment
                        ? 'cursor-pointer hover:bg-[rgb(var(--tabliodb-primary-soft))] hover:text-[rgb(var(--tabliodb-primary-text))]'
                        : 'cursor-not-allowed opacity-60',
                    )}
                    disabled={!canComment}
                    onClick={() => onReply(comment)}
                    type="button"
                  >
                    Reply
                  </button>
                ) : null}
                {canEdit ? (
                  <button
                    className="cursor-pointer rounded-full px-2 py-1 text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))] transition hover:bg-[rgb(var(--tabliodb-sky-soft))] hover:text-[rgb(var(--tabliodb-sky-text))]"
                    onClick={() => onEdit(comment)}
                    type="button"
                  >
                    Edit
                  </button>
                ) : null}
                {canDelete ? (
                  isDeleteConfirming ? (
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <button
                        className="cursor-pointer rounded-full px-2 py-1 text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))] transition hover:bg-[rgb(var(--tabliodb-surface))]"
                        disabled={isDeleting}
                        onClick={onDeleteCancel}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-[rgb(var(--tabliodb-danger))] px-2 py-1 text-xs font-extrabold text-white transition hover:bg-[rgb(var(--tabliodb-danger-hover))] disabled:cursor-wait disabled:opacity-70"
                        disabled={isDeleting}
                        onClick={() => onDeleteConfirm(comment)}
                        type="button"
                      >
                        {isDeleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                        Delete
                      </button>
                    </span>
                  ) : (
                    <button
                      className="cursor-pointer rounded-full px-2 py-1 text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))] transition hover:bg-[rgb(var(--tabliodb-danger-soft))] hover:text-[rgb(var(--tabliodb-danger-text))]"
                      onClick={() => onDelete(comment)}
                      type="button"
                    >
                      Delete
                    </button>
                  )
                ) : null}
                {hasReplies ? (
                  <button
                    aria-expanded={areRepliesExpanded}
                    className="cursor-pointer rounded-full px-2 py-1 text-xs font-extrabold text-[rgb(var(--tabliodb-sky-text))] transition hover:bg-[rgb(var(--tabliodb-sky-soft))]"
                    onClick={() => setAreRepliesExpanded((isExpanded) => !isExpanded)}
                    type="button"
                  >
                    {areRepliesExpanded ? 'Hide replies' : `View ${formatCommentReplyCount(comment.replyCount)}`}
                  </button>
                ) : null}
              </div>
              {isDeleteConfirming && deleteError ? (
                <div className="mt-1">
                  <FieldError>{getErrorMessage(deleteError)}</FieldError>
                </div>
              ) : null}
            </>
          )}
        </div>
      </article>

      {inlineReplyComposer ? (
        <div className={cn('pb-2 pr-2', inlineReplyIndentClass)}>{inlineReplyComposer}</div>
      ) : null}

      {hasVisibleReplies ? (
        <div className={cn('relative -mt-1 pl-8.5', replySpineIndentClass)}>
          {/* The spine sits on the parent avatar centerline, while each elbow overlaps the child avatar edge so nested replies feel physically connected. */}
          <span
            aria-hidden="true"
            className="absolute bottom-3 left-0 -top-1.5 w-px bg-[rgb(var(--tabliodb-border-strong))]"
          />
          <div className="grid gap-0.5">
            {comment.replies.map((reply) => (
              <ThreadCommentItem
                canModerateComments={canModerateComments}
                canComment={canComment}
                comment={reply}
                currentUserId={currentUserId}
                deleteConfirmCommentId={deleteConfirmCommentId}
                deleteError={deleteError}
                deletingCommentId={deletingCommentId}
                depth={depth + 1}
                key={reply.id}
                onDelete={onDelete}
                onDeleteCancel={onDeleteCancel}
                onDeleteConfirm={onDeleteConfirm}
                onEdit={onEdit}
                onReply={onReply}
                renderEditComposer={renderEditComposer}
                renderReplyComposer={renderReplyComposer}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatCommentReplyCount(replyCount: number): string {
  return `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`;
}

function getCommentQuotePreview(comment: CommentResponseDto): string {
  if (comment.deletedAt) {
    return 'This comment was deleted.';
  }

  // Quote preview memakai plain text hasil sanitasi server; rendering rich Lexical JSON akan ditambahkan sebagai tahap aman terpisah.
  return comment.body.trim() || 'No preview available.';
}

function createCommentTree(comments: CommentResponseDto[]): ThreadCommentNode[] {
  const nodesById = new Map<string, ThreadCommentNode>();
  const roots: ThreadCommentNode[] = [];

  for (const comment of comments) {
    nodesById.set(comment.id, {
      ...comment,
      replies: [],
    });
  }

  for (const comment of comments) {
    const node = nodesById.get(comment.id);

    if (!node) {
      continue;
    }

    const parent = comment.parentCommentId ? nodesById.get(comment.parentCommentId) : null;

    if (parent) {
      // Tree disusun di client dari halaman comment yang tersedia; parent yang belum ikut ter-fetch tetap ditampilkan sebagai root agar pagination tidak merusak UI.
      parent.replies.push(node);
      continue;
    }

    roots.push(node);
  }

  return roots;
}

function getFreshCommentTypingPresences(
  presences: CommentTypingPresence[],
  _typingTick: number,
): CommentTypingPresence[] {
  const now = Date.now();

  return presences.filter((presence) => now - presence.updatedAt <= commentTypingFreshnessMs);
}

function groupTypingPresencesByThreadId(presences: CommentTypingPresence[]): Map<string, CommentTypingPresence[]> {
  const grouped = new Map<string, CommentTypingPresence[]>();

  for (const presence of presences) {
    grouped.set(presence.threadId, [...(grouped.get(presence.threadId) ?? []), presence]);
  }

  return grouped;
}

function formatTypingPresenceText(presences: CommentTypingPresence[]): string {
  const names = presences.map((presence) => presence.user.name);

  if (names.length === 0) {
    return '';
  }

  if (names.length === 1) {
    return `${names[0]} is typing`;
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are typing`;
  }

  return `${names[0]}, ${names[1]}, and ${names.length - 2} more are typing`;
}

function formatUnreadCount(unreadCount: number): string {
  if (unreadCount > 99) {
    return '99+ new';
  }

  return `${unreadCount} new`;
}

function getVisibleThreadReaders(readers: CommentThreadReaderDto[], currentUserId: string): CommentThreadReaderDto[] {
  return readers.filter((reader) => reader.user.id !== currentUserId);
}

function getVisibleThreadReaderCount(
  readers: CommentThreadReaderDto[],
  totalReaderCount: number,
  currentUserId: string,
): number {
  const currentUserIncluded = readers.some((reader) => reader.user.id === currentUserId);

  return Math.max(readers.length - (currentUserIncluded ? 1 : 0), totalReaderCount - (currentUserIncluded ? 1 : 0));
}

function formatReadReceiptText(readers: CommentThreadReaderDto[], totalReaderCount: number): string | null {
  if (totalReaderCount <= 0 || readers.length === 0) {
    return null;
  }

  const visibleNames = readers.map((reader) => reader.user.name);

  if (totalReaderCount === 1) {
    return `Seen by ${visibleNames[0]}`;
  }

  if (totalReaderCount === 2 && visibleNames.length >= 2) {
    return `Seen by ${visibleNames[0]} and ${visibleNames[1]}`;
  }

  if (visibleNames.length >= 2) {
    return `Seen by ${visibleNames[0]}, ${visibleNames[1]}, and ${totalReaderCount - 2} more`;
  }

  return `Seen by ${visibleNames[0]} and ${totalReaderCount - 1} more`;
}

function CommentComposerFallback({
  density = 'default',
  invalid,
  placeholder,
}: {
  density?: 'default' | 'compact';
  invalid: boolean;
  placeholder: string;
}) {
  return (
    <div
      className={cn(
        'rounded-(--tabliodb-radius-md) border bg-white px-3 py-2 text-[13px] font-semibold leading-6 text-[rgb(var(--tabliodb-ink-subtle))]',
        density === 'compact' ? 'min-h-14' : 'min-h-20',
        invalid ? 'border-[rgb(var(--tabliodb-danger-border))]' : 'border-[rgb(var(--tabliodb-border-strong))]',
      )}
    >
      {placeholder}
    </div>
  );
}

function getActiveCommentTarget(
  model: DiagramModel,
  selectedTableId: string | null,
  selectedCommentTarget: EditorCommentTarget | null,
): { detail: string; label: string; targetId: string | null; targetType: CommentTargetType } {
  if (selectedCommentTarget && isCommentTargetAvailable(model, selectedCommentTarget)) {
    const targetLabel = getCommentTargetName(model, selectedCommentTarget);

    return {
      detail: formatCommentTargetType(selectedCommentTarget.targetType),
      label: targetLabel ?? selectedCommentTarget.targetId ?? model.metadata.name,
      targetId: selectedCommentTarget.targetId,
      targetType: selectedCommentTarget.targetType,
    };
  }

  const selectedTable = selectedTableId ? (model.tables[selectedTableId] ?? null) : null;

  if (selectedTable) {
    return {
      detail: 'Selected table',
      label: selectedTable.name,
      targetId: selectedTable.id,
      targetType: 'table',
    };
  }

  return {
    detail: 'Diagram',
    label: model.metadata.name,
    targetId: null,
    targetType: 'diagram',
  };
}

function isCommentTargetAvailable(
  model: DiagramModel,
  target: Pick<CommentThreadListItemDto, 'targetId' | 'targetType'>,
) {
  if (target.targetType === 'diagram') {
    return true;
  }

  if (!target.targetId) {
    return false;
  }

  // Availability memakai map normalized dari schema-core agar komentar detail ikut gugur saat entity dihapus/import ulang.
  switch (target.targetType) {
    case 'check':
      return Boolean(model.checks[target.targetId]);
    case 'column':
      return Boolean(model.columns[target.targetId]);
    case 'enum':
      return Boolean(model.enums[target.targetId]);
    case 'group':
      return Boolean(model.groups[target.targetId]);
    case 'index':
      return Boolean(model.indexes[target.targetId]);
    case 'note':
      return Boolean(model.notes[target.targetId]);
    case 'relationship':
      return Boolean(model.relationships[target.targetId]);
    case 'table':
      return Boolean(model.tables[target.targetId]);
    default:
      return false;
  }
}

function getCommentTargetName(
  model: DiagramModel,
  target: Pick<CommentThreadListItemDto, 'targetId' | 'targetType'>,
): string | null {
  if (target.targetType === 'diagram') {
    return model.metadata.name;
  }

  if (!target.targetId) {
    return null;
  }

  if (target.targetType === 'table') {
    return model.tables[target.targetId]?.name ?? null;
  }

  if (target.targetType === 'column') {
    const column = model.columns[target.targetId];
    const table = column ? model.tables[column.tableId] : null;

    return column ? `${table?.name ?? 'table'}.${column.name}` : null;
  }

  if (target.targetType === 'relationship') {
    return model.relationships[target.targetId]?.name ?? null;
  }

  if (target.targetType === 'index') {
    return model.indexes[target.targetId]?.name ?? null;
  }

  if (target.targetType === 'check') {
    return model.checks[target.targetId]?.name ?? null;
  }

  if (target.targetType === 'enum') {
    return model.enums[target.targetId]?.name ?? null;
  }

  if (target.targetType === 'note') {
    return model.notes[target.targetId]?.text.slice(0, 32) ?? null;
  }

  if (target.targetType === 'group') {
    return model.groups[target.targetId]?.name ?? null;
  }

  return null;
}

function getCommentThreadTargetLabel(model: DiagramModel, thread: CommentThreadListItemDto): string {
  if (thread.targetType === 'diagram') {
    return `Diagram: ${model.metadata.name}`;
  }

  if (!thread.targetId) {
    return formatCommentTargetType(thread.targetType);
  }

  const targetName = getCommentTargetName(model, thread);

  return `${formatCommentTargetType(thread.targetType)}: ${targetName ?? thread.targetId}`;
}

function findCommentThreadForTarget(
  model: DiagramModel,
  threads: CommentThreadListItemDto[],
  target: CommentTargetReference,
): CommentThreadListItemDto | null {
  const openExactThread = threads.find((thread) => thread.status === 'open' && isExactCommentTarget(thread, target));

  if (openExactThread) {
    return openExactThread;
  }

  const exactThread = threads.find((thread) => isExactCommentTarget(thread, target));

  if (exactThread) {
    return exactThread;
  }

  // Canvas marker count is intentionally aggregated, so table/column badges can represent related index/check/relationship threads.
  return (
    threads.find((thread) => thread.status === 'open' && isCommentThreadRelatedToTarget(model, thread, target)) ??
    threads.find((thread) => isCommentThreadRelatedToTarget(model, thread, target)) ??
    null
  );
}

function isExactCommentTarget(thread: CommentThreadListItemDto, target: CommentTargetReference): boolean {
  return thread.targetType === target.targetType && (thread.targetId ?? null) === (target.targetId ?? null);
}

function isCommentThreadRelatedToTarget(
  model: DiagramModel,
  thread: CommentThreadListItemDto,
  target: CommentTargetReference,
): boolean {
  if (isExactCommentTarget(thread, target)) {
    return true;
  }

  if (!target.targetId || !thread.targetId) {
    return false;
  }

  if (target.targetType === 'table') {
    return getCommentTargetTableId(model, thread) === target.targetId;
  }

  if (target.targetType === 'column') {
    return isCommentThreadRelatedToColumn(model, thread, target.targetId);
  }

  return false;
}

function isCommentThreadRelatedToColumn(
  model: DiagramModel,
  thread: CommentThreadListItemDto,
  columnId: string,
): boolean {
  if (!thread.targetId) {
    return false;
  }

  if (thread.targetType === 'column') {
    return thread.targetId === columnId;
  }

  if (thread.targetType === 'index') {
    return model.indexes[thread.targetId]?.columns.some((column) => column.columnId === columnId) ?? false;
  }

  if (thread.targetType === 'check') {
    return model.checks[thread.targetId]?.columnId === columnId;
  }

  if (thread.targetType === 'relationship') {
    const relationship = model.relationships[thread.targetId];

    return relationship
      ? getRelationshipColumnPairs(relationship).some(
          (columnPair) => columnPair.sourceColumnId === columnId || columnPair.targetColumnId === columnId,
        )
      : false;
  }

  return false;
}

function focusCommentTarget(
  model: DiagramModel,
  thread: CommentThreadListItemDto,
  onFocusTable: (tableId: string | null) => void,
) {
  const tableId = getCommentTargetTableId(model, thread);

  if (tableId) {
    onFocusTable(tableId);
  }
}

function getCommentTargetTableId(model: DiagramModel, target: CommentTargetReference): string | null {
  if (!target.targetId) {
    return null;
  }

  if (target.targetType === 'table') {
    return model.tables[target.targetId] ? target.targetId : null;
  }

  if (target.targetType === 'column') {
    return model.columns[target.targetId]?.tableId ?? null;
  }

  if (target.targetType === 'index') {
    return model.indexes[target.targetId]?.tableId ?? null;
  }

  if (target.targetType === 'check') {
    return model.checks[target.targetId]?.tableId ?? null;
  }

  if (target.targetType === 'relationship') {
    return model.relationships[target.targetId]?.sourceTableId ?? null;
  }

  return null;
}

function formatCommentTargetType(targetType: CommentTargetType): string {
  return targetType
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function formatCommentThreadStatus(status: CommentThreadListItemDto['status']): string {
  return status === 'resolved' ? 'Resolved' : 'Open';
}

function SidebarRail({
  icon,
  label,
  onClick,
  side,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  onClick: () => void;
  side: 'left' | 'right';
}) {
  return (
    <div
      className={cn(
        'flex h-full min-h-0 items-start justify-center pt-3',
        side === 'left' ? 'border-r-0' : 'border-l-0',
      )}
    >
      <IconButton icon={icon} label={label} onClick={onClick} variant="ghost" />
    </div>
  );
}

function SqlPreviewDialog({
  copied,
  dialect,
  onCopy,
  onDownload,
  onOpenChange,
  open,
  sql,
  warnings,
}: {
  copied: boolean;
  dialect: DatabaseDialect;
  onCopy: () => void;
  onDownload: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  sql: string;
  warnings: SqlGenerationWarning[];
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="w-[min(94vw,920px)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="size-5 text-[rgb(var(--tabliodb-sky-text))]" />
            SQL preview
          </DialogTitle>
          <DialogDescription>
            Review generated {formatDiagramDialect(dialect)} schema SQL before copying it into your database workflow.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-4">
          {warnings.length > 0 ? (
            <section className="rounded-[18px] border-2 border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] p-4 text-[13px] font-bold text-[rgb(var(--tabliodb-gold-text))]">
              <div className="mb-2 flex items-center gap-2 text-[14px] font-extrabold text-[rgb(var(--tabliodb-ink))]">
                <FileWarning className="size-4 text-[rgb(var(--tabliodb-gold-text))]" />
                Dialect warnings
              </div>
              <ul className="grid gap-1.5">
                {warnings.map((warning) => (
                  <li className="leading-5" key={warning.message}>
                    {warning.message}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section className="rounded-[18px] border-2 border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] p-4 text-[13px] font-bold text-[rgb(var(--tabliodb-primary-text))]">
              SQL is ready for {formatDiagramDialect(dialect)} with no compatibility warnings.
            </section>
          )}

          <pre className="tabliodb-scrollbar max-h-[52dvh] overflow-auto rounded-[18px] border-2 border-[rgb(var(--tabliodb-ink))] bg-[rgb(var(--tabliodb-ink))] p-4 text-[12px] font-semibold leading-5 text-white shadow-[0_4px_0_rgb(var(--tabliodb-border-strong))]">
            <code>{sql}</code>
          </pre>
        </DialogBody>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button" variant="secondary">
            Close
          </Button>
          <Button onClick={onDownload} type="button" variant="secondary">
            <Download className="size-4" />
            Download .sql
          </Button>
          <Button onClick={onCopy} type="button" variant="sky">
            <Copy className="size-4" />
            {copied ? 'Copied' : 'Copy SQL'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportJsonDialog({
  currentDiagramName,
  disabled,
  importError,
  isImporting,
  onImport,
  onOpenChange,
  open,
}: {
  currentDiagramName: string;
  disabled: boolean;
  importError: Error | null;
  isImporting: boolean;
  onImport: (input: EditorImportRequest) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const form = useForm<ImportJsonFormState>({
    defaultValues: {
      json: '',
    },
    mode: 'onChange',
    resolver: zodResolver(importJsonFormSchema),
  });
  const { errors } = form.formState;
  const rawJson = form.watch('json');
  const preview = useMemo(() => parseImportJsonDraft(rawJson), [rawJson]);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && disabled) {
      return;
    }

    onOpenChange(nextOpen);

    if (!nextOpen) {
      form.reset({ json: '' });
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    if (!file) {
      return;
    }

    const content = await file.text();

    // File upload hanya mengisi textarea; validasi dan preview tetap melalui jalur paste yang sama.
    form.setValue('json', content, { shouldDirty: true, shouldValidate: true });
    event.currentTarget.value = '';
  }

  async function handleSubmit() {
    if (preview.status !== 'valid') {
      form.setError('json', {
        message: preview.status === 'invalid' ? preview.error : 'Paste exported Tabliodb JSON or upload a .json file.',
        type: 'manual',
      });
      return;
    }

    try {
      // Server menerima konten mentah agar jalur UI identik dengan jalur SDK/API untuk import file JSON.
      await onImport({
        content: rawJson,
        source: 'tabliodb_json',
      });
      handleOpenChange(false);
    } catch {
      // Error mutation ditampilkan dari prop importError, jadi catch ini hanya menjaga dialog tetap terbuka untuk koreksi user.
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="w-[min(94vw,820px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="size-5 text-[rgb(var(--tabliodb-primary-text))]" />
              Import Tabliodb JSON
            </DialogTitle>
            <DialogDescription>
              Replace the current draft for {currentDiagramName}. Create a snapshot after import when the result looks
              right.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="grid gap-4">
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] px-4 py-5 text-center text-[13px] font-extrabold text-[rgb(var(--tabliodb-primary-text))] transition hover:bg-[rgb(var(--tabliodb-primary-soft-hover))]">
              <FileJson className="size-6" />
              Upload exported .tabliodb.json
              <span className="text-[12px] font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                or paste the file contents below
              </span>
              <input
                accept=".json,application/json"
                className="sr-only"
                disabled={disabled}
                onChange={handleFileChange}
                type="file"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                JSON
              </span>
              <ControlledTextarea
                aria-invalid={Boolean(errors.json) || preview.status === 'invalid'}
                className="tabliodb-scrollbar min-h-64 w-full resize-y rounded-[18px] border-2 border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 py-3 font-mono text-[12px] font-semibold leading-5 text-[rgb(var(--tabliodb-ink))] outline-none transition placeholder:font-sans placeholder:text-[rgb(var(--tabliodb-ink-subtle))] focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
                control={form.control}
                disabled={disabled}
                name="json"
                placeholder='{"schemaVersion":1,"dialect":"postgresql","tables":{...}}'
              />
              <FieldError>{errors.json?.message}</FieldError>
            </label>

            <ImportJsonPreview preview={preview} />

            {importError ? (
              <section className="rounded-[18px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-4 text-[13px] font-bold text-[rgb(var(--tabliodb-danger-text))]">
                {getErrorMessage(importError)}
              </section>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button disabled={disabled || isImporting || preview.status !== 'valid'} type="submit">
              {isImporting ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
              Apply import
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImportJsonPreview({ preview }: { preview: ImportJsonDraftPreview }) {
  if (preview.status === 'empty') {
    return (
      <section className="rounded-[18px] border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] p-4 text-[13px] font-bold text-[rgb(var(--tabliodb-ink-muted))]">
        Waiting for a Tabliodb JSON document.
      </section>
    );
  }

  if (preview.status === 'invalid') {
    return (
      <section className="rounded-[18px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-4 text-[13px] font-bold text-[rgb(var(--tabliodb-danger-text))]">
        {preview.error}
      </section>
    );
  }

  const model = preview.model;

  return (
    <section className="grid gap-3 rounded-[18px] border-2 border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="green">{formatDiagramDialect(model.dialect)}</Badge>
        <Badge>{Object.keys(model.tables).length} tables</Badge>
        <Badge>{Object.keys(model.relationships).length} relationships</Badge>
        <Badge>{Object.keys(model.indexes).length} indexes</Badge>
        <Badge>{Object.keys(model.enums).length} enums</Badge>
      </div>
      <div>
        <div className="text-[14px] font-extrabold text-[rgb(var(--tabliodb-ink))]">{model.metadata.name}</div>
        <div className="text-[12px] font-bold text-[rgb(var(--tabliodb-ink-muted))]">
          This import will replace the current unsaved draft model.
        </div>
      </div>
      {preview.warnings.length > 0 ? (
        <div className="rounded-2xl border-2 border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] p-3 text-[12px] font-bold text-[rgb(var(--tabliodb-gold-text))]">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-extrabold text-[rgb(var(--tabliodb-ink))]">
            <FileWarning className="size-4 text-[rgb(var(--tabliodb-gold-text))]" />
            Import warnings
          </div>
          <ul className="grid gap-1">
            {preview.warnings.slice(0, 6).map((warning) => (
              <li key={`${warning.code}:${warning.target?.id ?? warning.message}`}>{warning.message}</li>
            ))}
          </ul>
          {preview.warnings.length > 6 ? (
            <div className="mt-2">+{preview.warnings.length - 6} more warnings</div>
          ) : null}
        </div>
      ) : (
        <div className="text-[13px] font-extrabold text-[rgb(var(--tabliodb-primary-text))]">
          JSON is valid and no unresolved references were found.
        </div>
      )}
    </section>
  );
}

function ImportSqlDialog({
  currentDiagramName,
  defaultDialect,
  disabled,
  importError,
  isImporting,
  onImport,
  onOpenChange,
  open,
}: {
  currentDiagramName: string;
  defaultDialect: DatabaseDialect;
  disabled: boolean;
  importError: Error | null;
  isImporting: boolean;
  onImport: (input: EditorImportRequest) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const form = useForm<ImportSqlFormState>({
    defaultValues: {
      dialect: defaultDialect,
      sql: '',
    },
    mode: 'onChange',
    resolver: zodResolver(importSqlFormSchema),
  });
  const { errors } = form.formState;
  const rawSql = form.watch('sql');
  const dialect = form.watch('dialect');
  const preview = useMemo(
    () => parseImportSqlDraft(rawSql, dialect, currentDiagramName),
    [currentDiagramName, dialect, rawSql],
  );

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && disabled) {
      return;
    }

    onOpenChange(nextOpen);

    if (nextOpen) {
      form.reset({ dialect: defaultDialect, sql: '' });
    }

    if (!nextOpen) {
      form.reset({ dialect: defaultDialect, sql: '' });
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    if (!file) {
      return;
    }

    const content = await file.text();

    // Upload .sql hanya mengisi textarea supaya paste dan file tetap memakai validator serta preview yang sama.
    form.setValue('sql', content, { shouldDirty: true, shouldValidate: true });
    event.currentTarget.value = '';
  }

  async function handleSubmit() {
    if (preview.status !== 'valid') {
      form.setError('sql', {
        message: preview.status === 'invalid' ? preview.error : 'Paste SQL DDL or upload a .sql file.',
        type: 'manual',
      });
      return;
    }

    try {
      // Dialect ikut dikirim supaya parser backend tidak menebak-nebak sintaks DDL yang ditempel user.
      await onImport({
        content: rawSql,
        dialect,
        source: 'sql',
      });
      handleOpenChange(false);
    } catch {
      // Error mutation ditampilkan di bawah preview dan dialog tetap terbuka agar user bisa memperbaiki SQL.
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="w-[min(94vw,860px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code2 className="size-5 text-[rgb(var(--tabliodb-sky-text))]" />
              Import SQL DDL
            </DialogTitle>
            <DialogDescription>
              Parse CREATE statements into an editable draft for {currentDiagramName}. Snapshot after reviewing the
              imported diagram.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end">
              <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky-soft))] px-4 py-5 text-center text-[13px] font-extrabold text-[rgb(var(--tabliodb-sky-text))] transition hover:bg-[rgb(var(--tabliodb-sky-soft-hover))]">
                <FileText className="size-6" />
                Upload .sql DDL
                <span className="text-[12px] font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                  or paste CREATE statements below
                </span>
                <input
                  accept=".sql,.txt,text/plain,application/sql"
                  className="sr-only"
                  disabled={disabled}
                  onChange={handleFileChange}
                  type="file"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Source dialect
                </span>
                <ControlledSelect
                  className={selectClassName}
                  control={form.control}
                  disabled={disabled}
                  name="dialect"
                  options={diagramDialectOptions.map((option) => ({
                    label: formatDiagramDialect(option),
                    value: option,
                  }))}
                />
                <FieldError>{errors.dialect?.message}</FieldError>
              </label>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                SQL DDL
              </span>
              <ControlledTextarea
                aria-invalid={Boolean(errors.sql) || preview.status === 'invalid'}
                className="tabliodb-scrollbar min-h-64 w-full resize-y rounded-[18px] border-2 border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 py-3 font-mono text-[12px] font-semibold leading-5 text-[rgb(var(--tabliodb-ink))] outline-none transition placeholder:font-sans placeholder:text-[rgb(var(--tabliodb-ink-subtle))] focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
                control={form.control}
                disabled={disabled}
                name="sql"
                placeholder={'CREATE TABLE users (\n  id UUID PRIMARY KEY,\n  email VARCHAR(190) NOT NULL UNIQUE\n);'}
              />
              <FieldError>{errors.sql?.message}</FieldError>
            </label>

            <ImportSqlPreview preview={preview} />

            {importError ? (
              <section className="rounded-[18px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-4 text-[13px] font-bold text-[rgb(var(--tabliodb-danger-text))]">
                {getErrorMessage(importError)}
              </section>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button disabled={disabled || isImporting || preview.status !== 'valid'} type="submit" variant="sky">
              {isImporting ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
              Apply SQL import
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImportSqlPreview({ preview }: { preview: ImportSqlDraftPreview }) {
  if (preview.status === 'empty') {
    return (
      <section className="rounded-[18px] border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] p-4 text-[13px] font-bold text-[rgb(var(--tabliodb-ink-muted))]">
        Waiting for SQL DDL.
      </section>
    );
  }

  if (preview.status === 'invalid') {
    return (
      <section className="rounded-[18px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-4 text-[13px] font-bold text-[rgb(var(--tabliodb-danger-text))]">
        {preview.error}
      </section>
    );
  }

  const model = preview.model;

  return (
    <section className="grid gap-3 rounded-[18px] border-2 border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky-soft))] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="blue">{formatDiagramDialect(model.dialect)}</Badge>
        <Badge>{Object.keys(model.tables).length} tables</Badge>
        <Badge>{Object.keys(model.relationships).length} relationships</Badge>
        <Badge>{Object.keys(model.indexes).length} indexes</Badge>
        <Badge>{Object.keys(model.enums).length} enums</Badge>
      </div>
      <div>
        <div className="text-[14px] font-extrabold text-[rgb(var(--tabliodb-ink))]">{model.metadata.name}</div>
        <div className="text-[12px] font-bold text-[rgb(var(--tabliodb-ink-muted))]">
          SQL import is intentionally conservative; unsupported statements are reported instead of silently pretending
          they were modeled.
        </div>
      </div>
      {preview.warnings.length > 0 ? (
        <div className="rounded-2xl border-2 border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] p-3 text-[12px] font-bold text-[rgb(var(--tabliodb-gold-text))]">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-extrabold text-[rgb(var(--tabliodb-ink))]">
            <FileWarning className="size-4 text-[rgb(var(--tabliodb-gold-text))]" />
            Import warnings
          </div>
          <ul className="grid gap-1">
            {preview.warnings.slice(0, 8).map((warning) => (
              <li key={`${warning.code}:${warning.message}`}>{warning.message}</li>
            ))}
          </ul>
          {preview.warnings.length > 8 ? (
            <div className="mt-2">+{preview.warnings.length - 8} more warnings</div>
          ) : null}
        </div>
      ) : (
        <div className="text-[13px] font-extrabold text-[rgb(var(--tabliodb-sky-text))]">
          SQL parsed into an editable diagram with no import warnings.
        </div>
      )}
    </section>
  );
}

function WorkspaceSwitcher({
  activeOrganization,
  onSelect,
  organizations,
}: {
  activeOrganization: OrganizationDto | null;
  onSelect: (organization: OrganizationDto) => void;
  organizations: OrganizationDto[];
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
        Workspace
      </div>
      <DropdownMenu>
        <WithTooltip content="Switch workspace">
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-(--tabliodb-control-lg) w-full cursor-pointer items-center gap-2.5 rounded-(--tabliodb-radius-lg) border border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 text-left shadow-[0_2px_0_rgb(var(--tabliodb-border-strong))] transition hover:bg-[rgb(var(--tabliodb-surface))] active:translate-y-0.5 active:shadow-[0_1px_0_rgb(var(--tabliodb-border-strong))]"
              type="button"
            >
              <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-[rgb(var(--tabliodb-sky-soft))] text-[rgb(var(--tabliodb-sky-text))]">
                <Building2 className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-extrabold">
                  {activeOrganization?.name ?? 'Select workspace'}
                </div>
                <div className="truncate text-[11px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                  {activeOrganization ? formatOrganizationRole(activeOrganization.role) : 'No workspace'}
                </div>
              </div>
              <ChevronsUpDown className="size-4 shrink-0 text-[rgb(var(--tabliodb-ink-muted))]" />
            </button>
          </DropdownMenuTrigger>
        </WithTooltip>
        <DropdownMenuContent align="start" className="w-64">
          {organizations.map((organization) => {
            const isActive = organization.id === activeOrganization?.id;

            return (
              <DropdownMenuItem
                className="justify-between"
                key={organization.id}
                onSelect={() => {
                  if (!isActive) {
                    onSelect(organization);
                  }
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
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function CreateProjectDialog({
  onCreated,
  organizationId,
}: {
  onCreated: (project: ProjectResponseDto) => void;
  organizationId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<ProjectFormState>({
    defaultValues: {
      description: '',
      name: '',
    },
    mode: 'onBlur',
    resolver: zodResolver(projectFormSchema),
  });
  const { errors } = form.formState;

  const createProjectMutation = useCreateProjectMutation({
    mutationConfig: {
      onSuccess: (project) => {
        // New project langsung dinavigasikan agar user merasa aksi create menghasilkan workspace yang nyata.
        form.reset({ description: '', name: '' });
        setOpen(false);
        onCreated(project);
      },
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen && !createProjectMutation.isPending) {
      form.reset({ description: '', name: '' });
      createProjectMutation.reset();
    }
  }

  function handleSubmit(values: ProjectFormState) {
    createProjectMutation.mutate({
      description: toOptionalDescription(values.description),
      name: values.name,
      organizationId: organizationId ?? undefined,
    });
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button disabled={!organizationId} size="sm" variant="secondary">
          <FolderPlus className="size-4" />
          New
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(94vw,520px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>Create a workspace project for a schema, product area, or service.</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="grid gap-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Project name
                </span>
                <ControlledInput
                  autoFocus
                  aria-invalid={Boolean(errors.name)}
                  control={form.control}
                  disabled={!organizationId || createProjectMutation.isPending}
                  name="name"
                  placeholder="Billing Platform"
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
                  disabled={!organizationId || createProjectMutation.isPending}
                  name="description"
                  placeholder="Schemas for invoices, customers, and subscriptions."
                />
                <FieldError>{errors.description?.message}</FieldError>
              </label>

              {createProjectMutation.error ? (
                <div className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                  {getErrorMessage(createProjectMutation.error)}
                </div>
              ) : null}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              disabled={createProjectMutation.isPending}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button disabled={!organizationId || createProjectMutation.isPending} type="submit">
              {createProjectMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FolderPlus className="size-4" />
              )}
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  const canManageWorkspace = isOrganizationManager(organization);
  const form = useForm<WorkspaceSettingsFormState>({
    defaultValues: getWorkspaceSettingsDefaults(project),
    mode: 'onBlur',
    resolver: zodResolver(workspaceSettingsFormSchema),
  });
  const { errors } = form.formState;
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
  const auditLogs = auditLogsQuery.data?.items ?? [];
  const workspaceMembers = membersQuery.data?.items ?? [];
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

  useEffect(() => {
    if (open) {
      form.reset(getWorkspaceSettingsDefaults(project, settingsQuery.data));
      updateSettingsMutation.reset();
      updateMemberMutation.reset();
      removeMemberMutation.reset();
    }
  }, [form, open, project, settingsQuery.data]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && (updateSettingsMutation.isPending || isWorkspaceMemberMutationPending)) {
      return;
    }

    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset(getWorkspaceSettingsDefaults(project, settingsQuery.data));
      updateSettingsMutation.reset();
      updateMemberMutation.reset();
      removeMemberMutation.reset();
    }
  }

  function handleSubmit(values: WorkspaceSettingsFormState) {
    if (!canManageWorkspace) {
      return;
    }

    updateSettingsMutation.mutate({
      body: {
        allowMemberProjectCreate: values.allowMemberProjectCreate,
        defaultProjectRole: values.defaultProjectRole === 'none' ? null : values.defaultProjectRole,
        name: values.name,
      },
      organizationId: project.organizationId,
    });
  }

  function handleUpdateWorkspaceMemberRole(member: OrganizationMemberDto, role: OrganizationRole) {
    if (member.role === role) {
      return;
    }

    updateMemberMutation.mutate({
      body: { role },
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

  const memberMutationError = updateMemberMutation.error ?? removeMemberMutation.error;
  const updatingUserId = updateMemberMutation.isPending ? updateMemberMutation.variables?.userId : null;
  const removingUserId = removeMemberMutation.isPending ? removeMemberMutation.variables?.userId : null;

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <IconButton icon={Building2} label="Workspace settings" variant="ghost" />
      </DialogTrigger>
      <DialogContent className="w-[min(94vw,680px)]">
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
            disabled={updateSettingsMutation.isPending || isWorkspaceMemberMutationPending}
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
        role: values.role,
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

  function handleUpdateMemberRole(member: ProjectMemberDto, role: ProjectRole) {
    if (member.role === role) {
      return;
    }

    updateProjectMemberMutation.mutate({
      body: { role },
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

function DiagramSettingsDialog({
  canEdit,
  diagram,
  model,
  onUpdated,
}: {
  canEdit: boolean;
  diagram: DiagramResponseDto;
  model: DiagramModel;
  onUpdated: (diagram: DiagramResponseDto) => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<DiagramSettingsFormState>({
    defaultValues: getDiagramSettingsDefaults(diagram),
    mode: 'onBlur',
    resolver: zodResolver(diagramSettingsFormSchema),
  });
  const { errors } = form.formState;
  const diagramReviewSettingsQueryOptions = reviewSignalQueries.diagramSettings(diagram.id);
  const diagramReviewSettingsQuery = useQuery({
    ...diagramReviewSettingsQueryOptions,
    // Diagram settings dialog adalah fetch boundary untuk lint override, sama seperti settings lain yang tidak dibutuhkan saat canvas idle.
    enabled: open && diagramReviewSettingsQueryOptions.enabled !== false,
  });
  const updateDiagramMutation = useUpdateDiagramMutation();
  const updateDiagramReviewSettingsMutation = useUpdateDiagramReviewSignalSettingsMutation();
  const isPending = updateDiagramMutation.isPending || updateDiagramReviewSettingsMutation.isPending;
  const hasUnsavedDialectChange = model.dialect !== diagram.dialect;

  useEffect(() => {
    if (open) {
      form.reset(getDiagramSettingsDefaults(diagram, diagramReviewSettingsQuery.data));
      updateDiagramMutation.reset();
      updateDiagramReviewSettingsMutation.reset();
    }
  }, [diagram, diagramReviewSettingsQuery.data, form, open]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isPending) {
      return;
    }

    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset(getDiagramSettingsDefaults(diagram, diagramReviewSettingsQuery.data));
      updateDiagramMutation.reset();
      updateDiagramReviewSettingsMutation.reset();
    }
  }

  async function handleSubmit(values: DiagramSettingsFormState) {
    if (!canEdit) {
      return;
    }

    const updatedDiagram = await updateDiagramMutation.mutateAsync({
      body: {
        dialect: values.dialect,
        name: values.name,
      },
      diagramId: diagram.id,
    });
    const updatedReviewSettings = await updateDiagramReviewSettingsMutation.mutateAsync({
      diagramId: diagram.id,
      settings: toReviewSignalSettingsDto(values),
    });

    // Kedua endpoint disubmit sebagai satu intent UI supaya rename/dialect dan lint override tidak terasa seperti dua konfigurasi terpisah.
    form.reset(getDiagramSettingsDefaults(updatedDiagram, updatedReviewSettings));
    onUpdated(updatedDiagram);
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <IconButton icon={SlidersHorizontal} label="Diagram settings" variant="ghost" />
      </DialogTrigger>
      <DialogContent className="w-[min(94vw,520px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Diagram settings</DialogTitle>
            <DialogDescription>
              Rename the active diagram and choose the SQL dialect for generated output.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="grid gap-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Diagram name
                </span>
                <ControlledInput
                  autoFocus
                  aria-invalid={Boolean(errors.name)}
                  control={form.control}
                  disabled={isPending || !canEdit}
                  name="name"
                />
                <FieldError>{errors.name?.message}</FieldError>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  SQL dialect
                </span>
                <ControlledSelect
                  className={selectClassName}
                  control={form.control}
                  disabled={isPending || !canEdit}
                  name="dialect"
                  options={diagramDialectOptions.map((dialect) => ({
                    label: formatDiagramDialect(dialect),
                    value: dialect,
                  }))}
                />
                <FieldError>{errors.dialect?.message}</FieldError>
              </label>

              <section className="rounded-(--tabliodb-radius-lg) border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface))] p-3">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold">Review rule overrides</h3>
                    <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                      Disable extra rules for this diagram only.
                    </p>
                  </div>
                  <Badge variant="blue">{diagramReviewSettingsQuery.isPending ? 'Loading' : 'Diagram'}</Badge>
                </div>
                <ReviewSignalSettingsFields
                  control={form.control}
                  disabled={isPending || diagramReviewSettingsQuery.isFetching || !canEdit}
                  inheritedDisabledRuleKeys={diagramReviewSettingsQuery.data?.project.disabledRuleKeys}
                />
              </section>

              {!canEdit ? (
                <div className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-gold-text))]">
                  Your project role can view this diagram but cannot update diagram settings.
                </div>
              ) : null}

              {hasUnsavedDialectChange ? (
                <div className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-sky-text))]">
                  The open snapshot uses {formatDiagramDialect(model.dialect)} while the diagram record uses{' '}
                  {formatDiagramDialect(diagram.dialect)}.
                </div>
              ) : null}

              {updateDiagramMutation.error || updateDiagramReviewSettingsMutation.error ? (
                <div className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                  {getErrorMessage(updateDiagramMutation.error ?? updateDiagramReviewSettingsMutation.error)}
                </div>
              ) : null}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button disabled={isPending} onClick={() => handleOpenChange(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button disabled={isPending || !canEdit} type="submit">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save diagram
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReviewSignalSettingsFields<
  TFieldValues extends FieldValues & { disabledRuleKeys: DiagramReviewSignalCode[] },
>({
  control,
  disabled,
  inheritedDisabledRuleKeys = [],
}: {
  control: Control<TFieldValues>;
  disabled: boolean;
  inheritedDisabledRuleKeys?: DiagramReviewSignalCode[];
}) {
  const inheritedDisabledRules = new Set(inheritedDisabledRuleKeys);

  return (
    <div className="grid gap-2">
      {diagramReviewRuleDefinitions.map((rule) => (
        <Controller
          control={control}
          key={rule.code}
          name={'disabledRuleKeys' as Path<TFieldValues>}
          render={({ field }) => {
            const disabledRuleKeys = Array.isArray(field.value) ? (field.value as DiagramReviewSignalCode[]) : [];
            const isInherited = inheritedDisabledRules.has(rule.code);
            const isChecked = isInherited || disabledRuleKeys.includes(rule.code);

            return (
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-(--tabliodb-radius-md) border-2 bg-white p-3 transition',
                  isChecked
                    ? 'border-[rgb(var(--tabliodb-active-chip-border))] bg-[rgb(var(--tabliodb-selected-surface))]'
                    : 'border-[rgb(var(--tabliodb-border))] hover:bg-[rgb(var(--tabliodb-surface-raised))]',
                  (disabled || isInherited) && 'cursor-not-allowed opacity-75',
                )}
              >
                <Checkbox
                  checked={isChecked}
                  disabled={disabled || isInherited}
                  onCheckedChange={(checked) => {
                    const nextRuleKeys = new Set(disabledRuleKeys);

                    // Project inherited rules are displayed as checked in diagram settings, but only diagram-owned keys are written.
                    if (checked === true) {
                      nextRuleKeys.add(rule.code);
                    } else {
                      nextRuleKeys.delete(rule.code);
                    }

                    field.onChange(Array.from(nextRuleKeys));
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-extrabold text-[rgb(var(--tabliodb-ink))]">{rule.title}</span>
                    <Badge variant={isInherited ? 'blue' : getReviewRuleBadgeVariant(rule.severity)}>
                      {isInherited ? 'Inherited' : rule.severity}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
                    {rule.description}
                  </p>
                </div>
              </label>
            );
          }}
        />
      ))}
    </div>
  );
}

function getReviewRuleBadgeVariant(severity: DiagramReviewSignal['severity']): 'blue' | 'green' | 'neutral' | 'yellow' {
  if (severity === 'error') {
    return 'blue';
  }

  if (severity === 'warning') {
    return 'yellow';
  }

  return 'neutral';
}

function getDiagramSettingsDefaults(
  diagram: DiagramResponseDto,
  reviewSettings?: ReviewSignalEffectiveSettingsDto,
): DiagramSettingsFormState {
  return {
    dialect: diagram.dialect,
    disabledRuleKeys: reviewSettings?.diagram.disabledRuleKeys ?? [],
    name: diagram.name,
  };
}

function getReviewSignalSettingsDefaults(settings?: ReviewSignalSettingsDto): ReviewSignalSettingsFormState {
  return {
    disabledRuleKeys: settings?.disabledRuleKeys ?? [],
  };
}

function toReviewSignalSettingsDto(values: ReviewSignalSettingsFormState): ReviewSignalSettingsDto {
  return {
    // Duplicate keys can happen if a custom script mutates form state; normalizing here keeps payloads deterministic.
    disabledRuleKeys: Array.from(new Set(values.disabledRuleKeys)),
  };
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
    defaultProjectRole: settings?.defaultProjectRole ?? 'none',
    name: settings?.name ?? project.organizationName,
  };
}

function toOptionalDescription(value: string | undefined): string | undefined {
  const description = value?.trim();
  return description ? description : undefined;
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
      <Badge variant={getAuditLogTone(auditLog.action)}>{formatAuditLogAction(auditLog.action)}</Badge>
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
  onRoleChange: (member: ProjectMemberDto, role: ProjectRole) => void;
}) {
  const isBusy = isRemoving || isUpdating;

  return (
    <article className="grid gap-3 p-3 transition hover:bg-[rgb(var(--tabliodb-surface))] sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar className="size-10 rounded-[14px] text-xs" user={member} />
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h4 className="truncate text-sm font-extrabold">{member.name}</h4>
            <ProjectRoleBadge role={member.role} />
          </div>
          <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">{member.email}</p>
        </div>
      </div>
      <Select
        className={selectClassName}
        disabled={isBusy}
        onValueChange={(role) => onRoleChange(member, role as ProjectRole)}
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
  onRoleChange: (member: OrganizationMemberDto, role: OrganizationRole) => void;
}) {
  const isBusy = isRemoving || isUpdating;

  return (
    <article className="grid gap-3 p-3 transition hover:bg-[rgb(var(--tabliodb-surface))] sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar className="size-10 rounded-[14px] text-xs" user={member} />
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h4 className="truncate text-sm font-extrabold">{member.name}</h4>
            <OrganizationRoleBadge role={member.role} />
          </div>
          <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">{member.email}</p>
        </div>
      </div>
      <Select
        className={selectClassName}
        disabled={isBusy}
        onValueChange={(role) => onRoleChange(member, role as OrganizationRole)}
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

function ProjectRoleBadge({ role }: { role: ProjectRole }) {
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

function OrganizationRoleBadge({ role }: { role: OrganizationRole }) {
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

function formatProjectRole(role: ProjectRole): string {
  return {
    [ProjectRole.Commenter]: 'Commenter',
    [ProjectRole.Editor]: 'Editor',
    [ProjectRole.Owner]: 'Owner',
    [ProjectRole.Viewer]: 'Viewer',
  }[role];
}

function formatDiagramDialect(dialect: DatabaseDialect): string {
  return {
    mariadb: 'MariaDB',
    mysql: 'MySQL',
    postgresql: 'PostgreSQL',
    sqlite: 'SQLite',
    sqlserver: 'SQL Server',
  }[dialect];
}

function formatOrganizationRole(role: OrganizationDto['role']): string {
  return {
    [OrganizationRole.Admin]: 'Admin',
    [OrganizationRole.Guest]: 'Guest',
    [OrganizationRole.Member]: 'Member',
    [OrganizationRole.Owner]: 'Owner',
  }[role];
}

function isOrganizationManager(organization: OrganizationDto): boolean {
  return organization.role === 'owner' || organization.role === 'admin';
}

function hasProjectPermission(role: ProjectRole, permission: Permission): boolean {
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
      'comment.deleted': 'Comment',
      'comment.edited': 'Comment',
      'comment_thread.reopened': 'Reopened',
      'comment_thread.resolved': 'Resolved',
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
    action === 'project.created' ||
    action === 'project.member_added' ||
    action === 'user.enabled'
  ) {
    return 'green';
  }

  if (
    action === 'organization.member_removed' ||
    action === 'comment.deleted' ||
    action === 'project.archived' ||
    action === 'project.member_removed' ||
    action === 'user.disabled'
  ) {
    return 'yellow';
  }

  if (
    action === 'organization.member_role_updated' ||
    action === 'organization.settings_updated' ||
    action === 'comment.edited' ||
    action === 'comment_thread.reopened' ||
    action === 'project.member_role_updated' ||
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
    return formatProjectRole(role as ProjectRole);
  }

  return role;
}

function formatOrganizationRoleValue(role: string): string {
  if (Object.values(OrganizationRole).includes(role as OrganizationRole)) {
    return formatOrganizationRole(role as OrganizationRole);
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

type AvatarIdentity = {
  avatarUrl?: string | null;
  cursorColor?: string | null;
  email: string;
  name: string;
};

type CurrentAwarenessUser = {
  avatarUrl: string | null;
  cursorColor: string;
  email: string;
  id: string;
  name: string;
};

type CollaboratorPresence = {
  clientIds: number[];
  cursor?: AwarenessState['cursor'];
  selection?: AwarenessState['selection'];
  user: AwarenessState['user'] & { email: string };
};

type CommentTypingPresence = {
  clientIds: number[];
  parentCommentId: string | null;
  threadId: string;
  updatedAt: number;
  user: AwarenessState['user'];
};

function CollaborationPresence({ collaborators }: { collaborators: CollaboratorPresence[] }) {
  const visibleCollaborators = collaborators.slice(0, 4);
  const overflowCount = Math.max(0, collaborators.length - visibleCollaborators.length);

  return (
    <div className="hidden items-center gap-2 rounded-full border border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface))] px-2 py-1 sm:flex">
      <span className="relative grid size-2.5 place-items-center">
        <span className="absolute inline-flex size-2.5 animate-ping rounded-full bg-[rgb(var(--tabliodb-primary))] opacity-40" />
        <span className="relative inline-flex size-2.5 rounded-full bg-[rgb(var(--tabliodb-primary))]" />
      </span>
      <span className="text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
        {collaborators.length > 0 ? `${collaborators.length} live` : 'Live'}
      </span>
      {visibleCollaborators.length > 0 ? (
        <div className="flex -space-x-2">
          {visibleCollaborators.map((collaborator) => (
            <UserAvatar
              className="size-7 rounded-[11px] bg-white text-[10px] ring-2 ring-white"
              key={collaborator.user.id}
              user={collaborator.user}
            />
          ))}
          {overflowCount > 0 ? (
            <div className="grid size-7 place-items-center rounded-[11px] border-2 border-white bg-[rgb(var(--tabliodb-ink))] text-[10px] font-extrabold text-white ring-2 ring-white">
              +{overflowCount}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function UserAvatar({ className, user }: { className?: string; user: AvatarIdentity }) {
  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-primary-soft))] font-extrabold text-[rgb(var(--tabliodb-primary-text))]',
        className,
      )}
      style={user.cursorColor ? { backgroundColor: user.cursorColor } : undefined}
    >
      {user.avatarUrl ? (
        <img alt="" className="size-full object-cover" src={user.avatarUrl} />
      ) : (
        getMemberInitials(user)
      )}
    </div>
  );
}

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

function getMemberInitials(member: Pick<ProjectMemberDto, 'email' | 'name'>): string {
  const source = member.name.trim() || member.email;

  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function AddTableDialog({
  disabled = false,
  onCreate,
}: {
  disabled?: boolean;
  onCreate: (tableName?: string) => void;
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
        <Button className="ml-2 gap-2" disabled={disabled} variant="secondary">
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

type ImportJsonDraftPreview =
  | {
      status: 'empty';
      warnings: [];
    }
  | {
      error: string;
      status: 'invalid';
      warnings: [];
    }
  | {
      model: DiagramModel;
      status: 'valid';
      warnings: DiagramModelIntegrityWarning[];
    };

type ImportSqlDraftPreview =
  | {
      status: 'empty';
      warnings: [];
    }
  | {
      error: string;
      status: 'invalid';
      warnings: [];
    }
  | {
      model: DiagramModel;
      status: 'valid';
      warnings: Array<DiagramModelIntegrityWarning | SqlImportWarning>;
    };

function parseImportJsonDraft(value: string): ImportJsonDraftPreview {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return { status: 'empty', warnings: [] };
  }

  try {
    const parsedValue = JSON.parse(trimmedValue) as unknown;
    const model = parseDiagramModel(parsedValue);

    return {
      model,
      status: 'valid',
      warnings: getDiagramModelIntegrityWarnings(model),
    };
  } catch (error) {
    return {
      error: getImportJsonErrorMessage(error),
      status: 'invalid',
      warnings: [],
    };
  }
}

function getImportJsonErrorMessage(error: unknown): string {
  if (error instanceof SyntaxError) {
    return `JSON is not valid: ${error.message}`;
  }

  if (error instanceof z.ZodError) {
    const firstIssue = error.issues[0];

    return firstIssue
      ? `JSON does not match Tabliodb schema: ${firstIssue.message}`
      : 'JSON does not match Tabliodb schema.';
  }

  return 'JSON could not be imported.';
}

function parseImportSqlDraft(value: string, dialect: DatabaseDialect, diagramName: string): ImportSqlDraftPreview {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return { status: 'empty', warnings: [] };
  }

  try {
    const result = parseCreateSchemaSql(trimmedValue, {
      dialect,
      diagramName: `${diagramName} import`,
    });
    const model = parseDiagramModel(result.model);

    return {
      model,
      status: 'valid',
      warnings: [...result.warnings, ...getDiagramModelIntegrityWarnings(model)],
    };
  } catch (error) {
    return {
      error: getImportSqlErrorMessage(error),
      status: 'invalid',
      warnings: [],
    };
  }
}

function getImportSqlErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    const firstIssue = error.issues[0];

    return firstIssue
      ? `SQL produced an invalid Tabliodb model: ${firstIssue.message}`
      : 'SQL produced an invalid Tabliodb model.';
  }

  if (error instanceof Error) {
    return `SQL could not be imported: ${error.message}`;
  }

  return 'SQL could not be imported.';
}

function createDiagramModelSignature(model: DiagramModel): string {
  // Signature memakai serializer canonical schema-core, sehingga urutan key dan bentuk JSON konsisten antar render.
  return stringifyDiagramModel(model);
}

function toDiagramExportWarnings(warnings: readonly DiagramExportWarningInput[]): DiagramExportResponseDto['warnings'] {
  return warnings.map((warning) => ({
    code: warning.code,
    message: warning.message,
    statement: warning.statement,
    target: warning.target
      ? {
          id: warning.target.id,
          type: warning.target.type,
        }
      : undefined,
  }));
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

function downloadTextFile(fileName: string, content: string, mimeType: string) {
  downloadBlobFile(fileName, new Blob([content], { type: mimeType }));
}

function downloadBlobFile(fileName: string, blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  // Anchor sementara tetap paling kompatibel untuk download client-side tanpa menambah dependency.
  link.href = objectUrl;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

async function createPngBlobFromSvg(svg: string): Promise<Blob> {
  const { height, width } = readSvgSize(svg);
  const image = new Image();
  const objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('SVG image could not be decoded for PNG export.'));
      image.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.ceil(width * pixelRatio);
    canvas.height = Math.ceil(height * pixelRatio);

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas is not available for PNG export.');
    }

    // Scaling the context keeps text and relationship strokes crisp on high-density displays without huge files.
    context.scale(pixelRatio, pixelRatio);
    context.drawImage(image, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error('PNG export produced an empty blob.'));
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function readSvgSize(svg: string): { height: number; width: number } {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const svgElement = document.documentElement;
  const width = Number(svgElement.getAttribute('width'));
  const height = Number(svgElement.getAttribute('height'));

  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    return { height, width };
  }

  const viewBox = svgElement.getAttribute('viewBox')?.split(/\s+/).map(Number) ?? [];
  const viewBoxWidth = viewBox[2];
  const viewBoxHeight = viewBox[3];

  // Renderer always emits width/height, but viewBox fallback keeps the browser helper resilient to future SVG sources.
  return {
    height: Number.isFinite(viewBoxHeight) && viewBoxHeight > 0 ? viewBoxHeight : 720,
    width: Number.isFinite(viewBoxWidth) && viewBoxWidth > 0 ? viewBoxWidth : 1280,
  };
}

function createExportFileStem(projectName?: string, diagramName?: string): string {
  const parts = ['tabliodb', toFileSlug(projectName), toFileSlug(diagramName)].filter(Boolean);

  return parts.join('-') || 'tabliodb-diagram';
}

function toFileSlug(value?: string): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof TabliodbApiError && error.status === 401;
}
