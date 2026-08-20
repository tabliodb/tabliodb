import { redirect, type LoaderFunctionArgs, type Params } from 'react-router';
import { TabliodbApiError } from '@tabliodb/sdk';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { authQueries } from '@/resources/auth';
import { diagramsQueries } from '@/resources/diagrams';
import { organizationsQueries } from '@/resources/organizations';
import { projectsQueries } from '@/resources/projects';
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
    const projects = await queryClient.ensureQueryData(projectsQueries.listByOrganization(activeOrganization));
    const requestedProject = params.projectId
      ? (projects.find((project) => project.id === params.projectId) ?? null)
      : null;

    if (params.projectId && !requestedProject) {
      throw redirect(routes.workspace.to({ workspaceSlug: organizationSlug }));
    }

    const activeProject = requestedProject;
    const diagrams = await queryClient.ensureQueryData(diagramsQueries.listForWorkspace(activeOrganization));
    const requestedDiagram = params.diagramId
      ? (diagrams.find((diagram) => diagram.id === params.diagramId) ?? null)
      : null;

    if (params.diagramId && !requestedDiagram) {
      throw redirect(
        activeProject
          ? routes.project.to({ projectId: activeProject.id, workspaceSlug: organizationSlug })
          : routes.workspace.to({ workspaceSlug: organizationSlug }),
      );
    }

    if (activeProject && requestedDiagram && requestedDiagram.projectId !== activeProject.id) {
      // A project route may only open diagrams inside that folder; root diagrams use the workspace diagram route.
      throw redirect(routes.workspaceDiagram.to({ diagramId: requestedDiagram.id, workspaceSlug: organizationSlug }));
    }

    const rememberedDiagram =
      rememberedTarget && rememberedTarget.organizationId === activeOrganization.id
        ? (diagrams.find((diagram) => diagram.id === rememberedTarget.diagramId) ?? null)
        : null;
    const activeDiagram = requestedDiagram ?? (!params.diagramId ? (rememberedDiagram ?? diagrams[0] ?? null) : null);

    if (!activeDiagram) {
      if (activeProject && !isProjectRoute(params, organizationSlug, activeProject.id)) {
        throw redirect(routes.project.to({ projectId: activeProject.id, workspaceSlug: organizationSlug }));
      }

      if (!activeProject && !isWorkspaceRoute(params, organizationSlug)) {
        throw redirect(routes.workspace.to({ workspaceSlug: organizationSlug }));
      }

      return { title: activeProject?.name ?? activeOrganization.name };
    }

    if (!isDiagramRoute(params, organizationSlug, activeDiagram.projectId, activeDiagram.id)) {
      // The editor URL is canonicalized to the exact diagram so refreshes, sharing browser history, and document title agree.
      throw redirect(
        activeDiagram.projectId
          ? routes.diagram.to({
              diagramId: activeDiagram.id,
              projectId: activeDiagram.projectId,
              workspaceSlug: organizationSlug,
            })
          : routes.workspaceDiagram.to({
              diagramId: activeDiagram.id,
              workspaceSlug: organizationSlug,
            }),
      );
    }

    // Browser chrome follows the opened diagram document; project folders are only an organizational fallback.
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
  return params.workspaceSlug === workspaceSlug && !params.projectId && !params.diagramId;
}

function isProjectRoute(params: Params<string>, workspaceSlug: string, projectId: string): boolean {
  return params.workspaceSlug === workspaceSlug && params.projectId === projectId && !params.diagramId;
}

function isDiagramRoute(
  params: Params<string>,
  workspaceSlug: string,
  projectId: string | null,
  diagramId: string,
): boolean {
  return projectId
    ? params.workspaceSlug === workspaceSlug && params.projectId === projectId && params.diagramId === diagramId
    : params.workspaceSlug === workspaceSlug && !params.projectId && params.diagramId === diagramId;
}
