const lastOpenedEditorTargetStorageKey = 'tabliodb:last-opened-editor-target';

export type LastOpenedEditorTarget = {
  diagramId: string | null;
  diagramName?: string | null;
  openedAt: number;
  organizationId: string;
  projectId: string | null;
  projectName?: string | null;
  workspaceSlug: string;
};

type WritableLastOpenedEditorTarget = Omit<LastOpenedEditorTarget, 'openedAt'>;

export function readLastOpenedEditorTarget(): LastOpenedEditorTarget | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawTarget = window.localStorage.getItem(lastOpenedEditorTargetStorageKey);

    if (!rawTarget) {
      return null;
    }

    const target = JSON.parse(rawTarget) as Partial<LastOpenedEditorTarget>;

    if (!isValidLastOpenedEditorTarget(target)) {
      return null;
    }

    return target;
  } catch {
    return null;
  }
}

export function writeLastOpenedEditorTarget(target: WritableLastOpenedEditorTarget): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    // Route memory is deliberately client-only because it describes the user's latest browser context.
    window.localStorage.setItem(
      lastOpenedEditorTargetStorageKey,
      JSON.stringify({
        ...target,
        openedAt: Date.now(),
      }),
    );
  } catch {
    // Local storage can be disabled or full; editor routing must keep working without this preference.
  }
}

function isValidLastOpenedEditorTarget(target: Partial<LastOpenedEditorTarget>): target is LastOpenedEditorTarget {
  return (
    typeof target.organizationId === 'string' &&
    target.organizationId.length > 0 &&
    typeof target.workspaceSlug === 'string' &&
    target.workspaceSlug.length > 0 &&
    (typeof target.projectId === 'string' || target.projectId === null) &&
    (typeof target.diagramId === 'string' || target.diagramId === null) &&
    typeof target.openedAt === 'number'
  );
}
