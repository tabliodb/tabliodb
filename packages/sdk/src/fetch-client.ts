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
  diagramId: string;
  targetType: TargetType;
  targetId: string | null;
  body: string;
};
export type CommentThreadResponseDtoOutput = {
  thread: {
    id: string;
    diagramId: string;
    targetType: string;
    targetId: string | null;
    resolvedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  comment: {
    id: string;
    threadId: string;
    body: string;
    createdAt: string;
    updatedAt: string;
  };
};
export type CommentThreadListItemDtoOutput = {
  id: string;
  diagramId: string;
  targetType: string;
  targetId: string | null;
  status: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type CommentThreadListResponseDtoOutput = {
  items: CommentThreadListItemDtoOutput[];
  nextCursor: string | null;
  totalCount: number;
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
  status: Status;
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
  status: Status;
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
  Table = 'table',
  Column = 'column',
  Relationship = 'relationship',
  Enum = 'enum',
  Note = 'note',
  Diagram = 'diagram',
}
export enum Dialect {
  Postgresql = 'postgresql',
  Mysql = 'mysql',
  Sqlite = 'sqlite',
  Mariadb = 'mariadb',
  Sqlserver = 'sqlserver',
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
export enum Status {
  Pending = 'pending',
  Accepted = 'accepted',
  Revoked = 'revoked',
  Expired = 'expired',
}
export enum Role {
  Owner = 'owner',
  Admin = 'admin',
  Member = 'member',
  Viewer = 'viewer',
}
export enum DefaultProjectRole {
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
export enum SignupPolicy {
  SignupDisabled = 'signup_disabled',
  InviteOnly = 'invite_only',
  AllowedDomains = 'allowed_domains',
  SsoOnly = 'sso_only',
  PublicSignup = 'public_signup',
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
export enum InstanceRole {
  Owner = 'owner',
  Admin = 'admin',
}
export enum InstanceRole2 {
  Admin = 'admin',
}
