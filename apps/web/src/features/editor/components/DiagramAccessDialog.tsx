import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  AccessType as SdkDiagramAccessType,
  Role as SdkDiagramMemberRole,
  SourceType as SdkDiagramAccessSourceType,
  type DiagramEffectiveAccessDtoOutput,
  type DiagramMemberDtoOutput,
  type DiagramResponseDtoOutput,
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
  FieldError,
  IconButton,
  Select,
  WithTooltip,
  cn,
} from '@tabliodb/ui';
import { Loader2, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ControlledInput, ControlledSelect } from '@/features/app/FormControls';
import { getErrorMessage } from '@/features/app/RouteStates';
import {
  diagramsQueries,
  useAddDiagramMemberMutation,
  useRemoveDiagramMemberMutation,
  useUpdateDiagramMemberMutation,
} from '@/resources/diagrams';
import { selectClassName } from '../editor-form-styles';
import { UserAvatar } from './UserAvatar';

type DiagramMemberDto = DiagramMemberDtoOutput;
type DiagramEffectiveAccessDto = DiagramEffectiveAccessDtoOutput;
type DiagramResponseDto = DiagramResponseDtoOutput;

const diagramMemberPageQuery = { limit: 50 } as const;
const diagramRoleOptions = [
  SdkDiagramMemberRole.Owner,
  SdkDiagramMemberRole.Editor,
  SdkDiagramMemberRole.Commenter,
  SdkDiagramMemberRole.Viewer,
] as const;

const shareFormSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
  role: z.enum([
    SdkDiagramMemberRole.Owner,
    SdkDiagramMemberRole.Editor,
    SdkDiagramMemberRole.Commenter,
    SdkDiagramMemberRole.Viewer,
  ]),
});

type ShareFormState = z.infer<typeof shareFormSchema>;

const shareFormDefaults: ShareFormState = {
  email: '',
  role: SdkDiagramMemberRole.Viewer,
};

