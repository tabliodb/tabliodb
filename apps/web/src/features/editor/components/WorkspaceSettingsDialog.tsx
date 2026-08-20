import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { OrganizationRole, ProjectRole, type OrganizationRoleValue, type ProjectRoleValue } from '@tabliodb/shared';
import {
  DefaultProjectRole as SdkDefaultProjectRole,
  Role as SdkOrganizationMemberRole,
  Role3 as SdkTeamProjectRole,
  type AuditLogDtoOutput,
  type OrganizationDtoOutput,
  type OrganizationMemberDtoOutput,
  type OrganizationSettingsDtoOutput,
  type ProjectResponseDtoOutput,
  type TeamMemberDtoOutput,
  type TeamProjectAccessDtoOutput,
  type TeamResponseDtoOutput,
} from '@tabliodb/sdk';
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FieldError,
  IconButton,
  Select,
  WithTooltip,
  cn,
} from '@tabliodb/ui';
import { Archive, Building2, Loader2, Plus, Save, ShieldCheck, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ControlledCheckbox, ControlledInput, ControlledSelect } from '@/features/app/FormControls';
import { getErrorMessage } from '@/features/app/RouteStates';
import {
  organizationsQueries,
  useRemoveOrganizationMemberMutation,
  useUpdateOrganizationMemberMutation,
  useUpdateOrganizationSettingsMutation,
} from '@/resources/organizations';
import { projectsQueries } from '@/resources/projects';
import {
  teamsQueries,
  useAddTeamMemberMutation,
  useArchiveTeamMutation,
  useCreateTeamMutation,
  useRemoveTeamMemberMutation,
  useRemoveTeamProjectAccessMutation,
  useUpdateTeamMutation,
  useUpsertTeamProjectAccessMutation,
} from '@/resources/teams';
import { selectClassName } from '../editor-form-styles';
import { UserAvatar } from './UserAvatar';

type AuditLogDto = AuditLogDtoOutput;
type OrganizationDto = OrganizationDtoOutput;
type OrganizationMemberDto = OrganizationMemberDtoOutput;
type OrganizationSettingsDto = OrganizationSettingsDtoOutput;
type ProjectResponseDto = ProjectResponseDtoOutput;
type TeamMemberDto = TeamMemberDtoOutput;
type TeamProjectAccessDto = TeamProjectAccessDtoOutput;
type TeamProjectRole = `${SdkTeamProjectRole}`;
type TeamResponseDto = TeamResponseDtoOutput;
type WorkspaceDefaultProjectRole = ProjectRole.Editor | ProjectRole.Commenter | ProjectRole.Viewer;

const sdkDefaultProjectRoleByValue: Record<WorkspaceDefaultProjectRole, SdkDefaultProjectRole> = {
  [ProjectRole.Commenter]: SdkDefaultProjectRole.Commenter,
  [ProjectRole.Editor]: SdkDefaultProjectRole.Editor,
  [ProjectRole.Viewer]: SdkDefaultProjectRole.Viewer,
};

const sdkOrganizationMemberRoleByValue: Record<OrganizationRoleValue, SdkOrganizationMemberRole> = {
  [OrganizationRole.Admin]: SdkOrganizationMemberRole.Admin,
  [OrganizationRole.Guest]: SdkOrganizationMemberRole.Guest,
  [OrganizationRole.Member]: SdkOrganizationMemberRole.Member,
  [OrganizationRole.Owner]: SdkOrganizationMemberRole.Owner,
};

const sdkTeamProjectRoleByValue: Record<TeamProjectRole, SdkTeamProjectRole> = {
  commenter: SdkTeamProjectRole.Commenter,
  editor: SdkTeamProjectRole.Editor,
  viewer: SdkTeamProjectRole.Viewer,
};

function toOrganizationRoleValue(role: OrganizationRoleValue | SdkOrganizationMemberRole): OrganizationRoleValue {
  return role as OrganizationRoleValue;
}

function toWorkspaceDefaultProjectRole(role: SdkDefaultProjectRole): WorkspaceDefaultProjectRole {
  return role as unknown as WorkspaceDefaultProjectRole;
}

const workspaceDefaultRoleOptions = ['none', ProjectRole.Editor, ProjectRole.Commenter, ProjectRole.Viewer] as const;

const workspaceSettingsFormSchema = z.object({
  allowMemberProjectCreate: z.boolean(),
  defaultProjectRole: z.enum(workspaceDefaultRoleOptions),
  name: z.string().trim().min(1, 'Workspace name is required.').max(80, 'Keep the workspace name under 80 characters.'),
});

type WorkspaceSettingsFormState = z.infer<typeof workspaceSettingsFormSchema>;

const teamFormSchema = z.object({
  description: z.string().trim().max(240, 'Keep the description under 240 characters.').optional(),
  name: z.string().trim().min(1, 'Team name is required.').max(80, 'Keep the team name under 80 characters.'),
});

type TeamFormState = z.infer<typeof teamFormSchema>;

const teamFormDefaults: TeamFormState = {
  description: '',
  name: '',
};

const teamMemberFormSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
});

type TeamMemberFormState = z.infer<typeof teamMemberFormSchema>;

const teamMemberFormDefaults: TeamMemberFormState = {
  email: '',
};

const teamProjectAccessRoleOptions = [ProjectRole.Editor, ProjectRole.Commenter, ProjectRole.Viewer] as const;

const teamProjectAccessFormSchema = z.object({
  projectId: z.string().min(1, 'Select a project.'),
  role: z.enum(teamProjectAccessRoleOptions),
});

type TeamProjectAccessFormState = z.infer<typeof teamProjectAccessFormSchema>;

const teamProjectAccessFormDefaults: TeamProjectAccessFormState = {
  projectId: '',
  role: ProjectRole.Viewer,
};

const organizationRoleOptions = [
  OrganizationRole.Owner,
  OrganizationRole.Admin,
  OrganizationRole.Member,
  OrganizationRole.Guest,
] as const;

const teamPageQuery = { limit: 50 } as const;
const teamMemberPageQuery = { limit: 50 } as const;
const teamProjectAccessPageQuery = { limit: 50 } as const;
const workspaceMemberPageQuery = { limit: 50 } as const;
const workspaceAuditLogQuery = { limit: 8 } as const;

function isOrganizationManager(organization: OrganizationDto): boolean {
  return organization.role === 'owner' || organization.role === 'admin';
}

