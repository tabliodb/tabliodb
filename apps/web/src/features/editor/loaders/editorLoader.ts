import { redirect, type LoaderFunctionArgs, type Params } from 'react-router';
import { TabliodbApiError } from '@tabliodb/sdk';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { authQueries } from '@/resources/auth';
import { diagramsQueries } from '@/resources/diagrams';
import { organizationsQueries } from '@/resources/organizations';
import { foldersQueries } from '@/resources/folders';
import {
  getOrganizationSlug,
  matchesRememberedWorkspace,
  matchesWorkspaceRoute,
} from '../editor-route-guards';

export type EditorLoaderData = {
  title?: string;
};

export function getEditorRouteTitle(loaderData: unknown): string | undefined {
  if (!isEditorLoaderData(loaderData)) {
    return 'Editor';
  }

  return loaderData.title ?? 'Editor';
}

export async function editorLoader({ params }: LoaderFunctionArgs): Promise<EditorLoaderData> {
  try {
    const organizationList = await queryClient.ensureQueryData(organizationsQueries.list({ limit: 50 }));
    const rememberedTarget = await queryClient.ensureQueryData(authQueries.editorPreference());
    const organizations = organizationList.items;

    if (organizations.length === 0) {
      return { title: 'Editor' };
    }

    const requestedOrganization = params.workspaceSlug
      ? (organizations.find((organization) => matchesWorkspaceRoute(organization, params.workspaceSlug ?? null)) ??
        null)
      : null;
    const rememberedOrganization = rememberedTarget
      ? (organizations.find((organization) => matchesRememberedWorkspace(organization, rememberedTarget)) ?? null)
      : null;
    const activeOrganization = requestedOrganization ?? rememberedOrganization ?? organizations[0];
    const organizationSlug = getOrganizationSlug(activeOrganization);
    const folders = await queryClient.ensureQueryData(foldersQueries.listByOrganization(activeOrganization));
    const requestedFolder = params.folderId
      ? (folders.find((folder) => folder.id === params.folderId) ?? null)
      : null;

    if (params.folderId && !requestedFolder) {
      throw redirect(routes.workspace.to({ workspaceSlug: organizationSlug }));
    }

    const activeFolder = requestedFolder;
    const diagrams = await queryClient.ensureQueryData(diagramsQueries.listForWorkspace(activeOrganization));
    const requestedDiagram = params.diagramId
      ? (diagrams.find((diagram) => diagram.id === params.diagramId) ?? null)
      : null;

    if (params.diagramId && !requestedDiagram) {
      throw redirect(
        activeFolder
          ? routes.folder.to({ folderId: activeFolder.id, workspaceSlug: organizationSlug })
          : routes.workspace.to({ workspaceSlug: organizationSlug }),
      );
    }

    if (activeFolder && requestedDiagram && requestedDiagram.folderId !== activeFolder.id) {
      // A folder route may only open diagrams inside that folder; root diagrams use the workspace diagram route.
      throw redirect(routes.workspaceDiagram.to({ diagramId: requestedDiagram.id, workspaceSlug: organizationSlug }));
    }

    const rememberedDiagram =
      rememberedTarget && rememberedTarget.organizationId === activeOrganization.id
        ? (diagrams.find((diagram) => diagram.id === rememberedTarget.diagramId) ?? null)
        : null;
    const activeDiagram = requestedDiagram ?? (!params.diagramId ? (rememberedDiagram ?? diagrams[0] ?? null) : null);

    if (!activeDiagram) {
      if (activeFolder && !isFolderRoute(params, organizationSlug, activeFolder.id)) {
        throw redirect(routes.folder.to({ folderId: activeFolder.id, workspaceSlug: organizationSlug }));
      }

      if (!activeFolder && !isWorkspaceRoute(params, organizationSlug)) {
        throw redirect(routes.workspace.to({ workspaceSlug: organizationSlug }));
      }

      return { title: activeFolder?.name ?? activeOrganization.name };
    }

    if (!isDiagramRoute(params, organizationSlug, activeDiagram.folderId, activeDiagram.id)) {
      // The editor URL is canonicalized to the exact diagram so refreshes, sharing browser history, and document title agree.
      throw redirect(
        activeDiagram.folderId
          ? routes.diagram.to({
              diagramId: activeDiagram.id,
              folderId: activeDiagram.folderId,
              workspaceSlug: organizationSlug,
            })
          : routes.workspaceDiagram.to({
              diagramId: activeDiagram.id,
              workspaceSlug: organizationSlug,
            }),
      );
    }

    // Browser chrome follows the opened diagram document; folders are only an organizational fallback.
    return { title: activeDiagram.name };
  } catch (error) {
    if (error instanceof TabliodbApiError && error.status === 401) {
      throw redirect(routes.login.to());
    }

    throw error;
  }
}

function isEditorLoaderData(loaderData: unknown): loaderData is EditorLoaderData {
  return Boolean(loaderData && typeof loaderData === 'object' && 'title' in loaderData);
}

function isWorkspaceRoute(params: Params<string>, workspaceSlug: string): boolean {
  return params.workspaceSlug === workspaceSlug && !params.folderId && !params.diagramId;
}

function isFolderRoute(params: Params<string>, workspaceSlug: string, folderId: string): boolean {
  return params.workspaceSlug === workspaceSlug && params.folderId === folderId && !params.diagramId;
}

function isDiagramRoute(
  params: Params<string>,
  workspaceSlug: string,
  folderId: string | null,
  diagramId: string,
): boolean {
  return folderId
    ? params.workspaceSlug === workspaceSlug && params.folderId === folderId && params.diagramId === diagramId
    : params.workspaceSlug === workspaceSlug && !params.folderId && params.diagramId === diagramId;
}
