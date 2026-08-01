import { OrganizationRole, ProjectRole } from '@tabliodb/shared';
import type { OrganizationDto } from '@tabliodb/sdk';
import { describe, expect, it } from 'vitest';
import { canCreateAutomaticStarterProject } from './project.queries';

function organization(role: OrganizationRole, allowMemberProjectCreate = true): OrganizationDto {
  return {
    allowMemberProjectCreate,
    createdAt: '2026-07-29T00:00:00.000Z',
    defaultProjectRole: ProjectRole.Viewer,
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Library System',
    role,
    slug: 'library-system',
    status: 'active',
    updatedAt: '2026-07-29T00:00:00.000Z',
  };
}

describe(canCreateAutomaticStarterProject.name, () => {
  it('allows owner and admin to bootstrap the presentable starter project', () => {
    expect(canCreateAutomaticStarterProject(organization(OrganizationRole.Owner))).toBe(true);
    expect(canCreateAutomaticStarterProject(organization(OrganizationRole.Admin))).toBe(true);
  });

  it('does not auto-create starter projects for regular workspace members', () => {
    expect(canCreateAutomaticStarterProject(organization(OrganizationRole.Member, true))).toBe(false);
    expect(canCreateAutomaticStarterProject(organization(OrganizationRole.Guest, true))).toBe(false);
  });
});
