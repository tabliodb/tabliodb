import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { AccessRole, type AccessRoleValue } from '@tabliodb/shared';
import {
  Role7 as SdkFolderAccessOutputRole,
  Role8 as SdkFolderAssignableMemberRole,
  type FolderAccessDtoOutput,
  type FolderResponseDtoOutput,
} from '@tabliodb/sdk';
import {
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
  foldersQueries,
  useAddFolderAccessMutation,
  useArchiveFolderMutation,
  useRemoveFolderAccessMutation,
  useTransferFolderOwnershipMutation,
  useUpdateFolderAccessMutation,
  useUpdateFolderMutation,
} from '@/resources/folders';
import { selectClassName } from '../editor-form-styles';
import { UserAvatar } from './UserAvatar';

type FolderAccessDto = FolderAccessDtoOutput;
type FolderResponseDto = FolderResponseDtoOutput;
type FolderAssignableRole = AccessRole.Editor | AccessRole.Commenter | AccessRole.Viewer;

const folderAssignableRoleOptions = [AccessRole.Editor, AccessRole.Commenter, AccessRole.Viewer] as const;
const folderAccessPageQuery = { limit: 50 } as const;

const sdkFolderAccessRoleByValue: Record<FolderAssignableRole, SdkFolderAssignableMemberRole> = {
  [AccessRole.Commenter]: SdkFolderAssignableMemberRole.Commenter,
  [AccessRole.Editor]: SdkFolderAssignableMemberRole.Editor,
  [AccessRole.Viewer]: SdkFolderAssignableMemberRole.Viewer,
};

const folderFormSchema = z.object({
  description: z.string().trim().max(240, 'Keep the description under 240 characters.').optional(),
  name: z.string().trim().min(1, 'Folder name is required.').max(80, 'Keep the name under 80 characters.'),
});

type FolderFormState = z.infer<typeof folderFormSchema>;

const folderAccessFormSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
  role: z.enum(folderAssignableRoleOptions),
});

type FolderAccessFormState = z.infer<typeof folderAccessFormSchema>;

const folderAccessFormDefaults: FolderAccessFormState = {
  email: '',
  role: AccessRole.Viewer,
};

