import { useMutation } from '@tanstack/react-query';
import type { LoginCredentialDto } from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { projectsKeys } from '@/resources/projects';
import { authKeys } from './auth.keys';

const loginMutationFn = (body: LoginCredentialDto) => sdk.auth.login(body);
const logoutMutationFn = () => sdk.auth.logout();

type UseLoginMutationParams = {
  mutationConfig?: MutationConfig<typeof loginMutationFn>;
};

export function useLoginMutation(params: UseLoginMutationParams = {}) {
  return useMutation({
    mutationFn: loginMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Login response membawa user yang sama dengan /auth/me, jadi cache session bisa langsung dipakai route berikutnya.
      queryClient.setQueryData(authKeys.me(), data.user);
      queryClient.invalidateQueries({ queryKey: projectsKeys.all });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseLogoutMutationParams = {
  mutationConfig?: MutationConfig<typeof logoutMutationFn>;
};

export function useLogoutMutation(params: UseLogoutMutationParams = {}) {
  return useMutation({
    mutationFn: logoutMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Cookie session sudah dibersihkan server; cache client ikut dikosongkan agar workspace lama tidak muncul di login berikutnya.
      queryClient.clear();
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
