import { useMutation } from '@tanstack/react-query';
import type { OrganizationSettingsUpdateDto } from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { projectsKeys } from '@/resources/projects';
import { organizationsKeys } from './organization.keys';

const updateOrganizationSettingsMutationFn = (input: { body: OrganizationSettingsUpdateDto; organizationId: string }) =>
  sdk.organizations.updateSettings(input.organizationId, input.body);

type UseUpdateOrganizationSettingsMutationParams = {
  mutationConfig?: MutationConfig<typeof updateOrganizationSettingsMutationFn>;
};

export function useUpdateOrganizationSettingsMutation(params: UseUpdateOrganizationSettingsMutationParams = {}) {
  return useMutation({
    mutationFn: updateOrganizationSettingsMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Workspace settings affect project list labels/slugs and the settings dialog itself, so both caches are refreshed.
      queryClient.setQueryData(organizationsKeys.settings(variables.organizationId), data);
      queryClient.invalidateQueries({ queryKey: organizationsKeys.auditLogsRoot(variables.organizationId) });
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
