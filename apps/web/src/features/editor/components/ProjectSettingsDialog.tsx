import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Permission, ProjectRole, isGranted, permissionsForProjectRole, type ProjectRoleValue } from '@tabliodb/shared';
import {
  Role7 as SdkProjectMemberOutputRole,
  Role8 as SdkProjectAssignableMemberRole,
  type ProjectMemberDtoOutput,
  type ProjectResponseDtoOutput,
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
import { Archive, Loader2, Save, Settings, ShieldCheck, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ControlledInput, ControlledSelect, ControlledTextarea } from '@/features/app/FormControls';
import { getErrorMessage } from '@/features/app/RouteStates';
import {
  projectsQueries,
  useAddProjectMemberMutation,
  useArchiveProjectMutation,
  useRemoveProjectMemberMutation,
  useTransferProjectOwnershipMutation,
  useUpdateProjectMemberMutation,
  useUpdateProjectMutation,
} from '@/resources/projects';
import { reviewSignalQueries, useUpdateProjectReviewSignalSettingsMutation } from '@/resources/review-signals';
import { selectClassName } from '../editor-form-styles';
import {
  ReviewSignalSettingsFields,
  getReviewSignalSettingsDefaults,
  reviewSignalSettingsFormSchema,
  toReviewSignalSettingsDto,
  type ReviewSignalSettingsFormState,
} from '../review-signal-settings';
import { UserAvatar } from './UserAvatar';

type ProjectMemberDto = ProjectMemberDtoOutput;
type ProjectResponseDto = ProjectResponseDtoOutput;
type ProjectAssignableRole = ProjectRole.Editor | ProjectRole.Commenter | ProjectRole.Viewer;

const projectAssignableRoleOptions = [ProjectRole.Editor, ProjectRole.Commenter, ProjectRole.Viewer] as const;
const projectMemberPageQuery = { limit: 50 } as const;

const sdkProjectMemberRoleByValue: Record<ProjectAssignableRole, SdkProjectAssignableMemberRole> = {
  [ProjectRole.Commenter]: SdkProjectAssignableMemberRole.Commenter,
  [ProjectRole.Editor]: SdkProjectAssignableMemberRole.Editor,
  [ProjectRole.Viewer]: SdkProjectAssignableMemberRole.Viewer,
};

const projectFormSchema = z.object({
  description: z.string().trim().max(240, 'Keep the description under 240 characters.').optional(),
  name: z.string().trim().min(1, 'Folder name is required.').max(80, 'Keep the name under 80 characters.'),
});

type ProjectFormState = z.infer<typeof projectFormSchema>;

const memberFormSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
  role: z.enum(projectAssignableRoleOptions),
});

type MemberFormState = z.infer<typeof memberFormSchema>;

const memberFormDefaults: MemberFormState = {
  email: '',
  role: ProjectRole.Viewer,
};

