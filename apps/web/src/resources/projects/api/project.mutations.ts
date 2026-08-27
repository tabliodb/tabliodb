import { useMutation } from '@tanstack/react-query';
import {
  addProjectMember,
  archiveProject,
  createProject,
  removeProjectMember,
  transferProjectOwnership,
  updateProject,
  updateProjectMember,
  type ProjectCreateDto,
  type ProjectMemberCreateDto,
  type ProjectMemberUpdateDto,
  type ProjectOwnershipTransferDto,
  type ProjectResponseDtoOutput,
  type ProjectUpdateDto,
} from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { organizationsKeys } from '@/resources/organizations';
import { projectsKeys } from './project.keys';

const createProjectMutationFn = (body: ProjectCreateDto) => createProject({ projectCreateDto: body });
const updateProjectMutationFn = (input: { body: ProjectUpdateDto; projectId: string }) =>
  updateProject({ projectId: input.projectId, projectUpdateDto: input.body });
const archiveProjectMutationFn = (input: { organizationId: string; projectId: string }) =>
  archiveProject({ projectId: input.projectId });
const addProjectMemberMutationFn = (input: { body: ProjectMemberCreateDto; organizationId: string; projectId: string }) =>
  addProjectMember({ projectId: input.projectId, projectMemberCreateDto: input.body });
const updateProjectMemberMutationFn = (input: { body: ProjectMemberUpdateDto; projectId: string; userId: string }) =>
  updateProjectMember({ projectId: input.projectId, projectMemberUpdateDto: input.body, userId: input.userId });
const transferProjectOwnershipMutationFn = (input: { body: ProjectOwnershipTransferDto; projectId: string }) =>
  transferProjectOwnership({
    projectId: input.projectId,
    projectOwnershipTransferDto: input.body,
  });
const removeProjectMemberMutationFn = (input: { projectId: string; userId: string }) =>
  removeProjectMember({ projectId: input.projectId, userId: input.userId });
const getOrganizationProjectItemsKey = (organizationId: string) => projectsKeys.listItemsByOrganization(organizationId);

type UseCreateProjectMutationParams = {
  mutationConfig?: MutationConfig<typeof createProjectMutationFn>;
};

export function useCreateProjectMutation(params: UseCreateProjectMutationParams = {}) {
  return useMutation({
    mutationFn: createProjectMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Project list menjadi sumber navigasi editor, jadi setiap CRUD project selalu refresh daftar sidebar.
      queryClient.setQueryData<ProjectResponseDtoOutput[]>(
        getOrganizationProjectItemsKey(data.organizationId),
        (current) => [data, ...(current ?? []).filter((project) => project.id !== data.id)],
      );
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseUpdateProjectMutationParams = {
  mutationConfig?: MutationConfig<typeof updateProjectMutationFn>;
};

export function useUpdateProjectMutation(params: UseUpdateProjectMutationParams = {}) {
  return useMutation({
    mutationFn: updateProjectMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Rename project bisa mengubah slug dan header/sidebar, jadi cache list harus di-refresh setelah server menerima update.
      queryClient.setQueryData<ProjectResponseDtoOutput[]>(
        getOrganizationProjectItemsKey(data.organizationId),
        (current) => (current ?? []).map((project) => (project.id === data.id ? data : project)),
      );
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseArchiveProjectMutationParams = {
  mutationConfig?: MutationConfig<typeof archiveProjectMutationFn>;
};

export function useArchiveProjectMutation(params: UseArchiveProjectMutationParams = {}) {
  return useMutation({
    mutationFn: archiveProjectMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Archive mengeluarkan project dari list aktif karena server list hanya mengembalikan project non-archived.
      queryClient.setQueryData<ProjectResponseDtoOutput[]>(
        getOrganizationProjectItemsKey(variables.organizationId),
        (current) => (current ?? []).filter((project) => project.id !== variables.projectId),
      );
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseAddProjectMemberMutationParams = {
  mutationConfig?: MutationConfig<typeof addProjectMemberMutationFn>;
};

export function useAddProjectMemberMutation(params: UseAddProjectMemberMutationParams = {}) {
  return useMutation({
    mutationFn: addProjectMemberMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Folder-level invite may implicitly add an existing user as a workspace guest, so the workspace member list must refresh too.
      queryClient.invalidateQueries({ queryKey: projectsKeys.membersRoot(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: organizationsKeys.membersRoot(variables.organizationId) });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseUpdateProjectMemberMutationParams = {
  mutationConfig?: MutationConfig<typeof updateProjectMemberMutationFn>;
};

type UseTransferProjectOwnershipMutationParams = {
  mutationConfig?: MutationConfig<typeof transferProjectOwnershipMutationFn>;
};

export function useUpdateProjectMemberMutation(params: UseUpdateProjectMemberMutationParams = {}) {
  return useMutation({
    mutationFn: updateProjectMemberMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Role change harus muncul segera di settings agar owner tahu perubahan akses sudah diterima server.
      queryClient.invalidateQueries({ queryKey: projectsKeys.membersRoot(variables.projectId) });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useTransferProjectOwnershipMutation(params: UseTransferProjectOwnershipMutationParams = {}) {
  return useMutation({
    mutationFn: transferProjectOwnershipMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Folder ownership changes effective permissions, so both member rows and folder list role labels must be refreshed.
      queryClient.invalidateQueries({ queryKey: projectsKeys.membersRoot(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseRemoveProjectMemberMutationParams = {
  mutationConfig?: MutationConfig<typeof removeProjectMemberMutationFn>;
};

export function useRemoveProjectMemberMutation(params: UseRemoveProjectMemberMutationParams = {}) {
  return useMutation({
    mutationFn: removeProjectMemberMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Removing a user changes only the member list, so we scope invalidation narrowly to that project.
      queryClient.invalidateQueries({ queryKey: projectsKeys.membersRoot(variables.projectId) });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
