import { zodResolver } from '@hookform/resolvers/zod';
import {
  TargetType2 as SdkShareLinkTargetType,
  type DiagramShareLinkCreateDto,
  type DiagramShareLinkCreateResponseDtoOutput,
  type DiagramShareLinkDtoOutput,
  type SnapshotResponseDtoOutput,
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
  Surface,
} from '@tabliodb/ui';
import { Copy, Link2, Loader2, Share2, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ControlledInput, ControlledSelect } from '@/features/app/FormControls';
import { EmptyState, InlineErrorState, InlineLoadingState } from '@/features/app/RouteStates';

type DiagramShareLinkDto = DiagramShareLinkDtoOutput;
type SnapshotResponseDto = SnapshotResponseDtoOutput;
type ShareLinkTarget = 'diagram' | 'snapshot';

const sdkShareLinkTargetTypeByValue: Record<ShareLinkTarget, SdkShareLinkTargetType> = {
  diagram: SdkShareLinkTargetType.Diagram,
  snapshot: SdkShareLinkTargetType.Snapshot,
};

const shareLinkExpiryOptions = ['never', '7', '30'] as const;

const shareLinkFormSchema = z.object({
  expiresInDays: z.enum(shareLinkExpiryOptions),
  label: z.string().trim().max(80, 'Keep the label under 80 characters.'),
  targetType: z.enum(['diagram', 'snapshot']),
});

type ShareLinkFormState = z.infer<typeof shareLinkFormSchema>;

