import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';
import type { Permission, ProjectRole } from '@tabliodb/shared';

export type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
export type NullableColumn<T> = ColumnType<T | null, T | null | undefined, T | null>;
export type NullableTimestamp = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
export type BinaryColumn = ColumnType<Buffer, Buffer | Uint8Array, Buffer | Uint8Array>;
export type NullableBinaryColumn = ColumnType<
  Buffer | null,
  Buffer | Uint8Array | null | undefined,
  Buffer | Uint8Array | null
>;
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonColumn<T extends JsonValue = JsonValue> = ColumnType<T, T | string | undefined, T | string>;
export type NullableJsonColumn<T extends JsonValue = JsonValue> = ColumnType<
  T | null,
  T | string | null | undefined,
  T | string | null
>;
export type StringArrayColumn<T extends string = string> = ColumnType<T[], T[] | undefined, T[]>;
export type Defaulted<T> = ColumnType<T, T | undefined, T>;

export interface UserTable {
  id: Generated<string>;
  email: string;
  name: string;
  passwordHash: NullableColumn<string>;
  avatarColor: NullableColumn<string>;
  locale: NullableColumn<string>;
  timezone: NullableColumn<string>;
  isDisabled: Defaulted<boolean>;
  disabledAt: NullableTimestamp;
  lastLoginAt: NullableTimestamp;
  passwordChangedAt: NullableTimestamp;
  metadata: JsonColumn;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: NullableTimestamp;
}