export function DiagramAccessDialog({ canManage, diagram }: { canManage: boolean; diagram: DiagramResponseDto }) {
  const [confirmRemoveUserId, setConfirmRemoveUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const membersQueryOptions = diagramsQueries.members(diagram.id, diagramMemberPageQuery);
  const effectiveAccessQueryOptions = diagramsQueries.effectiveAccess(diagram.id, diagramMemberPageQuery);
  const membersQuery = useQuery({
    ...membersQueryOptions,
    // The member list is only needed while the dialog is visible; this keeps header render cheap.
    enabled: open && membersQueryOptions.enabled,
  });
  const effectiveAccessQuery = useQuery({
    ...effectiveAccessQueryOptions,
    // Effective access can include inherited workspace/folder/team grants, so it is loaded with the share dialog only.
    enabled: open && effectiveAccessQueryOptions.enabled,
  });
  const addDiagramMemberMutation = useAddDiagramMemberMutation();
  const updateDiagramMemberMutation = useUpdateDiagramMemberMutation();
  const removeDiagramMemberMutation = useRemoveDiagramMemberMutation();
  const form = useForm<ShareFormState>({
    defaultValues: shareFormDefaults,
    mode: 'onBlur',
    resolver: zodResolver(shareFormSchema),
  });
  const members = membersQuery.data?.items ?? [];
  const effectiveAccess = effectiveAccessQuery.data?.items ?? [];
  const isMemberMutationPending =
    addDiagramMemberMutation.isPending ||
    updateDiagramMemberMutation.isPending ||
    removeDiagramMemberMutation.isPending;
  const mutationError =
    addDiagramMemberMutation.error ?? updateDiagramMemberMutation.error ?? removeDiagramMemberMutation.error;

  useEffect(() => {
    if (!open) {
      form.reset(shareFormDefaults);
      setConfirmRemoveUserId(null);
      setRemovingUserId(null);
      setUpdatingUserId(null);
    }
  }, [form, open]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
  }

  function handleAddMember(values: ShareFormState) {
    addDiagramMemberMutation.mutate(
      {
        body: {
          email: values.email,
          role: values.role,
        },
        diagramId: diagram.id,
      },
      {
        onSuccess: () => {
          // Reset the invite form after the server accepts the direct diagram membership.
          form.reset(shareFormDefaults);
        },
      },
    );
  }

  function handleUpdateRole(member: DiagramMemberDto, role: SdkDiagramMemberRole) {
    setConfirmRemoveUserId(null);
    setUpdatingUserId(member.userId);
    updateDiagramMemberMutation.mutate(
      {
        body: { role },
        diagramId: diagram.id,
        userId: member.userId,
      },
      {
        onSettled: () => setUpdatingUserId(null),
      },
    );
  }

  function handleRemoveMember(member: DiagramMemberDto) {
    if (confirmRemoveUserId !== member.userId) {
      // A two-click delete keeps this compact dialog free from another confirmation layer.
      setConfirmRemoveUserId(member.userId);
      return;
    }

    setRemovingUserId(member.userId);
    removeDiagramMemberMutation.mutate(
      {
        diagramId: diagram.id,
        userId: member.userId,
      },
      {
        onSettled: () => {
          setConfirmRemoveUserId(null);
          setRemovingUserId(null);
        },
      },
    );
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <IconButton disabled={!canManage} icon={UsersRound} label="Diagram access" onClick={() => setOpen(true)} />
      <DialogContent className="max-h-[calc(100dvh-1.5rem)] w-[min(96vw,860px)] max-w-none">
        <DialogHeader className="border-b border-[rgb(var(--tabliodb-border))] pb-4">
          <DialogTitle>Diagram access</DialogTitle>
          <DialogDescription>
            Invite people and manage direct permissions for {diagram.name}. Public read-only links stay in the More
            menu.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="grid min-h-0 flex-1 gap-4 overflow-y-auto">
          <section className="rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-black">Direct access</h3>
                <p className="mt-0.5 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                  Use this when a diagram is standalone or needs different access than its folder.
                </p>
              </div>
              <Badge className="shrink-0" variant="neutral">
                {membersQuery.data?.totalCount ?? members.length} people
              </Badge>
            </div>

            <form
              className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_auto]"
              onSubmit={form.handleSubmit(handleAddMember)}
            >
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Email
                </span>
                <ControlledInput
                  aria-invalid={Boolean(form.formState.errors.email)}
                  autoComplete="email"
                  control={form.control}
                  disabled={isMemberMutationPending}
                  name="email"
                  placeholder="teammate@example.com"
                  type="email"
                />
                <FieldError>{form.formState.errors.email?.message}</FieldError>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Role
                </span>
                <ControlledSelect
                  className={selectClassName}
                  control={form.control}
                  disabled={isMemberMutationPending}
                  name="role"
                  options={diagramRoleOptions.map((role) => ({
                    label: formatDiagramRole(role),
                    value: role,
                  }))}
                />
              </label>
              <Button className="self-start sm:mt-6" disabled={!canManage || isMemberMutationPending} type="submit">
                {addDiagramMemberMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                Add
              </Button>
            </form>

            {mutationError ? (
              <div className="mt-3 rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                {getErrorMessage(mutationError)}
              </div>
            ) : null}
          </section>

          <section className="min-h-0 rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border))] bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-[rgb(var(--tabliodb-border))] p-4">
              <div>
                <h3 className="text-sm font-black">Effective access</h3>
                <p className="mt-0.5 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                  Read-only view of everyone who can currently open this diagram.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="shrink-0" variant="neutral">
                  {effectiveAccessQuery.data?.totalCount ?? effectiveAccess.length} people
                </Badge>
                {effectiveAccessQuery.isFetching ? (
                  <Loader2 className="size-4 animate-spin text-[rgb(var(--tabliodb-ink-muted))]" />
                ) : null}
              </div>
            </div>

            {effectiveAccessQuery.isPending ? (
              <div className="flex items-center gap-2 p-4 text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                <Loader2 className="size-4 animate-spin" />
                Loading access
              </div>
            ) : effectiveAccessQuery.error ? (
              <div className="m-4 rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                {getErrorMessage(effectiveAccessQuery.error)}
              </div>
            ) : effectiveAccess.length === 0 ? (
              <div className="m-4 rounded-[var(--tabliodb-radius-md)] border border-dashed border-[rgb(var(--tabliodb-border))] p-5 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                No effective access found
              </div>
            ) : (
              <div className="tabliodb-scrollbar max-h-[220px] overflow-y-auto">
                <div className="divide-y divide-[rgb(var(--tabliodb-border))]">
                  {effectiveAccess.map((member) => (
                    <DiagramEffectiveAccessRow key={member.userId} member={member} />
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="min-h-0 rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border))] bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-[rgb(var(--tabliodb-border))] p-4">
              <div>
                <h3 className="text-sm font-black">Members</h3>
                <p className="mt-0.5 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                  People explicitly added to this diagram.
                </p>
              </div>
              {membersQuery.isFetching ? (
                <Loader2 className="size-4 animate-spin text-[rgb(var(--tabliodb-ink-muted))]" />
              ) : null}
            </div>

            {membersQuery.isPending ? (
              <div className="flex items-center gap-2 p-4 text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                <Loader2 className="size-4 animate-spin" />
                Loading members
              </div>
            ) : membersQuery.error ? (
              <div className="m-4 rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                {getErrorMessage(membersQuery.error)}
              </div>
            ) : members.length === 0 ? (
              <div className="m-4 rounded-[var(--tabliodb-radius-md)] border border-dashed border-[rgb(var(--tabliodb-border))] p-5 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                No direct members yet
              </div>
            ) : (
              <div className="tabliodb-scrollbar max-h-[260px] overflow-y-auto">
                <div className="divide-y divide-[rgb(var(--tabliodb-border))]">
                  {members.map((member) => (
                    <DiagramMemberRow
                      confirmRemove={confirmRemoveUserId === member.userId}
                      isRemoving={removingUserId === member.userId}
                      isUpdating={updatingUserId === member.userId}
                      key={member.userId}
                      member={member}
                      onRemove={handleRemoveMember}
                      onRoleChange={handleUpdateRole}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        </DialogBody>

        <DialogFooter>
          <Button disabled={isMemberMutationPending} onClick={() => setOpen(false)} type="button" variant="secondary">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiagramEffectiveAccessRow({ member }: { member: DiagramEffectiveAccessDto }) {
  return (
    <article className="grid gap-3 p-3 transition hover:bg-[rgb(var(--tabliodb-surface))] sm:grid-cols-[minmax(0,1fr)_120px] sm:items-start">
      <div className="flex min-w-0 items-start gap-3">
        <UserAvatar className="size-10 rounded-[14px] text-xs" user={member} />
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h4 className="min-w-0 max-w-full truncate text-sm font-extrabold">{member.name}</h4>
            <DiagramRoleChip role={member.role} />
            <AccessTypeChip accessType={member.accessType} />
          </div>
          <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">{member.email}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {member.sources.map((source, index) => (
              <span
                className="inline-flex min-h-6 items-center rounded-full border border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] px-2 text-[11px] font-black leading-tight text-[rgb(var(--tabliodb-ink-muted))]"
                key={`${member.userId}-${source.sourceType}-${source.sourceId ?? 'workspace'}-${index}`}
              >
                {formatAccessSource(source.sourceType, source.sourceLabel)} / {formatDiagramRole(source.role)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-start sm:justify-end">
        <Badge variant={member.directRole ? 'green' : 'neutral'}>
          {member.directRole ? 'Direct row' : 'Inherited'}
        </Badge>
      </div>
    </article>
  );
}

function DiagramMemberRow({
  confirmRemove,
  isRemoving,
  isUpdating,
  member,
  onRemove,
  onRoleChange,
}: {
  confirmRemove: boolean;
  isRemoving: boolean;
  isUpdating: boolean;
  member: DiagramMemberDto;
  onRemove: (member: DiagramMemberDto) => void;
  onRoleChange: (member: DiagramMemberDto, role: SdkDiagramMemberRole) => void;
}) {
  const isBusy = isRemoving || isUpdating;

  return (
    <article className="grid gap-3 p-3 transition hover:bg-[rgb(var(--tabliodb-surface))] sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar className="size-10 rounded-[14px] text-xs" user={member} />
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h4 className="min-w-0 max-w-full truncate text-sm font-extrabold">{member.name}</h4>
            <DiagramRoleChip role={member.role} />
          </div>
          <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">{member.email}</p>
        </div>
      </div>
      <Select
        className={selectClassName}
        disabled={isBusy}
        onValueChange={(role) => onRoleChange(member, role as SdkDiagramMemberRole)}
        options={diagramRoleOptions.map((role) => ({
          label: formatDiagramRole(role),
          value: role,
        }))}
        value={member.role}
      />
      <WithTooltip content={confirmRemove ? `Click again to remove ${member.name}` : `Remove ${member.name}`}>
        <Button
          aria-label={confirmRemove ? `Confirm remove ${member.name}` : `Remove ${member.name}`}
          className={cn(confirmRemove && 'border-[rgb(var(--tabliodb-red))] text-[rgb(var(--tabliodb-red))]')}
          disabled={isBusy}
          onClick={() => onRemove(member)}
          size="icon"
          type="button"
          variant="ghost"
        >
          {isRemoving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </Button>
      </WithTooltip>
    </article>
  );
}

function DiagramRoleChip({ role }: { role: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-black leading-none',
        getRoleChipClassName(role),
      )}
    >
      {formatDiagramRole(role)}
    </span>
  );
}

function AccessTypeChip({ accessType }: { accessType: SdkDiagramAccessType }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-black leading-none',
        getAccessTypeChipClassName(accessType),
      )}
    >
      {formatAccessType(accessType)}
    </span>
  );
}

function getRoleChipClassName(role: string): string {
  return {
    [SdkDiagramMemberRole.Commenter]: 'border-[#88d8f7] bg-[#effbff] text-[#08729c]',
    [SdkDiagramMemberRole.Editor]: 'border-[#98df7c] bg-[#f2ffe9] text-[#2d7b0b]',
    [SdkDiagramMemberRole.Owner]: 'border-[#ffd56a] bg-[#fff8d7] text-[#8a5a00]',
    [SdkDiagramMemberRole.Viewer]:
      'border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] text-[rgb(var(--tabliodb-ink-muted))]',
  }[role as SdkDiagramMemberRole];
}

function getAccessTypeChipClassName(accessType: SdkDiagramAccessType): string {
  return {
    [SdkDiagramAccessType.Direct]: 'border-[#98df7c] bg-[#f2ffe9] text-[#2d7b0b]',
    [SdkDiagramAccessType.Inherited]:
      'border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] text-[rgb(var(--tabliodb-ink-muted))]',
    [SdkDiagramAccessType.Mixed]: 'border-[#88d8f7] bg-[#effbff] text-[#08729c]',
  }[accessType];
}

function formatDiagramRole(role: string): string {
  return {
    [SdkDiagramMemberRole.Commenter]: 'Commenter',
    [SdkDiagramMemberRole.Editor]: 'Editor',
    [SdkDiagramMemberRole.Owner]: 'Owner',
    [SdkDiagramMemberRole.Viewer]: 'Viewer',
  }[role as SdkDiagramMemberRole];
}

function formatAccessType(accessType: SdkDiagramAccessType): string {
  return {
    [SdkDiagramAccessType.Direct]: 'Direct',
    [SdkDiagramAccessType.Inherited]: 'Inherited',
    [SdkDiagramAccessType.Mixed]: 'Mixed',
  }[accessType];
}

function formatAccessSource(sourceType: SdkDiagramAccessSourceType, sourceLabel: string): string {
  if (sourceType === SdkDiagramAccessSourceType.WorkspaceDefault) {
    return 'Workspace default';
  }

  return sourceLabel;
}
