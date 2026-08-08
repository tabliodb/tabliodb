import { useMutation } from '@tanstack/react-query';
import { completeSetup, updateInstanceAuthSettings, type InstanceAuthSettingsUpdateDto, type SetupCreateDto } from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { projectsKeys } from '@/resources/projects';
import { setupKeys } from './setup.keys';

const completeSetupMutationFn = (body: SetupCreateDto) => completeSetup({ setupCreateDto: body });
const updateAuthSettingsMutationFn = (body: InstanceAuthSettingsUpdateDto) =>
  updateInstanceAuthSettings({ instanceAuthSettingsUpdateDto: body });

type UseCompleteSetupMutationParams = {
  mutationConfig?: MutationConfig<typeof completeSetupMutationFn>;
};
type UseUpdateAuthSettingsMutationParams = {
  mutationConfig?: MutationConfig<typeof updateAuthSettingsMutationFn>;
};

export function useCompleteSetupMutation(params: UseCompleteSetupMutationParams = {}) {
  return useMutation({
    mutationFn: completeSetupMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Setup response sudah membawa status terbaru, jadi cache setup bisa langsung akurat tanpa menunggu refetch.
      queryClient.setQueryData(setupKeys.status(), data.setup);
      queryClient.invalidateQueries({ queryKey: projectsKeys.all });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateAuthSettingsMutation(params: UseUpdateAuthSettingsMutationParams = {}) {
  return useMutation({
    mutationFn: updateAuthSettingsMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Signup policy memengaruhi setup status dan admin settings, jadi dua cache ringan ini dibuat langsung konsisten.
      queryClient.setQueryData(setupKeys.authSettings(), data);
      queryClient.setQueryData(setupKeys.status(), (current) =>
        current
          ? {
              ...current,
              signupPolicy: data.signupPolicy,
            }
          : current,
      );
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
