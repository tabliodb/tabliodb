import type {
  CurrentUserEditorPreferenceDtoOutput,
  OrganizationDtoOutput,
  ProjectResponseDtoOutput,
} from '@tabliodb/sdk';

type CurrentUserEditorPreferenceDto = CurrentUserEditorPreferenceDtoOutput;
type OrganizationDto = OrganizationDtoOutput;
type ProjectResponseDto = ProjectResponseDtoOutput;

export function getWorkspaceSlug(project: ProjectResponseDto): string {
  // Prefer human-friendly workspace slugs, but keep organization id as a stable fallback for older/project-only payloads.
  return project.organizationSlug || project.organizationId;
}

export function getOrganizationSlug(organization: OrganizationDto): string {
  // Workspace routes should stay readable when the server has a slug, while id fallback keeps setup/dev data reachable.
  return organization.slug || organization.id;
}

export function matchesWorkspaceRoute(organization: OrganizationDto, workspaceSlug: string | null): boolean {
  // Workspace URL accepts both slug and id so old remembered links still land on the intended workspace.
  return Boolean(workspaceSlug && (organization.slug === workspaceSlug || organization.id === workspaceSlug));
}

export function matchesRememberedWorkspace(
  organization: OrganizationDto,
  rememberedTarget: CurrentUserEditorPreferenceDto,
): boolean {
  // The remembered editor target stores canonical ids while route params use slugs, so both are accepted here.
  return Boolean(
    rememberedTarget.organizationId &&
    (organization.id === rememberedTarget.organizationId || organization.slug === rememberedTarget.workspaceSlug),
  );
}

export function createEditorPreferenceKey(target: {
  diagramId?: string | null;
  organizationId: string | null;
  projectId?: string | null;
}): string {
  // A compact stable key lets EditorPage skip duplicate preference writes without comparing nested objects.
  return [target.organizationId ?? '', target.projectId ?? '', target.diagramId ?? ''].join(':');
}
