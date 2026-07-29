import { useMutation } from '@tanstack/react-query';
import type { OrganizationMemberUpdateDto, OrganizationSettingsUpdateDto } from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { projectsKeys } from '@/resources/projects';
import { organizationsKeys } from './organization.keys';

const updateOrganizationSettingsMutationFn = (input: { body: OrganizationSettingsUpdateDto; organizationId: string }) =>
  sdk.organizations.updateSettings(input.organizationId, input.body);
const updateOrganizationMemberMutationFn = (input: {
  body: OrganizationMemberUpdateDto;
  organizationId: string;
  userId: string;
}) => sdk.organizations.updateMember(input.organizationId, input.userId, input.body);
const removeOrganizationMemberMutationFn = (input: { organizationId: string; userId: string }) =>
  sdk.organizations.removeMember(input.organizationId, input.userId);

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

type UseUpdateOrganizationMemberMutationParams = {
  mutationConfig?: MutationConfig<typeof updateOrganizationMemberMutationFn>;
};

export function useUpdateOrganizationMemberMutation(params: UseUpdateOrganizationMemberMutationParams = {}) {
  return useMutation({
    mutationFn: updateOrganizationMemberMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Workspace member role affects both the member table and the current user's workspace switcher role label.
      queryClient.invalidateQueries({ queryKey: organizationsKeys.membersRoot(variables.organizationId) });
      queryClient.invalidateQueries({ queryKey: organizationsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: organizationsKeys.auditLogsRoot(variables.organizationId) });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseRemoveOrganizationMemberMutationParams = {
  mutationConfig?: MutationConfig<typeof removeOrganizationMemberMutationFn>;
};

export function useRemoveOrganizationMemberMutation(params: UseRemoveOrganizationMemberMutationParams = {}) {
  return useMutation({
    mutationFn: removeOrganizationMemberMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Removing a workspace member can remove their project visibility too, so project lists are refreshed after success.
      queryClient.invalidateQueries({ queryKey: organizationsKeys.membersRoot(variables.organizationId) });
      queryClient.invalidateQueries({ queryKey: organizationsKeys.auditLogsRoot(variables.organizationId) });
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
