export enum OrganizationRole {
  Owner = 'owner',
  Admin = 'admin',
  Member = 'member',
  Guest = 'guest',
}

export enum ProjectRole {
  Owner = 'owner',
  Editor = 'editor',
  Commenter = 'commenter',
  Viewer = 'viewer',
}

export enum Permission {
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

const rolePermissions: Record<ProjectRole, Permission[]> = {
  [ProjectRole.Owner]: [Permission.All],
  [ProjectRole.Editor]: [
    Permission.ProjectRead,
    Permission.ProjectUpdate,
    Permission.DiagramCreate,
    Permission.DiagramRead,
    Permission.DiagramUpdate,
    Permission.DiagramDelete,
    Permission.DiagramComment,
    Permission.SnapshotCreate,
    Permission.SnapshotRead,
  ],
  [ProjectRole.Commenter]: [
    Permission.ProjectRead,
    Permission.DiagramRead,
    Permission.DiagramComment,
    Permission.SnapshotRead,
  ],
  [ProjectRole.Viewer]: [Permission.ProjectRead, Permission.DiagramRead, Permission.SnapshotRead],
};

const organizationRolePermissions: Record<OrganizationRole, Permission[]> = {
  [OrganizationRole.Owner]: [Permission.All],
  [OrganizationRole.Admin]: [Permission.OrganizationRead, Permission.OrganizationManage, Permission.ProjectCreate],
  [OrganizationRole.Member]: [Permission.OrganizationRead, Permission.ProjectCreate],
  [OrganizationRole.Guest]: [Permission.OrganizationRead],
};

export function permissionsForOrganizationRole(role: OrganizationRole): Permission[] {
  return organizationRolePermissions[role];
}

export function permissionsForProjectRole(role: ProjectRole): Permission[] {
  return rolePermissions[role];
}

export function isGranted(options: { requested: Permission[]; current: Permission[] }): boolean {
  if (options.current.includes(Permission.All)) {
    return true;
  }

  return options.requested.every((permission) => options.current.includes(permission));
}
