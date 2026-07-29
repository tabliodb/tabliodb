import { useMutation } from '@tanstack/react-query';
import type { SnapshotCreateDto, SnapshotResponseDto } from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { snapshotsKeys } from './snapshot.keys';

const createSnapshotMutationFn = (body: SnapshotCreateDto) => sdk.snapshots.create(body);

type UseCreateSnapshotMutationParams = {
  mutationConfig?: MutationConfig<typeof createSnapshotMutationFn>;
};

export function useCreateSnapshotMutation(params: UseCreateSnapshotMutationParams = {}) {
  return useMutation({
    mutationFn: createSnapshotMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Save snapshot bersifat append-only; cache list diperbarui di depan agar versi terbaru langsung terlihat di header editor.
      queryClient.setQueryData<SnapshotResponseDto[]>(snapshotsKeys.listByDiagram(data.diagramId), (current) => [
        data,
        ...(current ?? []),
      ]);
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
