/**
 * Tabliodb API
 * 0.1.0
 * DO NOT MODIFY - This file has been generated using oazapfts.
 * See https://www.npmjs.com/package/oazapfts
 */
import * as Oazapfts from '@oazapfts/runtime';
import * as QS from '@oazapfts/runtime/query';
export const defaults: Oazapfts.Defaults<Oazapfts.CustomHeaders> = {
  headers: {},
  baseUrl: '/api',
};
const oazapfts = Oazapfts.runtime(defaults);
export const servers = {
  server1: '/api',
};
export type ServerDependencyHealthDtoOutput = {
  latencyMs?: number;
  message?: string;
  status: Status;
};
export type ServerHealthResponseDtoOutput = {
  checkedAt: string;
  dependencies: {
    database: ServerDependencyHealthDtoOutput;
    redis: ServerDependencyHealthDtoOutput;
    storage: ServerDependencyHealthDtoOutput;
  };
  name: string;
  ok: boolean;
  uptimeSeconds: number;
  version: string;
};
export type ServerLivenessResponseDtoOutput = {
  checkedAt: string;
  name: string;
  ok: true;
  uptimeSeconds: number;
  version: string;
};
export type ServerHttpRouteMetricsDtoOutput = {
  averageDurationMs: number;
  count: number;
  errorCount: number;
  lastSeenAt: string;
  lastStatusCode: number;
  maxDurationMs: number;
  method: string;
  p95DurationMs: number;
  path: string;
};
export type ServerMemoryMetricsDtoOutput = {
  arrayBuffers: number;
  external: number;
  heapTotal: number;
  heapUsed: number;
  rss: number;
};
export type ServerRealtimeMetricsDtoOutput = {
  activeConnections: number;
  activeRooms: number;
};
export type ServerMetricsResponseDtoOutput = {
  generatedAt: string;
  http: {
    errorRequests: number;
    methods: {
      count: number;
      method: string;
    }[];
    routes: ServerHttpRouteMetricsDtoOutput[];
    statusGroups: {
      clientError: number;
      informational: number;
      redirection: number;
      serverError: number;
      success: number;
    };
    totalRequests: number;
  };
  process: {
    memoryBytes: ServerMemoryMetricsDtoOutput;
    nodeVersion: string;
    pid: number;
    uptimeSeconds: number;
  };
  realtime: ServerRealtimeMetricsDtoOutput;
  startedAt: string;
  window: {
    maxTrackedRoutes: number;
    routeDurationSampleSize: number;
  };
};
export type AuthUserDtoOutput = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  cursorColor: string;
  instanceRole: InstanceRole | null;
  passwordChangeRequired: boolean;
};
export type CurrentUserProfileUpdateDto = {
  cursorColor?: string;
  name?: string;
};
export type CurrentUserPasswordUpdateDto = {
  currentPassword: string;
  password: string;
};
export type CurrentUserTemporaryPasswordUpdateDto = {
  password: string;
};
export type CurrentUserEditorPreferenceDtoOutput = {
  diagramId: string | null;
  diagramName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  projectId: string | null;
  projectName: string | null;
  updatedAt: string | null;
  workspaceSlug: string | null;
};
export type CurrentUserEditorPreferenceUpdateDto = {
  diagramId?: string | null;
  organizationId: string;
  projectId?: string | null;
};
export type SessionBindingPublicKeyDto = {
  crv: Crv;
  ext?: boolean;
  key_ops?: string[];
  kty: Kty;
  x: string;
  y: string;
};
export type SessionBindingDto = {
  algorithm: Algorithm;
  publicKey: SessionBindingPublicKeyDto;
};
export type SignUpDto = {
  email: string;
  password: string;
  sessionBinding?: SessionBindingDto;
  name: string;
};
export type LoginResponseDtoOutput = {
  accessToken: string;
  user: AuthUserDtoOutput;
};
export type LoginCredentialDto = {
  email: string;
  password: string;
  sessionBinding?: SessionBindingDto;
};
export type OidcLoginProviderDtoOutput = {
  buttonLabel: string;
  enabled: boolean;
};
export type OidcLoginStartDto = {
  returnTo?: string;
  sessionBinding?: SessionBindingDto;
};
export type OidcLoginStartResponseDtoOutput = {
  authorizationUrl: string;
};
export type LogoutResponseDtoOutput = {
  successful: boolean;
};
export type PasswordResetRequestDto = {
  email: string;
};
export type PasswordResetRequestResponseDtoOutput = {
  expiresAt: string | null;
  resetToken: string | null;
  resetUrl: string | null;
  successful: boolean;
};
export type PasswordResetConfirmDto = {
  password: string;
  token: string;
};
export type PasswordResetConfirmResponseDtoOutput = {
  revokedSessions: number;
  successful: boolean;
};
export type ApiKeyCreateDto = {
  expiresInDays?: number;
  name?: string;
  permissions?: Permissions[];
};
export type ApiKeyDtoOutput = {
  createdAt: string;
  expiresAt: string | null;
  id: string;
  lastUsedAt: string | null;
  name: string;
  permissions: Permissions[];
  prefix: string;
  revokedAt: string | null;
  updatedAt: string;
};
export type ApiKeyCreateResponseDtoOutput = {
  secret: string;
  apiKey: ApiKeyDtoOutput;
};
export type ApiKeyListResponseDtoOutput = {
  items: ApiKeyDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type ApiKeyRevokeResponseDtoOutput = {
  id: string;
  revoked: boolean;
};
export type CommentLexicalDocumentDto = {
  root: {
    children: any[];
    type: Type;
    [key: string]: any;
  };
  [key: string]: any;
};
export type CommentThreadCreateDto = {
  bodyJson: CommentLexicalDocumentDto;
  diagramId: string;
  targetId: string | null;
  targetType: TargetType;
};
export type CommentLexicalDocumentDtoOutput = {
  root: {
    children: any[];
    type: Type;
    [key: string]: any;
  };
  [key: string]: any;
};
export type CommentResponseDtoOutput = {
  author: {
    avatarUrl: string | null;
    cursorColor: string;
    email: string;
    id: string;
    name: string;
  };
  body: string;
  bodyFormat: BodyFormat;
  bodyJson: CommentLexicalDocumentDtoOutput;
  bodyText: string;
  createdAt: string;
  createdById: string;
  deletedAt: string | null;
  editedAt: string | null;
  id: string;
  mentionedUserIds: string[];
  parentCommentId: string | null;
  replyCount: number;
  threadId: string;
  updatedAt: string;
};
export type CommentThreadResponseDtoOutput = {
  thread: {
    createdAt: string;
    createdById: string;
    diagramId: string;
    id: string;
    resolvedAt: string | null;
    resolvedById: string | null;
    status: Status2;
    targetId: string | null;
    targetType: TargetType;
    unreadCount: number;
    updatedAt: string;
  };
  comment: CommentResponseDtoOutput;
};
export type CommentThreadTargetSummaryDtoOutput = {
  openCount: number;
  resolvedCount: number;
  targetId: string | null;
  targetType: TargetType;
  totalCount: number;
  unreadCount: number;
  updatedAt: string | null;
};
export type CommentDiagramSummaryDtoOutput = {
  diagramId: string;
  openCount: number;
  resolvedCount: number;
  targets: CommentThreadTargetSummaryDtoOutput[];
  totalCount: number;
  unreadCount: number;
  updatedAt: string | null;
};
export type CommentThreadListItemDtoOutput = {
  createdAt: string;
  createdById: string;
  diagramId: string;
  id: string;
  resolvedAt: string | null;
  resolvedById: string | null;
  status: Status2;
  targetId: string | null;
  targetType: TargetType;
  unreadCount: number;
  updatedAt: string;
};
export type CommentThreadListResponseDtoOutput = {
  items: CommentThreadListItemDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type CommentListResponseDtoOutput = {
  items: CommentResponseDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type CommentReplyCreateDto = {
  bodyJson: CommentLexicalDocumentDto;
  parentCommentId?: string | null;
};
export type CommentUpdateDto = {
  bodyJson: CommentLexicalDocumentDto;
};
export type CommentThreadReadStateDtoOutput = {
  lastReadAt: string | null;
  lastReadCommentId: string | null;
  readers: {
    lastReadAt: string;
    lastReadCommentId: string | null;
    user: {
      avatarUrl: string | null;
      cursorColor: string;
      email: string;
      id: string;
      name: string;
    };
  }[];
  threadId: string;
  totalReaderCount: number;
  unreadCount: number;
  updatedAt: string | null;
};
export type CommentThreadStatusResponseDtoOutput = {
  createdAt: string;
  createdById: string;
  diagramId: string;
  id: string;
  resolvedAt: string | null;
  resolvedById: string | null;
  status: Status2;
  targetId: string | null;
  targetType: TargetType;
  unreadCount: number;
  updatedAt: string;
};
export type DiagramShareLinkDtoOutput = {
  id: string;
  diagramId: string;
  snapshotId: string | null;
  targetType: TargetType2;
  label: string | null;
  status: Status3;
  expiresAt: string | null;
  revokedAt: string | null;
  createdById: string;
  createdByName: string;
  accessCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type DiagramShareLinkListResponseDtoOutput = {
  items: DiagramShareLinkDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type DiagramShareLinkCreateDto = {
  expiresAt?: string | null;
  label?: string;
  snapshotId?: string;
  targetType?: TargetType2;
};
export type DiagramShareLinkCreateResponseDtoOutput = {
  shareLink: DiagramShareLinkDtoOutput;
  token: string;
  url: string;
};
export type DiagramShareLinkRevokeResponseDtoOutput = {
  successful: boolean;
};
export type DiagramCreateDto = {
  organizationId: string;
  projectId?: string | null;
  name: string;
  dialect?: Dialect;
};
export type DiagramResponseDtoOutput = {
  id: string;
  organizationId: string;
  projectId: string | null;
  name: string;
  dialect: Dialect;
  status: Status4;
  role: Role;
  createdAt: string;
  updatedAt: string;
};
export type WorkspaceDiagramCreateDto = {
  name: string;
  dialect?: Dialect;
};
export type DiagramListResponseDtoOutput = {
  items: DiagramResponseDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type DiagramMemberDtoOutput = {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  cursorColor: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
};
export type DiagramMemberListResponseDtoOutput = {
  items: DiagramMemberDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type DiagramMemberCreateDto = {
  email: string;
  role?: Role2;
};
export type DiagramEffectiveAccessSourceDtoOutput = {
  inherited: boolean;
  role: Role3;
  sourceId: string | null;
  sourceLabel: string;
  sourceName: string | null;
  sourceType: SourceType;
};
export type DiagramEffectiveAccessDtoOutput = {
  accessType: AccessType;
  avatarUrl: string | null;
  cursorColor: string;
  directRole: DirectRole | null;
  email: string;
  name: string;
  role: Role3;
  sources: DiagramEffectiveAccessSourceDtoOutput[];
  userId: string;
};
export type DiagramEffectiveAccessListResponseDtoOutput = {
  items: DiagramEffectiveAccessDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type DiagramOwnershipTransferDto = {
  userId: string;
};
export type DiagramMemberUpdateDto = {
  role: Role4;
};
export type DiagramMemberRemoveResponseDtoOutput = {
  successful: boolean;
};
export type DiagramUpdateDto = {
  name?: string;
  dialect?: Dialect;
  projectId?: string | null;
};
export type DiagramExportResponseDtoOutput = {
  content: string;
  filename: string;
  format: Format;
  mediaType: string;
  warnings: {
    code: string;
    message: string;
    statement?: string;
    target?: {
      id: string;
      type: string;
    };
  }[];
};
export type DiagramImportDto = {
  content: string;
  dialect?: Dialect;
  mode?: Mode;
  source: Source;
};
export type DiagramImportResponseDtoOutput = {
  diagram: DiagramResponseDtoOutput;
  model: {
    schemaVersion: number;
    dialect: Dialect;
    tables: {
      [key: string]: {
        id: string;
        name: string;
        schema?: string;
        position: {
          x: number;
          y: number;
        };
        width: number;
        color?: string;
        collapsed?: boolean;
        displayMode?: DisplayMode;
        columnIds: string[];
        indexIds: string[];
        groupId?: string;
        comment?: string;
      };
    };
    columns: {
      [key: string]: {
        id: string;
        tableId: string;
        name: string;
        type: {
          family: Family;
          length?: number;
          precision?: number;
          scale?: number;
          enumId?: string;
          raw?: string;
        };
        primaryKey: boolean;
        nullable: boolean;
        unique: boolean;
        autoIncrement: boolean;
        unsigned?: boolean;
        defaultValue?: string;
        generatedExpression?: string;
        collation?: string;
        comment?: string;
      };
    };
    indexes: {
      [key: string]: {
        id: string;
        tableId: string;
        name: string;
        columns: {
          columnId: string;
          order?: Order;
          nulls?: Nulls;
        }[];
        unique: boolean;
        method?: Method;
        where?: string;
        includeColumnIds?: string[];
        comment?: string;
      };
    };
    relationships: {
      [key: string]: {
        id: string;
        sourceTableId: string;
        sourceColumnIds: string[];
        targetTableId: string;
        targetColumnIds: string[];
        cardinality: Cardinality;
        onDelete?: OnDelete;
        onUpdate?: OnUpdate;
        name?: string;
        deferrable?: boolean;
        matchType?: MatchType;
        comment?: string;
      };
    };
    enums: {
      [key: string]: {
        id: string;
        name: string;
        schema?: string;
        values: string[];
        comment?: string;
      };
    };
    checks: {
      [key: string]: {
        id: string;
        tableId: string;
        columnId?: string;
        name: string;
        expression: string;
        comment?: string;
      };
    };
    notes: {
      [key: string]: {
        id: string;
        text: string;
        position: {
          x: number;
          y: number;
        };
        width?: number;
        color?: string;
      };
    };
    groups: {
      [key: string]: {
        id: string;
        name: string;
        position: {
          x: number;
          y: number;
        };
        width: number;
        height: number;
        color?: string;
        tableIds: string[];
      };
    };
    metadata: {
      name: string;
      updatedAt?: string;
      viewport?: {
        x: number;
        y: number;
        zoom: number;
      };
      gridSize?: number;
      tableMinWidth?: number;
      relationshipRouting?: RelationshipRouting;
    };
  };
  warnings: {
    code: string;
    message: string;
    statement?: string;
    target?: {
      id: string;
      type: string;
    };
  }[];
};
export type DiagramReviewEventDtoOutput = {
  action: Action;
  createdAt: string;
  createdById: string;
  diagramId: string;
  id: string;
  message: string | null;
  nextStatus: NextStatus;
  previousStatus: PreviousStatus;
  reviewer: {
    avatarUrl: string | null;
    cursorColor: string;
    email: string;
    id: string;
    name: string;
  };
  snapshotId: string | null;
};
export type DiagramReviewSummaryDtoOutput = {
  approvedCount: number;
  changesRequestedCount: number;
  commentedCount: number;
  currentStatus: CurrentStatus;
  diagramId: string;
  eventCount: number;
  latestEvent: DiagramReviewEventDtoOutput | null;
  recentEvents: DiagramReviewEventDtoOutput[];
};
export type DiagramReviewEventListResponseDtoOutput = {
  items: DiagramReviewEventDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type DiagramReviewActionCreateDto = {
  action: Action;
  message?: string | null;
};
export type InvitationCreateDto = {
  email: string;
  organizationId?: string;
  organizationRole?: OrganizationRole;
  projectId?: string;
  projectRole?: ProjectRole;
  diagramId?: string;
  diagramRole?: DiagramRole;
  message?: string;
  expiresInDays?: number;
};
export type InvitationDtoOutput = {
  id: string;
  email: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationRole: OrganizationRole;
  projectId: string | null;
  projectName: string | null;
  projectRole: ProjectRole | null;
  diagramId: string | null;
  diagramName: string | null;
  diagramRole: DiagramRole | null;
  message: string | null;
  invitedById: string;
  invitedByName: string;
  acceptedById: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  expiresAt: string;
  createdAt: string;
  status: Status5;
};
export type InvitationCreateResponseDtoOutput = {
  invitation: InvitationDtoOutput;
  token: string;
  acceptUrl: string;
};
export type InvitationPublicDtoOutput = {
  email: string;
  organizationName: string;
  organizationRole: OrganizationRole;
  projectName: string | null;
  projectRole: ProjectRole | null;
  diagramName: string | null;
  diagramRole: DiagramRole | null;
  message: string | null;
  expiresAt: string;
  status: Status5;
};
export type InvitationAcceptDto = {
  token: string;
  name: string;
  password: string;
  sessionBinding?: SessionBindingDto;
};
export type InvitationAcceptResponseDtoOutput = {
  accessToken: string;
  user: AuthUserDtoOutput;
  invitation: InvitationPublicDtoOutput;
};
export type NotificationInboxItemDtoOutput = {
  comment: {
    author: {
      avatarUrl: string | null;
      cursorColor: string;
      email: string;
      id: string;
      name: string;
    };
    body: string;
    bodyFormat: BodyFormat;
    bodyJson: CommentLexicalDocumentDtoOutput;
    bodyText: string;
    createdAt: string;
    createdById: string;
    deletedAt: string | null;
    editedAt: string | null;
    id: string;
    mentionedUserIds: string[];
    parentCommentId: string | null;
    replyCount: number;
    threadId: string;
    updatedAt: string;
  };
  createdAt: string;
  diagram: {
    dialect: Dialect;
    id: string;
    name: string;
  };
  id: string;
  isUnread: boolean;
  parentComment: {
    author: {
      avatarUrl: string | null;
      cursorColor: string;
      email: string;
      id: string;
      name: string;
    };
    bodyText: string;
    id: string;
  } | null;
  project: {
    id: string;
    name: string;
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    slug: string;
  } | null;
  thread: {
    id: string;
    status: Status6;
    targetId: string | null;
    targetType: TargetType3;
    updatedAt: string;
  };
  type: Type2;
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
};
export type NotificationInboxListResponseDtoOutput = {
  items: NotificationInboxItemDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type NotificationSummaryDtoOutput = {
  totalCount: number;
  unreadCount: number;
  updatedAt: string | null;
};
export type OrganizationCreateDto = {
  name: string;
};
export type OrganizationDtoOutput = {
  id: string;
  name: string;
  slug: string;
  role: Role5;
  status: string;
  defaultProjectRole: DefaultProjectRole | null;
  allowMemberProjectCreate: boolean;
  createdAt: string;
  updatedAt: string;
};
export type OrganizationListResponseDtoOutput = {
  items: OrganizationDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type OrganizationSettingsDtoOutput = {
  id: string;
  name: string;
  slug: string;
  defaultProjectRole: DefaultProjectRole | null;
  allowMemberProjectCreate: boolean;
  createdAt: string;
  updatedAt: string;
};
export type OrganizationSettingsUpdateDto = {
  name?: string;
  defaultProjectRole?: DefaultProjectRole | null;
  allowMemberProjectCreate?: boolean;
};
export type OrganizationMemberDtoOutput = {
  avatarUrl: string | null;
  cursorColor: string;
  createdAt: string;
  email: string;
  joinedAt: string | null;
  name: string;
  role: Role5;
  status: Status7;
  updatedAt: string;
  userId: string;
};
export type OrganizationMemberListResponseDtoOutput = {
  items: OrganizationMemberDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type OrganizationMemberCreateDto = {
  email: string;
  role?: Role6;
};
export type OrganizationMemberUpdateDto = {
  role: Role6;
};
export type OrganizationMemberRemoveResponseDtoOutput = {
  successful: boolean;
};
export type OrganizationOwnershipTransferDto = {
  userId: string;
};
export type AuditLogDtoOutput = {
  id: string;
  organizationId: string | null;
  projectId: string | null;
  diagramId: string | null;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: {
    [key: string]: any;
  };
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
};
export type AuditLogListResponseDtoOutput = {
  items: AuditLogDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type ProjectResponseDtoOutput = {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  projectRole: ProjectRole2;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};
export type ProjectListResponseDtoOutput = {
  items: ProjectResponseDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type ProjectCreateDto = {
  organizationId: string;
  name: string;
  description?: string;
};
export type ProjectUpdateDto = {
  name?: string;
  description?: string | null;
};
export type ProjectArchiveResponseDtoOutput = {
  successful: boolean;
};
export type ProjectMemberDtoOutput = {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  cursorColor: string;
  role: Role7;
  createdAt: string;
  updatedAt: string;
};
export type ProjectMemberListResponseDtoOutput = {
  items: ProjectMemberDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type ProjectMemberCreateDto = {
  email: string;
  role?: Role8;
};
export type ProjectOwnershipTransferDto = {
  userId: string;
};
export type ProjectMemberUpdateDto = {
  role: Role8;
};
export type ProjectMemberRemoveResponseDtoOutput = {
  successful: boolean;
};
export type PublicDiagramShareSnapshotDtoOutput = {
  id: string;
  version: number;
  message: string | null;
  createdAt: string;
};
export type PublicDiagramShareResponseDtoOutput = {
  diagram: {
    id: string;
    dialect: Dialect;
    name: string;
    organizationName: string;
    projectName: string | null;
  };
  model: {
    schemaVersion: number;
    dialect: Dialect;
    tables: {
      [key: string]: {
        id: string;
        name: string;
        schema?: string;
        position: {
          x: number;
          y: number;
        };
        width: number;
        color?: string;
        collapsed?: boolean;
        displayMode?: DisplayMode;
        columnIds: string[];
        indexIds: string[];
        groupId?: string;
        comment?: string;
      };
    };
    columns: {
      [key: string]: {
        id: string;
        tableId: string;
        name: string;
        type: {
          family: Family;
          length?: number;
          precision?: number;
          scale?: number;
          enumId?: string;
          raw?: string;
        };
        primaryKey: boolean;
        nullable: boolean;
        unique: boolean;
        autoIncrement: boolean;
        unsigned?: boolean;
        defaultValue?: string;
        generatedExpression?: string;
        collation?: string;
        comment?: string;
      };
    };
    indexes: {
      [key: string]: {
        id: string;
        tableId: string;
        name: string;
        columns: {
          columnId: string;
          order?: Order;
          nulls?: Nulls;
        }[];
        unique: boolean;
        method?: Method;
        where?: string;
        includeColumnIds?: string[];
        comment?: string;
      };
    };
    relationships: {
      [key: string]: {
        id: string;
        sourceTableId: string;
        sourceColumnIds: string[];
        targetTableId: string;
        targetColumnIds: string[];
        cardinality: Cardinality;
        onDelete?: OnDelete;
        onUpdate?: OnUpdate;
        name?: string;
        deferrable?: boolean;
        matchType?: MatchType;
        comment?: string;
      };
    };
    enums: {
      [key: string]: {
        id: string;
        name: string;
        schema?: string;
        values: string[];
        comment?: string;
      };
    };
    checks: {
      [key: string]: {
        id: string;
        tableId: string;
        columnId?: string;
        name: string;
        expression: string;
        comment?: string;
      };
    };
    notes: {
      [key: string]: {
        id: string;
        text: string;
        position: {
          x: number;
          y: number;
        };
        width?: number;
        color?: string;
      };
    };
    groups: {
      [key: string]: {
        id: string;
        name: string;
        position: {
          x: number;
          y: number;
        };
        width: number;
        height: number;
        color?: string;
        tableIds: string[];
      };
    };
    metadata: {
      name: string;
      updatedAt?: string;
      viewport?: {
        x: number;
        y: number;
        zoom: number;
      };
      gridSize?: number;
      tableMinWidth?: number;
      relationshipRouting?: RelationshipRouting;
    };
  };
  share: {
    expiresAt: string | null;
    targetType: TargetType4;
  };
  snapshot: PublicDiagramShareSnapshotDtoOutput | null;
};
export type ReviewSignalResponseDtoOutput = {
  code: string;
  diagramId: string;
  generatedAt: string;
  id: string;
  ignoredAt: string | null;
  ignoredById: string | null;
  message: string;
  ruleKey: string;
  severity: Severity;
  targetId: string | null;
  targetType: string;
  title: string;
};
export type ReviewSignalListResponseDtoOutput = {
  items: ReviewSignalResponseDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type ReviewSignalSettingsDtoOutput = {
  disabledRuleKeys: DisabledRuleKeys[];
};
export type ReviewSignalSettingsDto = {
  disabledRuleKeys?: DisabledRuleKeys[];
};
export type ReviewSignalEffectiveSettingsDtoOutput = {
  diagram: ReviewSignalSettingsDtoOutput;
  effective: ReviewSignalSettingsDtoOutput;
  project: ReviewSignalSettingsDtoOutput;
};
export type SetupStatusResponseDtoOutput = {
  completedAt: string | null;
  hasOrganization: boolean;
  hasOwner: boolean;
  isSetupComplete: boolean;
  signupPolicy: SignupPolicy;
};
export type SetupCreateDto = {
  ownerEmail: string;
  ownerName: string;
  ownerPassword: string;
  publicUrl?: string;
  sessionBinding?: SessionBindingDto;
  workspaceName: string;
};
export type SetupCreateResponseDtoOutput = {
  accessToken: string;
  setup: SetupStatusResponseDtoOutput;
  user: {
    avatarUrl: string | null;
    cursorColor: string;
    email: string;
    id: string;
    name: string;
  };
};
export type InstanceAuthSettingsDtoOutput = {
  allowedDomains: string[];
  signupPolicy: SignupPolicy;
};
export type InstanceAuthSettingsUpdateDto = {
  allowedDomains: string[];
  signupPolicy: SignupPolicy;
};
export type OidcProviderSettingsDtoOutput = {
  autoCreateUsers: boolean;
  autoJoinOrganizationId: string | null;
  autoJoinOrganizationRole: AutoJoinOrganizationRole | null;
  buttonLabel: string;
  clientId: string | null;
  clientSecretConfigured: boolean;
  clientSecretKeyId: string | null;
  clientSecretUpdatedAt: string | null;
  enabled: boolean;
  issuerUrl: string | null;
  scopes: string[];
};
export type OidcProviderSettingsUpdateDto = {
  autoCreateUsers: boolean;
  autoJoinOrganizationId: string | null;
  autoJoinOrganizationRole: AutoJoinOrganizationRole | null;
  buttonLabel: string;
  clearClientSecret?: boolean;
  clientId: string | null;
  clientSecret?: string;
  enabled: boolean;
  issuerUrl: string | null;
  scopes: string[];
};
export type SmtpSettingsDtoOutput = {
  enabled: boolean;
  fromEmail: string | null;
  fromName: string | null;
  host: string | null;
  passwordConfigured: boolean;
  passwordKeyId: string | null;
  passwordUpdatedAt: string | null;
  port: number | null;
  replyToEmail: string | null;
  security: SmtpSecurity_Output;
  username: string | null;
};
export type SmtpSettingsUpdateDto = {
  clearPassword?: boolean;
  enabled: boolean;
  fromEmail: string | null;
  fromName: string | null;
  host: string | null;
  password?: string;
  port: number | null;
  replyToEmail: string | null;
  security: SmtpSecurity;
  username: string | null;
};
export type SnapshotCreateDto = {
  diagramId: string;
  message?: string;
  snapshot: {
    schemaVersion?: number;
    dialect: Dialect;
    tables: {
      [key: string]: {
        id: string;
        name: string;
        schema?: string;
        position: {
          x: number;
          y: number;
        };
        width?: number;
        color?: string;
        collapsed?: boolean;
        displayMode?: DisplayMode;
        columnIds: string[];
        indexIds?: string[];
        groupId?: string;
        comment?: string;
      };
    };
    columns: {
      [key: string]: {
        id: string;
        tableId: string;
        name: string;
        type: {
          family: Family;
          length?: number;
          precision?: number;
          scale?: number;
          enumId?: string;
          raw?: string;
        };
        primaryKey?: boolean;
        nullable?: boolean;
        unique?: boolean;
        autoIncrement?: boolean;
        unsigned?: boolean;
        defaultValue?: string;
        generatedExpression?: string;
        collation?: string;
        comment?: string;
      };
    };
    indexes: {
      [key: string]: {
        id: string;
        tableId: string;
        name: string;
        columns: {
          columnId: string;
          order?: Order;
          nulls?: Nulls;
        }[];
        unique?: boolean;
        method?: Method;
        where?: string;
        includeColumnIds?: string[];
        comment?: string;
      };
    };
    relationships: {
      [key: string]: {
        id: string;
        sourceTableId: string;
        sourceColumnIds: string[];
        targetTableId: string;
        targetColumnIds: string[];
        cardinality: Cardinality;
        onDelete?: OnDelete;
        onUpdate?: OnUpdate;
        name?: string;
        deferrable?: boolean;
        matchType?: MatchType;
        comment?: string;
      };
    };
    enums: {
      [key: string]: {
        id: string;
        name: string;
        schema?: string;
        values: string[];
        comment?: string;
      };
    };
    checks?: {
      [key: string]: {
        id: string;
        tableId: string;
        columnId?: string;
        name: string;
        expression: string;
        comment?: string;
      };
    };
    notes: {
      [key: string]: {
        id: string;
        text: string;
        position: {
          x: number;
          y: number;
        };
        width?: number;
        color?: string;
      };
    };
    groups?: {
      [key: string]: {
        id: string;
        name: string;
        position: {
          x: number;
          y: number;
        };
        width: number;
        height: number;
        color?: string;
        tableIds: string[];
      };
    };
    metadata: {
      name: string;
      updatedAt?: string;
      viewport?: {
        x: number;
        y: number;
        zoom: number;
      };
      gridSize?: number;
      tableMinWidth?: number;
      relationshipRouting?: RelationshipRouting;
    };
  };
};
export type SnapshotResponseDtoOutput = {
  id: string;
  diagramId: string;
  version: number;
  message: string | null;
  snapshot: {
    schemaVersion: number;
    dialect: Dialect;
    tables: {
      [key: string]: {
        id: string;
        name: string;
        schema?: string;
        position: {
          x: number;
          y: number;
        };
        width: number;
        color?: string;
        collapsed?: boolean;
        displayMode?: DisplayMode;
        columnIds: string[];
        indexIds: string[];
        groupId?: string;
        comment?: string;
      };
    };
    columns: {
      [key: string]: {
        id: string;
        tableId: string;
        name: string;
        type: {
          family: Family;
          length?: number;
          precision?: number;
          scale?: number;
          enumId?: string;
          raw?: string;
        };
        primaryKey: boolean;
        nullable: boolean;
        unique: boolean;
        autoIncrement: boolean;
        unsigned?: boolean;
        defaultValue?: string;
        generatedExpression?: string;
        collation?: string;
        comment?: string;
      };
    };
    indexes: {
      [key: string]: {
        id: string;
        tableId: string;
        name: string;
        columns: {
          columnId: string;
          order?: Order;
          nulls?: Nulls;
        }[];
        unique: boolean;
        method?: Method;
        where?: string;
        includeColumnIds?: string[];
        comment?: string;
      };
    };
    relationships: {
      [key: string]: {
        id: string;
        sourceTableId: string;
        sourceColumnIds: string[];
        targetTableId: string;
        targetColumnIds: string[];
        cardinality: Cardinality;
        onDelete?: OnDelete;
        onUpdate?: OnUpdate;
        name?: string;
        deferrable?: boolean;
        matchType?: MatchType;
        comment?: string;
      };
    };
    enums: {
      [key: string]: {
        id: string;
        name: string;
        schema?: string;
        values: string[];
        comment?: string;
      };
    };
    checks: {
      [key: string]: {
        id: string;
        tableId: string;
        columnId?: string;
        name: string;
        expression: string;
        comment?: string;
      };
    };
    notes: {
      [key: string]: {
        id: string;
        text: string;
        position: {
          x: number;
          y: number;
        };
        width?: number;
        color?: string;
      };
    };
    groups: {
      [key: string]: {
        id: string;
        name: string;
        position: {
          x: number;
          y: number;
        };
        width: number;
        height: number;
        color?: string;
        tableIds: string[];
      };
    };
    metadata: {
      name: string;
      updatedAt?: string;
      viewport?: {
        x: number;
        y: number;
        zoom: number;
      };
      gridSize?: number;
      tableMinWidth?: number;
      relationshipRouting?: RelationshipRouting;
    };
  };
  restoredFromSnapshotId: string | null;
  createdAt: string;
};
export type SnapshotListResponseDtoOutput = {
  items: SnapshotResponseDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type SnapshotReferenceDtoOutput = {
  id: string;
  diagramId: string;
  version: number;
  message: string | null;
  restoredFromSnapshotId: string | null;
  createdAt: string;
};
export type SnapshotMigrationSqlWarningDtoOutput = {
  code: string;
  message: string;
  statement?: string;
  target?: {
    id: string;
    type: Type3;
  };
};
export type SnapshotMigrationSqlDtoOutput = {
  dialect: Dialect;
  sql: string;
  warnings: SnapshotMigrationSqlWarningDtoOutput[];
};
export type SnapshotTableRenameDtoOutput = {
  id: string;
  fromName: string;
  toName: string;
};
export type SnapshotTableChangeSummaryDtoOutput = {
  added: number;
  removed: number;
  changed: number;
  renamed: SnapshotTableRenameDtoOutput[];
};
export type SnapshotEntityChangeSummaryDtoOutput = {
  added: number;
  removed: number;
  changed: number;
};
export type SnapshotDiffResponseDtoOutput = {
  fromSnapshot: SnapshotReferenceDtoOutput;
  toSnapshot: SnapshotReferenceDtoOutput;
  migrationSql: SnapshotMigrationSqlDtoOutput;
  tables: SnapshotTableChangeSummaryDtoOutput;
  columns: SnapshotEntityChangeSummaryDtoOutput;
  relationships: SnapshotEntityChangeSummaryDtoOutput;
  indexes: SnapshotEntityChangeSummaryDtoOutput;
  enums: SnapshotEntityChangeSummaryDtoOutput;
  checks: SnapshotEntityChangeSummaryDtoOutput;
  notes: SnapshotEntityChangeSummaryDtoOutput;
  groups: SnapshotEntityChangeSummaryDtoOutput;
  dialectChanged: boolean;
  metadataChanged: boolean;
  schemaVersionChanged: boolean;
};
export type TeamResponseDtoOutput = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  memberCount: number;
  diagramAccessCount: number;
  projectAccessCount: number;
  createdAt: string;
  updatedAt: string;
};
export type TeamListResponseDtoOutput = {
  items: TeamResponseDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type TeamCreateDto = {
  organizationId: string;
  name: string;
  description?: string;
};
export type TeamUpdateDto = {
  name?: string;
  description?: string | null;
};
export type TeamArchiveResponseDtoOutput = {
  successful: boolean;
};
export type TeamMemberDtoOutput = {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  cursorColor: string;
  createdAt: string;
};
export type TeamMemberListResponseDtoOutput = {
  items: TeamMemberDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type TeamMemberCreateDto = {
  email: string;
};
export type TeamMemberRemoveResponseDtoOutput = {
  successful: boolean;
};
export type TeamProjectAccessDtoOutput = {
  projectId: string;
  projectName: string;
  projectSlug: string;
  role: Role8;
  createdAt: string;
  updatedAt: string;
};
export type TeamProjectAccessListResponseDtoOutput = {
  items: TeamProjectAccessDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type TeamProjectAccessUpsertDto = {
  projectId: string;
  role?: Role8;
};
export type TeamProjectAccessRemoveResponseDtoOutput = {
  successful: boolean;
};
export type TeamDiagramAccessDtoOutput = {
  diagramId: string;
  diagramName: string;
  projectId: string | null;
  role: Role8;
  createdAt: string;
  updatedAt: string;
};
export type TeamDiagramAccessListResponseDtoOutput = {
  items: TeamDiagramAccessDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type TeamDiagramAccessUpsertDto = {
  diagramId: string;
  role?: Role8;
};
export type TeamDiagramAccessRemoveResponseDtoOutput = {
  successful: boolean;
};
export type UserResponseDtoOutput = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  cursorColor: string;
  isDisabled: boolean;
  passwordChangeRequired: boolean;
  instanceRole: InstanceRole | null;
  organizations: {
    id: string;
    name: string;
    slug: string;
    role: string;
    status: string;
  }[];
  createdAt: string;
  updatedAt: string;
};
export type UserListResponseDtoOutput = {
  items: UserResponseDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type UserCreateDto = {
  email: string;
  name: string;
  password: string;
  instanceRole?: InstanceRole2;
};
export type UserStatusUpdateDto = {
  isDisabled: boolean;
};
export type UserPasswordResetDto = {
  password: string;
};
export type UserPasswordResetResponseDtoOutput = {
  successful: boolean;
  revokedSessions: number;
};
export type UserSessionRevokeResponseDtoOutput = {
  successful: boolean;
  revokedSessions: number;
};
export type CurrentUserResponseDtoOutput = AuthUserDtoOutput;
export function getServerHealth(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ServerHealthResponseDtoOutput;
    }>('/server/health', {
      ...opts,
    }),
  );
}
export function getServerLiveness(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ServerLivenessResponseDtoOutput;
    }>('/server/live', {
      ...opts,
    }),
  );
}
export function getServerReadiness(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ServerHealthResponseDtoOutput;
    }>('/server/ready', {
      ...opts,
    }),
  );
}
export function getServerMetrics(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ServerMetricsResponseDtoOutput;
    }>('/server/metrics', {
      ...opts,
    }),
  );
}
export function getCurrentUser(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: AuthUserDtoOutput;
    }>('/auth/me', {
      ...opts,
    }),
  );
}
export function updateCurrentUserProfile(
  {
    currentUserProfileUpdateDto,
  }: {
    currentUserProfileUpdateDto: CurrentUserProfileUpdateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: AuthUserDtoOutput;
    }>(
      '/auth/me/profile',
      oazapfts.json({
        ...opts,
        method: 'PATCH',
        body: currentUserProfileUpdateDto,
      }),
    ),
  );
}
export function updateCurrentUserPassword(
  {
    currentUserPasswordUpdateDto,
  }: {
    currentUserPasswordUpdateDto: CurrentUserPasswordUpdateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: AuthUserDtoOutput;
    }>(
      '/auth/me/password',
      oazapfts.json({
        ...opts,
        method: 'PATCH',
        body: currentUserPasswordUpdateDto,
      }),
    ),
  );
}
export function updateCurrentUserTemporaryPassword(
  {
    currentUserTemporaryPasswordUpdateDto,
  }: {
    currentUserTemporaryPasswordUpdateDto: CurrentUserTemporaryPasswordUpdateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: AuthUserDtoOutput;
    }>(
      '/auth/me/temporary-password',
      oazapfts.json({
        ...opts,
        method: 'PATCH',
        body: currentUserTemporaryPasswordUpdateDto,
      }),
    ),
  );
}
export function getCurrentUserEditorPreference(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: CurrentUserEditorPreferenceDtoOutput;
    }>('/auth/me/editor-preference', {
      ...opts,
    }),
  );
}
export function updateCurrentUserEditorPreference(
  {
    currentUserEditorPreferenceUpdateDto,
  }: {
    currentUserEditorPreferenceUpdateDto: CurrentUserEditorPreferenceUpdateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: CurrentUserEditorPreferenceDtoOutput;
    }>(
      '/auth/me/editor-preference',
      oazapfts.json({
        ...opts,
        method: 'PATCH',
        body: currentUserEditorPreferenceUpdateDto,
      }),
    ),
  );
}
export function uploadCurrentUserAvatar(
  {
    body,
  }: {
    body: {
      file: Blob;
    };
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: AuthUserDtoOutput;
    }>(
      '/auth/me/avatar',
      oazapfts.multipart({
        ...opts,
        method: 'POST',
        body,
      }),
    ),
  );
}
export function deleteCurrentUserAvatar(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: AuthUserDtoOutput;
    }>('/auth/me/avatar', {
      ...opts,
      method: 'DELETE',
    }),
  );
}
export function signUp(
  {
    signUpDto,
  }: {
    signUpDto: SignUpDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: LoginResponseDtoOutput;
    }>(
      '/auth/sign-up',
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: signUpDto,
      }),
    ),
  );
}
export function login(
  {
    loginCredentialDto,
  }: {
    loginCredentialDto: LoginCredentialDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: LoginResponseDtoOutput;
    }>(
      '/auth/login',
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: loginCredentialDto,
      }),
    ),
  );
}
export function getOidcLoginProvider(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: OidcLoginProviderDtoOutput;
    }>('/auth/oidc/provider', {
      ...opts,
    }),
  );
}
export function startOidcLogin(
  {
    oidcLoginStartDto,
  }: {
    oidcLoginStartDto: OidcLoginStartDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: OidcLoginStartResponseDtoOutput;
    }>(
      '/auth/oidc/start',
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: oidcLoginStartDto,
      }),
    ),
  );
}
export function completeOidcLogin(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchText('/auth/oidc/callback', {
      ...opts,
    }),
  );
}
export function logout(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: LogoutResponseDtoOutput;
    }>('/auth/logout', {
      ...opts,
      method: 'POST',
    }),
  );
}
export function requestPasswordReset(
  {
    passwordResetRequestDto,
  }: {
    passwordResetRequestDto: PasswordResetRequestDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: PasswordResetRequestResponseDtoOutput;
    }>(
      '/auth/password-reset/request',
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: passwordResetRequestDto,
      }),
    ),
  );
}
export function confirmPasswordReset(
  {
    passwordResetConfirmDto,
  }: {
    passwordResetConfirmDto: PasswordResetConfirmDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: PasswordResetConfirmResponseDtoOutput;
    }>(
      '/auth/password-reset/confirm',
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: passwordResetConfirmDto,
      }),
    ),
  );
}
export function createApiKey(
  {
    apiKeyCreateDto,
  }: {
    apiKeyCreateDto: ApiKeyCreateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: ApiKeyCreateResponseDtoOutput;
    }>(
      '/auth/api-keys',
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: apiKeyCreateDto,
      }),
    ),
  );
}
export function getApiKeys(
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ApiKeyListResponseDtoOutput;
    }>(
      `/auth/api-keys${QS.query(
        QS.explode({
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function revokeApiKey(
  {
    apiKeyId,
  }: {
    apiKeyId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ApiKeyRevokeResponseDtoOutput;
    }>(`/auth/api-keys/${encodeURIComponent(apiKeyId)}`, {
      ...opts,
      method: 'DELETE',
    }),
  );
}
export function createCommentThread(
  {
    commentThreadCreateDto,
  }: {
    commentThreadCreateDto: CommentThreadCreateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: CommentThreadResponseDtoOutput;
    }>(
      '/comments/threads',
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: commentThreadCreateDto,
      }),
    ),
  );
}
export function getCommentDiagramSummary(
  {
    diagramId,
  }: {
    diagramId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: CommentDiagramSummaryDtoOutput;
    }>(`/comments/diagram/${encodeURIComponent(diagramId)}/summary`, {
      ...opts,
    }),
  );
}
export function getCommentThreads(
  {
    cursor,
    limit,
    diagramId,
  }: {
    cursor?: string;
    limit?: number;
    diagramId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: CommentThreadListResponseDtoOutput;
    }>(
      `/comments/diagram/${encodeURIComponent(diagramId)}/threads${QS.query(
        QS.explode({
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function getThreadComments(
  {
    parentCommentId,
    cursor,
    limit,
    threadId,
  }: {
    parentCommentId?: string;
    cursor?: string;
    limit?: number;
    threadId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: CommentListResponseDtoOutput;
    }>(
      `/comments/threads/${encodeURIComponent(threadId)}/comments${QS.query(
        QS.explode({
          parentCommentId,
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function replyToCommentThread(
  {
    threadId,
    commentReplyCreateDto,
  }: {
    threadId: string;
    commentReplyCreateDto: CommentReplyCreateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: CommentThreadResponseDtoOutput;
    }>(
      `/comments/threads/${encodeURIComponent(threadId)}/comments`,
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: commentReplyCreateDto,
      }),
    ),
  );
}
export function getCommentThreadRootComments(
  {
    cursor,
    limit,
    threadId,
  }: {
    cursor?: string;
    limit?: number;
    threadId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: CommentListResponseDtoOutput;
    }>(
      `/comments/threads/${encodeURIComponent(threadId)}/root-comments${QS.query(
        QS.explode({
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function getCommentReplies(
  {
    cursor,
    limit,
    commentId,
  }: {
    cursor?: string;
    limit?: number;
    commentId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: CommentListResponseDtoOutput;
    }>(
      `/comments/comments/${encodeURIComponent(commentId)}/replies${QS.query(
        QS.explode({
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function replyToComment(
  {
    commentId,
    commentReplyCreateDto,
  }: {
    commentId: string;
    commentReplyCreateDto: CommentReplyCreateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: CommentThreadResponseDtoOutput;
    }>(
      `/comments/comments/${encodeURIComponent(commentId)}/replies`,
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: commentReplyCreateDto,
      }),
    ),
  );
}
export function updateComment(
  {
    commentId,
    commentUpdateDto,
  }: {
    commentId: string;
    commentUpdateDto: CommentUpdateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: CommentResponseDtoOutput;
    }>(
      `/comments/comments/${encodeURIComponent(commentId)}`,
      oazapfts.json({
        ...opts,
        method: 'PATCH',
        body: commentUpdateDto,
      }),
    ),
  );
}
export function deleteComment(
  {
    commentId,
  }: {
    commentId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: CommentResponseDtoOutput;
    }>(`/comments/comments/${encodeURIComponent(commentId)}`, {
      ...opts,
      method: 'DELETE',
    }),
  );
}
export function getCommentThreadReadState(
  {
    threadId,
  }: {
    threadId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: CommentThreadReadStateDtoOutput;
    }>(`/comments/threads/${encodeURIComponent(threadId)}/read-state`, {
      ...opts,
    }),
  );
}
export function markCommentThreadRead(
  {
    threadId,
  }: {
    threadId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: CommentThreadReadStateDtoOutput;
    }>(`/comments/threads/${encodeURIComponent(threadId)}/read`, {
      ...opts,
      method: 'PATCH',
    }),
  );
}
export function resolveCommentThread(
  {
    threadId,
  }: {
    threadId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: CommentThreadStatusResponseDtoOutput;
    }>(`/comments/threads/${encodeURIComponent(threadId)}/resolve`, {
      ...opts,
      method: 'PATCH',
    }),
  );
}
export function unresolveCommentThread(
  {
    threadId,
  }: {
    threadId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: CommentThreadStatusResponseDtoOutput;
    }>(`/comments/threads/${encodeURIComponent(threadId)}/unresolve`, {
      ...opts,
      method: 'PATCH',
    }),
  );
}
export function getDiagramShareLinks(
  {
    cursor,
    limit,
    diagramId,
  }: {
    cursor?: string;
    limit?: number;
    diagramId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: DiagramShareLinkListResponseDtoOutput;
    }>(
      `/diagrams/${encodeURIComponent(diagramId)}/share-links${QS.query(
        QS.explode({
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function createDiagramShareLink(
  {
    diagramId,
    diagramShareLinkCreateDto,
  }: {
    diagramId: string;
    diagramShareLinkCreateDto: DiagramShareLinkCreateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: DiagramShareLinkCreateResponseDtoOutput;
    }>(
      `/diagrams/${encodeURIComponent(diagramId)}/share-links`,
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: diagramShareLinkCreateDto,
      }),
    ),
  );
}
export function revokeDiagramShareLink(
  {
    shareLinkId,
    diagramId,
  }: {
    shareLinkId: string;
    diagramId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: DiagramShareLinkRevokeResponseDtoOutput;
    }>(`/diagrams/${encodeURIComponent(diagramId)}/share-links/${encodeURIComponent(shareLinkId)}`, {
      ...opts,
      method: 'DELETE',
    }),
  );
}
export function createDiagram(
  {
    diagramCreateDto,
  }: {
    diagramCreateDto: DiagramCreateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: DiagramResponseDtoOutput;
    }>(
      '/diagrams',
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: diagramCreateDto,
      }),
    ),
  );
}
export function createWorkspaceDiagram(
  {
    organizationId,
    workspaceDiagramCreateDto,
  }: {
    organizationId: string;
    workspaceDiagramCreateDto: WorkspaceDiagramCreateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: DiagramResponseDtoOutput;
    }>(
      `/diagrams/workspace/${encodeURIComponent(organizationId)}`,
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: workspaceDiagramCreateDto,
      }),
    ),
  );
}
export function getWorkspaceDiagrams(
  {
    cursor,
    limit,
    organizationId,
  }: {
    cursor?: string;
    limit?: number;
    organizationId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: DiagramListResponseDtoOutput;
    }>(
      `/diagrams/workspace/${encodeURIComponent(organizationId)}${QS.query(
        QS.explode({
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function getDiagramMembers(
  {
    cursor,
    limit,
    diagramId,
  }: {
    cursor?: string;
    limit?: number;
    diagramId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: DiagramMemberListResponseDtoOutput;
    }>(
      `/diagrams/${encodeURIComponent(diagramId)}/members${QS.query(
        QS.explode({
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function addDiagramMember(
  {
    diagramId,
    diagramMemberCreateDto,
  }: {
    diagramId: string;
    diagramMemberCreateDto: DiagramMemberCreateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: DiagramMemberDtoOutput;
    }>(
      `/diagrams/${encodeURIComponent(diagramId)}/members`,
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: diagramMemberCreateDto,
      }),
    ),
  );
}
export function getDiagramEffectiveAccess(
  {
    cursor,
    limit,
    diagramId,
  }: {
    cursor?: string;
    limit?: number;
    diagramId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: DiagramEffectiveAccessListResponseDtoOutput;
    }>(
      `/diagrams/${encodeURIComponent(diagramId)}/effective-access${QS.query(
        QS.explode({
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function transferDiagramOwnership(
  {
    diagramId,
    diagramOwnershipTransferDto,
  }: {
    diagramId: string;
    diagramOwnershipTransferDto: DiagramOwnershipTransferDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: DiagramMemberDtoOutput;
    }>(
      `/diagrams/${encodeURIComponent(diagramId)}/ownership/transfer`,
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: diagramOwnershipTransferDto,
      }),
    ),
  );
}
export function updateDiagramMember(
  {
    userId,
    diagramId,
    diagramMemberUpdateDto,
  }: {
    userId: string;
    diagramId: string;
    diagramMemberUpdateDto: DiagramMemberUpdateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: DiagramMemberDtoOutput;
    }>(
      `/diagrams/${encodeURIComponent(diagramId)}/members/${encodeURIComponent(userId)}`,
      oazapfts.json({
        ...opts,
        method: 'PATCH',
        body: diagramMemberUpdateDto,
      }),
    ),
  );
}
export function removeDiagramMember(
  {
    userId,
    diagramId,
  }: {
    userId: string;
    diagramId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: DiagramMemberRemoveResponseDtoOutput;
    }>(`/diagrams/${encodeURIComponent(diagramId)}/members/${encodeURIComponent(userId)}`, {
      ...opts,
      method: 'DELETE',
    }),
  );
}
export function updateDiagram(
  {
    diagramId,
    diagramUpdateDto,
  }: {
    diagramId: string;
    diagramUpdateDto: DiagramUpdateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: DiagramResponseDtoOutput;
    }>(
      `/diagrams/${encodeURIComponent(diagramId)}`,
      oazapfts.json({
        ...opts,
        method: 'PATCH',
        body: diagramUpdateDto,
      }),
    ),
  );
}
export function exportDiagram(
  {
    includeComments,
    dialect,
    format,
    diagramId,
  }: {
    includeComments?: boolean;
    dialect?: 'postgresql' | 'mysql' | 'sqlite' | 'mariadb' | 'sqlserver';
    format?: 'tabliodb_json' | 'sql' | 'markdown' | 'mermaid' | 'svg';
    diagramId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: DiagramExportResponseDtoOutput;
    }>(
      `/diagrams/${encodeURIComponent(diagramId)}/export${QS.query(
        QS.explode({
          includeComments,
          dialect,
          format,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function importDiagram(
  {
    diagramId,
    diagramImportDto,
  }: {
    diagramId: string;
    diagramImportDto: DiagramImportDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: DiagramImportResponseDtoOutput;
    }>(
      `/diagrams/${encodeURIComponent(diagramId)}/import`,
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: diagramImportDto,
      }),
    ),
  );
}
export function getDiagramReviewSummary(
  {
    diagramId,
  }: {
    diagramId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: DiagramReviewSummaryDtoOutput;
    }>(`/diagrams/${encodeURIComponent(diagramId)}/review`, {
      ...opts,
    }),
  );
}
export function getDiagramReviewEvents(
  {
    cursor,
    limit,
    diagramId,
  }: {
    cursor?: string;
    limit?: number;
    diagramId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: DiagramReviewEventListResponseDtoOutput;
    }>(
      `/diagrams/${encodeURIComponent(diagramId)}/review/events${QS.query(
        QS.explode({
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function createDiagramReviewAction(
  {
    diagramId,
    diagramReviewActionCreateDto,
  }: {
    diagramId: string;
    diagramReviewActionCreateDto: DiagramReviewActionCreateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: DiagramReviewSummaryDtoOutput;
    }>(
      `/diagrams/${encodeURIComponent(diagramId)}/review/actions`,
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: diagramReviewActionCreateDto,
      }),
    ),
  );
}
export function getFile(
  {
    fileId,
  }: {
    fileId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchText(`/files/${encodeURIComponent(fileId)}`, {
      ...opts,
    }),
  );
}
export function createInvitation(
  {
    invitationCreateDto,
  }: {
    invitationCreateDto: InvitationCreateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: InvitationCreateResponseDtoOutput;
    }>(
      '/invitations',
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: invitationCreateDto,
      }),
    ),
  );
}
export function getInvitationByToken(
  {
    token,
  }: {
    token: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: InvitationPublicDtoOutput;
    }>(`/invitations/${encodeURIComponent(token)}`, {
      ...opts,
    }),
  );
}
export function acceptInvitation(
  {
    invitationAcceptDto,
  }: {
    invitationAcceptDto: InvitationAcceptDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: InvitationAcceptResponseDtoOutput;
    }>(
      '/invitations/accept',
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: invitationAcceptDto,
      }),
    ),
  );
}
export function getNotificationInbox(
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: NotificationInboxListResponseDtoOutput;
    }>(
      `/notifications/inbox${QS.query(
        QS.explode({
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function getNotificationSummary(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: NotificationSummaryDtoOutput;
    }>('/notifications/summary', {
      ...opts,
    }),
  );
}
export function createOrganization(
  {
    organizationCreateDto,
  }: {
    organizationCreateDto: OrganizationCreateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: OrganizationDtoOutput;
    }>(
      '/organizations',
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: organizationCreateDto,
      }),
    ),
  );
}
export function getOrganizations(
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: OrganizationListResponseDtoOutput;
    }>(
      `/organizations${QS.query(
        QS.explode({
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function getOrganizationSettings(
  {
    organizationId,
  }: {
    organizationId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: OrganizationSettingsDtoOutput;
    }>(`/organizations/${encodeURIComponent(organizationId)}/settings`, {
      ...opts,
    }),
  );
}
export function updateOrganizationSettings(
  {
    organizationId,
    organizationSettingsUpdateDto,
  }: {
    organizationId: string;
    organizationSettingsUpdateDto: OrganizationSettingsUpdateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: OrganizationSettingsDtoOutput;
    }>(
      `/organizations/${encodeURIComponent(organizationId)}/settings`,
      oazapfts.json({
        ...opts,
        method: 'PATCH',
        body: organizationSettingsUpdateDto,
      }),
    ),
  );
}
export function getOrganizationMembers(
  {
    cursor,
    limit,
    organizationId,
  }: {
    cursor?: string;
    limit?: number;
    organizationId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: OrganizationMemberListResponseDtoOutput;
    }>(
      `/organizations/${encodeURIComponent(organizationId)}/members${QS.query(
        QS.explode({
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function addOrganizationMember(
  {
    organizationId,
    organizationMemberCreateDto,
  }: {
    organizationId: string;
    organizationMemberCreateDto: OrganizationMemberCreateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: OrganizationMemberDtoOutput;
    }>(
      `/organizations/${encodeURIComponent(organizationId)}/members`,
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: organizationMemberCreateDto,
      }),
    ),
  );
}
export function updateOrganizationMember(
  {
    userId,
    organizationId,
    organizationMemberUpdateDto,
  }: {
    userId: string;
    organizationId: string;
    organizationMemberUpdateDto: OrganizationMemberUpdateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: OrganizationMemberDtoOutput;
    }>(
      `/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(userId)}`,
      oazapfts.json({
        ...opts,
        method: 'PATCH',
        body: organizationMemberUpdateDto,
      }),
    ),
  );
}
export function removeOrganizationMember(
  {
    userId,
    organizationId,
  }: {
    userId: string;
    organizationId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: OrganizationMemberRemoveResponseDtoOutput;
    }>(`/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(userId)}`, {
      ...opts,
      method: 'DELETE',
    }),
  );
}
export function transferOrganizationOwnership(
  {
    organizationId,
    organizationOwnershipTransferDto,
  }: {
    organizationId: string;
    organizationOwnershipTransferDto: OrganizationOwnershipTransferDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: OrganizationMemberDtoOutput;
    }>(
      `/organizations/${encodeURIComponent(organizationId)}/ownership/transfer`,
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: organizationOwnershipTransferDto,
      }),
    ),
  );
}
export function getOrganizationAuditLogs(
  {
    cursor,
    limit,
    organizationId,
  }: {
    cursor?: string;
    limit?: number;
    organizationId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: AuditLogListResponseDtoOutput;
    }>(
      `/organizations/${encodeURIComponent(organizationId)}/audit-logs${QS.query(
        QS.explode({
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function getProjects(
  {
    organizationId,
    cursor,
    limit,
  }: {
    organizationId?: string;
    cursor?: string;
    limit?: number;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ProjectListResponseDtoOutput;
    }>(
      `/projects${QS.query(
        QS.explode({
          organizationId,
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function createProject(
  {
    projectCreateDto,
  }: {
    projectCreateDto: ProjectCreateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: ProjectResponseDtoOutput;
    }>(
      '/projects',
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: projectCreateDto,
      }),
    ),
  );
}
export function updateProject(
  {
    projectId,
    projectUpdateDto,
  }: {
    projectId: string;
    projectUpdateDto: ProjectUpdateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ProjectResponseDtoOutput;
    }>(
      `/projects/${encodeURIComponent(projectId)}`,
      oazapfts.json({
        ...opts,
        method: 'PATCH',
        body: projectUpdateDto,
      }),
    ),
  );
}
export function archiveProject(
  {
    projectId,
  }: {
    projectId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ProjectArchiveResponseDtoOutput;
    }>(`/projects/${encodeURIComponent(projectId)}`, {
      ...opts,
      method: 'DELETE',
    }),
  );
}
export function getProjectMembers(
  {
    cursor,
    limit,
    projectId,
  }: {
    cursor?: string;
    limit?: number;
    projectId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ProjectMemberListResponseDtoOutput;
    }>(
      `/projects/${encodeURIComponent(projectId)}/members${QS.query(
        QS.explode({
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function addProjectMember(
  {
    projectId,
    projectMemberCreateDto,
  }: {
    projectId: string;
    projectMemberCreateDto: ProjectMemberCreateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: ProjectMemberDtoOutput;
    }>(
      `/projects/${encodeURIComponent(projectId)}/members`,
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: projectMemberCreateDto,
      }),
    ),
  );
}
export function transferProjectOwnership(
  {
    projectId,
    projectOwnershipTransferDto,
  }: {
    projectId: string;
    projectOwnershipTransferDto: ProjectOwnershipTransferDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ProjectMemberDtoOutput;
    }>(
      `/projects/${encodeURIComponent(projectId)}/ownership/transfer`,
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: projectOwnershipTransferDto,
      }),
    ),
  );
}
export function updateProjectMember(
  {
    userId,
    projectId,
    projectMemberUpdateDto,
  }: {
    userId: string;
    projectId: string;
    projectMemberUpdateDto: ProjectMemberUpdateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ProjectMemberDtoOutput;
    }>(
      `/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
      oazapfts.json({
        ...opts,
        method: 'PATCH',
        body: projectMemberUpdateDto,
      }),
    ),
  );
}
export function removeProjectMember(
  {
    userId,
    projectId,
  }: {
    userId: string;
    projectId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ProjectMemberRemoveResponseDtoOutput;
    }>(`/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`, {
      ...opts,
      method: 'DELETE',
    }),
  );
}
export function getProjectDiagrams(
  {
    cursor,
    limit,
    projectId,
  }: {
    cursor?: string;
    limit?: number;
    projectId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: DiagramListResponseDtoOutput;
    }>(
      `/projects/${encodeURIComponent(projectId)}/diagrams${QS.query(
        QS.explode({
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function getPublicDiagramShare(
  {
    token,
  }: {
    token: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: PublicDiagramShareResponseDtoOutput;
    }>(`/public/share-links/${encodeURIComponent(token)}`, {
      ...opts,
    }),
  );
}
export function getDiagramReviewSignals(
  {
    includeIgnored,
    cursor,
    limit,
    diagramId,
  }: {
    includeIgnored?: boolean;
    cursor?: string;
    limit?: number;
    diagramId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ReviewSignalListResponseDtoOutput;
    }>(
      `/review-signals/diagram/${encodeURIComponent(diagramId)}${QS.query(
        QS.explode({
          includeIgnored,
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function getProjectReviewSignalSettings(
  {
    projectId,
  }: {
    projectId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ReviewSignalSettingsDtoOutput;
    }>(`/review-signals/project/${encodeURIComponent(projectId)}/settings`, {
      ...opts,
    }),
  );
}
export function updateProjectReviewSignalSettings(
  {
    projectId,
    reviewSignalSettingsDto,
  }: {
    projectId: string;
    reviewSignalSettingsDto: ReviewSignalSettingsDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ReviewSignalSettingsDtoOutput;
    }>(
      `/review-signals/project/${encodeURIComponent(projectId)}/settings`,
      oazapfts.json({
        ...opts,
        method: 'PATCH',
        body: reviewSignalSettingsDto,
      }),
    ),
  );
}
export function getDiagramReviewSignalSettings(
  {
    diagramId,
  }: {
    diagramId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ReviewSignalEffectiveSettingsDtoOutput;
    }>(`/review-signals/diagram/${encodeURIComponent(diagramId)}/settings`, {
      ...opts,
    }),
  );
}
export function updateDiagramReviewSignalSettings(
  {
    diagramId,
    reviewSignalSettingsDto,
  }: {
    diagramId: string;
    reviewSignalSettingsDto: ReviewSignalSettingsDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ReviewSignalEffectiveSettingsDtoOutput;
    }>(
      `/review-signals/diagram/${encodeURIComponent(diagramId)}/settings`,
      oazapfts.json({
        ...opts,
        method: 'PATCH',
        body: reviewSignalSettingsDto,
      }),
    ),
  );
}
export function ignoreReviewSignal(
  {
    signalId,
  }: {
    signalId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ReviewSignalResponseDtoOutput;
    }>(`/review-signals/${encodeURIComponent(signalId)}/ignore`, {
      ...opts,
      method: 'POST',
    }),
  );
}
export function unignoreReviewSignal(
  {
    signalId,
  }: {
    signalId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ReviewSignalResponseDtoOutput;
    }>(`/review-signals/${encodeURIComponent(signalId)}/unignore`, {
      ...opts,
      method: 'POST',
    }),
  );
}
export function getSetupStatus(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: SetupStatusResponseDtoOutput;
    }>('/setup', {
      ...opts,
    }),
  );
}
export function completeSetup(
  {
    setupCreateDto,
  }: {
    setupCreateDto: SetupCreateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: SetupCreateResponseDtoOutput;
    }>(
      '/setup',
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: setupCreateDto,
      }),
    ),
  );
}
export function getInstanceAuthSettings(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: InstanceAuthSettingsDtoOutput;
    }>('/setup/auth-settings', {
      ...opts,
    }),
  );
}
export function updateInstanceAuthSettings(
  {
    instanceAuthSettingsUpdateDto,
  }: {
    instanceAuthSettingsUpdateDto: InstanceAuthSettingsUpdateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: InstanceAuthSettingsDtoOutput;
    }>(
      '/setup/auth-settings',
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: instanceAuthSettingsUpdateDto,
      }),
    ),
  );
}
export function getOidcProviderSettings(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: OidcProviderSettingsDtoOutput;
    }>('/setup/oidc-provider', {
      ...opts,
    }),
  );
}
export function updateOidcProviderSettings(
  {
    oidcProviderSettingsUpdateDto,
  }: {
    oidcProviderSettingsUpdateDto: OidcProviderSettingsUpdateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: OidcProviderSettingsDtoOutput;
    }>(
      '/setup/oidc-provider',
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: oidcProviderSettingsUpdateDto,
      }),
    ),
  );
}
export function getSmtpSettings(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: SmtpSettingsDtoOutput;
    }>('/setup/smtp-settings', {
      ...opts,
    }),
  );
}
export function updateSmtpSettings(
  {
    smtpSettingsUpdateDto,
  }: {
    smtpSettingsUpdateDto: SmtpSettingsUpdateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: SmtpSettingsDtoOutput;
    }>(
      '/setup/smtp-settings',
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: smtpSettingsUpdateDto,
      }),
    ),
  );
}
export function createSnapshot(
  {
    snapshotCreateDto,
  }: {
    snapshotCreateDto: SnapshotCreateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: SnapshotResponseDtoOutput;
    }>(
      '/snapshots',
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: snapshotCreateDto,
      }),
    ),
  );
}
export function getDiagramSnapshots(
  {
    cursor,
    limit,
    diagramId,
  }: {
    cursor?: string;
    limit?: number;
    diagramId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: SnapshotListResponseDtoOutput;
    }>(
      `/snapshots/diagram/${encodeURIComponent(diagramId)}${QS.query(
        QS.explode({
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function getSnapshotDiff(
  {
    toSnapshotId,
    fromSnapshotId,
  }: {
    toSnapshotId: string;
    fromSnapshotId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: SnapshotDiffResponseDtoOutput;
    }>(`/snapshots/${encodeURIComponent(fromSnapshotId)}/diff/${encodeURIComponent(toSnapshotId)}`, {
      ...opts,
    }),
  );
}
export function restoreSnapshot(
  {
    snapshotId,
  }: {
    snapshotId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: SnapshotResponseDtoOutput;
    }>(`/snapshots/${encodeURIComponent(snapshotId)}/restore`, {
      ...opts,
      method: 'POST',
    }),
  );
}
export function getTeams(
  {
    organizationId,
    cursor,
    limit,
  }: {
    organizationId: string;
    cursor?: string;
    limit?: number;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: TeamListResponseDtoOutput;
    }>(
      `/teams${QS.query(
        QS.explode({
          organizationId,
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function createTeam(
  {
    teamCreateDto,
  }: {
    teamCreateDto: TeamCreateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: TeamResponseDtoOutput;
    }>(
      '/teams',
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: teamCreateDto,
      }),
    ),
  );
}
export function updateTeam(
  {
    teamId,
    teamUpdateDto,
  }: {
    teamId: string;
    teamUpdateDto: TeamUpdateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: TeamResponseDtoOutput;
    }>(
      `/teams/${encodeURIComponent(teamId)}`,
      oazapfts.json({
        ...opts,
        method: 'PATCH',
        body: teamUpdateDto,
      }),
    ),
  );
}
export function archiveTeam(
  {
    teamId,
  }: {
    teamId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: TeamArchiveResponseDtoOutput;
    }>(`/teams/${encodeURIComponent(teamId)}`, {
      ...opts,
      method: 'DELETE',
    }),
  );
}
export function getTeamMembers(
  {
    cursor,
    limit,
    teamId,
  }: {
    cursor?: string;
    limit?: number;
    teamId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: TeamMemberListResponseDtoOutput;
    }>(
      `/teams/${encodeURIComponent(teamId)}/members${QS.query(
        QS.explode({
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function addTeamMember(
  {
    teamId,
    teamMemberCreateDto,
  }: {
    teamId: string;
    teamMemberCreateDto: TeamMemberCreateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: TeamMemberDtoOutput;
    }>(
      `/teams/${encodeURIComponent(teamId)}/members`,
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: teamMemberCreateDto,
      }),
    ),
  );
}
export function removeTeamMember(
  {
    userId,
    teamId,
  }: {
    userId: string;
    teamId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: TeamMemberRemoveResponseDtoOutput;
    }>(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`, {
      ...opts,
      method: 'DELETE',
    }),
  );
}
export function getTeamProjectAccesses(
  {
    cursor,
    limit,
    teamId,
  }: {
    cursor?: string;
    limit?: number;
    teamId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: TeamProjectAccessListResponseDtoOutput;
    }>(
      `/teams/${encodeURIComponent(teamId)}/projects${QS.query(
        QS.explode({
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function upsertTeamProjectAccess(
  {
    teamId,
    teamProjectAccessUpsertDto,
  }: {
    teamId: string;
    teamProjectAccessUpsertDto: TeamProjectAccessUpsertDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: TeamProjectAccessDtoOutput;
    }>(
      `/teams/${encodeURIComponent(teamId)}/projects`,
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: teamProjectAccessUpsertDto,
      }),
    ),
  );
}
export function removeTeamProjectAccess(
  {
    projectId,
    teamId,
  }: {
    projectId: string;
    teamId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: TeamProjectAccessRemoveResponseDtoOutput;
    }>(`/teams/${encodeURIComponent(teamId)}/projects/${encodeURIComponent(projectId)}`, {
      ...opts,
      method: 'DELETE',
    }),
  );
}
export function getTeamDiagramAccesses(
  {
    cursor,
    limit,
    teamId,
  }: {
    cursor?: string;
    limit?: number;
    teamId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: TeamDiagramAccessListResponseDtoOutput;
    }>(
      `/teams/${encodeURIComponent(teamId)}/diagrams${QS.query(
        QS.explode({
          cursor,
          limit,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function upsertTeamDiagramAccess(
  {
    teamId,
    teamDiagramAccessUpsertDto,
  }: {
    teamId: string;
    teamDiagramAccessUpsertDto: TeamDiagramAccessUpsertDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: TeamDiagramAccessDtoOutput;
    }>(
      `/teams/${encodeURIComponent(teamId)}/diagrams`,
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: teamDiagramAccessUpsertDto,
      }),
    ),
  );
}
export function removeTeamDiagramAccess(
  {
    diagramId,
    teamId,
  }: {
    diagramId: string;
    teamId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: TeamDiagramAccessRemoveResponseDtoOutput;
    }>(`/teams/${encodeURIComponent(teamId)}/diagrams/${encodeURIComponent(diagramId)}`, {
      ...opts,
      method: 'DELETE',
    }),
  );
}
export function getUsers(
  {
    search,
    role,
    limit,
    cursor,
  }: {
    search?: string;
    role?: 'owner' | 'instance-admin' | 'org-admin' | 'member';
    limit?: number;
    cursor?: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: UserListResponseDtoOutput;
    }>(
      `/users${QS.query(
        QS.explode({
          search,
          role,
          limit,
          cursor,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
export function createUser(
  {
    userCreateDto,
  }: {
    userCreateDto: UserCreateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: UserResponseDtoOutput;
    }>(
      '/users',
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: userCreateDto,
      }),
    ),
  );
}
export function updateUserStatus(
  {
    userId,
    userStatusUpdateDto,
  }: {
    userId: string;
    userStatusUpdateDto: UserStatusUpdateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: UserResponseDtoOutput;
    }>(
      `/users/${encodeURIComponent(userId)}/status`,
      oazapfts.json({
        ...opts,
        method: 'PATCH',
        body: userStatusUpdateDto,
      }),
    ),
  );
}
export function resetUserPassword(
  {
    userId,
    userPasswordResetDto,
  }: {
    userId: string;
    userPasswordResetDto: UserPasswordResetDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: UserPasswordResetResponseDtoOutput;
    }>(
      `/users/${encodeURIComponent(userId)}/reset-password`,
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: userPasswordResetDto,
      }),
    ),
  );
}
export function revokeUserSessions(
  {
    userId,
  }: {
    userId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: UserSessionRevokeResponseDtoOutput;
    }>(`/users/${encodeURIComponent(userId)}/revoke-sessions`, {
      ...opts,
      method: 'POST',
    }),
  );
}
export enum Status {
  Disabled = 'disabled',
  Error = 'error',
  Ok = 'ok',
}
export enum InstanceRole {
  Owner = 'owner',
  Admin = 'admin',
}
export enum Algorithm {
  EcdsaP256Sha256 = 'ecdsa-p256-sha256',
}
export enum Crv {
  P256 = 'P-256',
}
export enum Kty {
  Ec = 'EC',
}
export enum Permissions {
  All = 'all',
  OrganizationRead = 'organization.read',
  OrganizationManage = 'organization.manage',
  ProjectCreate = 'project.create',
  ProjectRead = 'project.read',
  ProjectUpdate = 'project.update',
  ProjectDelete = 'project.delete',
  ProjectMemberManage = 'project.member.manage',
  DiagramCreate = 'diagram.create',
  DiagramRead = 'diagram.read',
  DiagramUpdate = 'diagram.update',
  DiagramDelete = 'diagram.delete',
  DiagramComment = 'diagram.comment',
  DiagramMemberManage = 'diagram.member.manage',
  SnapshotCreate = 'snapshot.create',
  SnapshotRead = 'snapshot.read',
  ApiKeyManage = 'api-key.manage',
}
export enum Type {
  Root = 'root',
}
export enum TargetType {
  Diagram = 'diagram',
  Table = 'table',
  Column = 'column',
  Relationship = 'relationship',
  Index = 'index',
  Enum = 'enum',
  Check = 'check',
  Note = 'note',
  Group = 'group',
}
export enum Status2 {
  Open = 'open',
  Resolved = 'resolved',
}
export enum BodyFormat {
  Lexical = 'lexical',
}
export enum TargetType2 {
  Diagram = 'diagram',
  Snapshot = 'snapshot',
}
export enum Status3 {
  Active = 'active',
  Expired = 'expired',
  Revoked = 'revoked',
}
export enum Dialect {
  Postgresql = 'postgresql',
  Mysql = 'mysql',
  Sqlite = 'sqlite',
  Mariadb = 'mariadb',
  Sqlserver = 'sqlserver',
}
export enum Status4 {
  Draft = 'draft',
  Reviewed = 'reviewed',
  Approved = 'approved',
  ChangesRequested = 'changes_requested',
}
export enum Role {
  Owner = 'owner',
  Editor = 'editor',
  Commenter = 'commenter',
  Viewer = 'viewer',
}
export enum Role2 {
  Editor = 'editor',
  Commenter = 'commenter',
  Viewer = 'viewer',
}
export enum AccessType {
  Direct = 'direct',
  Inherited = 'inherited',
  Mixed = 'mixed',
}
export enum DirectRole {
  Owner = 'owner',
  Editor = 'editor',
  Commenter = 'commenter',
  Viewer = 'viewer',
}
export enum Role3 {
  Owner = 'owner',
  Editor = 'editor',
  Commenter = 'commenter',
  Viewer = 'viewer',
}
export enum SourceType {
  Direct = 'direct',
  DiagramTeam = 'diagram_team',
  Folder = 'folder',
  FolderTeam = 'folder_team',
  WorkspaceAdmin = 'workspace_admin',
  WorkspaceDefault = 'workspace_default',
  WorkspaceMember = 'workspace_member',
}
export enum Role4 {
  Editor = 'editor',
  Commenter = 'commenter',
  Viewer = 'viewer',
}
export enum Format {
  TabliodbJson = 'tabliodb_json',
  Sql = 'sql',
  Markdown = 'markdown',
  Mermaid = 'mermaid',
  Svg = 'svg',
}
export enum Mode {
  Replace = 'replace',
}
export enum Source {
  TabliodbJson = 'tabliodb_json',
  Sql = 'sql',
}
export enum DisplayMode {
  AllColumns = 'all_columns',
  PkFkOnly = 'pk_fk_only',
  HeaderOnly = 'header_only',
}
export enum Family {
  Bigint = 'bigint',
  Boolean = 'boolean',
  Date = 'date',
  Decimal = 'decimal',
  Enum = 'enum',
  Float = 'float',
  Integer = 'integer',
  Json = 'json',
  Text = 'text',
  Time = 'time',
  Timestamp = 'timestamp',
  Uuid = 'uuid',
  Varchar = 'varchar',
}
export enum Order {
  Asc = 'asc',
  Desc = 'desc',
}
export enum Nulls {
  First = 'first',
  Last = 'last',
}
export enum Method {
  Btree = 'btree',
  Hash = 'hash',
  Gin = 'gin',
  Gist = 'gist',
  Brin = 'brin',
}
export enum Cardinality {
  OneToOne = 'one_to_one',
  OneToMany = 'one_to_many',
  ManyToMany = 'many_to_many',
}
export enum OnDelete {
  Cascade = 'cascade',
  Restrict = 'restrict',
  SetNull = 'set_null',
  SetDefault = 'set_default',
  NoAction = 'no_action',
}
export enum OnUpdate {
  Cascade = 'cascade',
  Restrict = 'restrict',
  SetNull = 'set_null',
  SetDefault = 'set_default',
  NoAction = 'no_action',
}
export enum MatchType {
  Simple = 'simple',
  Full = 'full',
  Partial = 'partial',
}
export enum RelationshipRouting {
  SmartOrthogonal = 'smart_orthogonal',
  Straight = 'straight',
  Manual = 'manual',
}
export enum CurrentStatus {
  Draft = 'draft',
  Reviewed = 'reviewed',
  Approved = 'approved',
  ChangesRequested = 'changes_requested',
}
export enum Action {
  Commented = 'commented',
  Approved = 'approved',
  ChangesRequested = 'changes_requested',
}
export enum NextStatus {
  Draft = 'draft',
  Reviewed = 'reviewed',
  Approved = 'approved',
  ChangesRequested = 'changes_requested',
}
export enum PreviousStatus {
  Draft = 'draft',
  Reviewed = 'reviewed',
  Approved = 'approved',
  ChangesRequested = 'changes_requested',
}
export enum OrganizationRole {
  Admin = 'admin',
  Member = 'member',
  Guest = 'guest',
}
export enum ProjectRole {
  Editor = 'editor',
  Commenter = 'commenter',
  Viewer = 'viewer',
}
export enum DiagramRole {
  Owner = 'owner',
  Editor = 'editor',
  Commenter = 'commenter',
  Viewer = 'viewer',
}
export enum Status5 {
  Pending = 'pending',
  Accepted = 'accepted',
  Revoked = 'revoked',
  Expired = 'expired',
}
export enum Status6 {
  Open = 'open',
  Resolved = 'resolved',
}
export enum TargetType3 {
  Diagram = 'diagram',
  Table = 'table',
  Column = 'column',
  Relationship = 'relationship',
  Index = 'index',
  Enum = 'enum',
  Check = 'check',
  Note = 'note',
  Group = 'group',
}
export enum Type2 {
  Mention = 'mention',
  Reply = 'reply',
}
export enum Role5 {
  Owner = 'owner',
  Admin = 'admin',
  Member = 'member',
  Guest = 'guest',
}
export enum DefaultProjectRole {
  Editor = 'editor',
  Commenter = 'commenter',
  Viewer = 'viewer',
}
export enum Status7 {
  Pending = 'pending',
  Active = 'active',
  Suspended = 'suspended',
}
export enum Role6 {
  Admin = 'admin',
  Member = 'member',
  Guest = 'guest',
}
export enum ProjectRole2 {
  Owner = 'owner',
  Editor = 'editor',
  Commenter = 'commenter',
  Viewer = 'viewer',
}
export enum Role7 {
  Owner = 'owner',
  Editor = 'editor',
  Commenter = 'commenter',
  Viewer = 'viewer',
}
export enum Role8 {
  Editor = 'editor',
  Commenter = 'commenter',
  Viewer = 'viewer',
}
export enum TargetType4 {
  Diagram = 'diagram',
  Snapshot = 'snapshot',
}
export enum Severity {
  Info = 'info',
  Warning = 'warning',
  Error = 'error',
  Success = 'success',
}
export enum DisabledRuleKeys {
  DuplicateColumnName = 'duplicate_column_name',
  DuplicateTableName = 'duplicate_table_name',
  EmailColumnNotUnique = 'email_column_not_unique',
  ForeignKeyMissingIndex = 'foreign_key_missing_index',
  MoneyColumnUsesFloat = 'money_column_uses_float',
  RelationshipColumnTypeMismatch = 'relationship_column_type_mismatch',
  TableMissingPrimaryKey = 'table_missing_primary_key',
  UnusedEnum = 'unused_enum',
}
export enum SignupPolicy {
  SignupDisabled = 'signup_disabled',
  InviteOnly = 'invite_only',
  AllowedDomains = 'allowed_domains',
  SsoOnly = 'sso_only',
  PublicSignup = 'public_signup',
}
export enum AutoJoinOrganizationRole {
  Member = 'member',
  Guest = 'guest',
}
export enum SmtpSecurity_Output {
  None = 'none',
  Starttls = 'starttls',
  Tls = 'tls',
}
export enum SmtpSecurity {
  None = 'none',
  Starttls = 'starttls',
  Tls = 'tls',
}
export enum Type3 {
  Check = 'check',
  Column = 'column',
  Enum = 'enum',
  Index = 'index',
  Relationship = 'relationship',
  Table = 'table',
}
export enum InstanceRole2 {
  Admin = 'admin',
}
