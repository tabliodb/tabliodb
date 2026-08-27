import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { OrganizationRole, ProjectRole, type OrganizationRoleValue, type ProjectRoleValue } from '@tabliodb/shared';
import {
  DefaultProjectRole as SdkDefaultProjectRole,
  OrganizationRole as SdkInvitationOrganizationRole,
  Role5 as SdkOrganizationMemberRole,
  Role6 as SdkOrganizationAssignableMemberRole,
  Role8 as SdkTeamProjectRole,
  type AuditLogDtoOutput,
  type InvitationCreateResponseDtoOutput,
  type OrganizationDtoOutput,
  type OrganizationMemberDtoOutput,
  type OrganizationSettingsDtoOutput,
  type ProjectResponseDtoOutput,
  type TeamDiagramAccessDtoOutput,
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
  Input,
  Select,
  WithTooltip,
  cn,
} from '@tabliodb/ui';
import {
  Archive,
  Building2,
  Copy,
  Loader2,
  MailPlus,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ControlledCheckbox, ControlledInput, ControlledSelect } from '@/features/app/FormControls';
import { getErrorMessage } from '@/features/app/RouteStates';
import { diagramsQueries } from '@/resources/diagrams';
import { useCreateInvitationMutation } from '@/resources/invitations';
import {
  organizationsQueries,
  useAddOrganizationMemberMutation,
  useRemoveOrganizationMemberMutation,
  useTransferOrganizationOwnershipMutation,
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
  useRemoveTeamDiagramAccessMutation,
  useRemoveTeamProjectAccessMutation,
  useUpdateTeamMutation,
  useUpsertTeamDiagramAccessMutation,
  useUpsertTeamProjectAccessMutation,
} from '@/resources/teams';
import { selectClassName } from '../editor-form-styles';
import { UserAvatar } from './UserAvatar';

type AuditLogDto = AuditLogDtoOutput;
type InvitationCreateResponseDto = InvitationCreateResponseDtoOutput;
type OrganizationDto = OrganizationDtoOutput;
type OrganizationMemberDto = OrganizationMemberDtoOutput;
type OrganizationSettingsDto = OrganizationSettingsDtoOutput;
type ProjectResponseDto = ProjectResponseDtoOutput;
type TeamDiagramAccessDto = TeamDiagramAccessDtoOutput;
type TeamMemberDto = TeamMemberDtoOutput;
type TeamProjectAccessDto = TeamProjectAccessDtoOutput;
type TeamProjectRole = `${SdkTeamProjectRole}`;
type TeamResponseDto = TeamResponseDtoOutput;
type WorkspaceMemberCreateRole = OrganizationRole.Admin | OrganizationRole.Member | OrganizationRole.Guest;
type WorkspaceDefaultProjectRole = ProjectRole.Editor | ProjectRole.Commenter | ProjectRole.Viewer;

const sdkDefaultProjectRoleByValue: Record<WorkspaceDefaultProjectRole, SdkDefaultProjectRole> = {
  [ProjectRole.Commenter]: SdkDefaultProjectRole.Commenter,
  [ProjectRole.Editor]: SdkDefaultProjectRole.Editor,
  [ProjectRole.Viewer]: SdkDefaultProjectRole.Viewer,
};

const sdkOrganizationMemberCreateRoleByValue: Record<WorkspaceMemberCreateRole, SdkOrganizationAssignableMemberRole> = {
  [OrganizationRole.Admin]: SdkOrganizationAssignableMemberRole.Admin,
  [OrganizationRole.Guest]: SdkOrganizationAssignableMemberRole.Guest,
  [OrganizationRole.Member]: SdkOrganizationAssignableMemberRole.Member,
};

const sdkInvitationOrganizationRoleByValue: Record<WorkspaceMemberCreateRole, SdkInvitationOrganizationRole> = {
  [OrganizationRole.Admin]: SdkInvitationOrganizationRole.Admin,
  [OrganizationRole.Guest]: SdkInvitationOrganizationRole.Guest,
  [OrganizationRole.Member]: SdkInvitationOrganizationRole.Member,
};

const sdkOrganizationMemberUpdateRoleByValue: Record<WorkspaceMemberCreateRole, SdkOrganizationAssignableMemberRole> = {
  [OrganizationRole.Admin]: SdkOrganizationAssignableMemberRole.Admin,
  [OrganizationRole.Guest]: SdkOrganizationAssignableMemberRole.Guest,
  [OrganizationRole.Member]: SdkOrganizationAssignableMemberRole.Member,
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

const workspaceMemberRoleOptions = [OrganizationRole.Member, OrganizationRole.Admin, OrganizationRole.Guest] as const;

const workspaceMemberFormSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
  role: z.enum(workspaceMemberRoleOptions),
});

type WorkspaceMemberFormState = z.infer<typeof workspaceMemberFormSchema>;

const workspaceMemberFormDefaults: WorkspaceMemberFormState = {
  email: '',
  role: OrganizationRole.Member,
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
  projectId: z.string().min(1, 'Select a folder.'),
  role: z.enum(teamProjectAccessRoleOptions),
});

type TeamProjectAccessFormState = z.infer<typeof teamProjectAccessFormSchema>;

const teamProjectAccessFormDefaults: TeamProjectAccessFormState = {
  projectId: '',
  role: ProjectRole.Viewer,
};

const teamDiagramAccessFormSchema = z.object({
  diagramId: z.string().min(1, 'Select a diagram.'),
  role: z.enum(teamProjectAccessRoleOptions),
});

type TeamDiagramAccessFormState = z.infer<typeof teamDiagramAccessFormSchema>;

