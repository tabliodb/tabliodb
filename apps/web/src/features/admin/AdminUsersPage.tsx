import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  InstanceRole2,
  OrganizationRole as SdkOrganizationRole,
  type InvitationCreateResponseDtoOutput,
  type UserResponseDtoOutput,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparatorItem,
  DropdownMenuTrigger,
  FieldError,
  Input,
  Surface,
  WithTooltip,
  cn,
} from '@tabliodb/ui';
import {
  Copy,
  Crown,
  KeyRound,
  Loader2,
  MailPlus,
  MoreHorizontal,
  Plus,
  Power,
  RotateCcw,
  Search,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ControlledCheckbox, ControlledInput, ControlledTextarea } from '@/features/app/FormControls';
import { EmptyState, InlineErrorState, InlineLoadingState } from '@/features/app/RouteStates';
import { useCreateInvitationMutation } from '@/resources/invitations';
import {
  type UserListQuery,
  useCreateUserMutation,
  useResetUserPasswordMutation,
  useRevokeUserSessionsMutation,
  useUpdateUserStatusMutation,
  usersQueries,
} from '@/resources/users';

const createUserFormSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
  grantInstanceAdmin: z.boolean(),
  name: z.string().trim().min(1, 'Name is required.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

type CreateUserFormState = z.infer<typeof createUserFormSchema>;

const createUserDefaults: CreateUserFormState = {
  email: '',
  grantInstanceAdmin: false,
  name: '',
  password: '',
};

const inviteUserFormSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
  expiresInDays: z.number().int().min(1, 'Minimum 1 day.').max(30, 'Maximum 30 days.'),
  message: z.string().trim().max(500, 'Message is too long.').optional(),
  organizationRole: z.enum(SdkOrganizationRole),
});

type InviteUserFormState = z.infer<typeof inviteUserFormSchema>;

const inviteUserDefaults: InviteUserFormState = {
  email: '',
  expiresInDays: 7,
  message: '',
  organizationRole: SdkOrganizationRole.Member,
};
const resetPasswordFormSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

type ResetPasswordFormState = z.infer<typeof resetPasswordFormSchema>;

const resetPasswordDefaults: ResetPasswordFormState = {
  password: '',
};

const roleFilters = ['all', 'owner', 'instance-admin', 'org-admin', 'member'] as const;
type RoleFilter = (typeof roleFilters)[number];
const userPageSize = 20;

