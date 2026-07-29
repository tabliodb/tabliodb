import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';
import type { Permission, ProjectRole } from '@tabliodb/shared';

export type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonColumn<T extends JsonValue = JsonValue> = ColumnType<T, T | string | undefined, T | string>;

export interface UserTable {
  id: Generated<string>;
  email: string;
  name: string;
  password: string | null;
  avatarColor: string | null;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
  deletedAt: Timestamp | null;
}

export interface SessionTable {
  id: Generated<string>;
  token: Buffer;
  userId: string;
  deviceType: string;
  deviceOS: string;
  appVersion: string | null;
  expiresAt: Timestamp | null;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
}

export interface ApiKeyTable {
  id: Generated<string>;
  key: Buffer;
  name: string;
  userId: string;
  permissions: Permission[];
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
}

export interface OrganizationTable {
  id: Generated<string>;
  name: string;
  slug: string;
  createdById: string;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
}

export interface OrganizationMemberTable {
  organizationId: string;
  userId: string;
  role: string;
  createdAt: Generated<Timestamp>;
}

export interface ProjectTable {
  id: Generated<string>;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  createdById: string;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
}

export interface ProjectMemberTable {
  projectId: string;
  userId: string;
  role: ProjectRole;
  createdAt: Generated<Timestamp>;
}

export interface DiagramTable {
  id: Generated<string>;
  projectId: string;
  name: string;
  dialect: string;
  createdById: string;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
}

export interface DiagramDocumentTable {
  diagramId: string;
  state: Buffer | null;
  version: Generated<number>;
  updatedAt: Generated<Timestamp>;
}

export interface DiagramSnapshotTable {
  id: Generated<string>;
  diagramId: string;
  version: number;
  message: string | null;
  snapshot: JsonColumn;
  createdById: string;
  createdAt: Generated<Timestamp>;
}

export interface CommentThreadTable {
  id: Generated<string>;
  diagramId: string;
  targetType: string;
  targetId: string;
  resolvedAt: Timestamp | null;
  createdById: string;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
}

export interface CommentTable {
  id: Generated<string>;
  threadId: string;
  body: string;
  createdById: string;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
}

export interface AuditLogTable {
  id: Generated<string>;
  organizationId: string | null;
  projectId: string | null;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: JsonColumn;
  createdAt: Generated<Timestamp>;
}

export interface DB {
  users: UserTable;
  sessions: SessionTable;
  api_keys: ApiKeyTable;
  organizations: OrganizationTable;
  organization_members: OrganizationMemberTable;
  projects: ProjectTable;
  project_members: ProjectMemberTable;
  diagrams: DiagramTable;
  diagram_documents: DiagramDocumentTable;
  diagram_snapshots: DiagramSnapshotTable;
  comment_threads: CommentThreadTable;
  comments: CommentTable;
  audit_logs: AuditLogTable;
}

export type User = Selectable<UserTable>;
export type InsertUser = Insertable<UserTable>;
export type UpdateUser = Updateable<UserTable>;
export type Project = Selectable<ProjectTable>;
export type Diagram = Selectable<DiagramTable>;
