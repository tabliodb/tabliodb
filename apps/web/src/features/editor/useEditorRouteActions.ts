import type { DiagramModel } from '@tabliodb/schema-core';
import type { OrganizationDtoOutput, FolderResponseDtoOutput } from '@tabliodb/sdk';
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router';
import { routes } from '@/app/routes';
import { getOrganizationSlug, getWorkspaceSlug } from './editor-route-guards';

type OrganizationDto = OrganizationDtoOutput;
type FolderResponseDto = FolderResponseDtoOutput;

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
  snapshotRecoveryModelRef,
}: {
  clearSelection: () => void;
  modelRef: MutableRefObject<DiagramModel | null>;
  navigate: NavigateFunction;
  persistedDraftSignatureRef: MutableRefObject<string | null>;
  setModel: Dispatch<SetStateAction<DiagramModel | null>>;
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
    (organization: OrganizationDto, { replace, ...resetOptions }: EditorRouteActionOptions = {}) => {
      resetDraft(resetOptions);

      navigate(
        routes.workspace.to({ workspaceSlug: getOrganizationSlug(organization) }),
        createNavigateOptions(replace),
      );
    },
    [navigate, resetDraft],
  );

  const goToFolder = useCallback(
    (folder: FolderResponseDto, { replace, ...resetOptions }: EditorRouteActionOptions = {}) => {
      resetDraft(resetOptions);
      navigate(
        routes.folder.to({
          folderId: folder.id,
          workspaceSlug: getWorkspaceSlug(folder),
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
        folderId: string | null;
        workspaceSlug: string;
      },
      { replace, ...resetOptions }: EditorRouteActionOptions = {},
    ) => {
      resetDraft(resetOptions);
      // Root diagrams use the workspace route; foldered diagrams keep the legacy folder route for deep links.
      navigate(
        target.folderId
          ? routes.diagram.to({ diagramId: target.diagramId, folderId: target.folderId, workspaceSlug: target.workspaceSlug })
          : routes.workspaceDiagram.to({ diagramId: target.diagramId, workspaceSlug: target.workspaceSlug }),
        createNavigateOptions(replace),
      );
    },
    [navigate, resetDraft],
  );

  return {
    goHome,
    goLogin,
    goToAdminSettings,
    goToDiagram,
    goToProfile,
    goToFolder,
    goToWorkspace,
    resetDraft,
  };
}

function createNavigateOptions(replace: boolean | undefined) {
  return replace === undefined ? undefined : { replace };
}
