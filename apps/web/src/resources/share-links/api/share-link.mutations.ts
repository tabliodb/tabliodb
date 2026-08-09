import { useMutation } from '@tanstack/react-query';
import { createDiagramShareLink, revokeDiagramShareLink, type DiagramShareLinkCreateDto } from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { shareLinkKeys } from './share-link.keys';

const createDiagramShareLinkMutationFn = (input: { body: DiagramShareLinkCreateDto; diagramId: string }) =>
  createDiagramShareLink({ diagramId: input.diagramId, diagramShareLinkCreateDto: input.body });

const revokeDiagramShareLinkMutationFn = (input: { diagramId: string; shareLinkId: string }) =>
  revokeDiagramShareLink({ diagramId: input.diagramId, shareLinkId: input.shareLinkId });

type UseCreateDiagramShareLinkMutationParams = {
  mutationConfig?: MutationConfig<typeof createDiagramShareLinkMutationFn>;
};

export function useCreateDiagramShareLinkMutation(params: UseCreateDiagramShareLinkMutationParams = {}) {
  return useMutation({
    mutationFn: createDiagramShareLinkMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Token hanya tersedia di response create, sedangkan list cache langsung di-refresh supaya UI menampilkan link aktif terbaru.
      queryClient.invalidateQueries({ queryKey: shareLinkKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseRevokeDiagramShareLinkMutationParams = {
  mutationConfig?: MutationConfig<typeof revokeDiagramShareLinkMutationFn>;
};

export function useRevokeDiagramShareLinkMutation(params: UseRevokeDiagramShareLinkMutationParams = {}) {
  return useMutation({
    mutationFn: revokeDiagramShareLinkMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: shareLinkKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
