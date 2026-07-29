import { useMutation } from '@tanstack/react-query';
import type { UserCreateDto } from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { usersKeys } from './user.keys';

const createUserMutationFn = (body: UserCreateDto) => sdk.users.create(body);

type UseCreateUserMutationParams = {
  mutationConfig?: MutationConfig<typeof createUserMutationFn>;
};

export function useCreateUserMutation(params: UseCreateUserMutationParams = {}) {
  return useMutation({
    mutationFn: createUserMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Setelah admin membuat user, semua daftar user perlu fresh karena role dan membership ditulis dalam transaksi server.
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
