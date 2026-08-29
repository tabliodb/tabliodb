import { useMutation } from '@tanstack/react-query';
import {
  addOrganizationMember,
  createOrganization,
  removeOrganizationMember,
  transferOrganizationOwnership,
  updateOrganizationMember,
  updateOrganizationSettings,
  type OrganizationCreateDto,
  type OrganizationDtoOutput,
  type OrganizationListResponseDtoOutput,
  type OrganizationMemberCreateDto,
  type OrganizationMemberUpdateDto,
  type OrganizationOwnershipTransferDto,
  type OrganizationSettingsUpdateDto,
} from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { foldersKeys } from '@/resources/folders';
import { organizationsKeys } from './organization.keys';

const createOrganizationMutationFn = (body: OrganizationCreateDto) =>
  createOrganization({ organizationCreateDto: body });
const updateOrganizationSettingsMutationFn = (input: { body: OrganizationSettingsUpdateDto; organizationId: string }) =>
  updateOrganizationSettings({ organizationId: input.organizationId, organizationSettingsUpdateDto: input.body });
const addOrganizationMemberMutationFn = (input: { body: OrganizationMemberCreateDto; organizationId: string }) =>
  addOrganizationMember({
    organizationId: input.organizationId,
    organizationMemberCreateDto: input.body,
  });
const updateOrganizationMemberMutationFn = (input: {
  body: OrganizationMemberUpdateDto;
  organizationId: string;
  userId: string;
}) =>
  updateOrganizationMember({
    organizationId: input.organizationId,
    organizationMemberUpdateDto: input.body,
    userId: input.userId,
  });
const transferOrganizationOwnershipMutationFn = (input: {
  body: OrganizationOwnershipTransferDto;
  organizationId: string;
}) =>
  transferOrganizationOwnership({
    organizationId: input.organizationId,
    organizationOwnershipTransferDto: input.body,
  });
const removeOrganizationMemberMutationFn = (input: { organizationId: string; userId: string }) =>
  removeOrganizationMember({ organizationId: input.organizationId, userId: input.userId });

type UseUpdateOrganizationSettingsMutationParams = {
  mutationConfig?: MutationConfig<typeof updateOrganizationSettingsMutationFn>;
};

type UseCreateOrganizationMutationParams = {
  mutationConfig?: MutationConfig<typeof createOrganizationMutationFn>;
};

export function useCreateOrganizationMutation(params: UseCreateOrganizationMutationParams = {}) {
  return useMutation({
    mutationFn: createOrganizationMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Workspace switcher membaca query list paginated, jadi item baru dipatch optimistic-friendly lalu list tetap di-refresh.
      queryClient.setQueriesData<OrganizationListResponseDtoOutput>(
        { queryKey: organizationsKeys.lists() },
        (current) => (current ? prependOrganizationToList(current, data) : current),
      );
      queryClient.invalidateQueries({ queryKey: organizationsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: organizationsKeys.adminWorkspacesRoot() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateOrganizationSettingsMutation(params: UseUpdateOrganizationSettingsMutationParams = {}) {
  return useMutation({
    mutationFn: updateOrganizationSettingsMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Workspace settings affect folder list labels/slugs and the settings dialog itself, so both caches are refreshed.
      queryClient.setQueryData(organizationsKeys.settings(variables.organizationId), data);
      queryClient.invalidateQueries({ queryKey: organizationsKeys.auditLogsRoot(variables.organizationId) });
      queryClient.invalidateQueries({ queryKey: foldersKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

function prependOrganizationToList(
  current: OrganizationListResponseDtoOutput,
  organization: OrganizationDtoOutput,
): OrganizationListResponseDtoOutput {
  const existingItems = current.items.filter((item) => item.id !== organization.id);

  return {
    ...current,
    items: [organization, ...existingItems],
    totalCount: existingItems.length === current.items.length ? current.totalCount + 1 : current.totalCount,
  };
}

type UseAddOrganizationMemberMutationParams = {
  mutationConfig?: MutationConfig<typeof addOrganizationMemberMutationFn>;
};

export function useAddOrganizationMemberMutation(params: UseAddOrganizationMemberMutationParams = {}) {
  return useMutation({
    mutationFn: addOrganizationMemberMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Existing-user membership changes the workspace roster immediately and leaves an audit trail.
      queryClient.invalidateQueries({ queryKey: organizationsKeys.membersRoot(variables.organizationId) });
      queryClient.invalidateQueries({ queryKey: organizationsKeys.auditLogsRoot(variables.organizationId) });
      queryClient.invalidateQueries({ queryKey: organizationsKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseUpdateOrganizationMemberMutationParams = {
  mutationConfig?: MutationConfig<typeof updateOrganizationMemberMutationFn>;
};

type UseTransferOrganizationOwnershipMutationParams = {
  mutationConfig?: MutationConfig<typeof transferOrganizationOwnershipMutationFn>;
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

export function useTransferOrganizationOwnershipMutation(params: UseTransferOrganizationOwnershipMutationParams = {}) {
  return useMutation({
    mutationFn: transferOrganizationOwnershipMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Workspace ownership affects top-level navigation roles and every inherited permission check.
      queryClient.invalidateQueries({ queryKey: organizationsKeys.membersRoot(variables.organizationId) });
      queryClient.invalidateQueries({ queryKey: organizationsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: organizationsKeys.auditLogsRoot(variables.organizationId) });
      queryClient.invalidateQueries({ queryKey: foldersKeys.lists() });
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
      // Removing a workspace member can remove their folder visibility too, so folder lists are refreshed after success.
      queryClient.invalidateQueries({ queryKey: organizationsKeys.membersRoot(variables.organizationId) });
      queryClient.invalidateQueries({ queryKey: organizationsKeys.auditLogsRoot(variables.organizationId) });
      queryClient.invalidateQueries({ queryKey: foldersKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
