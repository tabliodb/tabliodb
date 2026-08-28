import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';
import type { DiagramReviewSettings } from '@tabliodb/schema-core';
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
export type BigIntTextColumn = ColumnType<string, number | string, number | string>;
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
  avatarFileId: NullableColumn<string>;
  cursorColor: Defaulted<string>;
  locale: NullableColumn<string>;
  timezone: NullableColumn<string>;
  isDisabled: Defaulted<boolean>;
  disabledAt: NullableTimestamp;
  lastLoginAt: NullableTimestamp;
  passwordChangedAt: NullableTimestamp;
  passwordChangeRequired: Defaulted<boolean>;
  metadata: JsonColumn;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: NullableTimestamp;
}

export interface UserEditorPreferenceTable {
  userId: string;
  lastOpenedOrganizationId: NullableColumn<string>;
  lastOpenedProjectId: NullableColumn<string>;
  lastOpenedDiagramId: NullableColumn<string>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FileTable {
  id: Generated<string>;
  ownerId: string;
  kind: 'avatar' | 'comment_attachment';
  storageKey: string;
  originalName: NullableColumn<string>;
  mimeType: string;
  byteSize: BigIntTextColumn;
  checksumSha256: NullableColumn<string>;
  width: NullableColumn<number>;
  height: NullableColumn<number>;
  status: Defaulted<'pending' | 'ready' | 'rejected'>;
  metadata: JsonColumn;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: NullableTimestamp;
}

export interface FileVariantTable {
  id: Generated<string>;
  fileId: string;
  variant: string;
  storageKey: string;
  mimeType: string;
  byteSize: BigIntTextColumn;
  width: NullableColumn<number>;
  height: NullableColumn<number>;
  metadata: JsonColumn;
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  bindingAlgorithm: NullableColumn<string>;
  bindingKeyFingerprint: NullableColumn<string>;
  bindingPublicKeyJwk: NullableJsonColumn;
  bindingRequired: Defaulted<boolean>;
  riskScore: Defaulted<number>;
  lastSeenAt: NullableTimestamp;
  lastIpAddress: NullableColumn<string>;
  lastUserAgentHash: NullableColumn<string>;
  expiresAt: NullableTimestamp;
  revokedAt: NullableTimestamp;
  revokedReason: NullableColumn<string>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PasswordResetTokenTable {
  id: Generated<string>;
  tokenHash: BinaryColumn;
  userId: string;
  expiresAt: Timestamp;
  consumedAt: NullableTimestamp;
  revokedAt: NullableTimestamp;
  createdAt: Timestamp;
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
  diagramId: NullableColumn<string>;
  email: string;
  organizationRole: string;
  projectRole: NullableColumn<ProjectRole>;
  diagramRole: NullableColumn<ProjectRole>;
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

export interface TeamTable {
  id: Generated<string>;
  organizationId: string;
  name: string;
  slug: string;
  description: NullableColumn<string>;
  createdById: string;
  archivedAt: NullableTimestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TeamMemberTable {
  teamId: string;
  userId: string;
  createdById: NullableColumn<string>;
  createdAt: Timestamp;
}

export interface ProjectTeamAccessTable {
  projectId: string;
  teamId: string;
  role: ProjectRole.Editor | ProjectRole.Commenter | ProjectRole.Viewer;
  createdById: NullableColumn<string>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DiagramMemberTable {
  diagramId: string;
  userId: string;
  role: ProjectRole;
  createdById: NullableColumn<string>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DiagramTeamAccessTable {
  diagramId: string;
  teamId: string;
  role: ProjectRole.Editor | ProjectRole.Commenter | ProjectRole.Viewer;
  createdById: NullableColumn<string>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ApiKeyTable {
  id: Generated<string>;
  keyHash: BinaryColumn;
  keyPrefix: string;
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
  organizationId: string;
  projectId: NullableColumn<string>;
  name: string;
  slug: NullableColumn<string>;
  dialect: Defaulted<string>;
  status: Defaulted<'draft' | 'reviewed' | 'approved' | 'changes_requested'>;
  currentSnapshotId: NullableColumn<string>;
  lastSnapshotVersion: Defaulted<number>;
  reviewSettings: JsonColumn<DiagramReviewSettings>;
  createdById: string;
  archivedAt: NullableTimestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DiagramReviewEventTable {
  id: Generated<string>;
  diagramId: string;
  snapshotId: NullableColumn<string>;
  action: 'commented' | 'approved' | 'changes_requested';
  previousStatus: 'draft' | 'reviewed' | 'approved' | 'changes_requested';
  nextStatus: 'draft' | 'reviewed' | 'approved' | 'changes_requested';
  message: NullableColumn<string>;
  createdById: string;
  createdAt: Timestamp;
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

export interface DiagramShareLinkTable {
  id: Generated<string>;
  diagramId: string;
  snapshotId: NullableColumn<string>;
  tokenHash: BinaryColumn;
  targetType: Defaulted<'diagram' | 'snapshot'>;
  label: NullableColumn<string>;
  expiresAt: NullableTimestamp;
  revokedAt: NullableTimestamp;
  createdById: string;
  accessCount: Defaulted<number>;
  lastUsedAt: NullableTimestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  parentCommentId: NullableColumn<string>;
  bodyJson: JsonColumn;
  bodyText: string;
  bodyFormat: Defaulted<'lexical'>;
  createdById: string;
  editedAt: NullableTimestamp;
  deletedAt: NullableTimestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CommentMentionTable {
  commentId: string;
  mentionedUserId: string;
  createdAt: Timestamp;
}

export interface CommentEditHistoryTable {
  id: Generated<string>;
  commentId: string;
  editedById: string;
  previousBodyJson: JsonColumn;
  previousBodyText: string;
  nextBodyJson: JsonColumn;
  nextBodyText: string;
  bodyFormat: Defaulted<'lexical'>;
  createdAt: Timestamp;
}

export interface CommentThreadReadTable {
  threadId: string;
  userId: string;
  lastReadCommentId: NullableColumn<string>;
  lastReadAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BackgroundJobTable {
  id: Generated<string>;
  type: string;
  queue: Defaulted<string>;
  status: Defaulted<'queued' | 'running' | 'completed' | 'failed' | 'dead'>;
  payload: JsonColumn;
  result: NullableJsonColumn;
  error: NullableJsonColumn;
  attempts: Defaulted<number>;
  maxAttempts: Defaulted<number>;
  priority: Defaulted<number>;
  scheduledAt: Timestamp;
  lockedAt: NullableTimestamp;
  lockedBy: NullableColumn<string>;
  startedAt: NullableTimestamp;
  completedAt: NullableTimestamp;
  failedAt: NullableTimestamp;
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
  user_editor_preferences: UserEditorPreferenceTable;
  files: FileTable;
  file_variants: FileVariantTable;
  system_settings: SystemSettingTable;
  instance_members: InstanceMemberTable;
  sessions: SessionTable;
  password_reset_tokens: PasswordResetTokenTable;
  organizations: OrganizationTable;
  organization_members: OrganizationMemberTable;
  invitations: InvitationTable;
  projects: ProjectTable;
  project_members: ProjectMemberTable;
  teams: TeamTable;
  team_members: TeamMemberTable;
  project_team_access: ProjectTeamAccessTable;
  diagram_members: DiagramMemberTable;
  diagram_team_access: DiagramTeamAccessTable;
  api_keys: ApiKeyTable;
  diagrams: DiagramTable;
  diagram_review_events: DiagramReviewEventTable;
  diagram_documents: DiagramDocumentTable;
  diagram_snapshots: DiagramSnapshotTable;
  diagram_share_links: DiagramShareLinkTable;
  diagram_entity_index: DiagramEntityIndexTable;
  diagram_review_signals: DiagramReviewSignalTable;
  comment_threads: CommentThreadTable;
  comments: CommentTable;
  comment_edit_history: CommentEditHistoryTable;
  comment_mentions: CommentMentionTable;
  comment_thread_reads: CommentThreadReadTable;
  background_jobs: BackgroundJobTable;
  audit_logs: AuditLogTable;
}

export type User = Selectable<UserTable>;
export type InsertUser = Insertable<UserTable>;
export type UpdateUser = Updateable<UserTable>;
export type Project = Selectable<ProjectTable>;
export type Diagram = Selectable<DiagramTable>;