export function WorkspaceSettingsDialog({
  organization,
}: {
  organization: OrganizationDto;
}) {
  const [open, setOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const canManageWorkspace = isOrganizationManager(organization);
  const form = useForm<WorkspaceSettingsFormState>({
    defaultValues: getWorkspaceSettingsDefaults(organization),
    mode: 'onBlur',
    resolver: zodResolver(workspaceSettingsFormSchema),
  });
  const teamForm = useForm<TeamFormState>({
    defaultValues: teamFormDefaults,
    mode: 'onBlur',
    resolver: zodResolver(teamFormSchema),
  });
  const selectedTeamForm = useForm<TeamFormState>({
    defaultValues: teamFormDefaults,
    mode: 'onBlur',
    resolver: zodResolver(teamFormSchema),
  });
  const teamMemberForm = useForm<TeamMemberFormState>({
    defaultValues: teamMemberFormDefaults,
    mode: 'onBlur',
    resolver: zodResolver(teamMemberFormSchema),
  });
  const teamProjectAccessForm = useForm<TeamProjectAccessFormState>({
    defaultValues: teamProjectAccessFormDefaults,
    mode: 'onBlur',
    resolver: zodResolver(teamProjectAccessFormSchema),
  });
  const { errors } = form.formState;
  const { errors: teamErrors } = teamForm.formState;
  const { errors: selectedTeamErrors } = selectedTeamForm.formState;
  const { errors: teamMemberErrors } = teamMemberForm.formState;
  const { errors: teamProjectAccessErrors } = teamProjectAccessForm.formState;
  const settingsQueryOptions = organizationsQueries.settings(organization.id);
  const settingsQuery = useQuery({
    ...settingsQueryOptions,
    // Workspace settings tidak perlu di-fetch sebelum user membuka dialog, jadi modal menjadi fetch boundary.
    enabled: open && settingsQueryOptions.enabled !== false,
  });
  const auditLogsQueryOptions = organizationsQueries.auditLogs(organization.id, workspaceAuditLogQuery);
  const auditLogsQuery = useQuery({
    ...auditLogsQueryOptions,
    enabled: open && canManageWorkspace && auditLogsQueryOptions.enabled !== false,
  });
  const membersQueryOptions = organizationsQueries.members(organization.id, workspaceMemberPageQuery);
  const membersQuery = useQuery({
    ...membersQueryOptions,
    // Workspace members are admin-only data, so the dialog becomes the fetch boundary just like audit logs.
    enabled: open && canManageWorkspace && membersQueryOptions.enabled !== false,
  });
  const teamsQueryOptions = teamsQueries.list({ ...teamPageQuery, organizationId: organization.id });
  const teamsQuery = useQuery({
    ...teamsQueryOptions,
    // Teams are workspace-admin data and are only needed in the settings dialog.
    enabled: open && canManageWorkspace && teamsQueryOptions.enabled !== false,
  });
  const selectedTeamMembersQueryOptions = teamsQueries.members(selectedTeamId ?? '', teamMemberPageQuery);
  const selectedTeamMembersQuery = useQuery({
    ...selectedTeamMembersQueryOptions,
    enabled: open && canManageWorkspace && Boolean(selectedTeamId) && selectedTeamMembersQueryOptions.enabled !== false,
  });
  const selectedTeamProjectAccessesQueryOptions = teamsQueries.projectAccesses(
    selectedTeamId ?? '',
    teamProjectAccessPageQuery,
  );
  const selectedTeamProjectAccessesQuery = useQuery({
    ...selectedTeamProjectAccessesQueryOptions,
    enabled:
      open &&
      canManageWorkspace &&
      Boolean(selectedTeamId) &&
      selectedTeamProjectAccessesQueryOptions.enabled !== false,
  });
  const teamProjectOptionsQuery = useQuery({
    ...projectsQueries.list({ limit: 50, organizationId: organization.id }),
    // Project options are used only when granting a team access to a project.
    enabled: open && canManageWorkspace,
  });
  const auditLogs = auditLogsQuery.data?.items ?? [];
  const workspaceMembers = membersQuery.data?.items ?? [];
  const teams = teamsQuery.data?.items ?? [];
  const selectedTeam = selectedTeamId ? (teams.find((team) => team.id === selectedTeamId) ?? null) : null;
  const selectedTeamMembers = selectedTeamMembersQuery.data?.items ?? [];
  const selectedTeamProjectAccesses = selectedTeamProjectAccessesQuery.data?.items ?? [];
  const teamProjectOptions = teamProjectOptionsQuery.data?.items ?? [];
  const teamProjectSelectOptions = teamProjectOptions.map((projectOption) => ({
    disabled: selectedTeamProjectAccesses.some((access) => access.projectId === projectOption.id),
    label: projectOption.name,
    value: projectOption.id,
  }));
  const updateSettingsMutation = useUpdateOrganizationSettingsMutation({
    mutationConfig: {
      onSuccess: (settings) => {
        // Response server menjadi source of truth karena slug bisa berubah mengikuti nama workspace.
        form.reset(getWorkspaceSettingsDefaults(organization, settings));
      },
    },
  });
  const updateMemberMutation = useUpdateOrganizationMemberMutation();
  const removeMemberMutation = useRemoveOrganizationMemberMutation();
  const isWorkspaceMemberMutationPending = updateMemberMutation.isPending || removeMemberMutation.isPending;
  const createTeamMutation = useCreateTeamMutation({
    mutationConfig: {
      onSuccess: (team) => {
        teamForm.reset(teamFormDefaults);
        setSelectedTeamId(team.id);
      },
    },
  });
  const updateTeamMutation = useUpdateTeamMutation({
    mutationConfig: {
      onSuccess: (team) => {
        // The editable detail form follows the saved response so stale local edits do not linger after submit.
        selectedTeamForm.reset({ description: team.description ?? '', name: team.name });
      },
    },
  });
  const archiveTeamMutation = useArchiveTeamMutation({
    mutationConfig: {
      onSuccess: () => {
        setSelectedTeamId(null);
        selectedTeamForm.reset(teamFormDefaults);
      },
    },
  });
  const addTeamMemberMutation = useAddTeamMemberMutation({
    mutationConfig: {
      onSuccess: () => {
        teamMemberForm.reset(teamMemberFormDefaults);
      },
    },
  });
  const removeTeamMemberMutation = useRemoveTeamMemberMutation();
  const upsertTeamProjectAccessMutation = useUpsertTeamProjectAccessMutation({
    mutationConfig: {
      onSuccess: () => {
        teamProjectAccessForm.reset(teamProjectAccessFormDefaults);
      },
    },
  });
  const removeTeamProjectAccessMutation = useRemoveTeamProjectAccessMutation();
  const isTeamMutationPending =
    createTeamMutation.isPending ||
    updateTeamMutation.isPending ||
    archiveTeamMutation.isPending ||
    addTeamMemberMutation.isPending ||
    removeTeamMemberMutation.isPending ||
    upsertTeamProjectAccessMutation.isPending ||
    removeTeamProjectAccessMutation.isPending;

  useEffect(() => {
    if (open) {
      form.reset(getWorkspaceSettingsDefaults(organization, settingsQuery.data));
      updateSettingsMutation.reset();
      updateMemberMutation.reset();
      removeMemberMutation.reset();
      createTeamMutation.reset();
      updateTeamMutation.reset();
      archiveTeamMutation.reset();
      addTeamMemberMutation.reset();
      removeTeamMemberMutation.reset();
      upsertTeamProjectAccessMutation.reset();
      removeTeamProjectAccessMutation.reset();
    }
  }, [form, open, organization, settingsQuery.data]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!selectedTeam) {
      selectedTeamForm.reset(teamFormDefaults);
      return;
    }

    // Selection drives the detail form, so switching teams always shows the currently saved team metadata.
    selectedTeamForm.reset({ description: selectedTeam.description ?? '', name: selectedTeam.name });
  }, [open, selectedTeam?.description, selectedTeam?.id, selectedTeam?.name, selectedTeamForm]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && (updateSettingsMutation.isPending || isWorkspaceMemberMutationPending || isTeamMutationPending)) {
      return;
    }

    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset(getWorkspaceSettingsDefaults(organization, settingsQuery.data));
      updateSettingsMutation.reset();
      updateMemberMutation.reset();
      removeMemberMutation.reset();
      createTeamMutation.reset();
      updateTeamMutation.reset();
      archiveTeamMutation.reset();
      addTeamMemberMutation.reset();
      removeTeamMemberMutation.reset();
      upsertTeamProjectAccessMutation.reset();
      removeTeamProjectAccessMutation.reset();
      setSelectedTeamId(null);
      teamForm.reset(teamFormDefaults);
      selectedTeamForm.reset(teamFormDefaults);
      teamMemberForm.reset(teamMemberFormDefaults);
      teamProjectAccessForm.reset(teamProjectAccessFormDefaults);
    }
  }

  function handleSubmit(values: WorkspaceSettingsFormState) {
    if (!canManageWorkspace) {
      return;
    }

    updateSettingsMutation.mutate({
      body: {
        allowMemberProjectCreate: values.allowMemberProjectCreate,
        defaultProjectRole:
          values.defaultProjectRole === 'none' ? null : sdkDefaultProjectRoleByValue[values.defaultProjectRole],
        name: values.name,
      },
      organizationId: organization.id,
    });
  }

  function handleUpdateWorkspaceMemberRole(member: OrganizationMemberDto, role: OrganizationRoleValue) {
    if (member.role === role) {
      return;
    }

    updateMemberMutation.mutate({
      body: { role: sdkOrganizationMemberRoleByValue[role] },
      organizationId: organization.id,
      userId: member.userId,
    });
  }

  function handleRemoveWorkspaceMember(member: OrganizationMemberDto) {
    removeMemberMutation.mutate({
      organizationId: organization.id,
      userId: member.userId,
    });
  }

  function handleCreateTeam(values: TeamFormState) {
    if (!canManageWorkspace) {
      return;
    }

    createTeamMutation.mutate({
      description: toOptionalDescription(values.description),
      name: values.name,
      organizationId: organization.id,
    });
  }

  function handleArchiveTeam(team: TeamResponseDto) {
    archiveTeamMutation.mutate({
      organizationId: organization.id,
      teamId: team.id,
    });
  }

  function handleUpdateTeam(values: TeamFormState) {
    if (!selectedTeam) {
      return;
    }

    updateTeamMutation.mutate({
      body: {
        description: toOptionalDescription(values.description) ?? null,
        name: values.name,
      },
      teamId: selectedTeam.id,
    });
  }

  function handleAddTeamMember(values: TeamMemberFormState) {
    if (!selectedTeam) {
      return;
    }

    addTeamMemberMutation.mutate({
      body: {
        email: values.email,
      },
      organizationId: organization.id,
      teamId: selectedTeam.id,
    });
  }

  function handleRemoveTeamMember(member: TeamMemberDto) {
    if (!selectedTeam) {
      return;
    }

    removeTeamMemberMutation.mutate({
      organizationId: organization.id,
      teamId: selectedTeam.id,
      userId: member.userId,
    });
  }

  function handleUpsertTeamProjectAccess(values: TeamProjectAccessFormState) {
    if (!selectedTeam) {
      return;
    }

    upsertTeamProjectAccessMutation.mutate({
      body: {
        projectId: values.projectId,
        role: sdkTeamProjectRoleByValue[values.role as TeamProjectRole],
      },
      organizationId: organization.id,
      teamId: selectedTeam.id,
    });
  }

  function handleRemoveTeamProjectAccess(access: TeamProjectAccessDto) {
    if (!selectedTeam) {
      return;
    }

    removeTeamProjectAccessMutation.mutate({
      organizationId: organization.id,
      projectId: access.projectId,
      teamId: selectedTeam.id,
    });
  }

  function handleUpdateTeamProjectAccessRole(access: TeamProjectAccessDto, role: TeamProjectRole) {
    if (!selectedTeam || access.role === role) {
      return;
    }

    upsertTeamProjectAccessMutation.mutate({
      body: {
        projectId: access.projectId,
        role: sdkTeamProjectRoleByValue[role],
      },
      organizationId: organization.id,
      teamId: selectedTeam.id,
    });
  }

  const memberMutationError = updateMemberMutation.error ?? removeMemberMutation.error;
  const teamMutationError =
    createTeamMutation.error ??
    updateTeamMutation.error ??
    archiveTeamMutation.error ??
    addTeamMemberMutation.error ??
    removeTeamMemberMutation.error ??
    upsertTeamProjectAccessMutation.error ??
    removeTeamProjectAccessMutation.error;
  const updatingUserId = updateMemberMutation.isPending ? updateMemberMutation.variables?.userId : null;
  const removingUserId = removeMemberMutation.isPending ? removeMemberMutation.variables?.userId : null;
  const removingTeamMemberUserId = removeTeamMemberMutation.isPending
    ? removeTeamMemberMutation.variables?.userId
    : null;
  const removingTeamProjectId = removeTeamProjectAccessMutation.isPending
    ? removeTeamProjectAccessMutation.variables?.projectId
    : null;

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <IconButton icon={Building2} label="Workspace settings" variant="ghost" />
      </DialogTrigger>
      <DialogContent className="w-[min(96vw,920px)]">
        <DialogHeader>
          <DialogTitle>Workspace settings</DialogTitle>
          <DialogDescription>Configure the current workspace without changing the Tabliodb brand.</DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-5">
          <form className="grid gap-4" id="workspace-settings-form" onSubmit={form.handleSubmit(handleSubmit)}>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Workspace name
              </span>
              <ControlledInput
                aria-invalid={Boolean(errors.name)}
                control={form.control}
                disabled={settingsQuery.isPending || updateSettingsMutation.isPending || !canManageWorkspace}
                name="name"
              />
              <FieldError>{errors.name?.message}</FieldError>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Default project role
                </span>
                <ControlledSelect
                  className={selectClassName}
                  control={form.control}
                  disabled={settingsQuery.isPending || updateSettingsMutation.isPending || !canManageWorkspace}
                  name="defaultProjectRole"
                  options={workspaceDefaultRoleOptions.map((role) => ({
                    label: role === 'none' ? 'No automatic project role' : formatProjectRole(role),
                    value: role,
                  }))}
                />
              </label>

              <label className="mt-6 flex min-h-11 cursor-pointer items-center gap-3 rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold transition hover:bg-[rgb(var(--tabliodb-surface))]">
                <ControlledCheckbox
                  control={form.control}
                  disabled={settingsQuery.isPending || updateSettingsMutation.isPending || !canManageWorkspace}
                  name="allowMemberProjectCreate"
                />
                Members can create projects
              </label>
            </div>

            {settingsQuery.error || updateSettingsMutation.error ? (
              <div className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                {getErrorMessage(settingsQuery.error ?? updateSettingsMutation.error)}
              </div>
            ) : null}
          </form>

          {canManageWorkspace ? (
            <section className="border-t-2 border-[rgb(var(--tabliodb-border))] pt-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-extrabold">
                    <UsersRound className="size-4 text-[rgb(var(--tabliodb-sky-text))]" />
                    Workspace members
                  </h3>
                  <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                    {membersQuery.data?.totalCount ?? workspaceMembers.length} people with workspace access
                  </p>
                </div>
                <Badge variant="green">{workspaceMembers.length} loaded</Badge>
              </div>

              {membersQuery.isPending ? (
                <div className="mt-4 flex items-center gap-2 rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white p-4 text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                  <Loader2 className="size-4 animate-spin" />
                  Loading members
                </div>
              ) : membersQuery.error ? (
                <div className="mt-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                  {getErrorMessage(membersQuery.error)}
                </div>
              ) : workspaceMembers.length === 0 ? (
                <div className="mt-4 rounded-2xl border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-4 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                  No workspace members yet
                </div>
              ) : (
                <div className="tabliodb-scrollbar mt-4 max-h-72 overflow-y-auto rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white">
                  <div className="divide-y divide-[rgb(var(--tabliodb-border))]">
                    {workspaceMembers.map((member) => (
                      <OrganizationMemberRow
                        isRemoving={removingUserId === member.userId}
                        isUpdating={updatingUserId === member.userId}
                        key={member.userId}
                        member={member}
                        onRemove={handleRemoveWorkspaceMember}
                        onRoleChange={handleUpdateWorkspaceMemberRole}
                      />
                    ))}
                  </div>
                </div>
              )}

              {memberMutationError ? (
                <div className="mt-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                  {getErrorMessage(memberMutationError)}
                </div>
              ) : null}
            </section>
          ) : (
            <section className="border-t-2 border-[rgb(var(--tabliodb-border))] pt-5">
              <div className="rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white p-4 text-sm font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                Your workspace role is {formatOrganizationRole(organization.role)}. Owner or Admin access is required to
                manage workspace settings and members.
              </div>
            </section>
          )}

          {canManageWorkspace ? (
            <section className="border-t-2 border-[rgb(var(--tabliodb-border))] pt-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-extrabold">
                    <UsersRound className="size-4 text-[rgb(var(--tabliodb-primary-text))]" />
                    Teams
                  </h3>
                  <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                    Manage reusable groups before granting project access.
                  </p>
                </div>
                <Badge variant="green">{teamsQuery.data?.totalCount ?? teams.length} teams</Badge>
              </div>

              <form
                className="mt-4 grid gap-3 rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface))] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                onSubmit={teamForm.handleSubmit(handleCreateTeam)}
              >
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                    Team name
                  </span>
                  <ControlledInput
                    aria-invalid={Boolean(teamErrors.name)}
                    control={teamForm.control}
                    disabled={isTeamMutationPending}
                    name="name"
                    placeholder="Backend team"
                  />
                  <FieldError>{teamErrors.name?.message}</FieldError>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                    Description
                  </span>
                  <ControlledInput
                    aria-invalid={Boolean(teamErrors.description)}
                    control={teamForm.control}
                    disabled={isTeamMutationPending}
                    name="description"
                    placeholder="Optional team context"
                  />
                  <FieldError>{teamErrors.description?.message}</FieldError>
                </label>
                <Button className="self-start sm:mt-6" disabled={isTeamMutationPending} type="submit">
                  {createTeamMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Team
                </Button>
              </form>

              {teamsQuery.isPending ? (
                <div className="mt-4 flex items-center gap-2 rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white p-4 text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                  <Loader2 className="size-4 animate-spin" />
                  Loading teams
                </div>
              ) : teamsQuery.error ? (
                <div className="mt-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                  {getErrorMessage(teamsQuery.error)}
                </div>
              ) : (
                <div className="mt-4 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="tabliodb-scrollbar max-h-128 overflow-y-auto rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white p-2">
                    {teams.length === 0 ? (
                      <div className="grid min-h-28 place-items-center rounded-[14px] border-2 border-dashed border-[rgb(var(--tabliodb-border))] px-4 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                        No teams yet
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        {teams.map((team) => (
                          <TeamListItem
                            isSelected={team.id === selectedTeamId}
                            key={team.id}
                            onSelect={(nextTeam) => setSelectedTeamId(nextTeam.id)}
                            team={team}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white">
                    {selectedTeam ? (
                      <div className="grid gap-4 p-4">
                        <div className="flex flex-col gap-3 border-b-2 border-[rgb(var(--tabliodb-border))] pb-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h4 className="truncate text-sm font-extrabold">{selectedTeam.name}</h4>
                            <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                              {selectedTeam.memberCount} members / {selectedTeam.projectAccessCount} project grants
                            </p>
                          </div>
                          <WithTooltip content={`Archive ${selectedTeam.name}`}>
                            <Button
                              aria-label={`Archive ${selectedTeam.name}`}
                              disabled={isTeamMutationPending}
                              onClick={() => handleArchiveTeam(selectedTeam)}
                              size="sm"
                              type="button"
                              variant="secondary"
                            >
                              {archiveTeamMutation.isPending ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Archive className="size-4" />
                              )}
                              Archive
                            </Button>
                          </WithTooltip>
                        </div>

                        <form
                          className="grid gap-3 rounded-[14px] bg-[rgb(var(--tabliodb-surface))] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                          onSubmit={selectedTeamForm.handleSubmit(handleUpdateTeam)}
                        >
                          <label className="block text-sm">
                            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                              Name
                            </span>
                            <ControlledInput
                              aria-invalid={Boolean(selectedTeamErrors.name)}
                              control={selectedTeamForm.control}
                              disabled={isTeamMutationPending}
                              name="name"
                            />
                            <FieldError>{selectedTeamErrors.name?.message}</FieldError>
                          </label>
                          <label className="block text-sm">
                            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                              Description
                            </span>
                            <ControlledInput
                              aria-invalid={Boolean(selectedTeamErrors.description)}
                              control={selectedTeamForm.control}
                              disabled={isTeamMutationPending}
                              name="description"
                              placeholder="Optional team context"
                            />
                            <FieldError>{selectedTeamErrors.description?.message}</FieldError>
                          </label>
                          <Button
                            className="self-start sm:mt-6"
                            disabled={isTeamMutationPending}
                            size="sm"
                            type="submit"
                          >
                            {updateTeamMutation.isPending ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Save className="size-4" />
                            )}
                            Save
                          </Button>
                        </form>

                        <div className="grid gap-4 xl:grid-cols-2">
                          <section className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <h5 className="text-sm font-extrabold">Members</h5>
                                <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                                  People inherited by this team
                                </p>
                              </div>
                              <Badge>{selectedTeamMembers.length} loaded</Badge>
                            </div>

                            <form
                              className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
                              onSubmit={teamMemberForm.handleSubmit(handleAddTeamMember)}
                            >
                              <label className="block text-sm">
                                <span className="sr-only">Member email</span>
                                <ControlledInput
                                  aria-invalid={Boolean(teamMemberErrors.email)}
                                  autoComplete="email"
                                  control={teamMemberForm.control}
                                  disabled={isTeamMutationPending}
                                  name="email"
                                  placeholder="teammate@example.com"
                                  type="email"
                                />
                                <FieldError>{teamMemberErrors.email?.message}</FieldError>
                              </label>
                              <Button disabled={isTeamMutationPending} size="sm" type="submit">
                                {addTeamMemberMutation.isPending ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <UserPlus className="size-4" />
                                )}
                                Add
                              </Button>
                            </form>

                            {selectedTeamMembersQuery.isPending ? (
                              <div className="mt-3 flex items-center gap-2 rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] p-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                                <Loader2 className="size-4 animate-spin" />
                                Loading members
                              </div>
                            ) : selectedTeamMembers.length === 0 ? (
                              <div className="mt-3 rounded-[14px] border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-3 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                                No members in this team
                              </div>
                            ) : (
                              <div className="tabliodb-scrollbar mt-3 max-h-64 overflow-y-auto rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))]">
                                <div className="divide-y divide-[rgb(var(--tabliodb-border))]">
                                  {selectedTeamMembers.map((member) => (
                                    <TeamMemberRow
                                      isRemoving={removingTeamMemberUserId === member.userId}
                                      key={member.userId}
                                      member={member}
                                      onRemove={handleRemoveTeamMember}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </section>

                          <section className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <h5 className="text-sm font-extrabold">Project access</h5>
                                <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                                  Grants inherited by team members
                                </p>
                              </div>
                              <Badge>{selectedTeamProjectAccesses.length} loaded</Badge>
                            </div>

                            <form
                              className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_auto]"
                              onSubmit={teamProjectAccessForm.handleSubmit(handleUpsertTeamProjectAccess)}
                            >
                              <label className="block text-sm">
                                <span className="sr-only">Project</span>
                                <ControlledSelect
                                  aria-invalid={Boolean(teamProjectAccessErrors.projectId)}
                                  className={selectClassName}
                                  control={teamProjectAccessForm.control}
                                  disabled={isTeamMutationPending || teamProjectOptionsQuery.isPending}
                                  name="projectId"
                                  options={teamProjectSelectOptions}
                                  placeholder="Select project"
                                />
                                <FieldError>{teamProjectAccessErrors.projectId?.message}</FieldError>
                              </label>
                              <label className="block text-sm">
                                <span className="sr-only">Role</span>
                                <ControlledSelect
                                  aria-invalid={Boolean(teamProjectAccessErrors.role)}
                                  className={selectClassName}
                                  control={teamProjectAccessForm.control}
                                  disabled={isTeamMutationPending}
                                  name="role"
                                  options={teamProjectAccessRoleOptions.map((role) => ({
                                    label: formatProjectRole(role),
                                    value: role,
                                  }))}
                                />
                              </label>
                              <Button disabled={isTeamMutationPending} size="sm" type="submit">
                                {upsertTeamProjectAccessMutation.isPending ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <ShieldCheck className="size-4" />
                                )}
                                Grant
                              </Button>
                            </form>

                            {selectedTeamProjectAccessesQuery.isPending ? (
                              <div className="mt-3 flex items-center gap-2 rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] p-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                                <Loader2 className="size-4 animate-spin" />
                                Loading project access
                              </div>
                            ) : selectedTeamProjectAccesses.length === 0 ? (
                              <div className="mt-3 rounded-[14px] border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-3 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                                No project grants yet
                              </div>
                            ) : (
                              <div className="tabliodb-scrollbar mt-3 max-h-64 overflow-y-auto rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))]">
                                <div className="divide-y divide-[rgb(var(--tabliodb-border))]">
                                  {selectedTeamProjectAccesses.map((access) => (
                                    <TeamProjectAccessRow
                                      access={access}
                                      isRemoving={removingTeamProjectId === access.projectId}
                                      key={access.projectId}
                                      onRemove={handleRemoveTeamProjectAccess}
                                      onRoleChange={handleUpdateTeamProjectAccessRole}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </section>
                        </div>
                      </div>
                    ) : (
                      <div className="grid min-h-96 place-items-center p-6 text-center">
                        <div>
                          <UsersRound className="mx-auto size-8 text-[rgb(var(--tabliodb-primary-text))]" />
                          <h4 className="mt-3 text-sm font-extrabold">Select a team</h4>
                          <p className="mt-1 max-w-sm text-sm font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                            Pick a team to manage members and project grants, or create a new one above.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {teamMutationError || selectedTeamMembersQuery.error || selectedTeamProjectAccessesQuery.error ? (
                <div className="mt-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                  {getErrorMessage(
                    teamMutationError ?? selectedTeamMembersQuery.error ?? selectedTeamProjectAccessesQuery.error,
                  )}
                </div>
              ) : null}
            </section>
          ) : null}

          {canManageWorkspace ? (
            <section className="border-t-2 border-[rgb(var(--tabliodb-border))] pt-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold">Recent activity</h3>
                  <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                    Project and workspace changes recorded by the server
                  </p>
                </div>
                <Badge variant="blue">{auditLogs.length} loaded</Badge>
              </div>

              {auditLogsQuery.isPending ? (
                <div className="mt-4 flex items-center gap-2 rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white p-4 text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                  <Loader2 className="size-4 animate-spin" />
                  Loading activity
                </div>
              ) : auditLogsQuery.error ? (
                <div className="mt-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                  {getErrorMessage(auditLogsQuery.error)}
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="mt-4 rounded-2xl border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-4 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                  No activity yet
                </div>
              ) : (
                <div className="tabliodb-scrollbar mt-4 max-h-72 overflow-y-auto rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white">
                  <div className="divide-y divide-[rgb(var(--tabliodb-border))]">
                    {auditLogs.map((auditLog) => (
                      <AuditLogRow auditLog={auditLog} key={auditLog.id} />
                    ))}
                  </div>
                </div>
              )}
            </section>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button
            disabled={updateSettingsMutation.isPending || isWorkspaceMemberMutationPending || isTeamMutationPending}
            onClick={() => handleOpenChange(false)}
            type="button"
            variant="secondary"
          >
            Close
          </Button>
          <Button
            disabled={
              settingsQuery.isPending ||
              updateSettingsMutation.isPending ||
              isWorkspaceMemberMutationPending ||
              isTeamMutationPending ||
              !canManageWorkspace
            }
            form="workspace-settings-form"
            type="submit"
          >
            {updateSettingsMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getWorkspaceSettingsDefaults(
  organization: OrganizationDto,
  settings?: OrganizationSettingsDto,
): WorkspaceSettingsFormState {
  return {
    allowMemberProjectCreate: settings?.allowMemberProjectCreate ?? true,
    defaultProjectRole: settings?.defaultProjectRole
      ? toWorkspaceDefaultProjectRole(settings.defaultProjectRole)
      : 'none',
    name: settings?.name ?? organization.name,
  };
}

function toOptionalDescription(value: string | undefined): string | undefined {
  const description = value?.trim();
  return description ? description : undefined;
}

function TeamListItem({
  isSelected,
  onSelect,
  team,
}: {
  isSelected: boolean;
  onSelect: (team: TeamResponseDto) => void;
  team: TeamResponseDto;
}) {
  return (
    <button
      className={cn(
        'grid cursor-pointer gap-2 rounded-[14px] border-2 p-3 text-left transition hover:bg-[rgb(var(--tabliodb-selected-surface))]',
        isSelected
          ? 'border-[rgb(var(--tabliodb-primary))] bg-[rgb(var(--tabliodb-selected-surface))]'
          : 'border-transparent bg-white',
      )}
      onClick={() => onSelect(team)}
      type="button"
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{team.name}</span>
        <Badge className="shrink-0" variant={isSelected ? 'green' : 'neutral'}>
          {team.memberCount} users
        </Badge>
      </div>
      <p className="line-clamp-2 min-h-8 wrap-break-word text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
        {team.description || 'No description yet'}
      </p>
      <div className="truncate text-xs font-extrabold text-[rgb(var(--tabliodb-ink-subtle))]">
        {team.projectAccessCount} project grants
      </div>
    </button>
  );
}

function AuditLogRow({ auditLog }: { auditLog: AuditLogDto }) {
  return (
    <article className="grid gap-2 p-3 transition hover:bg-[rgb(var(--tabliodb-surface))] sm:grid-cols-[minmax(0,1fr)_120px] sm:items-center">
      <div className="min-w-0">
        <div className="truncate text-sm font-extrabold">{formatAuditLogMessage(auditLog)}</div>
        <p className="mt-1 truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
          {auditLog.actorName ?? auditLog.actorEmail ?? 'System'} - {formatDateTime(auditLog.createdAt)}
        </p>
      </div>
      <Badge className="justify-self-start sm:justify-self-end" variant={getAuditLogTone(auditLog.action)}>
        {formatAuditLogAction(auditLog.action)}
      </Badge>
    </article>
  );
}

function TeamMemberRow({
  isRemoving,
  member,
  onRemove,
}: {
  isRemoving: boolean;
  member: TeamMemberDto;
  onRemove: (member: TeamMemberDto) => void;
}) {
  return (
    <article className="grid gap-3 p-3 transition hover:bg-[rgb(var(--tabliodb-surface))] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar className="size-9 rounded-xl text-[11px]" user={member} />
        <div className="min-w-0">
          <h6 className="truncate text-sm font-extrabold">{member.name}</h6>
          <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">{member.email}</p>
        </div>
      </div>
      <WithTooltip content={`Remove ${member.name} from this team`}>
        <Button
          aria-label={`Remove ${member.name} from this team`}
          disabled={isRemoving}
          onClick={() => onRemove(member)}
          size="icon"
          variant="ghost"
        >
          {isRemoving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </Button>
      </WithTooltip>
    </article>
  );
}

function TeamProjectAccessRow({
  access,
  isRemoving,
  onRemove,
  onRoleChange,
}: {
  access: TeamProjectAccessDto;
  isRemoving: boolean;
  onRemove: (access: TeamProjectAccessDto) => void;
  onRoleChange: (access: TeamProjectAccessDto, role: TeamProjectRole) => void;
}) {
  return (
    <article className="grid gap-3 p-3 transition hover:bg-[rgb(var(--tabliodb-surface))] sm:grid-cols-[minmax(0,1fr)_130px_auto] sm:items-center">
      <div className="min-w-0">
        <h6 className="truncate text-sm font-extrabold">{access.projectName}</h6>
        <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">/{access.projectSlug}</p>
      </div>
      <Select
        className={selectClassName}
        disabled={isRemoving}
        onValueChange={(role) => onRoleChange(access, role as TeamProjectRole)}
        options={teamProjectAccessRoleOptions.map((role) => ({
          label: formatProjectRole(role),
          value: role,
        }))}
        value={access.role}
      />
      <WithTooltip content={`Remove ${access.projectName} access from this team`}>
        <Button
          aria-label={`Remove ${access.projectName} access from this team`}
          disabled={isRemoving}
          onClick={() => onRemove(access)}
          size="icon"
          variant="ghost"
        >
          {isRemoving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </Button>
      </WithTooltip>
    </article>
  );
}

function OrganizationMemberRow({
  isRemoving,
  isUpdating,
  member,
  onRemove,
  onRoleChange,
}: {
  isRemoving: boolean;
  isUpdating: boolean;
  member: OrganizationMemberDto;
  onRemove: (member: OrganizationMemberDto) => void;
  onRoleChange: (member: OrganizationMemberDto, role: OrganizationRoleValue) => void;
}) {
  const isBusy = isRemoving || isUpdating;

  return (
    <article className="grid gap-3 p-3 transition hover:bg-[rgb(var(--tabliodb-surface))] sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar className="size-10 rounded-[14px] text-xs" user={member} />
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h4 className="min-w-0 max-w-full truncate text-sm font-extrabold">{member.name}</h4>
            <OrganizationRoleBadge role={member.role} />
          </div>
          <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">{member.email}</p>
        </div>
      </div>
      <Select
        className={selectClassName}
        disabled={isBusy}
        onValueChange={(role) => onRoleChange(member, toOrganizationRoleValue(role as SdkOrganizationMemberRole))}
        options={organizationRoleOptions.map((role) => ({
          label: formatOrganizationRole(role),
          value: role,
        }))}
        value={member.role}
      />
      <WithTooltip content={`Remove ${member.name} from this workspace`}>
        <Button
          aria-label={`Remove ${member.name}`}
          disabled={isBusy}
          onClick={() => onRemove(member)}
          size="icon"
          variant="ghost"
        >
          {isRemoving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </Button>
      </WithTooltip>
    </article>
  );
}

function OrganizationRoleBadge({ role }: { role: OrganizationRoleValue }) {
  if (role === OrganizationRole.Owner) {
    return <Badge variant="yellow">{formatOrganizationRole(role)}</Badge>;
  }

  if (role === OrganizationRole.Admin) {
    return <Badge variant="blue">{formatOrganizationRole(role)}</Badge>;
  }

  if (role === OrganizationRole.Member) {
    return <Badge variant="green">{formatOrganizationRole(role)}</Badge>;
  }

  return <Badge>{formatOrganizationRole(role)}</Badge>;
}

function formatProjectRole(role: ProjectRoleValue): string {
  return {
    [ProjectRole.Commenter]: 'Commenter',
    [ProjectRole.Editor]: 'Editor',
    [ProjectRole.Owner]: 'Owner',
    [ProjectRole.Viewer]: 'Viewer',
  }[role];
}

function formatOrganizationRole(role: OrganizationRoleValue): string {
  return {
    [OrganizationRole.Admin]: 'Admin',
    [OrganizationRole.Guest]: 'Guest',
    [OrganizationRole.Member]: 'Member',
    [OrganizationRole.Owner]: 'Owner',
  }[role];
}

function formatAuditLogMessage(auditLog: AuditLogDto): string {
  if (auditLog.action === 'project.created') {
    return `Created project ${readMetadataString(auditLog.metadata, 'name', 'project')}`;
  }

  if (auditLog.action === 'project.archived') {
    return `Archived project ${readMetadataString(auditLog.metadata, 'name', 'project')}`;
  }

  if (auditLog.action === 'project.member_added') {
    return `Added ${readMetadataString(auditLog.metadata, 'email', 'member')} as ${formatProjectRoleValue(
      readMetadataString(auditLog.metadata, 'role', ProjectRole.Viewer),
    )}`;
  }

  if (auditLog.action === 'project.member_removed') {
    return `Removed ${readMetadataString(auditLog.metadata, 'email', 'member')} from project access`;
  }

  if (auditLog.action === 'project.member_role_updated') {
    const role = readMetadataRecord(auditLog.metadata, 'role');
    return `Changed ${readMetadataString(auditLog.metadata, 'email', 'member')} from ${formatProjectRoleValue(
      readMetadataString(role, 'before', ProjectRole.Viewer),
    )} to ${formatProjectRoleValue(readMetadataString(role, 'after', ProjectRole.Viewer))}`;
  }

  if (auditLog.action === 'organization.member_removed') {
    return `Removed ${readMetadataString(auditLog.metadata, 'email', 'member')} from workspace access`;
  }

  if (auditLog.action === 'organization.member_role_updated') {
    const role = readMetadataRecord(auditLog.metadata, 'role');
    return `Changed ${readMetadataString(auditLog.metadata, 'email', 'member')} from ${formatOrganizationRoleValue(
      readMetadataString(role, 'before', OrganizationRole.Guest),
    )} to ${formatOrganizationRoleValue(readMetadataString(role, 'after', OrganizationRole.Guest))}`;
  }

  if (auditLog.action === 'organization.settings_updated') {
    const changes = readMetadataRecord(auditLog.metadata, 'changes');
    const changedFields = Object.keys(changes);
    return changedFields.length > 0 ? `Updated workspace ${changedFields.join(', ')}` : 'Updated workspace settings';
  }

  if (auditLog.action === 'team.created') {
    return `Created team ${readMetadataString(auditLog.metadata, 'name', 'team')}`;
  }

  if (auditLog.action === 'team.updated') {
    const changes = readMetadataRecord(auditLog.metadata, 'changes');
    const changedFields = Object.keys(changes);
    return changedFields.length > 0 ? `Updated team ${changedFields.join(', ')}` : 'Updated team details';
  }

  if (auditLog.action === 'team.archived') {
    return `Archived team ${readMetadataString(auditLog.metadata, 'name', 'team')}`;
  }

  if (auditLog.action === 'team.member_added') {
    return `Added ${readMetadataString(auditLog.metadata, 'email', 'member')} to ${readMetadataString(
      auditLog.metadata,
      'teamName',
      'team',
    )}`;
  }

  if (auditLog.action === 'team.member_removed') {
    return `Removed ${readMetadataString(auditLog.metadata, 'email', 'member')} from ${readMetadataString(
      auditLog.metadata,
      'teamName',
      'team',
    )}`;
  }

  if (auditLog.action === 'team.project_access_updated') {
    const role = auditLog.metadata.role;
    const teamName = readMetadataString(auditLog.metadata, 'teamName', 'team');
    const projectName = readMetadataString(auditLog.metadata, 'projectName', 'project');

    if (role && typeof role === 'object' && !Array.isArray(role)) {
      return `Changed ${teamName} access to ${projectName} from ${formatProjectRoleValue(
        readMetadataString(role as Record<string, unknown>, 'before', ProjectRole.Viewer),
      )} to ${formatProjectRoleValue(readMetadataString(role as Record<string, unknown>, 'after', ProjectRole.Viewer))}`;
    }

    return `Granted ${teamName} ${formatProjectRoleValue(String(role ?? ProjectRole.Viewer))} on ${projectName}`;
  }

  if (auditLog.action === 'team.project_access_removed') {
    return `Removed ${readMetadataString(auditLog.metadata, 'teamName', 'team')} access from ${readMetadataString(
      auditLog.metadata,
      'projectName',
      'project',
    )}`;
  }

  if (auditLog.action === 'comment.deleted') {
    return readMetadataBoolean(auditLog.metadata, 'deletedByAuthor') ? 'Deleted own comment' : 'Moderated a comment';
  }

  if (auditLog.action === 'comment.edited') {
    return 'Edited a comment';
  }

  if (auditLog.action === 'comment_thread.resolved') {
    return 'Resolved a comment thread';
  }

  if (auditLog.action === 'comment_thread.reopened') {
    return 'Reopened a comment thread';
  }

  if (auditLog.action === 'diagram_review.approved') {
    return 'Approved diagram review';
  }

  if (auditLog.action === 'diagram_review.changes_requested') {
    return 'Requested diagram changes';
  }

  if (auditLog.action === 'diagram_review.commented') {
    return 'Started diagram review discussion';
  }

  if (auditLog.action === 'user.disabled') {
    return `Disabled user ${readMetadataString(auditLog.metadata, 'email', 'user')}`;
  }

  if (auditLog.action === 'user.enabled') {
    return `Enabled user ${readMetadataString(auditLog.metadata, 'email', 'user')}`;
  }

  if (auditLog.action === 'user.password_reset') {
    return `Reset password for ${readMetadataString(auditLog.metadata, 'email', 'user')}`;
  }

  if (auditLog.action === 'user.sessions_revoked') {
    return `Revoked sessions for ${readMetadataString(auditLog.metadata, 'email', 'user')}`;
  }

  return auditLog.action;
}

function formatAuditLogAction(action: string): string {
  return (
    {
      'organization.settings_updated': 'Workspace',
      'organization.member_removed': 'Removed',
      'organization.member_role_updated': 'Role',
      'team.archived': 'Team',
      'team.created': 'Team',
      'team.member_added': 'Team user',
      'team.member_removed': 'Removed',
      'team.project_access_removed': 'Access',
      'team.project_access_updated': 'Access',
      'team.updated': 'Team',
      'comment.deleted': 'Comment',
      'comment.edited': 'Comment',
      'comment_thread.reopened': 'Reopened',
      'comment_thread.resolved': 'Resolved',
      'diagram_review.approved': 'Approved',
      'diagram_review.changes_requested': 'Changes',
      'diagram_review.commented': 'Review',
      'project.archived': 'Archived',
      'project.created': 'Created',
      'project.member_added': 'Member',
      'project.member_removed': 'Removed',
      'project.member_role_updated': 'Role',
      'user.disabled': 'Disabled',
      'user.enabled': 'Enabled',
      'user.password_reset': 'Password',
      'user.sessions_revoked': 'Sessions',
    }[action] ?? 'Audit'
  );
}

function getAuditLogTone(action: string): 'blue' | 'green' | 'neutral' | 'yellow' {
  if (
    action === 'comment_thread.resolved' ||
    action === 'diagram_review.approved' ||
    action === 'project.created' ||
    action === 'project.member_added' ||
    action === 'team.created' ||
    action === 'team.member_added' ||
    action === 'team.project_access_updated' ||
    action === 'user.enabled'
  ) {
    return 'green';
  }

  if (
    action === 'organization.member_removed' ||
    action === 'comment.deleted' ||
    action === 'diagram_review.changes_requested' ||
    action === 'project.archived' ||
    action === 'project.member_removed' ||
    action === 'team.archived' ||
    action === 'team.member_removed' ||
    action === 'team.project_access_removed' ||
    action === 'user.disabled'
  ) {
    return 'yellow';
  }

  if (
    action === 'organization.member_role_updated' ||
    action === 'organization.settings_updated' ||
    action === 'comment.edited' ||
    action === 'comment_thread.reopened' ||
    action === 'diagram_review.commented' ||
    action === 'project.member_role_updated' ||
    action === 'team.updated' ||
    action === 'user.password_reset' ||
    action === 'user.sessions_revoked'
  ) {
    return 'blue';
  }

  return 'neutral';
}

function readMetadataRecord(metadata: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = metadata[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readMetadataString(metadata: Record<string, unknown>, key: string, fallback: string): string {
  const value = metadata[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function readMetadataBoolean(metadata: Record<string, unknown>, key: string): boolean {
  return metadata[key] === true;
}

function formatProjectRoleValue(role: string): string {
  if (Object.values(ProjectRole).includes(role as ProjectRole)) {
    return formatProjectRole(role as ProjectRoleValue);
  }

  return role;
}

function formatOrganizationRoleValue(role: string): string {
  if (Object.values(OrganizationRole).includes(role as OrganizationRole)) {
    return formatOrganizationRole(role as OrganizationRoleValue);
  }

  return role;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}
