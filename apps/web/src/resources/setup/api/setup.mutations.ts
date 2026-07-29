import { useMutation } from '@tanstack/react-query';
import type { SetupCreateDto } from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { projectsKeys } from '@/resources/projects';
import { setupKeys } from './setup.keys';

const completeSetupMutationFn = (body: SetupCreateDto) => sdk.setup.complete(body);

type UseCompleteSetupMutationParams = {
  mutationConfig?: MutationConfig<typeof completeSetupMutationFn>;
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
