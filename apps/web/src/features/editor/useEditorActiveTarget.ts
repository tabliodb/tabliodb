import { useMemo } from 'react';
import {
  Permission,
  isGranted,
  permissionsForOrganizationRole,
  permissionsForAccessRole,
  type OrganizationRoleValue,
  type AccessRoleValue,
} from '@tabliodb/shared';
import type {
  CurrentUserEditorPreferenceDtoOutput,
  DiagramResponseDtoOutput,
  OrganizationDtoOutput,
  FolderResponseDtoOutput,
} from '@tabliodb/sdk';
import { matchesRememberedWorkspace, matchesWorkspaceRoute } from './editor-route-guards';

type CurrentUserEditorPreferenceDto = CurrentUserEditorPreferenceDtoOutput;
type DiagramResponseDto = DiagramResponseDtoOutput;
type OrganizationDto = OrganizationDtoOutput;
type FolderResponseDto = FolderResponseDtoOutput;

type EditorPermissionFlags = {
  canCommentDiagram: boolean;
  canCreateDiagram: boolean;
  canCreateFolder: boolean;
  canCreateSnapshot: boolean;
  canEditDiagram: boolean;
  canManageDiagramMembers: boolean;
  canManageFolder: boolean;
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

export function useFilteredEditorFolders({
  folderSearchTerm,
  folders,
}: {
  folderSearchTerm: string;
  folders: FolderResponseDto[];
}): FolderResponseDto[] {
  return useMemo(() => {
    const search = folderSearchTerm.trim().toLowerCase();

    return search
      ? folders.filter((folder) =>
          [folder.name, folder.slug, folder.description ?? ''].some((value) => value.toLowerCase().includes(search)),
        )
      : folders;
  }, [folderSearchTerm, folders]);
}

export function useEditorActiveFolder({
  folders,
  routeFolderId,
}: {
  folders: FolderResponseDto[];
  routeFolderId: string | null;
}): FolderResponseDto | null {
  return useMemo(() => {
    if (!routeFolderId) {
      return null;
    }

    return folders.find((folder) => folder.id === routeFolderId) ?? null;
  }, [folders, routeFolderId]);
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
  activeDiagram,
  activeOrganization,
  activeFolder,
}: {
  activeDiagram: DiagramResponseDto | null;
  activeOrganization: OrganizationDto | null;
  activeFolder: FolderResponseDto | null;
}): EditorPermissionFlags {
  return useMemo(
    () => ({
      canCommentDiagram: activeDiagram
        ? hasFolderPermission(activeDiagram.role, Permission.DiagramComment)
        : activeFolder
          ? hasFolderPermission(activeFolder.folderRole, Permission.DiagramComment)
          : Boolean(
              activeOrganization && hasOrganizationPermission(activeOrganization.role, Permission.DiagramComment),
            ),
      canCreateDiagram: activeFolder
        ? hasFolderPermission(activeFolder.folderRole, Permission.DiagramCreate)
        : Boolean(activeOrganization && hasOrganizationPermission(activeOrganization.role, Permission.DiagramCreate)),
      canCreateFolder: activeOrganization
        ? hasOrganizationPermission(activeOrganization.role, Permission.FolderCreate)
        : false,
      canCreateSnapshot: activeDiagram
        ? hasFolderPermission(activeDiagram.role, Permission.SnapshotCreate)
        : activeFolder
          ? hasFolderPermission(activeFolder.folderRole, Permission.SnapshotCreate)
          : Boolean(
              activeOrganization && hasOrganizationPermission(activeOrganization.role, Permission.SnapshotCreate),
            ),
      // Diagram actions use the effective diagram role returned by the API, so a guest with direct editor access can edit without inheriting broad workspace power.
      canEditDiagram: activeDiagram
        ? hasFolderPermission(activeDiagram.role, Permission.DiagramUpdate)
        : activeFolder
          ? hasFolderPermission(activeFolder.folderRole, Permission.DiagramUpdate)
          : Boolean(activeOrganization && hasOrganizationPermission(activeOrganization.role, Permission.DiagramUpdate)),
      canManageDiagramMembers: activeDiagram
        ? hasFolderPermission(activeDiagram.role, Permission.DiagramMemberManage)
        : activeFolder
          ? hasFolderPermission(activeFolder.folderRole, Permission.DiagramMemberManage)
          : Boolean(
              activeOrganization && hasOrganizationPermission(activeOrganization.role, Permission.DiagramMemberManage),
            ),
      canManageFolder: activeFolder
        ? hasFolderPermission(activeFolder.folderRole, Permission.FolderUpdate)
        : false,
      canManageWorkspace: activeOrganization
        ? hasOrganizationPermission(activeOrganization.role, Permission.OrganizationManage)
        : false,
    }),
    [activeDiagram, activeOrganization, activeFolder],
  );
}

function hasOrganizationPermission(role: OrganizationRoleValue, permission: Permission): boolean {
  return isGranted({
    current: permissionsForOrganizationRole(role),
    requested: [permission],
  });
}

function hasFolderPermission(role: AccessRoleValue, permission: Permission): boolean {
  return isGranted({
    current: permissionsForAccessRole(role),
    requested: [permission],
  });
}
