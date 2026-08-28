import { useMutation } from '@tanstack/react-query';
import {
  addFolderAccess,
  archiveFolder,
  createFolder,
  removeFolderAccess,
  transferFolderOwnership,
  updateFolder,
  updateFolderAccess,
  type FolderCreateDto,
  type FolderAccessCreateDto,
  type FolderAccessUpdateDto,
  type FolderOwnershipTransferDto,
  type FolderResponseDtoOutput,
  type FolderUpdateDto,
} from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { organizationsKeys } from '@/resources/organizations';
import { foldersKeys } from './folder.keys';

const createFolderMutationFn = (body: FolderCreateDto) => createFolder({ folderCreateDto: body });
const updateFolderMutationFn = (input: { body: FolderUpdateDto; folderId: string }) =>
  updateFolder({ folderId: input.folderId, folderUpdateDto: input.body });
const archiveFolderMutationFn = (input: { organizationId: string; folderId: string }) =>
  archiveFolder({ folderId: input.folderId });
const addFolderAccessMutationFn = (input: { body: FolderAccessCreateDto; organizationId: string; folderId: string }) =>
  addFolderAccess({ folderId: input.folderId, folderAccessCreateDto: input.body });
const updateFolderAccessMutationFn = (input: { body: FolderAccessUpdateDto; folderId: string; userId: string }) =>
  updateFolderAccess({ folderId: input.folderId, folderAccessUpdateDto: input.body, userId: input.userId });
const transferFolderOwnershipMutationFn = (input: { body: FolderOwnershipTransferDto; folderId: string }) =>
  transferFolderOwnership({
    folderId: input.folderId,
    folderOwnershipTransferDto: input.body,
  });
const removeFolderAccessMutationFn = (input: { folderId: string; userId: string }) =>
  removeFolderAccess({ folderId: input.folderId, userId: input.userId });
const getOrganizationFolderItemsKey = (organizationId: string) => foldersKeys.listItemsByOrganization(organizationId);

type UseCreateFolderMutationParams = {
  mutationConfig?: MutationConfig<typeof createFolderMutationFn>;
};

export function useCreateFolderMutation(params: UseCreateFolderMutationParams = {}) {
  return useMutation({
    mutationFn: createFolderMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Folder list menjadi sumber navigasi editor, jadi setiap CRUD folder selalu refresh daftar sidebar.
      queryClient.setQueryData<FolderResponseDtoOutput[]>(
        getOrganizationFolderItemsKey(data.organizationId),
        (current) => [data, ...(current ?? []).filter((folder) => folder.id !== data.id)],
      );
      queryClient.invalidateQueries({ queryKey: foldersKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseUpdateFolderMutationParams = {
  mutationConfig?: MutationConfig<typeof updateFolderMutationFn>;
};

export function useUpdateFolderMutation(params: UseUpdateFolderMutationParams = {}) {
  return useMutation({
    mutationFn: updateFolderMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Rename folder bisa mengubah slug dan header/sidebar, jadi cache list harus di-refresh setelah server menerima update.
      queryClient.setQueryData<FolderResponseDtoOutput[]>(
        getOrganizationFolderItemsKey(data.organizationId),
        (current) => (current ?? []).map((folder) => (folder.id === data.id ? data : folder)),
      );
      queryClient.invalidateQueries({ queryKey: foldersKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseArchiveFolderMutationParams = {
  mutationConfig?: MutationConfig<typeof archiveFolderMutationFn>;
};

export function useArchiveFolderMutation(params: UseArchiveFolderMutationParams = {}) {
  return useMutation({
    mutationFn: archiveFolderMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Archive mengeluarkan folder dari list aktif karena server list hanya mengembalikan folder non-archived.
      queryClient.setQueryData<FolderResponseDtoOutput[]>(
        getOrganizationFolderItemsKey(variables.organizationId),
        (current) => (current ?? []).filter((folder) => folder.id !== variables.folderId),
      );
      queryClient.invalidateQueries({ queryKey: foldersKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseAddFolderAccessMutationParams = {
  mutationConfig?: MutationConfig<typeof addFolderAccessMutationFn>;
};

export function useAddFolderAccessMutation(params: UseAddFolderAccessMutationParams = {}) {
  return useMutation({
    mutationFn: addFolderAccessMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Folder-level invite may implicitly add an existing user as a workspace guest, so the workspace member list must refresh too.
      queryClient.invalidateQueries({ queryKey: foldersKeys.accessRoot(variables.folderId) });
      queryClient.invalidateQueries({ queryKey: organizationsKeys.membersRoot(variables.organizationId) });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseUpdateFolderAccessMutationParams = {
  mutationConfig?: MutationConfig<typeof updateFolderAccessMutationFn>;
};

type UseTransferFolderOwnershipMutationParams = {
  mutationConfig?: MutationConfig<typeof transferFolderOwnershipMutationFn>;
};

export function useUpdateFolderAccessMutation(params: UseUpdateFolderAccessMutationParams = {}) {
  return useMutation({
    mutationFn: updateFolderAccessMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Role change harus muncul segera di settings agar owner tahu perubahan akses sudah diterima server.
      queryClient.invalidateQueries({ queryKey: foldersKeys.accessRoot(variables.folderId) });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useTransferFolderOwnershipMutation(params: UseTransferFolderOwnershipMutationParams = {}) {
  return useMutation({
    mutationFn: transferFolderOwnershipMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Folder ownership changes effective permissions, so both member rows and folder list role labels must be refreshed.
      queryClient.invalidateQueries({ queryKey: foldersKeys.accessRoot(variables.folderId) });
      queryClient.invalidateQueries({ queryKey: foldersKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseRemoveFolderAccessMutationParams = {
  mutationConfig?: MutationConfig<typeof removeFolderAccessMutationFn>;
};

export function useRemoveFolderAccessMutation(params: UseRemoveFolderAccessMutationParams = {}) {
  return useMutation({
    mutationFn: removeFolderAccessMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Removing a user changes only the member list, so we scope invalidation narrowly to that folder.
      queryClient.invalidateQueries({ queryKey: foldersKeys.accessRoot(variables.folderId) });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
