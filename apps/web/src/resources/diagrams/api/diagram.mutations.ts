import { useMutation } from '@tanstack/react-query';
import {
  createDiagramReviewAction,
  exportDiagram,
  importDiagram,
  updateDiagram,
  type DiagramImportDto,
  type DiagramListResponseDtoOutput,
  type DiagramReviewActionCreateDto,
  type DiagramReviewSummaryDtoOutput,
  type DiagramResponseDtoOutput,
  type DiagramUpdateDto,
} from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { commentKeys } from '@/resources/comments';
import { diagramsKeys, type DiagramExportQuery } from './diagram.keys';

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

export function useUpdateDiagramMutation(params: UseUpdateDiagramMutationParams = {}) {
  return useMutation({
    mutationFn: updateDiagramMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Diagram list feeds the active editor header, so successful metadata changes are patched into every cached page.
      queryClient.setQueriesData<DiagramListResponseDtoOutput>({ queryKey: diagramsKeys.lists() }, (current) =>
        current ? replaceDiagramInList(current, data) : current,
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
      queryClient.setQueriesData<DiagramListResponseDtoOutput>({ queryKey: diagramsKeys.lists() }, (current) =>
        current ? replaceDiagramInList(current, data.diagram) : current,
      );
      queryClient.invalidateQueries({ queryKey: diagramsKeys.all });
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

function replaceDiagramInList(
  current: DiagramListResponseDtoOutput,
  diagram: DiagramResponseDtoOutput,
): DiagramListResponseDtoOutput {
  return {
    ...current,
    items: current.items.map((item) => (item.id === diagram.id ? diagram : item)),
  };
}
