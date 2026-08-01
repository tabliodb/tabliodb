import { useMutation } from '@tanstack/react-query';
import type { SnapshotCreateDto, SnapshotListResponseDto } from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { snapshotsKeys } from './snapshot.keys';

const createSnapshotMutationFn = (body: SnapshotCreateDto) => sdk.snapshots.create(body);
const restoreSnapshotMutationFn = (snapshotId: string) => sdk.snapshots.restore(snapshotId);

type UseCreateSnapshotMutationParams = {
  mutationConfig?: MutationConfig<typeof createSnapshotMutationFn>;
};

type UseRestoreSnapshotMutationParams = {
  mutationConfig?: MutationConfig<typeof restoreSnapshotMutationFn>;
};

export function useCreateSnapshotMutation(params: UseCreateSnapshotMutationParams = {}) {
  return useMutation({
    mutationFn: createSnapshotMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Save snapshot bersifat append-only; cache list diperbarui di depan agar versi terbaru langsung terlihat di header editor.
      queryClient.setQueryData<SnapshotListResponseDto>(snapshotsKeys.listByDiagram(data.diagramId), (current) => ({
        items: [data, ...(current?.items ?? [])],
        nextCursor: current?.nextCursor ?? null,
        totalCount: (current?.totalCount ?? 0) + 1,
      }));
      void queryClient.invalidateQueries({ queryKey: snapshotsKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useRestoreSnapshotMutation(params: UseRestoreSnapshotMutationParams = {}) {
  return useMutation({
    mutationFn: restoreSnapshotMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData<SnapshotListResponseDto>(snapshotsKeys.listByDiagram(data.diagramId), (current) => ({
        items: [data, ...(current?.items ?? [])],
        nextCursor: current?.nextCursor ?? null,
        totalCount: (current?.totalCount ?? 0) + 1,
      }));
      // Restore menghasilkan snapshot baru dari versi lama, sehingga semua daftar history diagram perlu di-refresh.
      void queryClient.invalidateQueries({ queryKey: snapshotsKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
