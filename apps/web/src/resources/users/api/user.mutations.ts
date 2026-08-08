import { useMutation } from '@tanstack/react-query';
import {
  createUser,
  resetUserPassword,
  revokeUserSessions,
  updateUserStatus,
  type UserCreateDto,
  type UserPasswordResetDto,
  type UserStatusUpdateDto,
} from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { usersKeys } from './user.keys';

const createUserMutationFn = (body: UserCreateDto) => createUser({ userCreateDto: body });
const resetUserPasswordMutationFn = (variables: { body: UserPasswordResetDto; userId: string }) =>
  resetUserPassword({ userId: variables.userId, userPasswordResetDto: variables.body });
const revokeUserSessionsMutationFn = (variables: { userId: string }) => revokeUserSessions({ userId: variables.userId });
const updateUserStatusMutationFn = (variables: { body: UserStatusUpdateDto; userId: string }) =>
  updateUserStatus({ userId: variables.userId, userStatusUpdateDto: variables.body });

type UseCreateUserMutationParams = {
  mutationConfig?: MutationConfig<typeof createUserMutationFn>;
};
type UseResetUserPasswordMutationParams = {
  mutationConfig?: MutationConfig<typeof resetUserPasswordMutationFn>;
};
type UseRevokeUserSessionsMutationParams = {
  mutationConfig?: MutationConfig<typeof revokeUserSessionsMutationFn>;
};
type UseUpdateUserStatusMutationParams = {
  mutationConfig?: MutationConfig<typeof updateUserStatusMutationFn>;
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

export function useResetUserPasswordMutation(params: UseResetUserPasswordMutationParams = {}) {
  return useMutation({
    mutationFn: resetUserPasswordMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Password reset merevoke session target di server, jadi directory user perlu refresh untuk menampilkan status terbaru.
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useRevokeUserSessionsMutation(params: UseRevokeUserSessionsMutationParams = {}) {
  return useMutation({
    mutationFn: revokeUserSessionsMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Session revoke tidak mengubah row user, tetapi invalidasi menjaga badge/action admin tetap sinkron jika nanti summary session ditambah.
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateUserStatusMutation(params: UseUpdateUserStatusMutationParams = {}) {
  return useMutation({
    mutationFn: updateUserStatusMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Disable/enable memengaruhi akses login dan badge admin, jadi semua list user di-refresh setelah mutation sukses.
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
