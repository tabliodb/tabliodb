import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, FieldError, Input, Surface, cn } from '@tabliodb/ui';
import { Camera, Check, ImageUp, Loader2, Palette, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ControlledInput } from '@/features/app/FormControls';
import { ErrorState, InlineErrorState, LoadingState } from '@/features/app/RouteStates';
import {
  authQueries,
  useDeleteAvatarMutation,
  useUpdateProfileMutation,
  useUploadAvatarMutation,
} from '@/resources/auth';

const cursorColorOptions = [
  { label: 'Green', value: '#58cc02' },
  { label: 'Sky', value: '#1cb0f6' },
  { label: 'Gold', value: '#ffc800' },
  { label: 'Coral', value: '#ff6b6b' },
  { label: 'Lavender', value: '#8b5cf6' },
  { label: 'Teal', value: '#009991' },
] as const;

const profileFormSchema = z.object({
  avatarFile: z.custom<File | null>().nullable(),
  cursorColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a valid hex color.'),
  name: z.string().trim().min(1, 'Name is required.').max(120, 'Name is too long.'),
});

type ProfileFormState = z.infer<typeof profileFormSchema>;

export function ProfilePage() {
  const currentUserQuery = useQuery(authQueries.me());
  const updateProfileMutation = useUpdateProfileMutation();
  const uploadAvatarMutation = useUploadAvatarMutation();
  const deleteAvatarMutation = useDeleteAvatarMutation();
  const [avatarInputKey, setAvatarInputKey] = useState(0);
  const [saved, setSaved] = useState(false);
  const form = useForm<ProfileFormState>({
    defaultValues: {
      avatarFile: null,
      cursorColor: '#58cc02',
      name: '',
    },
    mode: 'onBlur',
    resolver: zodResolver(profileFormSchema),
  });
  const currentUser = currentUserQuery.data;
  const avatarFile = form.watch('avatarFile');
  const watchedName = form.watch('name');
  const selectedColor = form.watch('cursorColor');
  const avatarPreviewUrl = useAvatarPreviewUrl(avatarFile);
  const isPending = updateProfileMutation.isPending || uploadAvatarMutation.isPending || deleteAvatarMutation.isPending;
  const hasProfileChanges = currentUser
    ? watchedName.trim() !== currentUser.name || selectedColor.toLowerCase() !== currentUser.cursorColor
    : false;
  const canSave = Boolean(avatarFile) || hasProfileChanges;
  const mutationError = updateProfileMutation.error ?? uploadAvatarMutation.error ?? deleteAvatarMutation.error;

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    form.reset({
      avatarFile: null,
      cursorColor: currentUser.cursorColor,
      name: currentUser.name,
    });
    setAvatarInputKey((value) => value + 1);
  }, [currentUser, form]);

  useEffect(() => {
    if (!saved) {
      return;
    }

    const timeoutId = window.setTimeout(() => setSaved(false), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [saved]);

  async function handleSubmit(values: ProfileFormState) {
    if (!currentUser) {
      return;
    }

    let savedUser = currentUser;
    const normalizedCursorColor = values.cursorColor.toLowerCase();
    const normalizedName = values.name.trim();

    if (normalizedName !== currentUser.name || normalizedCursorColor !== currentUser.cursorColor) {
      savedUser = await updateProfileMutation.mutateAsync({
        cursorColor: normalizedCursorColor,
        name: normalizedName,
      });
    }

    if (values.avatarFile) {
      savedUser = await uploadAvatarMutation.mutateAsync(values.avatarFile);
    }

    form.reset({
      avatarFile: null,
      cursorColor: savedUser.cursorColor,
      name: savedUser.name,
    });
    setAvatarInputKey((value) => value + 1);
    setSaved(true);
  }

  async function handleDeleteAvatar() {
    const user = await deleteAvatarMutation.mutateAsync(undefined);

    form.reset({
      avatarFile: null,
      cursorColor: user.cursorColor,
      name: user.name,
    });
    setAvatarInputKey((value) => value + 1);
    setSaved(true);
  }

  if (currentUserQuery.isPending) {
    return <LoadingState message="Loading profile" />;
  }

  if (currentUserQuery.error || !currentUser) {
    return <ErrorState error={currentUserQuery.error} onRetry={() => void currentUserQuery.refetch()} />;
  }

  const displayedAvatarUrl = avatarPreviewUrl ?? currentUser.avatarUrl;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 px-5 py-5">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-normal text-[rgb(var(--tabliodb-ink))]">Profile</h1>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
            Manage your visible identity and realtime collaboration cursor.
          </p>
        </div>
        <Badge variant={saved ? 'green' : 'blue'}>{saved ? 'Saved' : 'Ready'}</Badge>
      </section>

      <form className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]" onSubmit={form.handleSubmit(handleSubmit)}>
        <Surface className="grid gap-4 p-4" depth="md">
          <div className="flex items-center gap-3">
            <div
              className="grid size-20 place-items-center overflow-hidden rounded-[24px] border-4 border-white text-xl font-extrabold text-white shadow-[0_4px_0_rgb(var(--tabliodb-border-strong)),var(--tabliodb-shadow-panel)]"
              style={{ backgroundColor: selectedColor }}
            >
              {displayedAvatarUrl ? (
                <img alt="" className="size-full object-cover" src={displayedAvatarUrl} />
              ) : (
                getInitials(currentUser.name)
              )}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-extrabold">{currentUser.name}</h2>
              <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">{currentUser.email}</p>
            </div>
          </div>

          <Controller
            control={form.control}
            name="avatarFile"
            render={({ field }) => (
              <label
                className={cn(
                  'grid cursor-pointer gap-2 rounded-[var(--tabliodb-radius-lg)] border-2 border-dashed border-[rgb(var(--tabliodb-border-strong))] bg-[rgb(var(--tabliodb-surface))] p-4 text-center transition hover:border-[rgb(var(--tabliodb-sky))] hover:bg-[rgb(var(--tabliodb-sky-soft))]',
                  isPending && 'cursor-not-allowed opacity-60',
                )}
              >
                <span className="mx-auto grid size-10 place-items-center rounded-[14px] bg-[rgb(var(--tabliodb-sky-soft))] text-[rgb(var(--tabliodb-sky-text))]">
                  <ImageUp className="size-5" />
                </span>
                <span className="text-sm font-extrabold">{avatarFile ? avatarFile.name : 'Choose avatar image'}</span>
                <span className="text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                  PNG, JPEG, or WebP up to 2MB
                </span>
                <input
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={isPending}
                  key={avatarInputKey}
                  name={field.name}
                  onBlur={field.onBlur}
                  onChange={(event) => {
                    // File inputs cannot be value-controlled safely; Controller still owns the selected File object.
                    field.onChange(event.currentTarget.files?.[0] ?? null);
                    setSaved(false);
                  }}
                  type="file"
                />
              </label>
            )}
          />

          <div className="grid grid-cols-2 gap-2">
            <Button disabled={isPending || !avatarFile} type="submit" variant="sky">
              {uploadAvatarMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
              Upload
            </Button>
            <Button
              disabled={isPending || !currentUser.avatarUrl}
              onClick={() => void handleDeleteAvatar()}
              variant="danger"
            >
              {deleteAvatarMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Remove
            </Button>
          </div>
        </Surface>

        <Surface className="grid gap-5 p-4" depth="md">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Display name
            </span>
            <ControlledInput
              aria-invalid={Boolean(form.formState.errors.name)}
              control={form.control}
              disabled={isPending}
              name="name"
              placeholder="Your name"
            />
            <FieldError>{form.formState.errors.name?.message}</FieldError>
          </label>

          <section className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-extrabold">
                  <Palette className="size-5 text-[rgb(var(--tabliodb-primary-text))]" />
                  Cursor color
                </h2>
                <p className="text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                  Used for realtime cursors and collaboration presence.
                </p>
              </div>
              <span
                className="hidden h-8 min-w-24 rounded-full border-2 border-white px-3 text-center text-xs font-extrabold leading-7 text-white shadow-[0_2px_0_rgb(var(--tabliodb-border-strong))] sm:block"
                style={{ backgroundColor: selectedColor }}
              >
                {selectedColor}
              </span>
            </div>

            <Controller
              control={form.control}
              name="cursorColor"
              render={({ field }) => (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {cursorColorOptions.map((color) => {
                    const isSelected = field.value.toLowerCase() === color.value;

                    return (
                      <button
                        aria-label={`Use ${color.label} cursor color`}
                        className={cn(
                          'group grid cursor-pointer gap-2 rounded-[var(--tabliodb-radius-lg)] border-2 bg-white p-2 transition hover:-translate-y-0.5 hover:shadow-[0_3px_0_rgb(var(--tabliodb-border-strong))]',
                          isSelected
                            ? 'border-[rgb(var(--tabliodb-primary))] bg-[rgb(var(--tabliodb-primary-soft))]'
                            : 'border-[rgb(var(--tabliodb-border))]',
                        )}
                        disabled={isPending}
                        key={color.value}
                        onClick={() => {
                          field.onChange(color.value);
                          setSaved(false);
                        }}
                        type="button"
                      >
                        <span
                          className="grid h-10 place-items-center rounded-[14px] border-2 border-white text-white shadow-[0_2px_0_rgb(var(--tabliodb-border-strong))]"
                          style={{ backgroundColor: color.value }}
                        >
                          {isSelected ? <Check className="size-5 stroke-[3]" /> : null}
                        </span>
                        <span className="text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                          {color.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            />
            <FieldError>{form.formState.errors.cursorColor?.message}</FieldError>

            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Custom hex
              </span>
              <Controller
                control={form.control}
                name="cursorColor"
                render={({ field }) => (
                  <Input
                    aria-invalid={Boolean(form.formState.errors.cursorColor)}
                    disabled={isPending}
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={(event) => {
                      field.onChange(event.currentTarget.value);
                      setSaved(false);
                    }}
                    placeholder="#58cc02"
                    value={field.value}
                  />
                )}
              />
            </label>
          </section>

          {mutationError ? <InlineErrorState error={mutationError} title="Could not save profile" /> : null}

          <div className="sticky bottom-5 flex justify-end">
            <Button disabled={isPending || !canSave} type="submit">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save profile
            </Button>
          </div>
        </Surface>
      </form>
    </div>
  );
}

function useAvatarPreviewUrl(file: File | null): string | null {
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return previewUrl;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
