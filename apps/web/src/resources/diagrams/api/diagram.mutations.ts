import { useMutation } from '@tanstack/react-query';
import {
  addDiagramMember,
  createDiagram,
  createDiagramReviewAction,
  createWorkspaceDiagram,
  exportDiagram,
  importDiagram,
  removeDiagramMember,
  updateDiagram,
  updateDiagramMember,
  type DiagramCreateDto,
  type DiagramImportDto,
  type DiagramMemberCreateDto,
  type DiagramMemberUpdateDto,
  type DiagramReviewActionCreateDto,
  type DiagramReviewSummaryDtoOutput,
  type DiagramResponseDtoOutput,
  type DiagramUpdateDto,
  type WorkspaceDiagramCreateDto,
} from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { commentKeys } from '@/resources/comments';
import { projectsKeys } from '@/resources/projects';
import { reviewSignalKeys } from '@/resources/review-signals';
import { diagramsKeys, type DiagramExportQuery } from './diagram.keys';

const createDiagramMutationFn = (body: DiagramCreateDto) => createDiagram({ diagramCreateDto: body });
const createWorkspaceDiagramMutationFn = (input: { body: WorkspaceDiagramCreateDto; organizationId: string }) =>
  createWorkspaceDiagram({
    organizationId: input.organizationId,
    workspaceDiagramCreateDto: input.body,
  });
const updateDiagramMutationFn = (input: { body: DiagramUpdateDto; diagramId: string }) =>
  updateDiagram({ diagramId: input.diagramId, diagramUpdateDto: input.body });
const addDiagramMemberMutationFn = (input: { body: DiagramMemberCreateDto; diagramId: string }) =>
  addDiagramMember({ diagramId: input.diagramId, diagramMemberCreateDto: input.body });
const updateDiagramMemberMutationFn = (input: { body: DiagramMemberUpdateDto; diagramId: string; userId: string }) =>
  updateDiagramMember({ diagramId: input.diagramId, diagramMemberUpdateDto: input.body, userId: input.userId });
const removeDiagramMemberMutationFn = (input: { diagramId: string; userId: string }) =>
  removeDiagramMember({ diagramId: input.diagramId, userId: input.userId });
const importDiagramMutationFn = (input: { body: DiagramImportDto; diagramId: string }) =>
  importDiagram({ diagramId: input.diagramId, diagramImportDto: input.body });
const exportDiagramMutationFn = (input: { diagramId: string; query?: DiagramExportQuery }) =>
  exportDiagram({ diagramId: input.diagramId, ...input.query });
const createDiagramReviewActionMutationFn = (input: {
  body: DiagramReviewActionCreateDto;
  diagramId: string;
}): Promise<DiagramReviewSummaryDtoOutput> =>
  createDiagramReviewAction({ diagramId: input.diagramId, diagramReviewActionCreateDto: input.body });

type UseUpdateDiagramMutationParams = {
  mutationConfig?: MutationConfig<typeof updateDiagramMutationFn>;
};

type UseCreateDiagramMutationParams = {
  mutationConfig?: MutationConfig<typeof createDiagramMutationFn>;
};

type UseCreateWorkspaceDiagramMutationParams = {
  mutationConfig?: MutationConfig<typeof createWorkspaceDiagramMutationFn>;
};

type UseAddDiagramMemberMutationParams = {
  mutationConfig?: MutationConfig<typeof addDiagramMemberMutationFn>;
};

type UseUpdateDiagramMemberMutationParams = {
  mutationConfig?: MutationConfig<typeof updateDiagramMemberMutationFn>;
};

type UseRemoveDiagramMemberMutationParams = {
  mutationConfig?: MutationConfig<typeof removeDiagramMemberMutationFn>;
};