export function AdminUsersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [pageCursor, setPageCursor] = useState<string | undefined>();
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([]);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserResponseDtoOutput | null>(null);
  const userListQuery = useMemo<UserListQuery>(
    () => ({
      cursor: pageCursor,
      limit: userPageSize,
      role: roleFilter === 'all' ? undefined : roleFilter,
      search: searchTerm.trim() || undefined,
    }),
    [pageCursor, roleFilter, searchTerm],
  );
  const usersQuery = useQuery(usersQueries.list(userListQuery));
  const users = usersQuery.data?.items ?? [];
  const updateUserStatusMutation = useUpdateUserStatusMutation();
  const revokeUserSessionsMutation = useRevokeUserSessionsMutation();
  const userActionError = updateUserStatusMutation.error ?? revokeUserSessionsMutation.error;

  const stats = useMemo(
    () => ({
      active: users.filter((user) => !user.isDisabled).length,
      instanceAdmins: users.filter((user) => user.instanceRole === 'owner' || user.instanceRole === 'admin').length,
      organizationAdmins: users.filter((user) =>
        user.organizations.some((organization) => organization.role === SdkOrganizationRole.Admin),
      ).length,
      total: users.length,
    }),
    [users],
  );
  const totalCount = usersQuery.data?.totalCount ?? 0;
  const nextCursor = usersQuery.data?.nextCursor ?? null;

  function resetPagination() {
    // Search dan role filter mengubah dataset server, jadi cursor lama tidak boleh dipakai lagi.
    setPageCursor(undefined);
    setCursorHistory([]);
  }

  function handleToggleUserStatus(user: UserResponseDtoOutput) {
    updateUserStatusMutation.mutate({
      body: {
        isDisabled: !user.isDisabled,
      },
      userId: user.id,
    });
  }

  function handleRevokeUserSessions(user: UserResponseDtoOutput) {
    revokeUserSessionsMutation.mutate({ userId: user.id });
  }

  function isUserActionPending(userId: string): boolean {
    return (
      (updateUserStatusMutation.isPending && updateUserStatusMutation.variables?.userId === userId) ||
      (revokeUserSessionsMutation.isPending && revokeUserSessionsMutation.variables?.userId === userId)
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-normal text-[rgb(var(--tabliodb-ink))]">Manage users</h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
            Create instance accounts, review workspace access, and grant instance admin access.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <InviteUserDialog />
          <CreateUserDialog />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Matching users" value={totalCount} />
        <StatCard label="Showing now" value={stats.total} tone="green" />
        <StatCard label="Instance admins on page" value={stats.instanceAdmins} tone="blue" />
        <StatCard label="Workspace admins on page" value={stats.organizationAdmins} tone="yellow" />
      </section>

      {userActionError ? <InlineErrorState error={userActionError} title="User action failed" /> : null}

      <Surface className="overflow-hidden" depth="md">
        <div className="flex flex-col gap-3 border-b-2 border-[rgb(var(--tabliodb-border))] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--tabliodb-ink-subtle))]" />
            <Input
              className="pl-9"
              onChange={(event) => {
                setSearchTerm(event.target.value);
                resetPagination();
              }}
              placeholder="Search users"
              value={searchTerm}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {roleFilters.map((filter) => (
              <button
                className={cn(
                  'h-9 cursor-pointer rounded-full border-2 px-3 text-xs font-extrabold transition',
                  roleFilter === filter
                    ? 'border-[rgb(var(--tabliodb-primary))] bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]'
                    : 'border-[rgb(var(--tabliodb-border))] bg-white text-[rgb(var(--tabliodb-ink-muted))] hover:bg-[rgb(var(--tabliodb-surface))]',
                )}
                key={filter}
                onClick={() => {
                  setRoleFilter(filter);
                  resetPagination();
                }}
                type="button"
              >
                {formatRoleFilter(filter)}
              </button>
            ))}
          </div>
        </div>

        {usersQuery.isPending ? (
          <InlineLoadingState className="m-4" message="Loading users" />
        ) : usersQuery.error ? (
          <InlineErrorState
            className="m-4"
            error={usersQuery.error}
            onRetry={() => void usersQuery.refetch()}
            title="Could not load users"
          />
        ) : users.length === 0 ? (
          <EmptyState
            description={
              searchTerm.trim() || roleFilter !== 'all'
                ? 'Try clearing the search or choosing another role filter.'
                : 'Create a teammate or send an invite to start collaborating.'
            }
            icon={UsersRound}
            title="No users found"
          />
        ) : (
          <div className="divide-y divide-[rgb(var(--tabliodb-border))]">
            {users.map((user) => (
              <UserRow
                isBusy={isUserActionPending(user.id)}
                key={user.id}
                onResetPassword={setResetPasswordUser}
                onRevokeSessions={handleRevokeUserSessions}
                onToggleStatus={handleToggleUserStatus}
                user={user}
              />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t-2 border-[rgb(var(--tabliodb-border))] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
            Showing {users.length} of {totalCount} matching users
          </p>
          <div className="flex gap-2">
            <Button
              disabled={cursorHistory.length === 0 || usersQuery.isFetching}
              onClick={() => {
                const previousCursor = cursorHistory[cursorHistory.length - 1];
                setCursorHistory((history) => history.slice(0, -1));
                setPageCursor(previousCursor);
              }}
              size="sm"
              variant="secondary"
            >
              Previous
            </Button>
            <Button
              disabled={!nextCursor || usersQuery.isFetching}
              onClick={() => {
                setCursorHistory((history) => [...history, pageCursor]);
                setPageCursor(nextCursor ?? undefined);
              }}
              size="sm"
            >
              Next
            </Button>
          </div>
        </div>
      </Surface>

      <ResetUserPasswordDialog
        onOpenChange={(open) => {
          if (!open) {
            setResetPasswordUser(null);
          }
        }}
        user={resetPasswordUser}
      />
    </div>
  );
}

function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<InvitationCreateResponseDtoOutput | null>(null);
  const form = useForm<InviteUserFormState>({
    defaultValues: inviteUserDefaults,
    mode: 'onBlur',
    resolver: zodResolver(inviteUserFormSchema),
  });
  const { errors } = form.formState;

  const createInvitationMutation = useCreateInvitationMutation({
    mutationConfig: {
      onSuccess: (data) => {
        // Token mentah hanya dikirim sekali oleh API; dialog sengaja tetap terbuka agar admin bisa menyalin link sebelum reset.
        setCreatedInvite(data);
      },
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen && !createInvitationMutation.isPending) {
      form.reset(inviteUserDefaults);
      setCreatedInvite(null);
      createInvitationMutation.reset();
    }
  }

  function handleSubmit(values: InviteUserFormState) {
    createInvitationMutation.mutate({
      email: values.email,
      expiresInDays: values.expiresInDays,
      message: values.message?.trim() || undefined,
      organizationRole: values.organizationRole,
    });
  }

  async function copyAcceptUrl() {
    if (createdInvite?.acceptUrl) {
      await navigator.clipboard.writeText(createdInvite.acceptUrl);
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button className="gap-2" variant="secondary">
          <MailPlus className="size-4" />
          Invite user
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(94vw,560px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
            <DialogDescription>Create a one-time invitation link for a new teammate.</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="grid gap-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Email
                </span>
                <ControlledInput
                  aria-invalid={Boolean(errors.email)}
                  autoComplete="email"
                  control={form.control}
                  disabled={createInvitationMutation.isPending}
                  name="email"
                  type="email"
                />
                <FieldError>{errors.email?.message}</FieldError>
              </label>

              <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                <fieldset>
                  <legend className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                    Workspace role
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <RoleOption
                      checked={form.watch('organizationRole') === SdkOrganizationRole.Member}
                      description="Can join workspace projects."
                      label="Member"
                      onClick={() =>
                        form.setValue('organizationRole', SdkOrganizationRole.Member, { shouldDirty: true })
                      }
                    />
                    <RoleOption
                      checked={form.watch('organizationRole') === SdkOrganizationRole.Admin}
                      description="Can help manage users."
                      label="Admin"
                      onClick={() =>
                        form.setValue('organizationRole', SdkOrganizationRole.Admin, { shouldDirty: true })
                      }
                    />
                  </div>
                </fieldset>
                <label className="block text-sm">
                  <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                    Expires
                  </span>
                  <ControlledInput
                    aria-invalid={Boolean(errors.expiresInDays)}
                    control={form.control}
                    disabled={createInvitationMutation.isPending}
                    max={30}
                    min={1}
                    name="expiresInDays"
                    type="number"
                  />
                  <FieldError>{errors.expiresInDays?.message}</FieldError>
                </label>
              </div>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Message
                </span>
                <ControlledTextarea
                  aria-invalid={Boolean(errors.message)}
                  className="min-h-24 w-full resize-none rounded-2xl border-2 border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 py-2 text-sm font-semibold outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
                  control={form.control}
                  disabled={createInvitationMutation.isPending}
                  name="message"
                />
                <FieldError>{errors.message?.message}</FieldError>
              </label>

              {createdInvite ? (
                <div className="rounded-2xl border-2 border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] p-3">
                  <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-primary-text))]">
                    Invitation link
                  </div>
                  <div className="flex gap-2">
                    <Input readOnly value={createdInvite.acceptUrl} />
                    <Button className="shrink-0 gap-2" onClick={copyAcceptUrl} type="button" variant="secondary">
                      <Copy className="size-4" />
                      Copy
                    </Button>
                  </div>
                </div>
              ) : null}

              {createInvitationMutation.error ? (
                <InlineErrorState error={createInvitationMutation.error} title="Could not create invitation" />
              ) : null}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              disabled={createInvitationMutation.isPending}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="secondary"
            >
              Close
            </Button>
            <Button disabled={createInvitationMutation.isPending} type="submit">
              {createInvitationMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MailPlus className="size-4" />
              )}
              Create invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const form = useForm<CreateUserFormState>({
    defaultValues: createUserDefaults,
    mode: 'onBlur',
    resolver: zodResolver(createUserFormSchema),
  });
  const { errors } = form.formState;

  const createUserMutation = useCreateUserMutation({
    mutationConfig: {
      onSuccess: () => {
        // Success menutup dialog dan reset form agar submit berikutnya selalu mulai dari state bersih.
        form.reset(createUserDefaults);
        setOpen(false);
      },
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen && !createUserMutation.isPending) {
      form.reset(createUserDefaults);
      createUserMutation.reset();
    }
  }

  function handleSubmit(values: CreateUserFormState) {
    createUserMutation.mutate({
      email: values.email,
      instanceRole: values.grantInstanceAdmin ? InstanceRole2.Admin : undefined,
      name: values.name,
      password: values.password,
    });
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="size-4" />
          Add user
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(94vw,560px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
            <DialogDescription>Create an instance account. Workspace access is assigned separately.</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                    Name
                  </span>
                  <ControlledInput
                    aria-invalid={Boolean(errors.name)}
                    autoComplete="name"
                    control={form.control}
                    disabled={createUserMutation.isPending}
                    name="name"
                  />
                  <FieldError>{errors.name?.message}</FieldError>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                    Email
                  </span>
                  <ControlledInput
                    aria-invalid={Boolean(errors.email)}
                    autoComplete="email"
                    control={form.control}
                    disabled={createUserMutation.isPending}
                    name="email"
                    type="email"
                  />
                  <FieldError>{errors.email?.message}</FieldError>
                </label>
              </div>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Temporary password
                </span>
                <ControlledInput
                  aria-invalid={Boolean(errors.password)}
                  autoComplete="new-password"
                  control={form.control}
                  disabled={createUserMutation.isPending}
                  name="password"
                  type="password"
                />
                <FieldError>{errors.password?.message}</FieldError>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white p-3 text-sm font-extrabold transition hover:bg-[rgb(var(--tabliodb-surface))]">
                <ControlledCheckbox
                  control={form.control}
                  disabled={createUserMutation.isPending}
                  name="grantInstanceAdmin"
                />
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <ShieldCheck className="size-4 text-[rgb(var(--tabliodb-sky-text))]" />
                  Instance admin
                </span>
              </label>

              {createUserMutation.error ? (
                <InlineErrorState error={createUserMutation.error} title="Could not create user" />
              ) : null}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              disabled={createUserMutation.isPending}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button disabled={createUserMutation.isPending} type="submit">
              {createUserMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetUserPasswordDialog({
  onOpenChange,
  user,
}: {
  onOpenChange: (open: boolean) => void;
  user: UserResponseDtoOutput | null;
}) {
  const form = useForm<ResetPasswordFormState>({
    defaultValues: resetPasswordDefaults,
    mode: 'onBlur',
    resolver: zodResolver(resetPasswordFormSchema),
  });
  const { errors } = form.formState;
  const resetPasswordMutation = useResetUserPasswordMutation({
    mutationConfig: {
      onSuccess: () => {
        // Password reset sengaja menutup dialog setelah server merevoke session target agar admin tidak mengulang submit.
        form.reset(resetPasswordDefaults);
        onOpenChange(false);
      },
    },
  });
  const open = Boolean(user);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !resetPasswordMutation.isPending) {
      form.reset(resetPasswordDefaults);
      resetPasswordMutation.reset();
    }

    onOpenChange(nextOpen);
  }

  function handleSubmit(values: ResetPasswordFormState) {
    if (!user) {
      return;
    }

    resetPasswordMutation.mutate({
      body: {
        password: values.password,
      },
      userId: user.id,
    });
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="w-[min(94vw,520px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new temporary password for {user?.name ?? 'this user'}. Active sessions will be revoked.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="grid gap-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  New password
                </span>
                <ControlledInput
                  aria-invalid={Boolean(errors.password)}
                  autoComplete="new-password"
                  control={form.control}
                  disabled={resetPasswordMutation.isPending}
                  name="password"
                  type="password"
                />
                <FieldError>{errors.password?.message}</FieldError>
              </label>

              {resetPasswordMutation.error ? (
                <InlineErrorState error={resetPasswordMutation.error} title="Could not reset password" />
              ) : null}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              disabled={resetPasswordMutation.isPending}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button disabled={resetPasswordMutation.isPending || !user} type="submit" variant="sky">
              {resetPasswordMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}
              Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RoleOption({
  checked,
  description,
  label,
  onClick,
}: {
  checked: boolean;
  description: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        'cursor-pointer rounded-2xl border-2 p-3 text-left transition',
        checked
          ? 'border-[rgb(var(--tabliodb-primary))] bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]'
          : 'border-[rgb(var(--tabliodb-border))] bg-white hover:bg-[rgb(var(--tabliodb-surface))]',
      )}
      onClick={onClick}
      type="button"
    >
      <div className="text-sm font-extrabold">{label}</div>
      <div className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">{description}</div>
    </button>
  );
}

function UserRow({
  isBusy,
  onResetPassword,
  onRevokeSessions,
  onToggleStatus,
  user,
}: {
  isBusy: boolean;
  onResetPassword: (user: UserResponseDtoOutput) => void;
  onRevokeSessions: (user: UserResponseDtoOutput) => void;
  onToggleStatus: (user: UserResponseDtoOutput) => void;
  user: UserResponseDtoOutput;
}) {
  const bucket = getUserRoleBucket(user);

  return (
    <article className="grid gap-3 p-4 transition hover:bg-[rgb(var(--tabliodb-surface))] lg:grid-cols-[minmax(0,1.2fr)_minmax(180px,0.8fr)_auto_auto] lg:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar user={user} />
        <div className="min-w-0">
          <h3 className="truncate text-sm font-extrabold">{user.name}</h3>
          <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">{user.email}</p>
        </div>
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          {formatOrganizations(user)}
        </p>
        <p className="mt-1 truncate text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
          Joined {formatDate(user.createdAt)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <RoleBadge bucket={bucket} />
        {user.isDisabled ? <Badge>Disabled</Badge> : <Badge variant="green">Active</Badge>}
      </div>
      <div className="flex justify-start lg:justify-end">
        <DropdownMenu>
          <WithTooltip content={`Manage ${user.name}: password, sessions, and account status`}>
            <DropdownMenuTrigger asChild>
              <Button aria-label={`Manage ${user.name}`} disabled={isBusy} size="icon" variant="secondary">
                {isBusy ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
              </Button>
            </DropdownMenuTrigger>
          </WithTooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={isBusy} onSelect={() => onResetPassword(user)}>
              <KeyRound className="size-4" />
              Reset password
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isBusy} onSelect={() => onRevokeSessions(user)}>
              <RotateCcw className="size-4" />
              Revoke sessions
            </DropdownMenuItem>
            <DropdownMenuSeparatorItem />
            <DropdownMenuItem
              className={user.isDisabled ? undefined : 'text-[rgb(var(--tabliodb-danger-text))]'}
              disabled={isBusy}
              onSelect={() => onToggleStatus(user)}
            >
              <Power className="size-4" />
              {user.isDisabled ? 'Enable user' : 'Disable user'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}

function RoleBadge({ bucket }: { bucket: RoleFilter }) {
  if (bucket === 'owner') {
    return (
      <Badge variant="yellow">
        <Crown className="mr-1 size-3" />
        Owner
      </Badge>
    );
  }

  if (bucket === 'instance-admin') {
    return (
      <Badge variant="blue">
        <ShieldCheck className="mr-1 size-3" />
        Instance admin
      </Badge>
    );
  }

  if (bucket === 'org-admin') {
    return <Badge variant="blue">Org admin</Badge>;
  }

  return <Badge>Member</Badge>;
}

function StatCard({
  label,
  tone = 'neutral',
  value,
}: {
  label: string;
  tone?: 'blue' | 'green' | 'neutral' | 'yellow';
  value: number;
}) {
  const toneClassName = {
    blue: 'border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky-soft))] text-[rgb(var(--tabliodb-sky-text))]',
    green:
      'border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]',
    neutral: 'border-[rgb(var(--tabliodb-border-strong))] bg-white text-[rgb(var(--tabliodb-ink))]',
    yellow:
      'border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] text-[rgb(var(--tabliodb-gold-text))]',
  }[tone];

  return (
    <Surface className={cn('p-4', toneClassName)} depth="sm">
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="mt-1 text-xs font-extrabold uppercase tracking-wide opacity-75">{label}</div>
    </Surface>
  );
}

function getUserRoleBucket(user: UserResponseDtoOutput): RoleFilter {
  if (user.instanceRole === 'owner') {
    return 'owner';
  }

  if (user.instanceRole === 'admin') {
    return 'instance-admin';
  }

  if (user.organizations.some((organization) => organization.role === SdkOrganizationRole.Admin)) {
    return 'org-admin';
  }

  return 'member';
}

function formatRoleFilter(filter: RoleFilter): string {
  return {
    all: 'All',
    member: 'Members',
    owner: 'Owners',
    'instance-admin': 'Instance admins',
    'org-admin': 'Org admins',
  }[filter];
}

function formatOrganizations(user: UserResponseDtoOutput): string {
  if (user.organizations.length === 0) {
    return 'No workspace';
  }

  return user.organizations.map((organization) => organization.name).join(', ');
}

function UserAvatar({ user }: { user: Pick<UserResponseDtoOutput, 'avatarUrl' | 'name'> }) {
  return (
    <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] text-sm font-extrabold text-[rgb(var(--tabliodb-primary-text))]">
      {user.avatarUrl ? <img alt="" className="size-full object-cover" src={user.avatarUrl} /> : getInitials(user.name)}
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}