export function ProjectSettingsDialog({
  currentUserId,
  onArchived,
  onOpenChange,
  open,
  project,
  trigger,
}: {
  currentUserId: string;
  onArchived: () => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  project: ProjectResponseDto;
  trigger?: ReactNode | null;
}) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmTransferUserId, setConfirmTransferUserId] = useState<string | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [transferringUserId, setTransferringUserId] = useState<string | null>(null);
  const dialogOpen = open ?? internalOpen;
  const canManageProject = hasProjectPermission(project.projectRole, Permission.ProjectUpdate);
  const form = useForm<ProjectFormState>({
    defaultValues: getProjectFormDefaults(project),
    mode: 'onBlur',
    resolver: zodResolver(projectFormSchema),
  });
  const memberForm = useForm<MemberFormState>({
    defaultValues: memberFormDefaults,
    mode: 'onBlur',
    resolver: zodResolver(memberFormSchema),
  });
  const reviewSettingsForm = useForm<ReviewSignalSettingsFormState>({
    defaultValues: getReviewSignalSettingsDefaults(),
    mode: 'onBlur',
    resolver: zodResolver(reviewSignalSettingsFormSchema),
  });
  const { errors } = form.formState;
  const { errors: memberErrors } = memberForm.formState;
  const membersQueryOptions = projectsQueries.members(project.id, projectMemberPageQuery);
  const membersQuery = useQuery({
    ...membersQueryOptions,
    // Member list hanya dibutuhkan saat modal terbuka, jadi settings dialog menjadi fetch boundary.
    enabled: dialogOpen && membersQueryOptions.enabled !== false,
  });
  const projectReviewSettingsQueryOptions = reviewSignalQueries.projectSettings(project.id);
  const projectReviewSettingsQuery = useQuery({
    ...projectReviewSettingsQueryOptions,
    // Review defaults cukup dimuat saat user membuka settings supaya editor utama tetap ringan.
    enabled: dialogOpen && projectReviewSettingsQueryOptions.enabled !== false,
  });
  const members = membersQuery.data?.items ?? [];

  useEffect(() => {
    if (dialogOpen) {
      // Saat settings dibuka, form selalu mengikuti project terbaru dari query cache parent.
      form.reset(getProjectFormDefaults(project));
      memberForm.reset(memberFormDefaults);
      reviewSettingsForm.reset(getReviewSignalSettingsDefaults(projectReviewSettingsQuery.data));
      setConfirmArchive(false);
    }
  }, [dialogOpen, form, memberForm, project, projectReviewSettingsQuery.data, reviewSettingsForm]);

  const updateProjectMutation = useUpdateProjectMutation({
    mutationConfig: {
      onSuccess: () => {
        setDialogOpen(false);
      },
    },
  });
  const archiveProjectMutation = useArchiveProjectMutation({
    mutationConfig: {
      onSuccess: () => {
        setDialogOpen(false);
        onArchived();
      },
    },
  });
  const addProjectMemberMutation = useAddProjectMemberMutation({
    mutationConfig: {
      onSuccess: () => {
        // Role tetap viewer setelah add agar invite aman berulang cepat, tetapi email yang sudah dipakai dibersihkan.
        memberForm.reset(memberFormDefaults);
      },
    },
  });
  const updateProjectMemberMutation = useUpdateProjectMemberMutation();
  const transferProjectOwnershipMutation = useTransferProjectOwnershipMutation();
  const removeProjectMemberMutation = useRemoveProjectMemberMutation();
  const updateProjectReviewSettingsMutation = useUpdateProjectReviewSignalSettingsMutation({
    mutationConfig: {
      onSuccess: (settings) => {
        // Response server sudah dinormalisasi, jadi form rule defaults diselaraskan dari payload itu setelah save.
        reviewSettingsForm.reset(getReviewSignalSettingsDefaults(settings));
      },
    },
  });
  const isProjectMutationPending = updateProjectMutation.isPending || archiveProjectMutation.isPending;
  const isMemberMutationPending =
    addProjectMemberMutation.isPending ||
    updateProjectMemberMutation.isPending ||
    transferProjectOwnershipMutation.isPending ||
    removeProjectMemberMutation.isPending;
  const isReviewSettingsMutationPending = updateProjectReviewSettingsMutation.isPending;
  const isReviewSettingsPending = projectReviewSettingsQuery.isFetching || isReviewSettingsMutationPending;

  function setDialogOpen(nextOpen: boolean) {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && (isProjectMutationPending || isMemberMutationPending || isReviewSettingsMutationPending)) {
      return;
    }

    setDialogOpen(nextOpen);

    if (!nextOpen) {
      form.reset(getProjectFormDefaults(project));
      memberForm.reset(memberFormDefaults);
      reviewSettingsForm.reset(getReviewSignalSettingsDefaults(projectReviewSettingsQuery.data));
      setConfirmArchive(false);
      updateProjectMutation.reset();
      archiveProjectMutation.reset();
      addProjectMemberMutation.reset();
      updateProjectMemberMutation.reset();
      transferProjectOwnershipMutation.reset();
      removeProjectMemberMutation.reset();
      updateProjectReviewSettingsMutation.reset();
      setConfirmTransferUserId(null);
      setTransferringUserId(null);
    }
  }

  function handleSubmit(values: ProjectFormState) {
    updateProjectMutation.mutate({
      body: {
        description: toOptionalDescription(values.description) ?? null,
        name: values.name,
      },
      projectId: project.id,
    });
  }

  function handleArchive() {
    if (!confirmArchive) {
      setConfirmArchive(true);
      return;
    }

    archiveProjectMutation.mutate({ organizationId: project.organizationId, projectId: project.id });
  }

  function handleAddMember(values: MemberFormState) {
    addProjectMemberMutation.mutate({
      body: {
        email: values.email,
        role: sdkProjectMemberRoleByValue[values.role],
      },
      projectId: project.id,
    });
  }

  function handleReviewSettingsSubmit(values: ReviewSignalSettingsFormState) {
    updateProjectReviewSettingsMutation.mutate({
      projectId: project.id,
      settings: toReviewSignalSettingsDto(values),
    });
  }

  function handleUpdateMemberRole(member: ProjectMemberDto, role: ProjectAssignableRole) {
    if (toProjectRoleValue(member.role) === role) {
      return;
    }

    setConfirmTransferUserId(null);
    updateProjectMemberMutation.mutate({
      body: { role: sdkProjectMemberRoleByValue[role] },
      projectId: project.id,
      userId: member.userId,
    });
  }

  function handleTransferOwnership(member: ProjectMemberDto) {
    if (confirmTransferUserId !== member.userId) {
      // Folder ownership memakai aksi dua langkah agar user sadar bahwa Owner lama akan otomatis turun menjadi Editor.
      setConfirmTransferUserId(member.userId);
      return;
    }

    setTransferringUserId(member.userId);
    transferProjectOwnershipMutation.mutate(
      {
        body: { userId: member.userId },
        projectId: project.id,
      },
      {
        onSettled: () => {
          setConfirmTransferUserId(null);
          setTransferringUserId(null);
        },
      },
    );
  }

  function handleRemoveMember(member: ProjectMemberDto) {
    setConfirmTransferUserId(null);
    removeProjectMemberMutation.mutate({
      projectId: project.id,
      userId: member.userId,
    });
  }

  const mutationError = updateProjectMutation.error ?? archiveProjectMutation.error;
  const memberMutationError =
    addProjectMemberMutation.error ??
    updateProjectMemberMutation.error ??
    transferProjectOwnershipMutation.error ??
    removeProjectMemberMutation.error;
  const updatingUserId = updateProjectMemberMutation.isPending ? updateProjectMemberMutation.variables?.userId : null;
  const removingUserId = removeProjectMemberMutation.isPending ? removeProjectMemberMutation.variables?.userId : null;

  return (
    <Dialog onOpenChange={handleOpenChange} open={dialogOpen}>
      {trigger !== null ? (
        <DialogTrigger asChild>
          {trigger ?? <IconButton icon={Settings} label="Folder settings" variant="ghost" />}
        </DialogTrigger>
      ) : null}
      <DialogContent className="w-[min(94vw,680px)]">
        <DialogHeader>
          <DialogTitle>Folder settings</DialogTitle>
          <DialogDescription>Manage folder details, access, and archive state.</DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-5">
          <form className="grid gap-4" id="project-settings-form" onSubmit={form.handleSubmit(handleSubmit)}>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Folder name
              </span>
              <ControlledInput
                aria-invalid={Boolean(errors.name)}
                control={form.control}
                disabled={isProjectMutationPending}
                name="name"
              />
              <FieldError>{errors.name?.message}</FieldError>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Description
              </span>
              <ControlledTextarea
                aria-invalid={Boolean(errors.description)}
                className="min-h-24 w-full resize-none rounded-2xl border-2 border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 py-2 text-sm font-semibold outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
                control={form.control}
                disabled={isProjectMutationPending}
                name="description"
              />
              <FieldError>{errors.description?.message}</FieldError>
            </label>

            {mutationError ? (
              <div className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                {getErrorMessage(mutationError)}
              </div>
            ) : null}
          </form>

          <section className="border-t-2 border-[rgb(var(--tabliodb-border))] pt-5">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-extrabold">Review rule defaults</h3>
                <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                  Disabled rules become the baseline for every diagram in this folder.
                </p>
              </div>
              <Badge variant="blue">{projectReviewSettingsQuery.isPending ? 'Loading' : 'Folder'}</Badge>
            </div>
            <form
              className="grid gap-3"
              id="project-review-settings-form"
              onSubmit={reviewSettingsForm.handleSubmit(handleReviewSettingsSubmit)}
            >
              <ReviewSignalSettingsFields
                control={reviewSettingsForm.control}
                disabled={isReviewSettingsPending || !canManageProject}
              />
              {updateProjectReviewSettingsMutation.error ? (
                <div className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                  {getErrorMessage(updateProjectReviewSettingsMutation.error)}
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button
                  disabled={isReviewSettingsPending || !canManageProject}
                  size="sm"
                  type="submit"
                  variant="secondary"
                >
                  {updateProjectReviewSettingsMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save rules
                </Button>
              </div>
            </form>
          </section>

          <section className="border-t-2 border-[rgb(var(--tabliodb-border))] pt-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-extrabold">
                  <UsersRound className="size-4 text-[rgb(var(--tabliodb-sky-text))]" />
                  Folder members
                </h3>
                <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                  {membersQuery.data?.totalCount ?? members.length} people with direct folder access
                </p>
              </div>
              <Badge variant="green">{members.length} loaded</Badge>
            </div>

            <form
              className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_auto]"
              onSubmit={memberForm.handleSubmit(handleAddMember)}
            >
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Email
                </span>
                <ControlledInput
                  aria-invalid={Boolean(memberErrors.email)}
                  autoComplete="email"
                  control={memberForm.control}
                  disabled={isMemberMutationPending}
                  name="email"
                  placeholder="teammate@example.com"
                  type="email"
                />
                <FieldError>{memberErrors.email?.message}</FieldError>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Role
                </span>
                <ControlledSelect
                  className={selectClassName}
                  control={memberForm.control}
                  disabled={isMemberMutationPending}
                  name="role"
                  options={projectAssignableRoleOptions.map((role) => ({
                    label: formatProjectRole(role),
                    value: role,
                  }))}
                />
              </label>
              <Button className="self-start sm:mt-6" disabled={isMemberMutationPending} type="submit">
                {addProjectMemberMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                Add
              </Button>
            </form>

            {membersQuery.isPending ? (
              <div className="mt-4 flex items-center gap-2 rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white p-4 text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                <Loader2 className="size-4 animate-spin" />
                Loading members
              </div>
            ) : membersQuery.error ? (
              <div className="mt-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                {getErrorMessage(membersQuery.error)}
              </div>
            ) : members.length === 0 ? (
              <div className="mt-4 rounded-2xl border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-4 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                No folder members yet
              </div>
            ) : (
              <div className="tabliodb-scrollbar mt-4 max-h-72 overflow-y-auto rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white">
                <div className="divide-y divide-[rgb(var(--tabliodb-border))]">
                  {members.map((member) => (
                    <ProjectMemberRow
                      confirmTransfer={confirmTransferUserId === member.userId}
                      currentUserId={currentUserId}
                      isRemoving={removingUserId === member.userId}
                      isTransferring={transferringUserId === member.userId}
                      isUpdating={updatingUserId === member.userId}
                      key={member.userId}
                      member={member}
                      onRemove={handleRemoveMember}
                      onRoleChange={handleUpdateMemberRole}
                      onTransferOwnership={handleTransferOwnership}
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
        </DialogBody>

        <DialogFooter className="justify-between sm:justify-between">
          <Button
            disabled={isProjectMutationPending || isMemberMutationPending}
            onClick={handleArchive}
            variant={confirmArchive ? 'danger' : 'secondary'}
          >
            {archiveProjectMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Archive className="size-4" />
            )}
            {confirmArchive ? 'Confirm archive' : 'Archive'}
          </Button>
          <div className="flex gap-2">
            <Button
              disabled={isProjectMutationPending || isMemberMutationPending}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              disabled={isProjectMutationPending || isMemberMutationPending}
              form="project-settings-form"
              type="submit"
            >
              {updateProjectMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectMemberRow({
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
  confirmTransfer: boolean;
  currentUserId: string;
  isRemoving: boolean;
  isTransferring: boolean;
  isUpdating: boolean;
  member: ProjectMemberDto;
  onRemove: (member: ProjectMemberDto) => void;
  onRoleChange: (member: ProjectMemberDto, role: ProjectAssignableRole) => void;
  onTransferOwnership: (member: ProjectMemberDto) => void;
}) {
  const isBusy = isRemoving || isTransferring || isUpdating;
  const isSelf = member.userId === currentUserId;
  const normalizedRole = toProjectRoleValue(member.role);
  const isOwner = normalizedRole === ProjectRole.Owner;
  const canEditRole = !isOwner && !isSelf;
  const canRemove = !isOwner && !isSelf;
  const canTransferOwnership = !isSelf && !isOwner;

  return (
    <article className="grid gap-3 p-3 transition hover:bg-[rgb(var(--tabliodb-surface))] sm:grid-cols-[minmax(0,1fr)_230px_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar className="size-10 rounded-[14px] text-xs" user={member} />
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h4 className="min-w-0 max-w-full truncate text-sm font-extrabold">{member.name}</h4>
            <ProjectRoleBadge role={member.role} />
          </div>
          <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">{member.email}</p>
        </div>
      </div>
      {!canEditRole ? (
        <div className="text-left sm:text-right">
          <div className="text-sm font-extrabold text-[rgb(var(--tabliodb-ink))]">
            {formatProjectRole(normalizedRole)}
          </div>
          <div className="text-[11px] font-bold text-[rgb(var(--tabliodb-ink-muted))]">
            {isSelf ? 'Your access' : 'Managed by transfer'}
          </div>
        </div>
      ) : (
        <Select
          className={selectClassName}
          disabled={isBusy}
          onValueChange={(role) => onRoleChange(member, role as ProjectAssignableRole)}
          options={projectAssignableRoleOptions.map((role) => ({
            label: formatProjectRole(role),
            value: role,
          }))}
          value={normalizedRole}
        />
      )}
      <div className="flex justify-start gap-2 sm:justify-end">
        {canTransferOwnership ? (
          <WithTooltip
            content={
              confirmTransfer
                ? `Click again to transfer folder ownership to ${member.name}`
                : `Transfer folder ownership to ${member.name}`
            }
          >
            <Button
              aria-label={
                confirmTransfer
                  ? `Confirm transfer folder ownership to ${member.name}`
                  : `Transfer folder ownership to ${member.name}`
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
          <WithTooltip content={`Remove ${member.name} from this folder`}>
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

function ProjectRoleBadge({ role }: { role: ProjectRoleValue | SdkProjectMemberOutputRole }) {
  const normalizedRole = toProjectRoleValue(role);

  if (normalizedRole === ProjectRole.Owner) {
    return <Badge variant="yellow">{formatProjectRole(normalizedRole)}</Badge>;
  }

  if (normalizedRole === ProjectRole.Editor) {
    return <Badge variant="green">{formatProjectRole(normalizedRole)}</Badge>;
  }

  if (normalizedRole === ProjectRole.Commenter) {
    return <Badge variant="blue">{formatProjectRole(normalizedRole)}</Badge>;
  }

  return <Badge>{formatProjectRole(normalizedRole)}</Badge>;
}

function formatProjectRole(role: ProjectRoleValue): string {
  return {
    [ProjectRole.Commenter]: 'Commenter',
    [ProjectRole.Editor]: 'Editor',
    [ProjectRole.Owner]: 'Owner',
    [ProjectRole.Viewer]: 'Viewer',
  }[role];
}

function getProjectFormDefaults(project: ProjectResponseDto): ProjectFormState {
  return {
    description: project.description ?? '',
    name: project.name,
  };
}

function hasProjectPermission(role: ProjectRoleValue | SdkProjectMemberOutputRole, permission: Permission): boolean {
  return isGranted({
    current: permissionsForProjectRole(toProjectRoleValue(role)),
    requested: [permission],
  });
}

function toProjectRoleValue(role: ProjectRoleValue | SdkProjectMemberOutputRole): ProjectRoleValue {
  // SDK generated enum dan shared permission enum memakai value string yang sama, tetapi cast eksplisit menjaga boundary tetap terlihat.
  return role as ProjectRoleValue;
}

function toOptionalDescription(value: string | undefined): string | undefined {
  const description = value?.trim();
  return description ? description : undefined;
}