export function ShareLinksDialog({
  createError,
  disabled,
  isCreating,
  isLoading,
  isRevoking,
  latestSnapshot,
  listError,
  onCopy,
  onCreate,
  onOpenChange,
  onRetry,
  onRevoke,
  open,
  revokeError,
  shareLinks,
}: {
  createError: Error | null;
  disabled: boolean;
  isCreating: boolean;
  isLoading: boolean;
  isRevoking: boolean;
  latestSnapshot: SnapshotResponseDto | null;
  listError: Error | null;
  onCopy: (url: string) => void;
  onCreate: (input: DiagramShareLinkCreateDto) => Promise<DiagramShareLinkCreateResponseDtoOutput>;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  onRevoke: (shareLinkId: string) => Promise<unknown>;
  open: boolean;
  revokeError: Error | null;
  shareLinks: DiagramShareLinkDto[];
}) {
  const [lastCreatedUrl, setLastCreatedUrl] = useState<string | null>(null);
  const [shareLinkToRevoke, setShareLinkToRevoke] = useState<DiagramShareLinkDto | null>(null);
  const form = useForm<ShareLinkFormState>({
    defaultValues: {
      expiresInDays: 'never',
      label: '',
      targetType: 'diagram',
    },
    resolver: zodResolver(shareLinkFormSchema),
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      expiresInDays: 'never',
      label: '',
      // Snapshot option hanya dipilih otomatis jika ada snapshot dan user memilihnya sendiri setelah dialog terbuka.
      targetType: 'diagram',
    });
    setLastCreatedUrl(null);
    setShareLinkToRevoke(null);
  }, [form, open]);

  async function handleSubmit(values: ShareLinkFormState) {
    if (disabled) {
      return;
    }

    const expiresAt = values.expiresInDays === 'never' ? null : createExpiryIsoDate(Number(values.expiresInDays));
    const response = await onCreate({
      expiresAt,
      label: values.label.trim() || undefined,
      snapshotId: values.targetType === 'snapshot' ? latestSnapshot?.id : undefined,
      targetType: sdkShareLinkTargetTypeByValue[values.targetType],
    });

    setLastCreatedUrl(response.url);
  }

  function handleRevoke(shareLink: DiagramShareLinkDto) {
    if (isRevoking) {
      return;
    }

    setShareLinkToRevoke(shareLink);
  }

  async function handleConfirmRevoke() {
    if (!shareLinkToRevoke || isRevoking) {
      return;
    }

    try {
      // Revoke tetap lewat mutation parent agar list invalidation, toast, dan error panel existing tidak berubah perilakunya.
      await onRevoke(shareLinkToRevoke.id);
      setShareLinkToRevoke(null);
    } catch {
      // Error mutation sudah dirender melalui revokeError, jadi dialog tetap terbuka tanpa throw yang membuat promise rejection bocor ke console.
    }
  }

  return (
    <>
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="h-[min(86dvh,720px)] w-[min(94vw,980px)] max-w-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="size-5 text-[rgb(var(--tabliodb-primary-text))]" />
              Share read-only link
            </DialogTitle>
            <DialogDescription>
              Create public links for stakeholders who only need to inspect this diagram.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid min-h-0 gap-4 lg:grid-cols-[minmax(260px,360px)_1fr]">
            <form
              className="grid content-start gap-4"
              onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}
            >
              <Surface className="grid gap-3 p-4">
                <div>
                  <p className="text-sm font-black text-[rgb(var(--tabliodb-ink))]">New public link</p>
                  <p className="mt-1 text-xs font-bold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
                    Anyone with the URL can view the diagram without signing in.
                  </p>
                </div>

                <label className="grid gap-1.5 text-xs font-extrabold uppercase text-[rgb(var(--tabliodb-ink-muted))]">
                  Label
                  <ControlledInput
                    autoComplete="off"
                    control={form.control}
                    name="label"
                    placeholder="Stakeholder review"
                  />
                  <FieldError>{form.formState.errors.label?.message}</FieldError>
                </label>

                <label className="grid gap-1.5 text-xs font-extrabold uppercase text-[rgb(var(--tabliodb-ink-muted))]">
                  Target
                  <ControlledSelect
                    control={form.control}
                    name="targetType"
                    options={[
                      { label: 'Live diagram', value: 'diagram' },
                      {
                        disabled: !latestSnapshot,
                        label: latestSnapshot ? `Saved version v${latestSnapshot.version}` : 'No saved version yet',
                        value: 'snapshot',
                      },
                    ]}
                  />
                  <FieldError>{form.formState.errors.targetType?.message}</FieldError>
                </label>

                <label className="grid gap-1.5 text-xs font-extrabold uppercase text-[rgb(var(--tabliodb-ink-muted))]">
                  Expiry
                  <ControlledSelect
                    control={form.control}
                    name="expiresInDays"
                    options={[
                      { label: 'Never expires', value: 'never' },
                      { label: '7 days', value: '7' },
                      { label: '30 days', value: '30' },
                    ]}
                  />
                  <FieldError>{form.formState.errors.expiresInDays?.message}</FieldError>
                </label>

                {createError ? <InlineErrorState error={createError} title="Could not create share link" /> : null}

                <Button className="gap-2" disabled={disabled || isCreating} type="submit">
                  {isCreating ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                  Create link
                </Button>
              </Surface>

              {lastCreatedUrl ? (
                <Surface className="grid gap-3 border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] p-4">
                  <div>
                    <p className="text-sm font-black text-[rgb(var(--tabliodb-primary-text))]">Link copied</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
                      This URL is shown only now because Tabliodb stores the token as a hash.
                    </p>
                  </div>
                  <div className="min-w-0 rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-primary-border))] bg-white px-3 py-2 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                    <span className="block truncate">{lastCreatedUrl}</span>
                  </div>
                  <Button className="gap-2" onClick={() => onCopy(lastCreatedUrl)} type="button" variant="secondary">
                    <Copy className="size-4" />
                    Copy again
                  </Button>
                </Surface>
              ) : null}
            </form>

            <Surface className="flex min-h-0 flex-col overflow-hidden p-0">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[rgb(var(--tabliodb-border))] px-4 py-3">
                <div>
                  <p className="text-sm font-black text-[rgb(var(--tabliodb-ink))]">Existing links</p>
                  <p className="text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                    {shareLinks.length} link{shareLinks.length === 1 ? '' : 's'} for this diagram
                  </p>
                </div>
                <Badge variant="green">Read-only</Badge>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {isLoading ? (
                  <InlineLoadingState message="Loading share links" />
                ) : listError ? (
                  <InlineErrorState error={listError} onRetry={onRetry} title="Could not load share links" />
                ) : shareLinks.length === 0 ? (
                  <EmptyState
                    description="Create a public link when stakeholders need to review a schema without joining the workspace."
                    icon={Share2}
                    title="No share links yet"
                  />
                ) : (
                  <div className="grid gap-3">
                    {shareLinks.map((shareLink) => (
                      <ShareLinkListItem
                        isRevoking={isRevoking}
                        key={shareLink.id}
                        onRevoke={handleRevoke}
                        shareLink={shareLink}
                      />
                    ))}
                  </div>
                )}

                {revokeError ? (
                  <InlineErrorState className="mt-4" error={revokeError} title="Could not revoke link" />
                ) : null}
              </div>
            </Surface>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="secondary">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setShareLinkToRevoke(null);
          }
        }}
        open={Boolean(shareLinkToRevoke)}
      >
        <DialogContent className="w-[min(92vw,420px)]">
          <DialogHeader>
            <DialogTitle>Revoke share link?</DialogTitle>
            <DialogDescription>
              This read-only URL will stop working immediately. People who already have the link will lose access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button disabled={isRevoking} onClick={() => setShareLinkToRevoke(null)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button
              className="gap-2"
              disabled={isRevoking}
              onClick={() => void handleConfirmRevoke()}
              type="button"
              variant="danger"
            >
              {isRevoking ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Revoke link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ShareLinkListItem({
  isRevoking,
  onRevoke,
  shareLink,
}: {
  isRevoking: boolean;
  onRevoke: (shareLink: DiagramShareLinkDto) => void;
  shareLink: DiagramShareLinkDto;
}) {
  const isActive = shareLink.status === 'active';

  return (
    <article className="rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border))] bg-white p-3 shadow-[0_2px_0_rgb(var(--tabliodb-border))]">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-black text-[rgb(var(--tabliodb-ink))]">
              {shareLink.label || formatShareLinkTarget(shareLink)}
            </p>
            <ShareLinkStatusBadge status={shareLink.status} />
          </div>
          <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
            {formatShareLinkTarget(shareLink)} / created by {shareLink.createdByName}
          </p>
        </div>
        <Button
          className="shrink-0 gap-2"
          disabled={!isActive || isRevoking}
          onClick={() => onRevoke(shareLink)}
          size="sm"
          type="button"
          variant="secondary"
        >
          {isRevoking ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
          Revoke
        </Button>
      </div>
      <dl className="mt-3 grid gap-2 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))] sm:grid-cols-3">
        <div>
          <dt className="font-extrabold uppercase text-[rgb(var(--tabliodb-ink-subtle))]">Created</dt>
          <dd>{formatDateTime(shareLink.createdAt)}</dd>
        </div>
        <div>
          <dt className="font-extrabold uppercase text-[rgb(var(--tabliodb-ink-subtle))]">Expires</dt>
          <dd>{shareLink.expiresAt ? formatDateTime(shareLink.expiresAt) : 'Never'}</dd>
        </div>
        <div>
          <dt className="font-extrabold uppercase text-[rgb(var(--tabliodb-ink-subtle))]">Opens</dt>
          <dd>{shareLink.accessCount}</dd>
        </div>
      </dl>
    </article>
  );
}

function ShareLinkStatusBadge({ status }: { status: DiagramShareLinkDto['status'] }) {
  if (status === 'active') {
    return <Badge variant="green">Active</Badge>;
  }

  if (status === 'expired') {
    return <Badge variant="yellow">Expired</Badge>;
  }

  return <Badge variant="neutral">Revoked</Badge>;
}

function formatShareLinkTarget(shareLink: DiagramShareLinkDto): string {
  return shareLink.targetType === 'snapshot' ? 'Saved version link' : 'Live diagram link';
}

function createExpiryIsoDate(days: number): string {
  // Expiry dihitung di client untuk preview cepat; backend tetap memvalidasi bahwa tanggalnya berada di masa depan.
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}
