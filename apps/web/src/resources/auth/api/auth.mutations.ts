import { useMutation } from '@tanstack/react-query';
import {
  confirmPasswordReset,
  deleteCurrentUserAvatar,
  login,
  logout,
  requestPasswordReset,
  updateCurrentUserPassword,
  updateCurrentUserProfile,
  uploadCurrentUserAvatar,
  type CurrentUserPasswordUpdateDto,
  type CurrentUserProfileUpdateDto,
  type LoginCredentialDto,
  type PasswordResetConfirmDto,
  type PasswordResetRequestDto,
} from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { projectsKeys } from '@/resources/projects';
import { usersKeys } from '@/resources/users';
import { authKeys } from './auth.keys';

const uploadAvatarMutationFn = (file: Blob) => uploadCurrentUserAvatar({ body: { file } });
const deleteAvatarMutationFn = () => deleteCurrentUserAvatar();
const updateProfileMutationFn = (body: CurrentUserProfileUpdateDto) =>
  updateCurrentUserProfile({ currentUserProfileUpdateDto: body });
const updatePasswordMutationFn = (body: CurrentUserPasswordUpdateDto) =>
  updateCurrentUserPassword({ currentUserPasswordUpdateDto: body });
const loginMutationFn = (body: LoginCredentialDto) => login({ loginCredentialDto: body });
const logoutMutationFn = () => logout();
const passwordResetRequestMutationFn = (body: PasswordResetRequestDto) =>
  requestPasswordReset({ passwordResetRequestDto: body });
const passwordResetConfirmMutationFn = (body: PasswordResetConfirmDto) =>
  confirmPasswordReset({ passwordResetConfirmDto: body });

type UseUploadAvatarMutationParams = {
  mutationConfig?: MutationConfig<typeof uploadAvatarMutationFn>;
};
type UseDeleteAvatarMutationParams = {
  mutationConfig?: MutationConfig<typeof deleteAvatarMutationFn>;
};
type UseUpdateProfileMutationParams = {
  mutationConfig?: MutationConfig<typeof updateProfileMutationFn>;
};
type UseUpdatePasswordMutationParams = {
  mutationConfig?: MutationConfig<typeof updatePasswordMutationFn>;
};
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

type UsePasswordResetRequestMutationParams = {
  mutationConfig?: MutationConfig<typeof passwordResetRequestMutationFn>;
};

export function usePasswordResetRequestMutation(params: UsePasswordResetRequestMutationParams = {}) {
  return useMutation({
    mutationFn: passwordResetRequestMutationFn,
    ...params.mutationConfig,
  });
}

type UsePasswordResetConfirmMutationParams = {
  mutationConfig?: MutationConfig<typeof passwordResetConfirmMutationFn>;
};

export function useUploadAvatarMutation(params: UseUploadAvatarMutationParams = {}) {
  return useMutation({
    mutationFn: uploadAvatarMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Avatar upload mengembalikan CurrentUserResponseDto terbaru, jadi auth cache bisa langsung sinkron tanpa refetch.
      queryClient.setQueryData(authKeys.me(), data);
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDeleteAvatarMutation(params: UseDeleteAvatarMutationParams = {}) {
  return useMutation({
    mutationFn: deleteAvatarMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Delete avatar mengikuti strategi cache yang sama seperti upload agar header/profile tidak menunggu roundtrip tambahan.
      queryClient.setQueryData(authKeys.me(), data);
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateProfileMutation(params: UseUpdateProfileMutationParams = {}) {
  return useMutation({
    mutationFn: updateProfileMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Profile identity tampil di header, mention, dan directory admin; response /auth/me langsung menjadi cache source of truth.
      queryClient.setQueryData(authKeys.me(), data);
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateCurrentUserPasswordMutation(params: UseUpdatePasswordMutationParams = {}) {
  return useMutation({
    mutationFn: updatePasswordMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Password change clears the temporary-password gate, so the auth cache must update before protected routes continue.
      queryClient.setQueryData(authKeys.me(), data);
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function usePasswordResetConfirmMutation(params: UsePasswordResetConfirmMutationParams = {}) {
  return useMutation({
    mutationFn: passwordResetConfirmMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Password reset revokes existing sessions; clearing cache prevents stale auth state from surviving this boundary.
      queryClient.clear();
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
