import { useMemo } from 'react';
import {
  Permission,
  isGranted,
  permissionsForOrganizationRole,
  permissionsForProjectRole,
  type OrganizationRoleValue,
  type ProjectRoleValue,
} from '@tabliodb/shared';
import type {
  CurrentUserEditorPreferenceDtoOutput,
  DiagramResponseDtoOutput,
  OrganizationDtoOutput,
  ProjectResponseDtoOutput,
} from '@tabliodb/sdk';
import { matchesRememberedWorkspace, matchesWorkspaceRoute } from './editor-route-guards';

type CurrentUserEditorPreferenceDto = CurrentUserEditorPreferenceDtoOutput;
type DiagramResponseDto = DiagramResponseDtoOutput;
type OrganizationDto = OrganizationDtoOutput;
type ProjectResponseDto = ProjectResponseDtoOutput;

type EditorPermissionFlags = {
  canCommentDiagram: boolean;
  canCreateDiagram: boolean;
  canCreateProject: boolean;
  canCreateSnapshot: boolean;
  canEditDiagram: boolean;
  canManageProject: boolean;
  canManageWorkspace: boolean;
};

export function useEditorActiveOrganization({
  organizations,
  rememberedEditorTarget,
  routeWorkspaceSlug,
}: {
  organizations: OrganizationDto[];
  rememberedEditorTarget: CurrentUserEditorPreferenceDto | null;
  routeWorkspaceSlug: string | null;
}): OrganizationDto | null {
  return useMemo(() => {
    if (organizations.length === 0) {
      return null;
    }

    if (routeWorkspaceSlug) {
      // Explicit URL wins over remembered preference so shared links and browser history remain deterministic.
      return organizations.find((organization) => matchesWorkspaceRoute(organization, routeWorkspaceSlug)) ?? null;
    }

    if (rememberedEditorTarget) {
      return (
        organizations.find((organization) => matchesRememberedWorkspace(organization, rememberedEditorTarget)) ?? null
      );
    }

    return null;
  }, [organizations, rememberedEditorTarget, routeWorkspaceSlug]);
}

export function useFilteredEditorProjects({
  projectSearchTerm,
  projects,
}: {
  projectSearchTerm: string;
  projects: ProjectResponseDto[];
}): ProjectResponseDto[] {
  return useMemo(() => {
    const search = projectSearchTerm.trim().toLowerCase();

    return search
      ? projects.filter((project) =>
          [project.name, project.slug, project.description ?? ''].some((value) => value.toLowerCase().includes(search)),
        )
      : projects;
  }, [projectSearchTerm, projects]);
}

export function useEditorActiveProject({
  projects,
  routeProjectId,
}: {
  projects: ProjectResponseDto[];
  routeProjectId: string | null;
}): ProjectResponseDto | null {
  return useMemo(() => {
    if (!routeProjectId) {
      return null;
    }

    return projects.find((project) => project.id === routeProjectId) ?? null;
  }, [projects, routeProjectId]);
}

export function useEditorActiveDiagram({
  diagrams,
  routeDiagramId,
}: {
  diagrams: DiagramResponseDto[];
  routeDiagramId: string | null;
}): DiagramResponseDto | null {
  return useMemo(() => {
    if (!routeDiagramId) {
      return null;
    }

    return diagrams.find((diagram) => diagram.id === routeDiagramId) ?? null;
  }, [diagrams, routeDiagramId]);
}

export function useEditorPermissionFlags({
  activeOrganization,
  activeProject,
}: {
  activeOrganization: OrganizationDto | null;
  activeProject: ProjectResponseDto | null;
}): EditorPermissionFlags {
  return useMemo(
    () => ({
      canCommentDiagram: activeProject
        ? hasProjectPermission(activeProject.projectRole, Permission.DiagramComment)
        : false,
      canCreateDiagram: activeProject
        ? hasProjectPermission(activeProject.projectRole, Permission.DiagramCreate)
        : false,
      canCreateProject: activeOrganization
        ? hasOrganizationPermission(activeOrganization.role, Permission.ProjectCreate)
        : false,
      canCreateSnapshot: activeProject
        ? hasProjectPermission(activeProject.projectRole, Permission.SnapshotCreate)
        : false,
      canEditDiagram: activeProject ? hasProjectPermission(activeProject.projectRole, Permission.DiagramUpdate) : false,
      canManageProject: activeProject
        ? hasProjectPermission(activeProject.projectRole, Permission.ProjectUpdate)
        : false,
      canManageWorkspace: activeOrganization
        ? hasOrganizationPermission(activeOrganization.role, Permission.OrganizationManage)
        : false,
    }),
    [activeOrganization, activeProject],
  );
}

function hasOrganizationPermission(role: OrganizationRoleValue, permission: Permission): boolean {
  return isGranted({
    current: permissionsForOrganizationRole(role),
    requested: [permission],
  });
}

function hasProjectPermission(role: ProjectRoleValue, permission: Permission): boolean {
  return isGranted({
    current: permissionsForProjectRole(role),
    requested: [permission],
  });
}
