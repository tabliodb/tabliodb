import { useMutation } from '@tanstack/react-query';
import {
  ignoreReviewSignal,
  unignoreReviewSignal,
  updateDiagramReviewSignalSettings,
  updateProjectReviewSignalSettings,
  type ReviewSignalSettingsDto,
} from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { reviewSignalKeys } from './review-signal.keys';

const ignoreReviewSignalMutationFn = (signalId: string) => ignoreReviewSignal({ signalId });
const unignoreReviewSignalMutationFn = (signalId: string) => unignoreReviewSignal({ signalId });
const updateDiagramReviewSignalSettingsMutationFn = (variables: {
  diagramId: string;
  settings: ReviewSignalSettingsDto;
}) => updateDiagramReviewSignalSettings({ diagramId: variables.diagramId, reviewSignalSettingsDto: variables.settings });
const updateProjectReviewSignalSettingsMutationFn = (variables: {
  projectId: string;
  settings: ReviewSignalSettingsDto;
}) => updateProjectReviewSignalSettings({ projectId: variables.projectId, reviewSignalSettingsDto: variables.settings });

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

type UseUpdateDiagramReviewSignalSettingsMutationParams = {
  mutationConfig?: MutationConfig<typeof updateDiagramReviewSignalSettingsMutationFn>;
};

export function useUpdateDiagramReviewSignalSettingsMutation(
  params: UseUpdateDiagramReviewSignalSettingsMutationParams = {},
) {
  return useMutation({
    mutationFn: updateDiagramReviewSignalSettingsMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Rule settings mengubah effective settings dan hasil lint untuk diagram aktif, jadi dua cache domain direfresh bersama.
      queryClient.setQueryData(reviewSignalKeys.diagramSettings(variables.diagramId), data);
      queryClient.invalidateQueries({ queryKey: reviewSignalKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseUpdateProjectReviewSignalSettingsMutationParams = {
  mutationConfig?: MutationConfig<typeof updateProjectReviewSignalSettingsMutationFn>;
};

export function useUpdateProjectReviewSignalSettingsMutation(
  params: UseUpdateProjectReviewSignalSettingsMutationParams = {},
) {
  return useMutation({
    mutationFn: updateProjectReviewSignalSettingsMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Project settings menjadi baseline semua diagram di project, jadi effective diagram settings dan review list perlu diambil ulang.
      queryClient.setQueryData(reviewSignalKeys.projectSettings(variables.projectId), data);
      queryClient.invalidateQueries({ queryKey: reviewSignalKeys.settings() });
      queryClient.invalidateQueries({ queryKey: reviewSignalKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
