import { useMutation } from '@tanstack/react-query';
import type { DiagramListResponseDto, DiagramResponseDto, DiagramUpdateDto } from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { diagramsKeys } from './diagram.keys';

const updateDiagramMutationFn = (input: { body: DiagramUpdateDto; diagramId: string }) =>
  sdk.diagrams.update(input.diagramId, input.body);

type UseUpdateDiagramMutationParams = {
  mutationConfig?: MutationConfig<typeof updateDiagramMutationFn>;
};

export function useUpdateDiagramMutation(params: UseUpdateDiagramMutationParams = {}) {
  return useMutation({
    mutationFn: updateDiagramMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Diagram list feeds the active editor header, so successful metadata changes are patched into every cached page.
      queryClient.setQueriesData<DiagramListResponseDto>({ queryKey: diagramsKeys.lists() }, (current) =>
        current ? replaceDiagramInList(current, data) : current,
      );
      queryClient.invalidateQueries({ queryKey: diagramsKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

function replaceDiagramInList(current: DiagramListResponseDto, diagram: DiagramResponseDto): DiagramListResponseDto {
  return {
    ...current,
    items: current.items.map((item) => (item.id === diagram.id ? diagram : item)),
  };
}