const teamDiagramAccessFormDefaults: TeamDiagramAccessFormState = {
  diagramId: '',
  role: ProjectRole.Viewer,
};

const teamPageQuery = { limit: 50 } as const;
const teamMemberPageQuery = { limit: 50 } as const;
const teamDiagramAccessPageQuery = { limit: 50 } as const;
const teamProjectAccessPageQuery = { limit: 50 } as const;
const workspaceMemberPageQuery = { limit: 50 } as const;
const workspaceAuditLogQuery = { limit: 8 } as const;

const workspaceSettingsTabs = [
  { label: 'General', value: 'general' },
  { label: 'Members', value: 'members' },
  { label: 'Teams', value: 'teams' },
  { label: 'Activity', value: 'activity' },
] as const;

type WorkspaceSettingsTab = (typeof workspaceSettingsTabs)[number]['value'];

function isOrganizationManager(organization: OrganizationDto): boolean {
  return organization.role === 'owner' || organization.role === 'admin';
}

function WorkspaceSettingsTabList({
  activeTab,
  onActiveTabChange,
}: {
  activeTab: WorkspaceSettingsTab;
  onActiveTabChange: (tab: WorkspaceSettingsTab) => void;
}) {
  return (
    <div
      aria-label="Workspace settings sections"
      className="tabliodb-scrollbar flex shrink-0 gap-1 overflow-x-auto rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface))] p-1"
      role="tablist"
    >
      {workspaceSettingsTabs.map((tab) => {
        const isActive = activeTab === tab.value;

        return (
          <button
            aria-selected={isActive}
            className={cn(
              'h-9 shrink-0 cursor-pointer rounded-[var(--tabliodb-radius-md)] border px-3 text-xs font-black leading-none transition-[background,border-color,box-shadow,color] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--tabliodb-focus-ring))]',
              isActive
                ? 'border-[rgb(var(--tabliodb-primary-border))] bg-white text-[rgb(var(--tabliodb-primary-text))] shadow-[0_2px_0_rgb(var(--tabliodb-primary-border))]'
                : 'border-transparent text-[rgb(var(--tabliodb-ink-muted))] hover:bg-white hover:text-[rgb(var(--tabliodb-ink))]',
            )}
            key={tab.value}
            onClick={() => onActiveTabChange(tab.value)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function WorkspaceSettingsDialog({
  currentUserId,
  onOpenChange,
  open,
  organization,
  trigger,
}: {
  currentUserId: string;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  organization: OrganizationDto;
  trigger?: ReactNode | null;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const dialogOpen = open ?? internalOpen;
  // Dialog besar ini sengaja dipotong menjadi tab agar user tidak harus memindai satu halaman panjang berisi beberapa workflow.
  const [activeSettingsTab, setActiveSettingsTab] = useState<WorkspaceSettingsTab>('general');
  const [confirmWorkspaceTransferUserId, setConfirmWorkspaceTransferUserId] = useState<string | null>(null);
  const [createdWorkspaceInvite, setCreatedWorkspaceInvite] = useState<InvitationCreateResponseDto | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [transferringWorkspaceUserId, setTransferringWorkspaceUserId] = useState<string | null>(null);
  const canManageWorkspace = isOrganizationManager(organization);
  const canTransferWorkspaceOwnership = toOrganizationRoleValue(organization.role) === OrganizationRole.Owner;
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
  const workspaceMemberForm = useForm<WorkspaceMemberFormState>({
    defaultValues: workspaceMemberFormDefaults,
    mode: 'onBlur',
    resolver: zodResolver(workspaceMemberFormSchema),
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
  const teamDiagramAccessForm = useForm<TeamDiagramAccessFormState>({
    defaultValues: teamDiagramAccessFormDefaults,
    mode: 'onBlur',
    resolver: zodResolver(teamDiagramAccessFormSchema),
  });
  const { errors } = form.formState;
  const { errors: teamErrors } = teamForm.formState;
  const { errors: selectedTeamErrors } = selectedTeamForm.formState;
  const { errors: workspaceMemberErrors } = workspaceMemberForm.formState;
  const { errors: teamMemberErrors } = teamMemberForm.formState;
  const { errors: teamProjectAccessErrors } = teamProjectAccessForm.formState;
  const { errors: teamDiagramAccessErrors } = teamDiagramAccessForm.formState;
  const settingsQueryOptions = organizationsQueries.settings(organization.id);
  const settingsQuery = useQuery({
    ...settingsQueryOptions,
    // Workspace settings tidak perlu di-fetch sebelum user membuka dialog, jadi modal menjadi fetch boundary.
    enabled: dialogOpen && settingsQueryOptions.enabled !== false,
  });
  const auditLogsQueryOptions = organizationsQueries.auditLogs(organization.id, workspaceAuditLogQuery);
  const auditLogsQuery = useQuery({
    ...auditLogsQueryOptions,
    enabled:
      dialogOpen && activeSettingsTab === 'activity' && canManageWorkspace && auditLogsQueryOptions.enabled !== false,
  });
  const membersQueryOptions = organizationsQueries.members(organization.id, workspaceMemberPageQuery);
  const membersQuery = useQuery({
    ...membersQueryOptions,
    // Workspace members are admin-only data, so the dialog becomes the fetch boundary just like audit logs.
    enabled:
      dialogOpen && activeSettingsTab === 'members' && canManageWorkspace && membersQueryOptions.enabled !== false,
  });
  const teamsQueryOptions = teamsQueries.list({ ...teamPageQuery, organizationId: organization.id });
  const teamsQuery = useQuery({
    ...teamsQueryOptions,
    // Teams are workspace-admin data and are only needed in the settings dialog.
    enabled: dialogOpen && activeSettingsTab === 'teams' && canManageWorkspace && teamsQueryOptions.enabled !== false,
  });
  const selectedTeamMembersQueryOptions = teamsQueries.members(selectedTeamId ?? '', teamMemberPageQuery);
  const selectedTeamMembersQuery = useQuery({
    ...selectedTeamMembersQueryOptions,
    enabled:
      dialogOpen &&
      activeSettingsTab === 'teams' &&
      canManageWorkspace &&
      Boolean(selectedTeamId) &&
      selectedTeamMembersQueryOptions.enabled !== false,
  });
  const selectedTeamProjectAccessesQueryOptions = teamsQueries.projectAccesses(
    selectedTeamId ?? '',
    teamProjectAccessPageQuery,
  );
  const selectedTeamProjectAccessesQuery = useQuery({
    ...selectedTeamProjectAccessesQueryOptions,
    enabled:
      dialogOpen &&
      activeSettingsTab === 'teams' &&
      canManageWorkspace &&
      Boolean(selectedTeamId) &&
      selectedTeamProjectAccessesQueryOptions.enabled !== false,
  });
  const selectedTeamDiagramAccessesQueryOptions = teamsQueries.diagramAccesses(
    selectedTeamId ?? '',
    teamDiagramAccessPageQuery,
  );
  const selectedTeamDiagramAccessesQuery = useQuery({
    ...selectedTeamDiagramAccessesQueryOptions,
    enabled:
      dialogOpen &&
      activeSettingsTab === 'teams' &&
      canManageWorkspace &&
      Boolean(selectedTeamId) &&
      selectedTeamDiagramAccessesQueryOptions.enabled !== false,
  });
  const teamProjectOptionsQuery = useQuery({
    ...projectsQueries.list({ limit: 50, organizationId: organization.id }),
    // Folder options are backed by the legacy project endpoint while the product language stays diagram-first.
    enabled: dialogOpen && activeSettingsTab === 'teams' && canManageWorkspace,
  });
  const teamDiagramOptionsQuery = useQuery({
    ...diagramsQueries.listByWorkspace(organization.id, { limit: 50 }),
    // Diagram options are needed only when a workspace admin manages team grants.
    enabled: dialogOpen && activeSettingsTab === 'teams' && canManageWorkspace,
  });
  const auditLogs = auditLogsQuery.data?.items ?? [];
  const workspaceMembers = membersQuery.data?.items ?? [];
  const teams = teamsQuery.data?.items ?? [];
  const selectedTeam = selectedTeamId ? (teams.find((team) => team.id === selectedTeamId) ?? null) : null;
  const selectedTeamMembers = selectedTeamMembersQuery.data?.items ?? [];
  const selectedTeamProjectAccesses = selectedTeamProjectAccessesQuery.data?.items ?? [];
  const selectedTeamDiagramAccesses = selectedTeamDiagramAccessesQuery.data?.items ?? [];
  const teamProjectOptions = teamProjectOptionsQuery.data?.items ?? [];
  const teamDiagramOptions = teamDiagramOptionsQuery.data?.items ?? [];
  const teamProjectSelectOptions = teamProjectOptions.map((projectOption) => ({
    disabled: selectedTeamProjectAccesses.some((access) => access.projectId === projectOption.id),
    label: projectOption.name,
    value: projectOption.id,
  }));
  const teamDiagramSelectOptions = teamDiagramOptions.map((diagramOption) => ({
    disabled: selectedTeamDiagramAccesses.some((access) => access.diagramId === diagramOption.id),
    label: diagramOption.projectId ? `${diagramOption.name} / folder` : `${diagramOption.name} / root`,
    value: diagramOption.id,
  }));
  const updateSettingsMutation = useUpdateOrganizationSettingsMutation({
    mutationConfig: {
      onSuccess: (settings) => {
        // Response server menjadi source of truth karena slug bisa berubah mengikuti nama workspace.
        form.reset(getWorkspaceSettingsDefaults(organization, settings));
      },
    },
  });
  const addMemberMutation = useAddOrganizationMemberMutation({
    mutationConfig: {
      onSuccess: () => {
        workspaceMemberForm.reset(workspaceMemberFormDefaults);
        setCreatedWorkspaceInvite(null);
      },
    },
  });
  const createWorkspaceInvitationMutation = useCreateInvitationMutation({
    mutationConfig: {
      onSuccess: (invite) => {
        // Invitation token is only returned once, so the dialog keeps the generated link visible for copying.
        setCreatedWorkspaceInvite(invite);
      },
    },
  });
  const updateMemberMutation = useUpdateOrganizationMemberMutation();
  const transferOrganizationOwnershipMutation = useTransferOrganizationOwnershipMutation();
  const removeMemberMutation = useRemoveOrganizationMemberMutation();
  const isWorkspaceMemberMutationPending =
    addMemberMutation.isPending ||
    createWorkspaceInvitationMutation.isPending ||
    updateMemberMutation.isPending ||
    transferOrganizationOwnershipMutation.isPending ||
    removeMemberMutation.isPending;
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
  const upsertTeamDiagramAccessMutation = useUpsertTeamDiagramAccessMutation({
    mutationConfig: {
      onSuccess: () => {
        teamDiagramAccessForm.reset(teamDiagramAccessFormDefaults);
      },
    },
  });
  const removeTeamDiagramAccessMutation = useRemoveTeamDiagramAccessMutation();
  const isTeamMutationPending =
    createTeamMutation.isPending ||
    updateTeamMutation.isPending ||
    archiveTeamMutation.isPending ||
    addTeamMemberMutation.isPending ||
    removeTeamMemberMutation.isPending ||
    upsertTeamProjectAccessMutation.isPending ||
    removeTeamProjectAccessMutation.isPending ||
    upsertTeamDiagramAccessMutation.isPending ||
    removeTeamDiagramAccessMutation.isPending;

  useEffect(() => {
    if (dialogOpen) {
      form.reset(getWorkspaceSettingsDefaults(organization, settingsQuery.data));
      updateSettingsMutation.reset();
      addMemberMutation.reset();
      createWorkspaceInvitationMutation.reset();
      updateMemberMutation.reset();
      transferOrganizationOwnershipMutation.reset();
      removeMemberMutation.reset();
      createTeamMutation.reset();
      updateTeamMutation.reset();
      archiveTeamMutation.reset();
      addTeamMemberMutation.reset();
      removeTeamMemberMutation.reset();
      upsertTeamProjectAccessMutation.reset();
      removeTeamProjectAccessMutation.reset();
      upsertTeamDiagramAccessMutation.reset();
      removeTeamDiagramAccessMutation.reset();
      setConfirmWorkspaceTransferUserId(null);
      setTransferringWorkspaceUserId(null);
    }
  }, [dialogOpen, form, organization, settingsQuery.data]);

  useEffect(() => {
    if (!dialogOpen) {
      return;
    }

    if (!selectedTeam) {
      selectedTeamForm.reset(teamFormDefaults);
      return;
    }

    // Selection drives the detail form, so switching teams always shows the currently saved team metadata.
    selectedTeamForm.reset({ description: selectedTeam.description ?? '', name: selectedTeam.name });
  }, [dialogOpen, selectedTeam?.description, selectedTeam?.id, selectedTeam?.name, selectedTeamForm]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && (updateSettingsMutation.isPending || isWorkspaceMemberMutationPending || isTeamMutationPending)) {
      return;
    }

    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);

    if (nextOpen) {
      // Setiap sesi dialog mulai dari General supaya user selalu melihat pengaturan paling dasar sebelum workflow lain.
      setActiveSettingsTab('general');
    }

    if (!nextOpen) {
      form.reset(getWorkspaceSettingsDefaults(organization, settingsQuery.data));
      updateSettingsMutation.reset();
      addMemberMutation.reset();
      createWorkspaceInvitationMutation.reset();
      updateMemberMutation.reset();
      transferOrganizationOwnershipMutation.reset();
      removeMemberMutation.reset();
      createTeamMutation.reset();
      updateTeamMutation.reset();
      archiveTeamMutation.reset();
      addTeamMemberMutation.reset();
      removeTeamMemberMutation.reset();
      upsertTeamProjectAccessMutation.reset();
      removeTeamProjectAccessMutation.reset();
      upsertTeamDiagramAccessMutation.reset();
      removeTeamDiagramAccessMutation.reset();
      setSelectedTeamId(null);
      teamForm.reset(teamFormDefaults);
      selectedTeamForm.reset(teamFormDefaults);
      setCreatedWorkspaceInvite(null);
      workspaceMemberForm.reset(workspaceMemberFormDefaults);
      teamMemberForm.reset(teamMemberFormDefaults);
      teamProjectAccessForm.reset(teamProjectAccessFormDefaults);
      teamDiagramAccessForm.reset(teamDiagramAccessFormDefaults);
      setConfirmWorkspaceTransferUserId(null);
      setTransferringWorkspaceUserId(null);
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

  function handleAddWorkspaceMember(values: WorkspaceMemberFormState) {
    if (!canManageWorkspace) {
      return;
    }

    addMemberMutation.mutate({
      body: {
        email: values.email,
        // The create endpoint intentionally excludes Owner; ownership is managed by role changes with owner guards.
        role: sdkOrganizationMemberCreateRoleByValue[values.role],
      },
      organizationId: organization.id,
    });
  }

  function handleCreateWorkspaceInvite(values: WorkspaceMemberFormState) {
    if (!canManageWorkspace) {
      return;
    }

    createWorkspaceInvitationMutation.mutate({
      email: values.email,
      expiresInDays: 7,
      organizationId: organization.id,
      // Workspace invitation creates a new account, while the Add action is reserved for existing users.
      organizationRole: sdkInvitationOrganizationRoleByValue[values.role],
    });
  }

  async function copyWorkspaceInviteUrl() {
    if (!createdWorkspaceInvite) {
      return;
    }

    await navigator.clipboard.writeText(createdWorkspaceInvite.acceptUrl);
  }

  function handleUpdateWorkspaceMemberRole(member: OrganizationMemberDto, role: WorkspaceMemberCreateRole) {
    if (toOrganizationRoleValue(member.role) === role) {
      return;
    }

    setConfirmWorkspaceTransferUserId(null);
    updateMemberMutation.mutate({
      body: { role: sdkOrganizationMemberUpdateRoleByValue[role] },
      organizationId: organization.id,
      userId: member.userId,
    });
  }

  function handleTransferWorkspaceOwnership(member: OrganizationMemberDto) {
    if (confirmWorkspaceTransferUserId !== member.userId) {
      // Workspace ownership dipindahkan lewat aksi dua tahap supaya Owner tidak tercampur dengan role operasional biasa.
      setConfirmWorkspaceTransferUserId(member.userId);
      return;
    }

    setTransferringWorkspaceUserId(member.userId);
    transferOrganizationOwnershipMutation.mutate(
      {
        body: { userId: member.userId },
        organizationId: organization.id,
      },
      {
        onSettled: () => {
          setConfirmWorkspaceTransferUserId(null);
          setTransferringWorkspaceUserId(null);
        },
      },
    );
  }

  function handleRemoveWorkspaceMember(member: OrganizationMemberDto) {
    setConfirmWorkspaceTransferUserId(null);
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

  function handleUpsertTeamDiagramAccess(values: TeamDiagramAccessFormState) {
    if (!selectedTeam) {
      return;
    }

    upsertTeamDiagramAccessMutation.mutate({
      body: {
        diagramId: values.diagramId,
        // Team diagram grants use the same role enum as folder grants.
        role: sdkTeamProjectRoleByValue[values.role as TeamProjectRole],
      },
      organizationId: organization.id,
      teamId: selectedTeam.id,
    });
  }

  function handleRemoveTeamDiagramAccess(access: TeamDiagramAccessDto) {
    if (!selectedTeam) {
      return;
    }

    removeTeamDiagramAccessMutation.mutate({
      diagramId: access.diagramId,
      organizationId: organization.id,
      teamId: selectedTeam.id,
    });
  }

  function handleUpdateTeamDiagramAccessRole(access: TeamDiagramAccessDto, role: TeamProjectRole) {
    if (!selectedTeam || access.role === role) {
      return;
    }

    upsertTeamDiagramAccessMutation.mutate({
      body: {
        diagramId: access.diagramId,
        role: sdkTeamProjectRoleByValue[role],
      },
      organizationId: organization.id,
      teamId: selectedTeam.id,
    });
  }

  const memberMutationError =
    addMemberMutation.error ??
    createWorkspaceInvitationMutation.error ??
    updateMemberMutation.error ??
    transferOrganizationOwnershipMutation.error ??
    removeMemberMutation.error;
  const teamMutationError =
    createTeamMutation.error ??
    updateTeamMutation.error ??
    archiveTeamMutation.error ??
    addTeamMemberMutation.error ??
    removeTeamMemberMutation.error ??
    upsertTeamProjectAccessMutation.error ??
    removeTeamProjectAccessMutation.error ??
    upsertTeamDiagramAccessMutation.error ??
    removeTeamDiagramAccessMutation.error;
  const updatingUserId = updateMemberMutation.isPending ? updateMemberMutation.variables?.userId : null;
  const removingUserId = removeMemberMutation.isPending ? removeMemberMutation.variables?.userId : null;
  const removingTeamMemberUserId = removeTeamMemberMutation.isPending
    ? removeTeamMemberMutation.variables?.userId
    : null;
  const removingTeamProjectId = removeTeamProjectAccessMutation.isPending
    ? removeTeamProjectAccessMutation.variables?.projectId
    : null;
  const removingTeamDiagramId = removeTeamDiagramAccessMutation.isPending
    ? removeTeamDiagramAccessMutation.variables?.diagramId
    : null;

  return (
    <Dialog onOpenChange={handleOpenChange} open={dialogOpen}>
      {trigger !== null ? (
        <DialogTrigger asChild>
          {trigger ?? <IconButton icon={Building2} label="Workspace settings" variant="ghost" />}
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-h-[calc(100dvh-1.5rem)] w-[min(96vw,960px)]">
        <DialogHeader>
          <DialogTitle>Workspace settings</DialogTitle>
          <DialogDescription>Configure the current workspace without changing the Tabliodb brand.</DialogDescription>
        </DialogHeader>

        <DialogBody className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <WorkspaceSettingsTabList activeTab={activeSettingsTab} onActiveTabChange={setActiveSettingsTab} />

          <div className="tabliodb-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
            {activeSettingsTab === 'general' ? (
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
                      Default folder role
                    </span>
                    <ControlledSelect
                      className={selectClassName}
                      control={form.control}
                      disabled={settingsQuery.isPending || updateSettingsMutation.isPending || !canManageWorkspace}
                      name="defaultProjectRole"
                      options={workspaceDefaultRoleOptions.map((role) => ({
                        label: role === 'none' ? 'No automatic folder role' : formatProjectRole(role),
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
                    Members can create folders
                  </label>
                </div>

                {settingsQuery.error || updateSettingsMutation.error ? (
                  <div className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                    {getErrorMessage(settingsQuery.error ?? updateSettingsMutation.error)}
                  </div>
                ) : null}
              </form>
            ) : null}

            {activeSettingsTab === 'members' ? (
              canManageWorkspace ? (
                <section className="grid gap-4">
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
                    <Badge variant="green">{workspaceMembers.length} shown</Badge>
                  </div>

                  <form
                    className="mt-4 grid gap-3 rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface))] p-3 sm:grid-cols-[minmax(0,1fr)_150px_auto]"
                    onSubmit={workspaceMemberForm.handleSubmit(handleAddWorkspaceMember)}
                  >
                    <label className="block text-sm">
                      <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                        Existing user email
                      </span>
                      <ControlledInput
                        aria-invalid={Boolean(workspaceMemberErrors.email)}
                        autoComplete="email"
                        control={workspaceMemberForm.control}
                        disabled={isWorkspaceMemberMutationPending}
                        name="email"
                        placeholder="teammate@company.com"
                        type="email"
                      />
                      <FieldError>{workspaceMemberErrors.email?.message}</FieldError>
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                        Workspace role
                      </span>
                      <ControlledSelect
                        className={selectClassName}
                        control={workspaceMemberForm.control}
                        disabled={isWorkspaceMemberMutationPending}
                        name="role"
                        options={workspaceMemberRoleOptions.map((role) => ({
                          label: formatOrganizationRole(role),
                          value: role,
                        }))}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2 self-start sm:mt-6">
                      <Button className="gap-2" disabled={isWorkspaceMemberMutationPending} type="submit">
                        {addMemberMutation.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <UserPlus className="size-4" />
                        )}
                        Add
                      </Button>
                      <Button
                        className="gap-2"
                        disabled={isWorkspaceMemberMutationPending}
                        onClick={workspaceMemberForm.handleSubmit(handleCreateWorkspaceInvite)}
                        type="button"
                        variant="secondary"
                      >
                        {createWorkspaceInvitationMutation.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <MailPlus className="size-4" />
                        )}
                        Invite link
                      </Button>
                    </div>
                  </form>

                  {createdWorkspaceInvite ? (
                    <div className="mt-3 rounded-2xl border-2 border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] p-3">
                      <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-primary-text))]">
                        Invitation link
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input readOnly value={createdWorkspaceInvite.acceptUrl} />
                        <Button
                          className="shrink-0 gap-2"
                          onClick={copyWorkspaceInviteUrl}
                          type="button"
                          variant="secondary"
                        >
                          <Copy className="size-4" />
                          Copy
                        </Button>
                      </div>
                    </div>
                  ) : null}

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
                            canTransferOwnership={canTransferWorkspaceOwnership}
                            confirmTransfer={confirmWorkspaceTransferUserId === member.userId}
                            currentUserId={currentUserId}
                            isRemoving={removingUserId === member.userId}
                            isTransferring={transferringWorkspaceUserId === member.userId}
                            isUpdating={updatingUserId === member.userId}
                            key={member.userId}
                            member={member}
                            onRemove={handleRemoveWorkspaceMember}
                            onRoleChange={handleUpdateWorkspaceMemberRole}
                            onTransferOwnership={handleTransferWorkspaceOwnership}
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
                <section className="grid gap-4">
                  <div className="rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white p-4 text-sm font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                    Your workspace role is {formatOrganizationRole(organization.role)}. Owner or Admin access is
                    required to manage workspace settings and members.
                  </div>
                </section>
              )
            ) : null}

            {activeSettingsTab === 'teams' && canManageWorkspace ? (
              <section className="grid gap-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-extrabold">
                      <UsersRound className="size-4 text-[rgb(var(--tabliodb-primary-text))]" />
                      Teams
                    </h3>
                    <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                      Manage reusable groups before granting folder or diagram access.
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
                  <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <div className="tabliodb-scrollbar max-h-[32rem] overflow-y-auto rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white p-2">
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
                                {selectedTeam.memberCount} members / {selectedTeam.projectAccessCount} folder grants /{' '}
                                {selectedTeam.diagramAccessCount} diagram grants
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
                            className="grid min-w-0 gap-3 rounded-[14px] bg-[rgb(var(--tabliodb-surface))] p-3"
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

                          <div className="grid min-w-0 gap-4">
                            <section className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <h5 className="text-sm font-extrabold">Members</h5>
                                  <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                                    People who inherit every folder and diagram grant on this team
                                  </p>
                                </div>
                                <Badge>{selectedTeamMembers.length} shown</Badge>
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
                                  <h5 className="text-sm font-extrabold">Folder access</h5>
                                  <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                                    Grants inherited by team members for every diagram inside a folder
                                  </p>
                                </div>
                                <Badge>{selectedTeamProjectAccesses.length} shown</Badge>
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
                                    placeholder="Select folder"
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
                                  Loading folder access
                                </div>
                              ) : selectedTeamProjectAccesses.length === 0 ? (
                                <div className="mt-3 rounded-[14px] border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-3 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                                  No folder grants yet
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

                            <section className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] p-3 xl:col-span-2">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <h5 className="text-sm font-extrabold">Diagram access</h5>
                                  <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                                    Grants inherited by team members for one specific diagram
                                  </p>
                                </div>
                                <Badge>{selectedTeamDiagramAccesses.length} shown</Badge>
                              </div>

                              <form
                                className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_auto]"
                                onSubmit={teamDiagramAccessForm.handleSubmit(handleUpsertTeamDiagramAccess)}
                              >
                                <label className="block text-sm">
                                  <span className="sr-only">Diagram</span>
                                  <ControlledSelect
                                    aria-invalid={Boolean(teamDiagramAccessErrors.diagramId)}
                                    className={selectClassName}
                                    control={teamDiagramAccessForm.control}
                                    disabled={isTeamMutationPending || teamDiagramOptionsQuery.isPending}
                                    name="diagramId"
                                    options={teamDiagramSelectOptions}
                                    placeholder="Select diagram"
                                  />
                                  <FieldError>{teamDiagramAccessErrors.diagramId?.message}</FieldError>
                                </label>
                                <label className="block text-sm">
                                  <span className="sr-only">Role</span>
                                  <ControlledSelect
                                    aria-invalid={Boolean(teamDiagramAccessErrors.role)}
                                    className={selectClassName}
                                    control={teamDiagramAccessForm.control}
                                    disabled={isTeamMutationPending}
                                    name="role"
                                    options={teamProjectAccessRoleOptions.map((role) => ({
                                      label: formatProjectRole(role),
                                      value: role,
                                    }))}
                                  />
                                </label>
                                <Button disabled={isTeamMutationPending} size="sm" type="submit">
                                  {upsertTeamDiagramAccessMutation.isPending ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <ShieldCheck className="size-4" />
                                  )}
                                  Grant
                                </Button>
                              </form>

                              {selectedTeamDiagramAccessesQuery.isPending ? (
                                <div className="mt-3 flex items-center gap-2 rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] p-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                                  <Loader2 className="size-4 animate-spin" />
                                  Loading diagram access
                                </div>
                              ) : selectedTeamDiagramAccesses.length === 0 ? (
                                <div className="mt-3 rounded-[14px] border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-3 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                                  No diagram grants yet
                                </div>
                              ) : (
                                <div className="tabliodb-scrollbar mt-3 max-h-64 overflow-y-auto rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))]">
                                  <div className="divide-y divide-[rgb(var(--tabliodb-border))]">
                                    {selectedTeamDiagramAccesses.map((access) => (
                                      <TeamDiagramAccessRow
                                        access={access}
                                        isRemoving={removingTeamDiagramId === access.diagramId}
                                        key={access.diagramId}
                                        onRemove={handleRemoveTeamDiagramAccess}
                                        onRoleChange={handleUpdateTeamDiagramAccessRole}
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
                              Pick a team to manage members, folder access, and direct diagram access.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {teamMutationError ||
                selectedTeamMembersQuery.error ||
                selectedTeamProjectAccessesQuery.error ||
                selectedTeamDiagramAccessesQuery.error ? (
                  <div className="mt-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                    {getErrorMessage(
                      teamMutationError ??
                        selectedTeamMembersQuery.error ??
                        selectedTeamProjectAccessesQuery.error ??
                        selectedTeamDiagramAccessesQuery.error,
                    )}
                  </div>
                ) : null}
              </section>
            ) : null}

            {activeSettingsTab === 'activity' && canManageWorkspace ? (
              <section className="grid gap-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold">Recent activity</h3>
                    <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                      Workspace, folder, team, and diagram access changes recorded by the server
                    </p>
                  </div>
                  <Badge variant="blue">{auditLogs.length} shown</Badge>
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
          </div>
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
          {activeSettingsTab === 'general' ? (
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
          ) : null}
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
        {team.projectAccessCount} folder grants / {team.diagramAccessCount} diagram grants
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
      <WithTooltip content={`Remove ${access.projectName} folder access from this team`}>
        <Button
          aria-label={`Remove ${access.projectName} folder access from this team`}
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

function TeamDiagramAccessRow({
  access,
  isRemoving,
  onRemove,
  onRoleChange,
}: {
  access: TeamDiagramAccessDto;
  isRemoving: boolean;
  onRemove: (access: TeamDiagramAccessDto) => void;
  onRoleChange: (access: TeamDiagramAccessDto, role: TeamProjectRole) => void;
}) {
  return (
    <article className="grid gap-3 p-3 transition hover:bg-[rgb(var(--tabliodb-surface))] sm:grid-cols-[minmax(0,1fr)_130px_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <h6 className="min-w-0 truncate text-sm font-extrabold">{access.diagramName}</h6>
          <Badge className="shrink-0" variant={access.projectId ? 'neutral' : 'blue'}>
            {access.projectId ? 'Folder' : 'Root'}
          </Badge>
        </div>
        <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">Direct team diagram grant</p>
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
      <WithTooltip content={`Remove ${access.diagramName} diagram access from this team`}>
        <Button
          aria-label={`Remove ${access.diagramName} diagram access from this team`}
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
  canTransferOwnership,
  confirmTransfer,
  currentUserId,
  isRemoving,
  isTransferring,
  isUpdating,
  member,
  onRemove,
  onRoleChange,
  onTransferOwnership,
}: {
  canTransferOwnership: boolean;
  confirmTransfer: boolean;
  currentUserId: string;
  isRemoving: boolean;
  isTransferring: boolean;
  isUpdating: boolean;
  member: OrganizationMemberDto;
  onRemove: (member: OrganizationMemberDto) => void;
  onRoleChange: (member: OrganizationMemberDto, role: WorkspaceMemberCreateRole) => void;
  onTransferOwnership: (member: OrganizationMemberDto) => void;
}) {
  const isBusy = isRemoving || isTransferring || isUpdating;
  const isSelf = member.userId === currentUserId;
  const normalizedRole = toOrganizationRoleValue(member.role);
  const isOwner = normalizedRole === OrganizationRole.Owner;
  const canEditRole = !isOwner && !isSelf;
  const canRemove = !isOwner && !isSelf;
  const canTransferThisMember = canTransferOwnership && !isSelf && !isOwner;

  return (
    <article className="grid gap-3 p-3 transition hover:bg-[rgb(var(--tabliodb-surface))] sm:grid-cols-[minmax(0,1fr)_230px_auto] sm:items-center">
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
      {!canEditRole ? (
        <div className="text-left sm:text-right">
          <div className="text-sm font-extrabold text-[rgb(var(--tabliodb-ink))]">
            {formatOrganizationRole(normalizedRole)}
          </div>
          <div className="text-[11px] font-bold text-[rgb(var(--tabliodb-ink-muted))]">
            {isSelf ? 'Your access' : 'Managed by transfer'}
          </div>
        </div>
      ) : (
        <Select
          className={selectClassName}
          disabled={isBusy}
          onValueChange={(role) => onRoleChange(member, role as WorkspaceMemberCreateRole)}
          options={workspaceMemberRoleOptions.map((role) => ({
            label: formatOrganizationRole(role),
            value: role,
          }))}
          value={normalizedRole}
        />
      )}
      <div className="flex justify-start gap-2 sm:justify-end">
        {canTransferThisMember ? (
          <WithTooltip
            content={
              confirmTransfer
                ? `Click again to transfer workspace ownership to ${member.name}`
                : `Transfer workspace ownership to ${member.name}`
            }
          >
            <Button
              aria-label={
                confirmTransfer
                  ? `Confirm transfer workspace ownership to ${member.name}`
                  : `Transfer workspace ownership to ${member.name}`
              }
              className={cn(confirmTransfer && 'border-[rgb(var(--tabliodb-red))] text-[rgb(var(--tabliodb-red))]')}
              disabled={isBusy}
              onClick={() => onTransferOwnership(member)}
              size="sm"
              type="button"
              variant={confirmTransfer ? 'secondary' : 'soft'}
            >
              {isTransferring ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
              {confirmTransfer ? 'Confirm transfer' : 'Transfer owner'}
            </Button>
          </WithTooltip>
        ) : null}
        {canRemove ? (
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
        ) : null}
      </div>
    </article>
  );
}

function OrganizationRoleBadge({ role }: { role: OrganizationRoleValue | SdkOrganizationMemberRole }) {
  const normalizedRole = toOrganizationRoleValue(role);

  if (normalizedRole === OrganizationRole.Owner) {
    return <Badge variant="yellow">{formatOrganizationRole(normalizedRole)}</Badge>;
  }

  if (normalizedRole === OrganizationRole.Admin) {
    return <Badge variant="blue">{formatOrganizationRole(normalizedRole)}</Badge>;
  }

  if (normalizedRole === OrganizationRole.Member) {
    return <Badge variant="green">{formatOrganizationRole(normalizedRole)}</Badge>;
  }

  return <Badge>{formatOrganizationRole(normalizedRole)}</Badge>;
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
    return `Created folder ${readMetadataString(auditLog.metadata, 'name', 'folder')}`;
  }

  if (auditLog.action === 'project.archived') {
    return `Archived folder ${readMetadataString(auditLog.metadata, 'name', 'folder')}`;
  }

  if (auditLog.action === 'project.member_added') {
    return `Added ${readMetadataString(auditLog.metadata, 'email', 'member')} as ${formatProjectRoleValue(
      readMetadataString(auditLog.metadata, 'role', ProjectRole.Viewer),
    )}`;
  }

  if (auditLog.action === 'project.member_removed') {
    return `Removed ${readMetadataString(auditLog.metadata, 'email', 'member')} from folder access`;
  }

  if (auditLog.action === 'project.member_role_updated') {
    if (readMetadataBoolean(auditLog.metadata, 'transfer')) {
      return `Transferred folder ownership to ${readMetadataString(auditLog.metadata, 'email', 'member')}`;
    }

    const role = readMetadataRecord(auditLog.metadata, 'role');
    return `Changed ${readMetadataString(auditLog.metadata, 'email', 'member')} from ${formatProjectRoleValue(
      readMetadataString(role, 'before', ProjectRole.Viewer),
    )} to ${formatProjectRoleValue(readMetadataString(role, 'after', ProjectRole.Viewer))}`;
  }

  if (auditLog.action === 'organization.member_removed') {
    return `Removed ${readMetadataString(auditLog.metadata, 'email', 'member')} from workspace access`;
  }

  if (auditLog.action === 'organization.member_role_updated') {
    if (readMetadataBoolean(auditLog.metadata, 'transfer')) {
      return `Transferred workspace ownership to ${readMetadataString(auditLog.metadata, 'email', 'member')}`;
    }

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
    const projectName = readMetadataString(auditLog.metadata, 'projectName', 'folder');

    if (role && typeof role === 'object' && !Array.isArray(role)) {
      return `Changed ${teamName} folder access to ${projectName} from ${formatProjectRoleValue(
        readMetadataString(role as Record<string, unknown>, 'before', ProjectRole.Viewer),
      )} to ${formatProjectRoleValue(readMetadataString(role as Record<string, unknown>, 'after', ProjectRole.Viewer))}`;
    }

    return `Granted ${teamName} ${formatProjectRoleValue(String(role ?? ProjectRole.Viewer))} on folder ${projectName}`;
  }

  if (auditLog.action === 'team.project_access_removed') {
    return `Removed ${readMetadataString(auditLog.metadata, 'teamName', 'team')} folder access from ${readMetadataString(
      auditLog.metadata,
      'projectName',
      'folder',
    )}`;
  }

  if (auditLog.action === 'team.diagram_access_updated') {
    const role = auditLog.metadata.role;
    const teamName = readMetadataString(auditLog.metadata, 'teamName', 'team');
    const diagramName = readMetadataString(auditLog.metadata, 'diagramName', 'diagram');

    if (role && typeof role === 'object' && !Array.isArray(role)) {
      return `Changed ${teamName} diagram access to ${diagramName} from ${formatProjectRoleValue(
        readMetadataString(role as Record<string, unknown>, 'before', ProjectRole.Viewer),
      )} to ${formatProjectRoleValue(readMetadataString(role as Record<string, unknown>, 'after', ProjectRole.Viewer))}`;
    }

    return `Granted ${teamName} ${formatProjectRoleValue(String(role ?? ProjectRole.Viewer))} on diagram ${diagramName}`;
  }

  if (auditLog.action === 'team.diagram_access_removed') {
    return `Removed ${readMetadataString(auditLog.metadata, 'teamName', 'team')} diagram access from ${readMetadataString(
      auditLog.metadata,
      'diagramName',
      'diagram',
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
      'team.diagram_access_removed': 'Access',
      'team.diagram_access_updated': 'Access',
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
    action === 'team.diagram_access_updated' ||
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
    action === 'team.diagram_access_removed' ||
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
