import { useMutation } from '@tanstack/react-query';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { reviewSignalKeys } from './review-signal.keys';

const ignoreReviewSignalMutationFn = (signalId: string) => sdk.reviewSignals.ignore(signalId);
const unignoreReviewSignalMutationFn = (signalId: string) => sdk.reviewSignals.unignore(signalId);

type UseIgnoreReviewSignalMutationParams = {
  mutationConfig?: MutationConfig<typeof ignoreReviewSignalMutationFn>;
};

export function useIgnoreReviewSignalMutation(params: UseIgnoreReviewSignalMutationParams = {}) {
  return useMutation({
    mutationFn: ignoreReviewSignalMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Ignore mengubah visibility list review, jadi seluruh cache list di-refresh tanpa menebak kombinasi query.
      queryClient.invalidateQueries({ queryKey: reviewSignalKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseUnignoreReviewSignalMutationParams = {
  mutationConfig?: MutationConfig<typeof unignoreReviewSignalMutationFn>;
};

export function useUnignoreReviewSignalMutation(params: UseUnignoreReviewSignalMutationParams = {}) {
  return useMutation({
    mutationFn: unignoreReviewSignalMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Unignore mengembalikan signal ke list aktif setelah sync berikutnya, jadi invalidasi lebih aman dari patch cache manual.
      queryClient.invalidateQueries({ queryKey: reviewSignalKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
