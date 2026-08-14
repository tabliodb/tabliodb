import { useMutation } from '@tanstack/react-query';
import type { DiagramModel } from '@tabliodb/schema-core';
import {
  createSnapshot,
  restoreSnapshot,
  type SnapshotCreateDto,
  type SnapshotListResponseDtoOutput,
} from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { reviewSignalKeys } from '@/resources/review-signals';
import { snapshotsKeys } from './snapshot.keys';

type SnapshotCreateInput = Omit<SnapshotCreateDto, 'snapshot'> & {
  snapshot: DiagramModel;
};

const createSnapshotMutationFn = (body: SnapshotCreateInput) =>
  createSnapshot({ snapshotCreateDto: body as unknown as SnapshotCreateDto });
const restoreSnapshotMutationFn = (snapshotId: string) => restoreSnapshot({ snapshotId });

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
      queryClient.setQueryData<SnapshotListResponseDtoOutput>(
        snapshotsKeys.listByDiagram(data.diagramId),
        (current) => ({
          items: [data, ...(current?.items ?? [])],
          nextCursor: current?.nextCursor ?? null,
          totalCount: (current?.totalCount ?? 0) + 1,
        }),
      );
      void queryClient.invalidateQueries({ queryKey: snapshotsKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: reviewSignalKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useRestoreSnapshotMutation(params: UseRestoreSnapshotMutationParams = {}) {
  return useMutation({
    mutationFn: restoreSnapshotMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData<SnapshotListResponseDtoOutput>(
        snapshotsKeys.listByDiagram(data.diagramId),
        (current) => ({
          items: [data, ...(current?.items ?? [])],
          nextCursor: current?.nextCursor ?? null,
          totalCount: (current?.totalCount ?? 0) + 1,
        }),
      );
      // Restore menghasilkan snapshot baru dari versi lama, sehingga semua daftar history diagram perlu di-refresh.
      void queryClient.invalidateQueries({ queryKey: snapshotsKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: reviewSignalKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
