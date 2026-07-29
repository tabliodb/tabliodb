import { useMutation } from '@tanstack/react-query';
import type {
  ProjectCreateDto,
  ProjectMemberCreateDto,
  ProjectMemberUpdateDto,
  ProjectResponseDto,
  ProjectUpdateDto,
} from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { projectsKeys } from './project.keys';

const createProjectMutationFn = (body: ProjectCreateDto) => sdk.projects.create(body);
const updateProjectMutationFn = (input: { body: ProjectUpdateDto; projectId: string }) =>
  sdk.projects.update(input.projectId, input.body);
const archiveProjectMutationFn = (input: { organizationId: string; projectId: string }) =>
  sdk.projects.archive(input.projectId);
const addProjectMemberMutationFn = (input: { body: ProjectMemberCreateDto; projectId: string }) =>
  sdk.projects.addMember(input.projectId, input.body);
const updateProjectMemberMutationFn = (input: { body: ProjectMemberUpdateDto; projectId: string; userId: string }) =>
  sdk.projects.updateMember(input.projectId, input.userId, input.body);
const removeProjectMemberMutationFn = (input: { projectId: string; userId: string }) =>
  sdk.projects.removeMember(input.projectId, input.userId);
const getStarterProjectsKey = (organizationId: string) => projectsKeys.list({ limit: 50, organizationId });

type UseCreateProjectMutationParams = {
  mutationConfig?: MutationConfig<typeof createProjectMutationFn>;
};

export function useCreateProjectMutation(params: UseCreateProjectMutationParams = {}) {
  return useMutation({
    mutationFn: createProjectMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Project list menjadi sumber navigasi editor, jadi setiap CRUD project selalu refresh daftar sidebar.
      queryClient.setQueryData<ProjectResponseDto[]>(getStarterProjectsKey(data.organizationId), (current) => [
        data,
        ...(current ?? []).filter((project) => project.id !== data.id),
      ]);
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
      queryClient.setQueryData<ProjectResponseDto[]>(getStarterProjectsKey(data.organizationId), (current) =>
        (current ?? []).map((project) => (project.id === data.id ? data : project)),
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
      queryClient.setQueryData<ProjectResponseDto[]>(getStarterProjectsKey(variables.organizationId), (current) =>
        (current ?? []).filter((project) => project.id !== variables.projectId),
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
      // Member management memakai query terpisah dari project list agar cache sidebar tidak ikut churn.
      queryClient.invalidateQueries({ queryKey: projectsKeys.membersRoot(variables.projectId) });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseUpdateProjectMemberMutationParams = {
  mutationConfig?: MutationConfig<typeof updateProjectMemberMutationFn>;
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
