import { useMutation } from '@tanstack/react-query';
import {
  acceptInvitation,
  activatePreparedSessionBinding,
  createInvitation,
  prepareSessionBinding,
  type InvitationAcceptDto,
  type InvitationCreateDto,
} from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { authKeys } from '@/resources/auth';
import { projectsKeys } from '@/resources/projects';
import { invitationsKeys } from './invitation.keys';

const acceptInvitationMutationFn = async (body: InvitationAcceptDto) => {
  const sessionBinding = await prepareSessionBinding();

  return acceptInvitation({
    invitationAcceptDto: sessionBinding
      ? {
          ...body,
          // Invitation accept creates a brand-new session, so the server can bind it to this browser right away.
          sessionBinding,
        }
      : body,
  });
};
const createInvitationMutationFn = (body: InvitationCreateDto) => createInvitation({ invitationCreateDto: body });

type UseAcceptInvitationMutationParams = {
  mutationConfig?: MutationConfig<typeof acceptInvitationMutationFn>;
};

export function useAcceptInvitationMutation(params: UseAcceptInvitationMutationParams = {}) {
  return useMutation({
    mutationFn: acceptInvitationMutationFn,
    ...params.mutationConfig,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await activatePreparedSessionBinding();
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
