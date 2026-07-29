import { useMutation } from '@tanstack/react-query';
import type { ProjectCreateDto, ProjectResponseDto, ProjectUpdateDto } from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { projectsKeys } from './project.keys';

const createProjectMutationFn = (body: ProjectCreateDto) => sdk.projects.create(body);
const updateProjectMutationFn = (input: { body: ProjectUpdateDto; projectId: string }) =>
  sdk.projects.update(input.projectId, input.body);
const archiveProjectMutationFn = (projectId: string) => sdk.projects.archive(projectId);
const starterProjectsKey = projectsKeys.list({ limit: 50 });

type UseCreateProjectMutationParams = {
  mutationConfig?: MutationConfig<typeof createProjectMutationFn>;
};

export function useCreateProjectMutation(params: UseCreateProjectMutationParams = {}) {
  return useMutation({
    mutationFn: createProjectMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Project list menjadi sumber navigasi editor, jadi setiap CRUD project selalu refresh daftar sidebar.
      queryClient.setQueryData<ProjectResponseDto[]>(starterProjectsKey, (current) => [
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
      queryClient.setQueryData<ProjectResponseDto[]>(starterProjectsKey, (current) =>
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
      queryClient.setQueryData<ProjectResponseDto[]>(starterProjectsKey, (current) =>
        (current ?? []).filter((project) => project.id !== variables),
      );
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
