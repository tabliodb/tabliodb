import { describe, expect, it } from 'vitest';
import {
  OrganizationRole,
  Permission,
  ProjectRole,
  isGranted,
  permissionsForOrganizationRole,
  permissionsForProjectRole,
} from './permissions.js';

const concretePermissions = Object.values(Permission).filter((permission) => permission !== Permission.All);

function expectPermissionMatrix(options: { allowed: Permission[]; current: Permission[]; label: string }): void {
  const allowed = new Set(options.allowed);

  for (const permission of concretePermissions) {
    // Every concrete permission is checked through isGranted so the matrix locks the public helper contract,
    // not just the raw array returned by each role helper.
    expect(isGranted({ current: options.current, requested: [permission] }), `${options.label} -> ${permission}`).toBe(
      allowed.has(permission),
    );
  }
}

describe(permissionsForOrganizationRole.name, () => {
  it('keeps workspace owner as the all-permission sentinel', () => {
    expect(permissionsForOrganizationRole(OrganizationRole.Owner)).toEqual([Permission.All]);
  });

  it.each([
    [
      OrganizationRole.Admin,
      [
        Permission.OrganizationRead,
        Permission.OrganizationManage,
        Permission.ProjectCreate,
        Permission.DiagramCreate,
        Permission.DiagramRead,
        Permission.DiagramUpdate,
        Permission.DiagramDelete,
        Permission.DiagramComment,
        Permission.DiagramMemberManage,
        Permission.SnapshotCreate,
        Permission.SnapshotRead,
      ],
    ],
    [
      OrganizationRole.Member,
      [
        Permission.OrganizationRead,
        Permission.ProjectCreate,
        Permission.DiagramCreate,
        Permission.DiagramRead,
        Permission.DiagramUpdate,
        Permission.DiagramDelete,
        Permission.DiagramComment,
        Permission.SnapshotCreate,
        Permission.SnapshotRead,
      ],
    ],
    [OrganizationRole.Guest, [Permission.OrganizationRead]],
  ])('grants the expected workspace permissions for %s', (role, allowed) => {
    expectPermissionMatrix({
      allowed,
      current: permissionsForOrganizationRole(role),
      label: `organization:${role}`,
    });
  });
});

describe(permissionsForProjectRole.name, () => {
  it('keeps folder and diagram owner as the all-permission sentinel', () => {
    expect(permissionsForProjectRole(ProjectRole.Owner)).toEqual([Permission.All]);
  });

  it.each([
    [
      ProjectRole.Editor,
      [
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
    ],
    [
      ProjectRole.Commenter,
      [Permission.ProjectRead, Permission.DiagramRead, Permission.DiagramComment, Permission.SnapshotRead],
    ],
    [ProjectRole.Viewer, [Permission.ProjectRead, Permission.DiagramRead, Permission.SnapshotRead]],
  ])('grants the expected folder/diagram permissions for %s', (role, allowed) => {
    expectPermissionMatrix({
      allowed,
      current: permissionsForProjectRole(role),
      label: `project:${role}`,
    });
  });
});

describe(isGranted.name, () => {
  it('requires every requested permission to be present', () => {
    expect(
      isGranted({
        current: [Permission.ProjectRead],
        requested: [Permission.ProjectRead, Permission.ProjectUpdate],
      }),
    ).toBe(false);
  });

  it('allows empty permission requirements', () => {
    expect(isGranted({ current: [], requested: [] })).toBe(true);
  });

  it('lets the all-permission sentinel satisfy any requested scope', () => {
    expect(
      isGranted({
        current: [Permission.All],
        requested: [Permission.OrganizationManage, Permission.ApiKeyManage],
      }),
    ).toBe(true);
  });
});