export interface SystemSettingTable {
  key: string;
  value: JsonColumn;
  isSecret: Defaulted<boolean>;
  updatedById: NullableColumn<string>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface InstanceMemberTable {
  userId: string;
  role: 'owner' | 'admin';
  createdById: NullableColumn<string>;
  createdAt: Timestamp;
}

export interface SessionTable {
  id: Generated<string>;
  tokenHash: BinaryColumn;
  userId: string;
  deviceType: Defaulted<string>;
  deviceOs: Defaulted<string>;
  userAgent: NullableColumn<string>;
  ipAddress: NullableColumn<string>;
  appVersion: NullableColumn<string>;
  expiresAt: NullableTimestamp;
  revokedAt: NullableTimestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OrganizationTable {
  id: Generated<string>;
  name: string;
  slug: string;
  createdById: string;
  defaultProjectRole: NullableColumn<string>;
  allowMemberProjectCreate: Defaulted<boolean>;
  metadata: JsonColumn;
  archivedAt: NullableTimestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OrganizationMemberTable {
  organizationId: string;
  userId: string;
  role: string;
  status: Defaulted<'pending' | 'active' | 'suspended'>;
  joinedAt: NullableTimestamp;
  createdById: NullableColumn<string>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface InvitationTable {
  id: Generated<string>;
  organizationId: string;
  projectId: NullableColumn<string>;
  email: string;
  organizationRole: string;
  projectRole: NullableColumn<ProjectRole>;
  tokenHash: BinaryColumn;
  message: NullableColumn<string>;
  invitedById: string;
  acceptedById: NullableColumn<string>;
  acceptedAt: NullableTimestamp;
  revokedAt: NullableTimestamp;
  expiresAt: Timestamp;
  createdAt: Timestamp;
}

export interface ProjectTable {
  id: Generated<string>;
  organizationId: string;
  name: string;
  slug: string;
  description: NullableColumn<string>;
  defaultDialect: Defaulted<string>;
  visibility: Defaulted<'private' | 'organization'>;
  createdById: string;
  archivedAt: NullableTimestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProjectMemberTable {
  projectId: string;
  userId: string;
  role: ProjectRole;
  createdById: NullableColumn<string>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ApiKeyTable {
  id: Generated<string>;
  keyHash: BinaryColumn;
  name: string;
  userId: string;
  organizationId: NullableColumn<string>;
  projectId: NullableColumn<string>;
  permissions: StringArrayColumn<Permission>;
  lastUsedAt: NullableTimestamp;
  expiresAt: NullableTimestamp;
  revokedAt: NullableTimestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DiagramTable {
  id: Generated<string>;
  projectId: string;
  name: string;
  slug: NullableColumn<string>;
  dialect: Defaulted<string>;
  status: Defaulted<'draft' | 'reviewed' | 'approved' | 'changes_requested'>;
  currentSnapshotId: NullableColumn<string>;
  lastSnapshotVersion: Defaulted<number>;
  createdById: string;
  archivedAt: NullableTimestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DiagramDocumentTable {
  diagramId: string;
  yjsState: NullableBinaryColumn;
  stateVector: NullableBinaryColumn;
  version: Defaulted<number>;
  checksum: NullableColumn<string>;
  schemaCache: NullableJsonColumn;
  updatedById: NullableColumn<string>;
  updatedAt: Timestamp;
}

export interface DiagramSnapshotTable {
  id: Generated<string>;
  diagramId: string;
  version: number;
  message: NullableColumn<string>;
  snapshot: JsonColumn;
  checksum: NullableColumn<string>;
  createdById: string;
  restoredFromSnapshotId: NullableColumn<string>;
  createdAt: Timestamp;
}

export interface DiagramEntityIndexTable {
  id: Generated<string>;
  diagramId: string;
  entityType: string;
  entityId: string;
  parentEntityId: NullableColumn<string>;
  name: string;
  path: string;
  searchText: string;
  metadata: JsonColumn;
  updatedAt: Timestamp;
}

export interface DiagramReviewSignalTable {
  id: Generated<string>;
  diagramId: string;
  ruleKey: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  targetType: string;
  targetId: NullableColumn<string>;
  message: string;
  metadata: JsonColumn;
  ignoredById: NullableColumn<string>;
  ignoredAt: NullableTimestamp;
  generatedAt: Timestamp;
}

export interface CommentThreadTable {
  id: Generated<string>;
  diagramId: string;
  targetType: string;
  targetId: NullableColumn<string>;
  status: Defaulted<'open' | 'resolved'>;
  resolvedById: NullableColumn<string>;
  resolvedAt: NullableTimestamp;
  createdById: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CommentTable {
  id: Generated<string>;
  threadId: string;
  body: string;
  bodyFormat: Defaulted<'markdown'>;
  createdById: string;
  editedAt: NullableTimestamp;
  deletedAt: NullableTimestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AuditLogTable {
  id: Generated<string>;
  organizationId: NullableColumn<string>;
  projectId: NullableColumn<string>;
  diagramId: NullableColumn<string>;
  actorId: NullableColumn<string>;
  action: string;
  entityType: string;
  entityId: string;
  metadata: JsonColumn;
  ipAddress: NullableColumn<string>;
  userAgent: NullableColumn<string>;
  requestId: NullableColumn<string>;
  createdAt: Timestamp;
}

export interface DB {
  users: UserTable;
  system_settings: SystemSettingTable;
  instance_members: InstanceMemberTable;
  sessions: SessionTable;
  organizations: OrganizationTable;
  organization_members: OrganizationMemberTable;
  invitations: InvitationTable;
  projects: ProjectTable;
  project_members: ProjectMemberTable;
  api_keys: ApiKeyTable;
  diagrams: DiagramTable;
  diagram_documents: DiagramDocumentTable;
  diagram_snapshots: DiagramSnapshotTable;
  diagram_entity_index: DiagramEntityIndexTable;
  diagram_review_signals: DiagramReviewSignalTable;
  comment_threads: CommentThreadTable;
  comments: CommentTable;
  audit_logs: AuditLogTable;
}

export type User = Selectable<UserTable>;
export type InsertUser = Insertable<UserTable>;
export type UpdateUser = Updateable<UserTable>;
export type Project = Selectable<ProjectTable>;
export type Diagram = Selectable<DiagramTable>;
