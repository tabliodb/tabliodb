export enum OrganizationRole {
  Owner = 'owner',
  Admin = 'admin',
  Member = 'member',
  Guest = 'guest',
}

export enum AccessRole {
  Owner = 'owner',
  Editor = 'editor',
  Commenter = 'commenter',
  Viewer = 'viewer',
}

export type OrganizationRoleValue = `${OrganizationRole}`;
export type AccessRoleValue = `${AccessRole}`;

export enum Permission {
  All = 'all',
  OrganizationRead = 'organization.read',
  OrganizationManage = 'organization.manage',
  FolderCreate = 'folder.create',
  FolderRead = 'folder.read',
  FolderUpdate = 'folder.update',
  FolderDelete = 'folder.delete',
  FolderAccessManage = 'folder.access.manage',
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

const rolePermissions: Record<AccessRoleValue, Permission[]> = {
  [AccessRole.Owner]: [Permission.All],
  [AccessRole.Editor]: [
    Permission.FolderRead,
    Permission.FolderUpdate,
    Permission.DiagramCreate,
    Permission.DiagramRead,
    Permission.DiagramUpdate,
    Permission.DiagramDelete,
    Permission.DiagramComment,
    Permission.SnapshotCreate,
    Permission.SnapshotRead,
  ],
  [AccessRole.Commenter]: [
    Permission.FolderRead,
    Permission.DiagramRead,
    Permission.DiagramComment,
    Permission.SnapshotRead,
  ],
  [AccessRole.Viewer]: [Permission.FolderRead, Permission.DiagramRead, Permission.SnapshotRead],
};

const organizationRolePermissions: Record<OrganizationRoleValue, Permission[]> = {
  [OrganizationRole.Owner]: [Permission.All],
  // Root diagrams are workspace-owned documents, so workspace roles need direct diagram permissions without a folder grant.
  [OrganizationRole.Admin]: [
    Permission.OrganizationRead,
    Permission.OrganizationManage,
    Permission.FolderCreate,
    Permission.DiagramCreate,
    Permission.DiagramRead,
    Permission.DiagramUpdate,
    Permission.DiagramDelete,
    Permission.DiagramComment,
    Permission.DiagramMemberManage,
    Permission.SnapshotCreate,
    Permission.SnapshotRead,
  ],
  [OrganizationRole.Member]: [
    Permission.OrganizationRead,
    Permission.FolderCreate,
    Permission.DiagramCreate,
    Permission.DiagramRead,
    Permission.DiagramUpdate,
    Permission.DiagramDelete,
    Permission.DiagramComment,
    Permission.SnapshotCreate,
    Permission.SnapshotRead,
  ],
  [OrganizationRole.Guest]: [Permission.OrganizationRead],
};

export function permissionsForOrganizationRole(role: OrganizationRoleValue): Permission[] {
  return organizationRolePermissions[role];
}

export function permissionsForAccessRole(role: AccessRoleValue): Permission[] {
  return rolePermissions[role];
}

export function isGranted(options: { requested: Permission[]; current: Permission[] }): boolean {
  if (options.current.includes(Permission.All)) {
    return true;
  }

  return options.requested.every((permission) => options.current.includes(permission));
}
