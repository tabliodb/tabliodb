import { useMutation } from '@tanstack/react-query';
import type { InvitationAcceptDto, InvitationCreateDto } from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { authKeys } from '@/resources/auth';
import { projectsKeys } from '@/resources/projects';
import { invitationsKeys } from './invitation.keys';

const acceptInvitationMutationFn = (body: InvitationAcceptDto) => sdk.invitations.accept(body);
const createInvitationMutationFn = (body: InvitationCreateDto) => sdk.invitations.create(body);

type UseAcceptInvitationMutationParams = {
  mutationConfig?: MutationConfig<typeof acceptInvitationMutationFn>;
};

export function useAcceptInvitationMutation(params: UseAcceptInvitationMutationParams = {}) {
  return useMutation({
    mutationFn: acceptInvitationMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Accept invite langsung membuat session cookie; cache auth disiapkan agar route berikutnya tidak perlu probe ulang.
      queryClient.setQueryData(authKeys.me(), data.user);
      queryClient.invalidateQueries({ queryKey: invitationsKeys.token(variables.token) });
      queryClient.invalidateQueries({ queryKey: projectsKeys.all });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseCreateInvitationMutationParams = {
  mutationConfig?: MutationConfig<typeof createInvitationMutationFn>;
};

export function useCreateInvitationMutation(params: UseCreateInvitationMutationParams = {}) {
  return useMutation({
    mutationFn: createInvitationMutationFn,
    ...params.mutationConfig,
  });
}
