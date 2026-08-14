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
  getWorkspaceSlug,
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

    const rememberedProject =
      rememberedTarget && rememberedTarget.organizationId === activeOrganization.id
        ? (projects.find((project) => project.id === rememberedTarget.projectId) ?? null)
        : null;
    const activeProject = requestedProject ?? (!params.projectId ? (rememberedProject ?? projects[0] ?? null) : null);

    if (!activeProject) {
      if (!isWorkspaceRoute(params, organizationSlug)) {
        throw redirect(routes.workspace.to({ workspaceSlug: organizationSlug }));
      }

      return { title: activeOrganization.name };
    }

    const workspaceSlug = getWorkspaceSlug(activeProject);
    const diagrams = await queryClient.ensureQueryData(diagramsQueries.listForProject(activeProject));
    const requestedDiagram = params.diagramId
      ? (diagrams.find((diagram) => diagram.id === params.diagramId) ?? null)
      : null;

    if (params.diagramId && !requestedDiagram) {
      throw redirect(routes.project.to({ projectId: activeProject.id, workspaceSlug }));
    }

    const rememberedDiagram =
      rememberedTarget && rememberedTarget.projectId === activeProject.id
        ? (diagrams.find((diagram) => diagram.id === rememberedTarget.diagramId) ?? null)
        : null;
    const activeDiagram = requestedDiagram ?? (!params.diagramId ? (rememberedDiagram ?? diagrams[0] ?? null) : null);

    if (!activeDiagram) {
      if (!isProjectRoute(params, workspaceSlug, activeProject.id)) {
        throw redirect(routes.project.to({ projectId: activeProject.id, workspaceSlug }));
      }

      return { title: activeProject.name };
    }

    if (!isDiagramRoute(params, workspaceSlug, activeProject.id, activeDiagram.id)) {
      // The editor URL is canonicalized to the exact diagram so refreshes, sharing browser history, and document title agree.
      throw redirect(
        routes.diagram.to({
          diagramId: activeDiagram.id,
          projectId: activeProject.id,
          workspaceSlug,
        }),
      );
    }

    return { title: activeProject.name };
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

function isDiagramRoute(params: Params<string>, workspaceSlug: string, projectId: string, diagramId: string): boolean {
  return params.workspaceSlug === workspaceSlug && params.projectId === projectId && params.diagramId === diagramId;
}
