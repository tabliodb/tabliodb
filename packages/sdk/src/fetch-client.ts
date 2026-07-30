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
export type ServerHealthResponseDtoOutput = {
  name: string;
  ok: boolean;
  version: string;
};
export type AuthUserDtoOutput = {
  id: string;
  email: string;
  name: string;
  avatarColor: string | null;
};
export type SignUpDto = {
  email: string;
  password: string;
  name: string;
};
export type LoginResponseDtoOutput = {
  accessToken: string;
  user: AuthUserDtoOutput;
};
export type LoginCredentialDto = {
  email: string;
  password: string;
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
  name?: string;
  permissions?: Permissions[];
};
export type ApiKeyCreateResponseDtoOutput = {
  secret: string;
  apiKey: {
    id: string;
    name: string;
    permissions: Permissions[];
  };
};
export type CommentThreadCreateDto = {
  body: string;
  diagramId: string;
  targetId: string | null;
  targetType: TargetType;
};
export type CommentResponseDtoOutput = {
  author: {
    avatarColor: string | null;
    email: string;
    id: string;
    name: string;
  };
  body: string;
  bodyFormat: BodyFormat;
  createdAt: string;
  createdById: string;
  editedAt: string | null;
  id: string;
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
    status: Status;
    targetId: string | null;
    targetType: TargetType;
    updatedAt: string;
  };
  comment: CommentResponseDtoOutput;
};
export type CommentThreadListItemDtoOutput = {
  createdAt: string;
  createdById: string;
  diagramId: string;
  id: string;
  resolvedAt: string | null;
  resolvedById: string | null;
  status: Status;
  targetId: string | null;
  targetType: TargetType;
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
  body: string;
};
export type CommentThreadStatusResponseDtoOutput = {
  createdAt: string;
  createdById: string;
  diagramId: string;
  id: string;
  resolvedAt: string | null;
  resolvedById: string | null;
  status: Status;
  targetId: string | null;
  targetType: TargetType;
  updatedAt: string;
};
export type DiagramCreateDto = {
  projectId: string;
  name: string;
  dialect?: Dialect;
};
export type DiagramResponseDtoOutput = {
  id: string;
  projectId: string;
  name: string;
  dialect: Dialect;
  createdAt: string;
  updatedAt: string;
};
export type DiagramUpdateDto = {
  name?: string;
  dialect?: Dialect;
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
export type InvitationCreateDto = {
  email: string;
  organizationId?: string;
  organizationRole?: OrganizationRole;
  projectId?: string;
  projectRole?: ProjectRole;
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
  message: string | null;
  invitedById: string;
  invitedByName: string;
  acceptedById: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  expiresAt: string;
  createdAt: string;
  status: Status2;
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
  message: string | null;
  expiresAt: string;
  status: Status2;
};
export type InvitationAcceptDto = {
  token: string;
  name: string;
  password: string;
};
export type InvitationAcceptResponseDtoOutput = {
  accessToken: string;
  user: AuthUserDtoOutput;
  invitation: InvitationPublicDtoOutput;
};
export type OrganizationDtoOutput = {
  id: string;
  name: string;
  slug: string;
  role: Role;
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
  avatarColor: string | null;
  createdAt: string;
  email: string;
  joinedAt: string | null;
  name: string;
  role: Role;
  status: Status3;
  updatedAt: string;
  userId: string;
};
export type OrganizationMemberListResponseDtoOutput = {
  items: OrganizationMemberDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type OrganizationMemberUpdateDto = {
  role: Role;
};
export type OrganizationMemberRemoveResponseDtoOutput = {
  successful: boolean;
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
  organizationId?: string;
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
  avatarColor: string | null;
  role: Role2;
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
  role?: Role2;
};
export type ProjectMemberUpdateDto = {
  role: Role2;
};
export type ProjectMemberRemoveResponseDtoOutput = {
  successful: boolean;
};
export type DiagramListResponseDtoOutput = {
  items: DiagramResponseDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
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
  workspaceName: string;
};
export type SetupCreateResponseDtoOutput = {
  accessToken: string;
  setup: SetupStatusResponseDtoOutput;
  user: {
    avatarColor: string | null;
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
  createdAt: string;
};
export type SnapshotListResponseDtoOutput = {
  items: SnapshotResponseDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
};
export type UserResponseDtoOutput = {
  id: string;
  email: string;
  name: string;
  avatarColor: string | null;
  isDisabled: boolean;
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
  organizationId?: string;
  organizationRole?: OrganizationRole;
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
      status: number;
      data: ServerHealthResponseDtoOutput;
    }>('/server/health', {
      ...opts,
    }),
  );
}
export function getCurrentUser(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: number;
      data: AuthUserDtoOutput;
    }>('/auth/me', {
      ...opts,
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
      status: number;
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
      status: number;
      data: CommentListResponseDtoOutput;
    }>(
      `/comments/threads/${encodeURIComponent(threadId)}/comments${QS.query(
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
      status: number;
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
      status: number;
      data: CommentThreadStatusResponseDtoOutput;
    }>(`/comments/threads/${encodeURIComponent(threadId)}/unresolve`, {
      ...opts,
      method: 'PATCH',
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
      status: number;
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
    format?: 'tabliodb_json' | 'sql' | 'markdown' | 'svg';
    diagramId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: number;
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
      status: number;
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
      status: number;
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
      status: number;
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
      status: number;
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
      status: number;
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
      status: number;
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
      status: number;
      data: OrganizationMemberRemoveResponseDtoOutput;
    }>(`/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(userId)}`, {
      ...opts,
      method: 'DELETE',
    }),
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
      status: number;
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
      status: number;
      data: ProjectListResponseDtoOutput;
    }>(
      `/projects${QS.query(
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
      status: number;
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
      status: number;
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
      status: number;
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
      status: number;
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
      status: number;
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
      status: number;
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
      status: number;
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
      status: number;
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
      status: number;
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
      status: number;
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
      status: number;
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
      status: number;
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
      status: number;
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
      status: number;
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
  SnapshotCreate = 'snapshot.create',
  SnapshotRead = 'snapshot.read',
  ApiKeyManage = 'api-key.manage',
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
export enum Status {
  Open = 'open',
  Resolved = 'resolved',
}
export enum BodyFormat {
  Markdown = 'markdown',
}
export enum Dialect {
  Postgresql = 'postgresql',
  Mysql = 'mysql',
  Sqlite = 'sqlite',
  Mariadb = 'mariadb',
  Sqlserver = 'sqlserver',
}
export enum Format {
  TabliodbJson = 'tabliodb_json',
  Sql = 'sql',
  Markdown = 'markdown',
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
export enum OrganizationRole {
  Admin = 'admin',
  Member = 'member',
}
export enum ProjectRole {
  Editor = 'editor',
  Commenter = 'commenter',
  Viewer = 'viewer',
}
export enum Status2 {
  Pending = 'pending',
  Accepted = 'accepted',
  Revoked = 'revoked',
  Expired = 'expired',
}
export enum Role {
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
export enum Status3 {
  Pending = 'pending',
  Active = 'active',
  Suspended = 'suspended',
}
export enum ProjectRole2 {
  Owner = 'owner',
  Editor = 'editor',
  Commenter = 'commenter',
  Viewer = 'viewer',
}
export enum Role2 {
  Owner = 'owner',
  Editor = 'editor',
  Commenter = 'commenter',
  Viewer = 'viewer',
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
export enum InstanceRole {
  Owner = 'owner',
  Admin = 'admin',
}
export enum InstanceRole2 {
  Admin = 'admin',
}