export function FolderSettingsDialog({
  currentUserId,
  onArchived,
  onOpenChange,
  open,
  folder,
  trigger,
}: {
  currentUserId: string;
  onArchived: () => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  folder: FolderResponseDto;
  trigger?: ReactNode | null;
}) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmTransferUserId, setConfirmTransferUserId] = useState<string | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [transferringUserId, setTransferringUserId] = useState<string | null>(null);
  const dialogOpen = open ?? internalOpen;
  const form = useForm<FolderFormState>({
    defaultValues: getFolderFormDefaults(folder),
    mode: 'onBlur',
    resolver: zodResolver(folderFormSchema),
  });
  const folderAccessForm = useForm<FolderAccessFormState>({
    defaultValues: folderAccessFormDefaults,
    mode: 'onBlur',
    resolver: zodResolver(folderAccessFormSchema),
  });
  const { errors } = form.formState;
  const { errors: folderAccessErrors } = folderAccessForm.formState;
  const folderAccessQueryOptions = foldersQueries.access(folder.id, folderAccessPageQuery);
  const folderAccessQuery = useQuery({
    ...folderAccessQueryOptions,
    // Folder access list hanya dibutuhkan saat modal terbuka, jadi settings dialog menjadi fetch boundary.
    enabled: dialogOpen && folderAccessQueryOptions.enabled !== false,
  });
  const folderAccessEntries = folderAccessQuery.data?.items ?? [];

  useEffect(() => {
    if (dialogOpen) {
      // Saat settings dibuka, form selalu mengikuti folder terbaru dari query cache parent.
      form.reset(getFolderFormDefaults(folder));
      folderAccessForm.reset(folderAccessFormDefaults);
      setConfirmArchive(false);
    }
  }, [dialogOpen, form, folderAccessForm, folder]);

  const updateFolderMutation = useUpdateFolderMutation({
    mutationConfig: {
      onSuccess: () => {
        setDialogOpen(false);
      },
    },
  });
  const archiveFolderMutation = useArchiveFolderMutation({
    mutationConfig: {
      onSuccess: () => {
        setDialogOpen(false);
        onArchived();
      },
    },
  });
  const addFolderAccessMutation = useAddFolderAccessMutation({
    mutationConfig: {
      onSuccess: () => {
        // Role tetap viewer setelah add agar invite aman berulang cepat, tetapi email yang sudah dipakai dibersihkan.
        folderAccessForm.reset(folderAccessFormDefaults);
      },
    },
  });
  const updateFolderAccessMutation = useUpdateFolderAccessMutation();
  const transferFolderOwnershipMutation = useTransferFolderOwnershipMutation();
  const removeFolderAccessMutation = useRemoveFolderAccessMutation();
  const isFolderMutationPending = updateFolderMutation.isPending || archiveFolderMutation.isPending;
  const isFolderAccessMutationPending =
    addFolderAccessMutation.isPending ||
    updateFolderAccessMutation.isPending ||
    transferFolderOwnershipMutation.isPending ||
    removeFolderAccessMutation.isPending;

  function setDialogOpen(nextOpen: boolean) {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && (isFolderMutationPending || isFolderAccessMutationPending)) {
      return;
    }

    setDialogOpen(nextOpen);

    if (!nextOpen) {
      form.reset(getFolderFormDefaults(folder));
      folderAccessForm.reset(folderAccessFormDefaults);
      setConfirmArchive(false);
      updateFolderMutation.reset();
      archiveFolderMutation.reset();
      addFolderAccessMutation.reset();
      updateFolderAccessMutation.reset();
      transferFolderOwnershipMutation.reset();
      removeFolderAccessMutation.reset();
      setConfirmTransferUserId(null);
      setTransferringUserId(null);
    }
  }

  function handleSubmit(values: FolderFormState) {
    updateFolderMutation.mutate({
      body: {
        description: toOptionalDescription(values.description) ?? null,
        name: values.name,
      },
      folderId: folder.id,
    });
  }

  function handleArchive() {
    if (!confirmArchive) {
      setConfirmArchive(true);
      return;
    }

    archiveFolderMutation.mutate({ organizationId: folder.organizationId, folderId: folder.id });
  }

  function handleAddFolderAccess(values: FolderAccessFormState) {
    addFolderAccessMutation.mutate({
      body: {
        email: values.email,
        role: sdkFolderAccessRoleByValue[values.role],
      },
      organizationId: folder.organizationId,
      folderId: folder.id,
    });
  }

  function handleUpdateFolderAccessRole(access: FolderAccessDto, role: FolderAssignableRole) {
    if (toAccessRoleValue(access.role) === role) {
      return;
    }

    setConfirmTransferUserId(null);
    updateFolderAccessMutation.mutate({
      body: { role: sdkFolderAccessRoleByValue[role] },
      folderId: folder.id,
      userId: access.userId,
    });
  }

  function handleTransferOwnership(access: FolderAccessDto) {
    if (confirmTransferUserId !== access.userId) {
      // Folder ownership memakai aksi dua langkah agar user sadar bahwa Owner lama akan otomatis turun menjadi Editor.
      setConfirmTransferUserId(access.userId);
      return;
    }

    setTransferringUserId(access.userId);
    transferFolderOwnershipMutation.mutate(
      {
        body: { userId: access.userId },
        folderId: folder.id,
      },
      {
        onSettled: () => {
          setConfirmTransferUserId(null);
          setTransferringUserId(null);
        },
      },
    );
  }

  function handleRemoveFolderAccess(access: FolderAccessDto) {
    setConfirmTransferUserId(null);
    removeFolderAccessMutation.mutate({
      folderId: folder.id,
      userId: access.userId,
    });
  }

  const mutationError = updateFolderMutation.error ?? archiveFolderMutation.error;
  const folderAccessMutationError =
    addFolderAccessMutation.error ??
    updateFolderAccessMutation.error ??
    transferFolderOwnershipMutation.error ??
    removeFolderAccessMutation.error;
  const updatingUserId = updateFolderAccessMutation.isPending ? updateFolderAccessMutation.variables?.userId : null;
  const removingUserId = removeFolderAccessMutation.isPending ? removeFolderAccessMutation.variables?.userId : null;

  return (
    <Dialog onOpenChange={handleOpenChange} open={dialogOpen}>
      {trigger !== null ? (
        <DialogTrigger asChild>
          {trigger ?? <IconButton icon={Settings} label="Folder settings" variant="ghost" />}
        </DialogTrigger>
      ) : null}
      <DialogContent className="w-[min(94vw,680px)]">
        <DialogHeader>
          <DialogTitle>Folder</DialogTitle>
          <DialogDescription>Details and access inherited by diagrams in this folder.</DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-5">
          <form
            className="grid gap-4 rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border))] bg-white p-4"
            id="folder-settings-form"
            onSubmit={form.handleSubmit(handleSubmit)}
          >
            <h3 className="text-sm font-black">Details</h3>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Folder name
              </span>
              <ControlledInput
                aria-invalid={Boolean(errors.name)}
                control={form.control}
                disabled={isFolderMutationPending}
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
                disabled={isFolderMutationPending}
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

          <section className="rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border))] bg-white">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="p-4 pb-0">
                <h3 className="flex items-center gap-2 text-sm font-extrabold">
                  <UsersRound className="size-4 text-[rgb(var(--tabliodb-sky-text))]" />
                  Folder access
                </h3>
                <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                  {folderAccessQuery.data?.totalCount ?? folderAccessEntries.length} people
                </p>
              </div>
            </div>

            <form
              className="m-4 grid gap-3 rounded-[var(--tabliodb-radius-md)] bg-[rgb(var(--tabliodb-surface))] p-3 sm:grid-cols-[minmax(0,1fr)_160px_auto]"
              onSubmit={folderAccessForm.handleSubmit(handleAddFolderAccess)}
            >
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Email
                </span>
                <ControlledInput
                  aria-invalid={Boolean(folderAccessErrors.email)}
                  autoComplete="email"
                  control={folderAccessForm.control}
                  disabled={isFolderAccessMutationPending}
                  name="email"
                  placeholder="teammate@example.com"
                  type="email"
                />
                <FieldError>{folderAccessErrors.email?.message}</FieldError>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Role
                </span>
                <ControlledSelect
                  className={selectClassName}
                  control={folderAccessForm.control}
                  disabled={isFolderAccessMutationPending}
                  name="role"
                  options={folderAssignableRoleOptions.map((role) => ({
                    label: formatAccessRole(role),
                    value: role,
                  }))}
                />
              </label>
              <Button className="self-start sm:mt-6" disabled={isFolderAccessMutationPending} type="submit">
                {addFolderAccessMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                Add access
              </Button>
            </form>

            {folderAccessQuery.isPending ? (
              <div className="m-4 flex items-center gap-2 rounded-2xl border-2 border-[rgb(var(--tabliodb-border))] bg-white p-4 text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                <Loader2 className="size-4 animate-spin" />
                Loading access
              </div>
            ) : folderAccessQuery.error ? (
              <div className="m-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                {getErrorMessage(folderAccessQuery.error)}
              </div>
            ) : folderAccessEntries.length === 0 ? (
              <div className="m-4 rounded-2xl border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-4 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                No direct folder access yet
              </div>
            ) : (
              <div className="tabliodb-scrollbar max-h-72 overflow-y-auto border-t border-[rgb(var(--tabliodb-border))]">
                <div className="divide-y divide-[rgb(var(--tabliodb-border))]">
                  {folderAccessEntries.map((access) => (
                    <FolderAccessRow
                      access={access}
                      confirmTransfer={confirmTransferUserId === access.userId}
                      currentUserId={currentUserId}
                      isRemoving={removingUserId === access.userId}
                      isTransferring={transferringUserId === access.userId}
                      isUpdating={updatingUserId === access.userId}
                      key={access.userId}
                      onRemove={handleRemoveFolderAccess}
                      onRoleChange={handleUpdateFolderAccessRole}
                      onTransferOwnership={handleTransferOwnership}
                    />
                  ))}
                </div>
              </div>
            )}

            {folderAccessMutationError ? (
              <div className="m-4 rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                {getErrorMessage(folderAccessMutationError)}
              </div>
            ) : null}
          </section>
        </DialogBody>

        <DialogFooter className="justify-between sm:justify-between">
          <Button
            disabled={isFolderMutationPending || isFolderAccessMutationPending}
            onClick={handleArchive}
            variant={confirmArchive ? 'danger' : 'secondary'}
          >
            {archiveFolderMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Archive className="size-4" />
            )}
            {confirmArchive ? 'Confirm archive' : 'Archive folder'}
          </Button>
          <div className="flex gap-2">
            <Button
              disabled={isFolderMutationPending || isFolderAccessMutationPending}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              disabled={isFolderMutationPending || isFolderAccessMutationPending}
              form="folder-settings-form"
              type="submit"
            >
              {updateFolderMutation.isPending ? (
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

function FolderAccessRow({
  access,
  confirmTransfer,
  currentUserId,
  isRemoving,
  isTransferring,
  isUpdating,
  onRemove,
  onRoleChange,
  onTransferOwnership,
}: {
  access: FolderAccessDto;
  confirmTransfer: boolean;
  currentUserId: string;
  isRemoving: boolean;
  isTransferring: boolean;
  isUpdating: boolean;
  onRemove: (access: FolderAccessDto) => void;
  onRoleChange: (access: FolderAccessDto, role: FolderAssignableRole) => void;
  onTransferOwnership: (access: FolderAccessDto) => void;
}) {
  const isBusy = isRemoving || isTransferring || isUpdating;
  const isSelf = access.userId === currentUserId;
  const normalizedRole = toAccessRoleValue(access.role);
  const isOwner = normalizedRole === AccessRole.Owner;
  const canEditRole = !isOwner && !isSelf;
  const canRemove = !isOwner && !isSelf;
  const canTransferOwnership = !isSelf && !isOwner;

  return (
    <article className="grid gap-3 p-3 transition hover:bg-[rgb(var(--tabliodb-surface))] sm:grid-cols-[minmax(0,1fr)_230px_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar className="size-10 rounded-[14px] text-xs" user={access} />
        <div className="min-w-0">
          <h4 className="min-w-0 max-w-full truncate text-sm font-extrabold">{access.name}</h4>
          <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">{access.email}</p>
        </div>
      </div>
      {!canEditRole ? (
        <div className="text-left sm:text-right">
          <div className="text-sm font-extrabold text-[rgb(var(--tabliodb-ink))]">
            {formatAccessRole(normalizedRole)}
          </div>
          <div className="text-[11px] font-bold text-[rgb(var(--tabliodb-ink-muted))]">
            {isSelf ? 'Your access' : 'Owner transfer only'}
          </div>
        </div>
      ) : (
        <Select
          className={selectClassName}
          disabled={isBusy}
          onValueChange={(role) => onRoleChange(access, role as FolderAssignableRole)}
          options={folderAssignableRoleOptions.map((role) => ({
            label: formatAccessRole(role),
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
                ? `Click again to transfer folder ownership to ${access.name}`
                : `Transfer folder ownership to ${access.name}`
            }
          >
            <Button
              aria-label={
                confirmTransfer
                  ? `Confirm transfer folder ownership to ${access.name}`
                  : `Transfer folder ownership to ${access.name}`
              }
              className={cn(confirmTransfer && 'border-[rgb(var(--tabliodb-red))] text-[rgb(var(--tabliodb-red))]')}
              disabled={isBusy}
              onClick={() => onTransferOwnership(access)}
              size="sm"
              type="button"
              variant={confirmTransfer ? 'secondary' : 'soft'}
            >
              {isTransferring ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
              {confirmTransfer ? 'Confirm transfer' : 'Transfer ownership'}
            </Button>
          </WithTooltip>
        ) : null}
        {canRemove ? (
          <WithTooltip content={`Remove ${access.name} from this folder`}>
            <Button
              aria-label={`Remove ${access.name}`}
              disabled={isBusy}
              onClick={() => onRemove(access)}
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

function formatAccessRole(role: AccessRoleValue): string {
  return {
    [AccessRole.Commenter]: 'Commenter',
    [AccessRole.Editor]: 'Editor',
    [AccessRole.Owner]: 'Owner',
    [AccessRole.Viewer]: 'Viewer',
  }[role];
}

function getFolderFormDefaults(folder: FolderResponseDto): FolderFormState {
  return {
    description: folder.description ?? '',
    name: folder.name,
  };
}

function toAccessRoleValue(role: AccessRoleValue | SdkFolderAccessOutputRole): AccessRoleValue {
  // SDK generated enum dan shared permission enum memakai value string yang sama, tetapi cast eksplisit menjaga boundary tetap terlihat.
  return role as AccessRoleValue;
}

function toOptionalDescription(value: string | undefined): string | undefined {
  const description = value?.trim();
  return description ? description : undefined;
}
