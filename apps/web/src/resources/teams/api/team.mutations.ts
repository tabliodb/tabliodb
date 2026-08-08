import { useMutation } from '@tanstack/react-query';
import {
  addTeamMember,
  archiveTeam,
  createTeam,
  removeTeamMember,
  removeTeamProjectAccess,
  updateTeam,
  upsertTeamProjectAccess,
  type TeamCreateDto,
  type TeamMemberCreateDto,
  type TeamProjectAccessUpsertDto,
  type TeamUpdateDto,
} from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { organizationsKeys } from '@/resources/organizations';
import { projectsKeys } from '@/resources/projects';
import { teamsKeys } from './team.keys';

const createTeamMutationFn = (body: TeamCreateDto) => createTeam({ teamCreateDto: body });
const updateTeamMutationFn = (input: { body: TeamUpdateDto; teamId: string }) =>
  updateTeam({ teamId: input.teamId, teamUpdateDto: input.body });
const archiveTeamMutationFn = (input: { organizationId: string; teamId: string }) => archiveTeam({ teamId: input.teamId });
const addTeamMemberMutationFn = (input: { body: TeamMemberCreateDto; organizationId: string; teamId: string }) =>
  addTeamMember({ teamId: input.teamId, teamMemberCreateDto: input.body });
const removeTeamMemberMutationFn = (input: { organizationId: string; teamId: string; userId: string }) =>
  removeTeamMember({ teamId: input.teamId, userId: input.userId });
const upsertTeamProjectAccessMutationFn = (input: {
  body: TeamProjectAccessUpsertDto;
  organizationId: string;
  teamId: string;
}) => upsertTeamProjectAccess({ teamId: input.teamId, teamProjectAccessUpsertDto: input.body });
const removeTeamProjectAccessMutationFn = (input: { organizationId: string; projectId: string; teamId: string }) =>
  removeTeamProjectAccess({ projectId: input.projectId, teamId: input.teamId });

type UseCreateTeamMutationParams = {
  mutationConfig?: MutationConfig<typeof createTeamMutationFn>;
};

export function useCreateTeamMutation(params: UseCreateTeamMutationParams = {}) {
  return useMutation({
    mutationFn: createTeamMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Team list lives under an organization query, while audit log records who changed workspace access.
      queryClient.invalidateQueries({ queryKey: teamsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: organizationsKeys.auditLogsRoot(data.organizationId) });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseUpdateTeamMutationParams = {
  mutationConfig?: MutationConfig<typeof updateTeamMutationFn>;
};

export function useUpdateTeamMutation(params: UseUpdateTeamMutationParams = {}) {
  return useMutation({
    mutationFn: updateTeamMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: teamsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: organizationsKeys.auditLogsRoot(data.organizationId) });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseArchiveTeamMutationParams = {
  mutationConfig?: MutationConfig<typeof archiveTeamMutationFn>;
};

export function useArchiveTeamMutation(params: UseArchiveTeamMutationParams = {}) {
  return useMutation({
    mutationFn: archiveTeamMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: teamsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: organizationsKeys.auditLogsRoot(variables.organizationId) });
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseAddTeamMemberMutationParams = {
  mutationConfig?: MutationConfig<typeof addTeamMemberMutationFn>;
};

export function useAddTeamMemberMutation(params: UseAddTeamMemberMutationParams = {}) {
  return useMutation({
    mutationFn: addTeamMemberMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: teamsKeys.membersRoot(variables.teamId) });
      queryClient.invalidateQueries({ queryKey: teamsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: organizationsKeys.auditLogsRoot(variables.organizationId) });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseRemoveTeamMemberMutationParams = {
  mutationConfig?: MutationConfig<typeof removeTeamMemberMutationFn>;
};

export function useRemoveTeamMemberMutation(params: UseRemoveTeamMemberMutationParams = {}) {
  return useMutation({
    mutationFn: removeTeamMemberMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: teamsKeys.membersRoot(variables.teamId) });
      queryClient.invalidateQueries({ queryKey: teamsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: organizationsKeys.auditLogsRoot(variables.organizationId) });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseUpsertTeamProjectAccessMutationParams = {
  mutationConfig?: MutationConfig<typeof upsertTeamProjectAccessMutationFn>;
};

export function useUpsertTeamProjectAccessMutation(params: UseUpsertTeamProjectAccessMutationParams = {}) {
  return useMutation({
    mutationFn: upsertTeamProjectAccessMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Project access through a team changes effective roles, so project lists and active access panels both refresh.
      queryClient.invalidateQueries({ queryKey: teamsKeys.projectAccessesRoot(variables.teamId) });
      queryClient.invalidateQueries({ queryKey: teamsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: organizationsKeys.auditLogsRoot(variables.organizationId) });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseRemoveTeamProjectAccessMutationParams = {
  mutationConfig?: MutationConfig<typeof removeTeamProjectAccessMutationFn>;
};

export function useRemoveTeamProjectAccessMutation(params: UseRemoveTeamProjectAccessMutationParams = {}) {
  return useMutation({
    mutationFn: removeTeamProjectAccessMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: teamsKeys.projectAccessesRoot(variables.teamId) });
      queryClient.invalidateQueries({ queryKey: teamsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: organizationsKeys.auditLogsRoot(variables.organizationId) });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
