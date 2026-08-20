import type { DiagramModel } from '@tabliodb/schema-core';
import type { OrganizationDtoOutput, ProjectResponseDtoOutput } from '@tabliodb/sdk';
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router';
import { routes } from '@/app/routes';
import { getOrganizationSlug, getWorkspaceSlug } from './editor-route-guards';

type OrganizationDto = OrganizationDtoOutput;
type ProjectResponseDto = ProjectResponseDtoOutput;

type ResetDraftOptions = {
  clearSelection?: boolean;
};

type EditorRouteActionOptions = ResetDraftOptions & {
  replace?: boolean;
};

export function useEditorRouteActions({
  clearSelection,
  modelRef,
  navigate,
  persistedDraftSignatureRef,
  setModel,
  setProjectSearchTerm,
  snapshotRecoveryModelRef,
}: {
  clearSelection: () => void;
  modelRef: MutableRefObject<DiagramModel | null>;
  navigate: NavigateFunction;
  persistedDraftSignatureRef: MutableRefObject<string | null>;
  setModel: Dispatch<SetStateAction<DiagramModel | null>>;
  setProjectSearchTerm: Dispatch<SetStateAction<string>>;
  snapshotRecoveryModelRef: MutableRefObject<DiagramModel | null>;
}) {
  const resetDraft = useCallback(
    ({ clearSelection: shouldClearSelection = true }: ResetDraftOptions = {}) => {
      modelRef.current = null;
      snapshotRecoveryModelRef.current = null;
      persistedDraftSignatureRef.current = null;
      setModel(null);

      if (shouldClearSelection) {
        // Route changes invalidate canvas entity references; clearing selection prevents stale sidebar/inspector anchors.
        clearSelection();
      }
    },
    [clearSelection, modelRef, persistedDraftSignatureRef, setModel, snapshotRecoveryModelRef],
  );

  const goHome = useCallback(
    ({ replace, ...resetOptions }: EditorRouteActionOptions = {}) => {
      resetDraft(resetOptions);
      navigate(routes.home.to(), createNavigateOptions(replace));
    },
    [navigate, resetDraft],
  );

  const goLogin = useCallback(
    ({ replace, ...resetOptions }: EditorRouteActionOptions = {}) => {
      resetDraft(resetOptions);
      navigate(routes.login.to(), createNavigateOptions(replace));
    },
    [navigate, resetDraft],
  );

  const goToAdminSettings = useCallback(() => {
    navigate(routes.adminSettings.to());
  }, [navigate]);

  const goToProfile = useCallback(() => {
    navigate(routes.profile.to());
  }, [navigate]);

  const goToWorkspace = useCallback(
    (
      organization: OrganizationDto,
      {
        clearProjectSearch = false,
        replace,
        ...resetOptions
      }: EditorRouteActionOptions & { clearProjectSearch?: boolean } = {},
    ) => {
      resetDraft(resetOptions);

      if (clearProjectSearch) {
        setProjectSearchTerm('');
      }

      navigate(
        routes.workspace.to({ workspaceSlug: getOrganizationSlug(organization) }),
        createNavigateOptions(replace),
      );
    },
    [navigate, resetDraft, setProjectSearchTerm],
  );

  const goToProject = useCallback(
    (project: ProjectResponseDto, { replace, ...resetOptions }: EditorRouteActionOptions = {}) => {
      resetDraft(resetOptions);
      navigate(
        routes.project.to({
          projectId: project.id,
          workspaceSlug: getWorkspaceSlug(project),
        }),
        createNavigateOptions(replace),
      );
    },
    [navigate, resetDraft],
  );

  const goToDiagram = useCallback(
    (
      target: {
        diagramId: string;
        projectId: string;
        workspaceSlug: string;
      },
      { replace, ...resetOptions }: EditorRouteActionOptions = {},
    ) => {
      resetDraft(resetOptions);
      navigate(routes.diagram.to(target), createNavigateOptions(replace));
    },
    [navigate, resetDraft],
  );

  return {
    goHome,
    goLogin,
    goToAdminSettings,
    goToDiagram,
    goToProfile,
    goToProject,
    goToWorkspace,
    resetDraft,
  };
}

function createNavigateOptions(replace: boolean | undefined) {
  return replace === undefined ? undefined : { replace };
}
