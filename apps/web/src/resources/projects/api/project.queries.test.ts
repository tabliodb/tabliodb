import { DefaultProjectRole, Role as SdkOrganizationRole, type OrganizationDtoOutput } from '@tabliodb/sdk';
import { describe, expect, it } from 'vitest';
import { canCreateAutomaticStarterProject } from './project.queries';

function organization(role: SdkOrganizationRole, allowMemberProjectCreate = true): OrganizationDtoOutput {
  return {
    allowMemberProjectCreate,
    createdAt: '2026-07-29T00:00:00.000Z',
    defaultProjectRole: DefaultProjectRole.Viewer,
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
    expect(canCreateAutomaticStarterProject(organization(SdkOrganizationRole.Owner))).toBe(true);
    expect(canCreateAutomaticStarterProject(organization(SdkOrganizationRole.Admin))).toBe(true);
  });

  it('does not auto-create starter projects for regular workspace members', () => {
    expect(canCreateAutomaticStarterProject(organization(SdkOrganizationRole.Member, true))).toBe(false);
    expect(canCreateAutomaticStarterProject(organization(SdkOrganizationRole.Guest, true))).toBe(false);
  });
});