export function useCreateDiagramMutation(params: UseCreateDiagramMutationParams = {}) {
  return useMutation({
    mutationFn: createDiagramMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Diagram selector utama membaca list workspace; project cache hanya dipatch jika diagram memang berada di folder.
      patchDiagramListCache(data);
      queryClient.invalidateQueries({ queryKey: diagramsKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useCreateWorkspaceDiagramMutation(params: UseCreateWorkspaceDiagramMutationParams = {}) {
  return useMutation({
    mutationFn: createWorkspaceDiagramMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Workspace-level create produces a root diagram, so the workspace list is the authoritative optimistic cache.
      patchDiagramListCache(data);
      queryClient.invalidateQueries({ queryKey: diagramsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateDiagramMutation(params: UseUpdateDiagramMutationParams = {}) {
  return useMutation({
    mutationFn: updateDiagramMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Diagram list feeds the active editor header, so successful metadata changes are patched into workspace/folder caches.
      patchDiagramListCache(data, 'replace');
      queryClient.invalidateQueries({ queryKey: diagramsKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useAddDiagramMemberMutation(params: UseAddDiagramMemberMutationParams = {}) {
  return useMutation({
    mutationFn: addDiagramMemberMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Diagram sharing has its own cache root so access changes do not churn the full diagram list.
      queryClient.invalidateQueries({ queryKey: diagramsKeys.membersRoot(variables.diagramId) });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateDiagramMemberMutation(params: UseUpdateDiagramMemberMutationParams = {}) {
  return useMutation({
    mutationFn: updateDiagramMemberMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Role changes affect only the sharing panel and downstream permission checks handled by the server.
      queryClient.invalidateQueries({ queryKey: diagramsKeys.membersRoot(variables.diagramId) });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useRemoveDiagramMemberMutation(params: UseRemoveDiagramMemberMutationParams = {}) {
  return useMutation({
    mutationFn: removeDiagramMemberMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Removing a direct member leaves workspace/project caches intact; only diagram access membership changes.
      queryClient.invalidateQueries({ queryKey: diagramsKeys.membersRoot(variables.diagramId) });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseExportDiagramMutationParams = {
  mutationConfig?: MutationConfig<typeof exportDiagramMutationFn>;
};

export function useExportDiagramMutation(params: UseExportDiagramMutationParams = {}) {
  return useMutation({
    mutationFn: exportDiagramMutationFn,
    ...params.mutationConfig,
  });
}

type UseImportDiagramMutationParams = {
  mutationConfig?: MutationConfig<typeof importDiagramMutationFn>;
};

export function useImportDiagramMutation(params: UseImportDiagramMutationParams = {}) {
  return useMutation({
    mutationFn: importDiagramMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Import replace mutates the draft document and diagram metadata, so related list/export caches must be refreshed.
      patchDiagramListCache(data.diagram, 'replace');
      queryClient.invalidateQueries({ queryKey: diagramsKeys.all });
      queryClient.invalidateQueries({ queryKey: reviewSignalKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

function patchDiagramListCache(data: DiagramResponseDtoOutput, mode: 'prepend' | 'replace' = 'prepend') {
  const patchList = (current: DiagramResponseDtoOutput[] | undefined) => {
    const items = (current ?? []).filter((diagram) => diagram.id !== data.id);

    return mode === 'replace' ? [...items, data].sort(byUpdatedAtDesc) : [data, ...items];
  };

  queryClient.setQueryData<DiagramResponseDtoOutput[]>(
    diagramsKeys.listItemsByWorkspace(data.organizationId),
    patchList,
  );

  if (data.projectId) {
    queryClient.setQueryData<DiagramResponseDtoOutput[]>(diagramsKeys.listItemsByProject(data.projectId), patchList);
  }
}

function byUpdatedAtDesc(left: DiagramResponseDtoOutput, right: DiagramResponseDtoOutput) {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

type UseCreateDiagramReviewActionMutationParams = {
  mutationConfig?: MutationConfig<typeof createDiagramReviewActionMutationFn>;
};

export function useCreateDiagramReviewActionMutation(params: UseCreateDiagramReviewActionMutationParams = {}) {
  return useMutation({
    mutationFn: createDiagramReviewActionMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Review action mutates diagram status and review event history; related cached views should observe the new decision immediately.
      queryClient.setQueryData(diagramsKeys.reviewSummary(variables.diagramId), data);
      queryClient.invalidateQueries({ queryKey: diagramsKeys.reviews() });
      queryClient.invalidateQueries({ queryKey: diagramsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: commentKeys.summaries() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
