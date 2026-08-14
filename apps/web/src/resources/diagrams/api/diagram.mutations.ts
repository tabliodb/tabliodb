import { useMutation } from '@tanstack/react-query';
import {
  createDiagram,
  createDiagramReviewAction,
  exportDiagram,
  importDiagram,
  updateDiagram,
  type DiagramCreateDto,
  type DiagramImportDto,
  type DiagramReviewActionCreateDto,
  type DiagramReviewSummaryDtoOutput,
  type DiagramResponseDtoOutput,
  type DiagramUpdateDto,
} from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { commentKeys } from '@/resources/comments';
import { reviewSignalKeys } from '@/resources/review-signals';
import { diagramsKeys, type DiagramExportQuery } from './diagram.keys';

const createDiagramMutationFn = (body: DiagramCreateDto) => createDiagram({ diagramCreateDto: body });
const updateDiagramMutationFn = (input: { body: DiagramUpdateDto; diagramId: string }) =>
  updateDiagram({ diagramId: input.diagramId, diagramUpdateDto: input.body });
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

export function useCreateDiagramMutation(params: UseCreateDiagramMutationParams = {}) {
  return useMutation({
    mutationFn: createDiagramMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Diagram selector dan editor route bergantung pada list per project, jadi creation langsung terlihat tanpa menunggu reload.
      queryClient.setQueryData<DiagramResponseDtoOutput[]>(
        diagramsKeys.listItemsByProject(data.projectId),
        (current) => [data, ...(current ?? []).filter((diagram) => diagram.id !== data.id)],
      );
      queryClient.invalidateQueries({ queryKey: diagramsKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateDiagramMutation(params: UseUpdateDiagramMutationParams = {}) {
  return useMutation({
    mutationFn: updateDiagramMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Diagram list feeds the active editor header, so successful metadata changes are patched into every cached page.
      queryClient.setQueryData<DiagramResponseDtoOutput[]>(diagramsKeys.listItemsByProject(data.projectId), (current) =>
        (current ?? []).map((diagram) => (diagram.id === data.id ? data : diagram)),
      );
      queryClient.invalidateQueries({ queryKey: diagramsKeys.lists() });
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
      queryClient.setQueryData<DiagramResponseDtoOutput[]>(
        diagramsKeys.listItemsByProject(data.diagram.projectId),
        (current) => (current ?? []).map((diagram) => (diagram.id === data.diagram.id ? data.diagram : diagram)),
      );
      queryClient.invalidateQueries({ queryKey: diagramsKeys.all });
      queryClient.invalidateQueries({ queryKey: reviewSignalKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
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
