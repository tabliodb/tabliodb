import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import type { DiagramModel } from '@tabliodb/schema-core';
import {
  Action as SdkDiagramReviewAction,
  CurrentStatus as SdkDiagramReviewStatus,
  type FolderAccessDtoOutput,
} from '@tabliodb/sdk';
import type { AwarenessState } from '@tabliodb/shared';
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
  cn,
} from '@tabliodb/ui';
import { Check, CircleCheck, CircleDot, FileWarning, Loader2, MessageSquareText, Reply, Trash2, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { InlineErrorState, getErrorMessage } from '@/features/app/RouteStates';
import {
  type CommentLexicalDocumentDto,
  type CommentResponseDto,
  type CommentThreadListItemDto,
  type CommentThreadReaderDto,
  commentQueries,
  useCreateCommentThreadMutation,
  useDeleteCommentMutation,
  useMarkCommentThreadReadMutation,
  useReplyToCommentMutation,
  useReplyToCommentThreadMutation,
  useResolveCommentThreadMutation,
  useUnresolveCommentThreadMutation,
  useUpdateCommentMutation,
} from '@/resources/comments';
import { diagramsQueries, useCreateDiagramReviewActionMutation } from '@/resources/diagrams';
import { foldersQueries } from '@/resources/folders';
import { createEmptyCommentFormBody } from '../comment-body';
import {
  findCommentThreadForTarget,
  focusCommentTarget,
  formatCommentTargetType,
  getActiveCommentTarget,
  getCommentThreadTargetLabel,
} from '../comments/comment-targets';
import type { CommentThreadOpenRequest, CommentTypingPresence, EditorCommentTarget } from '../comments/types';
import { CommentBody } from './CommentBody';
import { UserAvatar } from './UserAvatar';

const CommentComposer = lazy(() => import('./CommentComposer'));

type DiagramReviewAction = `${SdkDiagramReviewAction}`;
type DiagramReviewStatus = `${SdkDiagramReviewStatus}`;
type FolderAccessDto = FolderAccessDtoOutput;

const sdkDiagramReviewActionByValue: Record<DiagramReviewAction, SdkDiagramReviewAction> = {
  approved: SdkDiagramReviewAction.Approved,
  changes_requested: SdkDiagramReviewAction.ChangesRequested,
  commented: SdkDiagramReviewAction.Commented,
};

const commentFormSchema = z.object({
  body: z.string().trim().min(1, 'Write a comment before sending.').max(5000, 'Comment is too long.'),
  bodyJson: z.custom<CommentLexicalDocumentDto>(),
});

type CommentFormState = z.infer<typeof commentFormSchema>;

const folderAccessPageQuery = { limit: 50 } as const;
const commentThreadPageQuery = { limit: 50 } as const;
const commentReplyPageQuery = { limit: 50 } as const;
const commentNestedReplyPageQuery = { limit: 30 } as const;
const commentTypingFreshnessMs = 8000;
const commentTypingTimeoutMs = 6500;
const emptyCommentThreads: CommentThreadListItemDto[] = [];
const emptyComments: CommentResponseDto[] = [];
const emptyFolderAccess: FolderAccessDto[] = [];

export function CommentsDialog({
  canComment,
  canModerateComments,
  currentUserId,
  diagramId,
  model,
  onCommentTargetSelect,
  onFocusTable,
  onOpenChange,
  onTypingChange,
  open,
  openRequest,
  folderId,
  remoteTypingPresences,
  selectedCommentTarget,
  selectedTableId,
}: {
  canComment: boolean;
  canModerateComments: boolean;
  currentUserId: string;
  diagramId: string;
  model: DiagramModel;
  onCommentTargetSelect: (target: EditorCommentTarget) => void;
  onFocusTable: (tableId: string | null) => void;
  onOpenChange: (open: boolean) => void;
  onTypingChange: (typing: AwarenessState['commentTyping']) => void;
  open: boolean;
  openRequest: CommentThreadOpenRequest | null;
  folderId: string | null;
  remoteTypingPresences: CommentTypingPresence[];
  selectedCommentTarget: EditorCommentTarget | null;
  selectedTableId: string | null;
}) {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [deleteConfirmCommentId, setDeleteConfirmCommentId] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<CommentResponseDto | null>(null);
  const [replyParentComment, setReplyParentComment] = useState<CommentResponseDto | null>(null);
  const [typingTick, setTypingTick] = useState(0);
  const typingStopTimeoutRef = useRef<number | null>(null);
  const localCommentTypingRef = useRef<AwarenessState['commentTyping']>(undefined);
  const lastMarkedReadSignatureRef = useRef<string | null>(null);
  const handledOpenRequestIdRef = useRef<number | null>(null);
  const createForm = useForm<CommentFormState>({
    defaultValues: createEmptyCommentFormBody(),
    mode: 'onBlur',
    resolver: zodResolver(commentFormSchema),
  });
  const replyForm = useForm<CommentFormState>({
    defaultValues: createEmptyCommentFormBody(),
    mode: 'onBlur',
    resolver: zodResolver(commentFormSchema),
  });
  const editForm = useForm<CommentFormState>({
    defaultValues: createEmptyCommentFormBody(),
    mode: 'onBlur',
    resolver: zodResolver(commentFormSchema),
  });
  const activeTarget = useMemo(
    () => getActiveCommentTarget(model, selectedTableId, selectedCommentTarget),
    [model, selectedCommentTarget, selectedTableId],
  );
  const reviewSummaryQueryOptions = diagramsQueries.reviewSummary(diagramId);
  const reviewSummaryQuery = useQuery({
    ...reviewSummaryQueryOptions,
    // Review workflow berada di dialog comments; query ini sengaja lazy agar initial editor render tetap fokus ke canvas.
    enabled: open && reviewSummaryQueryOptions.enabled !== false,
  });
  const threadQueryOptions = commentQueries.listThreads(diagramId, commentThreadPageQuery);
  const threadsQuery = useQuery({
    ...threadQueryOptions,
    // Comments panel menjadi fetch boundary supaya editor awal tidak membawa traffic diskusi ketika user belum membukanya.
    enabled: open && threadQueryOptions.enabled !== false,
  });
  const threads = threadsQuery.data?.items ?? emptyCommentThreads;
  const activeThread = activeThreadId ? (threads.find((thread) => thread.id === activeThreadId) ?? null) : null;
  const rootCommentsQueryOptions = commentQueries.listRootComments(activeThreadId ?? '', commentReplyPageQuery);
  const rootCommentsQuery = useQuery({
    ...rootCommentsQueryOptions,
    // Root comments menjadi entry point tree; setiap child mengambil replies langsung dari endpoint parent comment.
    enabled: open && Boolean(activeThreadId) && rootCommentsQueryOptions.enabled !== false,
  });
  const threadReadStateQueryOptions = commentQueries.readState(activeThread?.id ?? '');
  const threadReadStateQuery = useQuery({
    ...threadReadStateQueryOptions,
    // Read receipt hanya diambil untuk thread yang sedang dibuka agar dialog tidak melakukan request tambahan untuk semua thread.
    enabled: open && Boolean(activeThread) && threadReadStateQueryOptions.enabled !== false,
  });
  const mentionMembersQueryOptions = foldersQueries.access(folderId ?? '', folderAccessPageQuery);
  const mentionMembersQuery = useQuery({
    ...mentionMembersQueryOptions,
    // Root diagrams do not have folder access grants; a diagram-scoped mention endpoint will fill this gap cleanly later.
    enabled: open && Boolean(folderId) && mentionMembersQueryOptions.enabled !== false,
  });
  const rootComments = rootCommentsQuery.data?.items ?? emptyComments;
  const visibleTypingPresences = useMemo(
    () => getFreshCommentTypingPresences(remoteTypingPresences, typingTick),
    [remoteTypingPresences, typingTick],
  );
  const typingPresencesByThreadId = useMemo(
    () => groupTypingPresencesByThreadId(visibleTypingPresences),
    [visibleTypingPresences],
  );
  const activeThreadTypingPresences = activeThreadId ? (typingPresencesByThreadId.get(activeThreadId) ?? []) : [];
  const mentionUsers = mentionMembersQuery.data?.items ?? emptyFolderAccess;
  const createThreadMutation = useCreateCommentThreadMutation();
  const deleteCommentMutation = useDeleteCommentMutation();
  const threadReplyMutation = useReplyToCommentThreadMutation();
  const commentReplyMutation = useReplyToCommentMutation();
  const reviewActionMutation = useCreateDiagramReviewActionMutation();
  const resolveThreadMutation = useResolveCommentThreadMutation();
  const unresolveThreadMutation = useUnresolveCommentThreadMutation();
  const markThreadReadMutation = useMarkCommentThreadReadMutation();
  const updateCommentMutation = useUpdateCommentMutation();
  const isReplyMutationPending = threadReplyMutation.isPending || commentReplyMutation.isPending;
  const isMutationPending =
    createThreadMutation.isPending ||
    deleteCommentMutation.isPending ||
    isReplyMutationPending ||
    reviewActionMutation.isPending ||
    resolveThreadMutation.isPending ||
    unresolveThreadMutation.isPending ||
    updateCommentMutation.isPending;

  useEffect(() => {
    if (!open) {
      setActiveThreadId(null);
      handledOpenRequestIdRef.current = null;
      stopCommentTyping();
      return;
    }

    if (activeThreadId && !threads.some((thread) => thread.id === activeThreadId)) {
      setActiveThreadId(null);
    }
  }, [activeThreadId, open, threads]);

  useEffect(() => {
    if (!open || !openRequest || threadsQuery.isPending || threadsQuery.error) {
      return;
    }

    if (handledOpenRequestIdRef.current === openRequest.requestId) {
      return;
    }

    handledOpenRequestIdRef.current = openRequest.requestId;
    const matchingThread = findCommentThreadForTarget(model, threads, openRequest.target);

    if (!matchingThread) {
      setActiveThreadId(null);
      return;
    }

    handleThreadSelect(matchingThread);
  }, [model, open, openRequest, threads, threadsQuery.error, threadsQuery.isPending]);

  useEffect(() => {
    lastMarkedReadSignatureRef.current = null;
  }, [activeThreadId, open]);

  useEffect(() => {
    if (
      !open ||
      !activeThread ||
      rootCommentsQuery.isPending ||
      rootCommentsQuery.error ||
      markThreadReadMutation.isPending
    ) {
      return;
    }

    const readSignature = `${activeThread.id}:${activeThread.updatedAt}:${
      rootCommentsQuery.data?.totalCount ?? rootComments.length
    }`;

    if (lastMarkedReadSignatureRef.current === readSignature) {
      return;
    }

    lastMarkedReadSignatureRef.current = readSignature;
    markThreadReadMutation.mutate(activeThread.id);
  }, [
    activeThread,
    rootComments.length,
    markThreadReadMutation,
    open,
    rootCommentsQuery.data?.totalCount,
    rootCommentsQuery.error,
    rootCommentsQuery.isPending,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const intervalId = window.setInterval(() => setTypingTick((value) => value + 1), 2000);

    return () => window.clearInterval(intervalId);
  }, [open]);

  useEffect(() => {
    // Parent reply selalu scoped ke thread aktif; pindah thread menghapus quote preview agar payload tidak mengarah ke thread lama.
    stopCommentTyping();
    setEditingComment(null);
    setDeleteConfirmCommentId(null);
    setReplyParentComment(null);
    editForm.reset(createEmptyCommentFormBody());
    replyForm.reset(createEmptyCommentFormBody());
  }, [activeThreadId, editForm, replyForm]);

  useEffect(() => {
    return () => {
      stopCommentTyping();
    };
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isMutationPending) {
      return;
    }

    onOpenChange(nextOpen);

    if (!nextOpen) {
      createForm.reset(createEmptyCommentFormBody());
      editForm.reset(createEmptyCommentFormBody());
      replyForm.reset(createEmptyCommentFormBody());
      setDeleteConfirmCommentId(null);
      setEditingComment(null);
      setReplyParentComment(null);
      stopCommentTyping();
      createThreadMutation.reset();
      deleteCommentMutation.reset();
      resetReplyMutations();
      resolveThreadMutation.reset();
      reviewActionMutation.reset();
      unresolveThreadMutation.reset();
      updateCommentMutation.reset();
    }
  }

  function handleCreateThread(values: CommentFormState) {
    if (!canComment) {
      return;
    }

    createThreadMutation.mutate(
      {
        body: {
          bodyJson: values.bodyJson,
          diagramId,
          targetId: activeTarget.targetId,
          targetType: activeTarget.targetType,
        },
      },
      {
        onSuccess: (response) => {
          setActiveThreadId(response.thread.id);
          createForm.reset(createEmptyCommentFormBody());
        },
      },
    );
  }

  function handleReply(values: CommentFormState) {
    if (!canComment || !activeThread) {
      return;
    }

    const body = {
      bodyJson: values.bodyJson,
      parentCommentId: replyParentComment?.id ?? null,
    };
    const onSuccess = () => {
      replyForm.reset(createEmptyCommentFormBody());
      setReplyParentComment(null);
      stopCommentTyping();
    };

    if (replyParentComment) {
      commentReplyMutation.mutate(
        {
          body,
          commentId: replyParentComment.id,
        },
        { onSuccess },
      );
      return;
    }

    threadReplyMutation.mutate(
      {
        body,
        threadId: activeThread.id,
      },
      { onSuccess },
    );
  }

  function handleReplyTargetSelect(comment: CommentResponseDto) {
    if (!canComment) {
      return;
    }

    setEditingComment(null);
    setDeleteConfirmCommentId(null);
    editForm.reset(createEmptyCommentFormBody());

    if (replyParentComment?.id !== comment.id) {
      replyForm.reset(createEmptyCommentFormBody());
      resetReplyMutations();
    }

    stopCommentTyping();
    setReplyParentComment(comment);
  }

  function handleEditTargetSelect(comment: CommentResponseDto) {
    if (!canComment || comment.deletedAt || comment.createdById !== currentUserId) {
      return;
    }

    stopCommentTyping();
    setReplyParentComment(null);
    setDeleteConfirmCommentId(null);
    replyForm.reset(createEmptyCommentFormBody());
    resetReplyMutations();
    updateCommentMutation.reset();
    editForm.reset({
      body: comment.body,
      bodyJson: comment.bodyJson,
    });
    setEditingComment(comment);
  }

  function handleEditCancel() {
    editForm.reset(createEmptyCommentFormBody());
    updateCommentMutation.reset();
    setEditingComment(null);
  }

  function handleDeleteTargetSelect(comment: CommentResponseDto) {
    if (!canComment || comment.deletedAt || (comment.createdById !== currentUserId && !canModerateComments)) {
      return;
    }

    setEditingComment(null);
    setReplyParentComment(null);
    editForm.reset(createEmptyCommentFormBody());
    replyForm.reset(createEmptyCommentFormBody());
    resetReplyMutations();
    deleteCommentMutation.reset();
    stopCommentTyping();
    setDeleteConfirmCommentId(comment.id);
  }

  function handleDeleteCancel() {
    deleteCommentMutation.reset();
    setDeleteConfirmCommentId(null);
  }

  function handleDeleteConfirm(comment: CommentResponseDto) {
    if (!canComment || comment.deletedAt || deleteCommentMutation.isPending) {
      return;
    }

    deleteCommentMutation.mutate(comment.id, {
      onSuccess: () => {
        setDeleteConfirmCommentId(null);
      },
    });
  }

  function handleEditComment(values: CommentFormState) {
    if (!canComment || !editingComment) {
      return;
    }

    updateCommentMutation.mutate(
      {
        body: {
          bodyJson: values.bodyJson,
        },
        commentId: editingComment.id,
      },
      {
        onSuccess: () => {
          editForm.reset(createEmptyCommentFormBody());
          setEditingComment(null);
        },
      },
    );
  }

  function handleInlineReplyCancel() {
    replyForm.reset(createEmptyCommentFormBody());
    resetReplyMutations();
    setReplyParentComment(null);
    stopCommentTyping();
  }

  function handleToggleResolved() {
    if (!activeThread || !canComment) {
      return;
    }

    if (activeThread.status === 'resolved') {
      unresolveThreadMutation.mutate(activeThread.id);
      return;
    }

    resolveThreadMutation.mutate(activeThread.id);
  }

  function handleReviewAction(action: DiagramReviewAction) {
    if (!canComment || reviewActionMutation.isPending) {
      return;
    }

    reviewActionMutation.mutate({
      body: { action: sdkDiagramReviewActionByValue[action] },
      diagramId,
    });
  }

  function handleThreadSelect(thread: CommentThreadListItemDto) {
    setActiveThreadId(thread.id);
    stopCommentTyping();
    setReplyParentComment(null);
    focusCommentTarget(model, thread, onFocusTable);
    // Fokus canvas dapat memilih table induk; target komentar dipasang setelahnya agar anchor detail tidak tertimpa fallback table.
    onCommentTargetSelect({ targetId: thread.targetId, targetType: thread.targetType });
  }

  function handleReplyComposerChange(
    value: string,
    bodyJson: CommentLexicalDocumentDto,
    onChange: (value: string) => void,
  ) {
    onChange(value);
    replyForm.setValue('bodyJson', bodyJson, { shouldDirty: true });

    if (!activeThread || !canComment || isReplyMutationPending || value.trim().length === 0) {
      stopCommentTyping();
      return;
    }

    publishCommentTyping(activeThread.id, replyParentComment?.id ?? null);
  }

  function handleReplyComposerBlur(onBlur?: () => void) {
    onBlur?.();
    stopCommentTyping();
  }

  function publishCommentTyping(threadId: string, parentCommentId: string | null) {
    clearTypingStopTimeout();
    const nextTyping = {
      parentCommentId,
      threadId,
      updatedAt: Date.now(),
    };

    localCommentTypingRef.current = nextTyping;
    onTypingChange(nextTyping);
    // Typing presence should disappear even if the user stops moving focus without submitting.
    typingStopTimeoutRef.current = window.setTimeout(() => {
      localCommentTypingRef.current = undefined;
      onTypingChange(undefined);
      typingStopTimeoutRef.current = null;
    }, commentTypingTimeoutMs);
  }

  function stopCommentTyping() {
    clearTypingStopTimeout();

    if (localCommentTypingRef.current === undefined) {
      return;
    }

    localCommentTypingRef.current = undefined;
    onTypingChange(undefined);
  }

  function clearTypingStopTimeout() {
    if (typingStopTimeoutRef.current !== null) {
      window.clearTimeout(typingStopTimeoutRef.current);
      typingStopTimeoutRef.current = null;
    }
  }

  function resetReplyMutations() {
    threadReplyMutation.reset();
    commentReplyMutation.reset();
  }

  const mutationError =
    createThreadMutation.error ??
    threadReplyMutation.error ??
    commentReplyMutation.error ??
    reviewActionMutation.error ??
    resolveThreadMutation.error ??
    unresolveThreadMutation.error;
  const activeThreadTargetLabel = activeThread ? getCommentThreadTargetLabel(model, activeThread) : null;
  const reviewStatus = reviewSummaryQuery.data?.currentStatus ?? 'draft';
  const latestReviewEvent = reviewSummaryQuery.data?.latestEvent ?? null;
  const latestReviewText = latestReviewEvent
    ? `${formatDiagramReviewAction(latestReviewEvent.action)} by ${latestReviewEvent.reviewer.name} at ${formatDateTime(
        latestReviewEvent.createdAt,
      )}`
    : reviewSummaryQuery.isPending
      ? 'Loading review status'
      : 'No review action yet';
  const readReceiptText = formatReadReceiptText(
    getVisibleThreadReaders(threadReadStateQuery.data?.readers ?? [], currentUserId),
    getVisibleThreadReaderCount(
      threadReadStateQuery.data?.readers ?? [],
      threadReadStateQuery.data?.totalReaderCount ?? 0,
      currentUserId,
    ),
  );
  const replyPlaceholder = activeThread
    ? canComment
      ? replyParentComment
        ? `Reply to ${replyParentComment.author.name} with @teammate`
        : 'Reply with @teammate'
      : 'Your role can read this thread only'
    : 'Select a thread before replying';

  function renderInlineReplyComposer(comment: CommentResponseDto): ReactNode {
    if (replyParentComment?.id !== comment.id) {
      return null;
    }

    return (
      <form
        className="mt-1 rounded-(--tabliodb-radius-md) border-2 border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky-soft))] p-2"
        onSubmit={replyForm.handleSubmit(handleReply)}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0 text-xs font-extrabold text-[rgb(var(--tabliodb-sky-text))]">
            Replying to {comment.author.name}
          </div>
          <button
            className="shrink-0 cursor-pointer rounded-full px-2 py-1 text-xs font-extrabold text-[rgb(var(--tabliodb-sky-text))] hover:bg-white/70"
            onClick={handleInlineReplyCancel}
            type="button"
          >
            Cancel
          </button>
        </div>
        <div className="mb-2 flex gap-2 rounded-(--tabliodb-radius-sm) border border-[rgb(var(--tabliodb-sky-border))] bg-white/75 px-2.5 py-2">
          <MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-[rgb(var(--tabliodb-sky-text))]" />
          <div className="min-w-0">
            <div className="truncate text-[11px] font-extrabold text-[rgb(var(--tabliodb-sky-text))]">
              {comment.author.name}
            </div>
            <p className="line-clamp-2 whitespace-pre-wrap wrap-break-word text-xs font-semibold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
              {getCommentQuotePreview(comment)}
            </p>
          </div>
        </div>
        <Controller
          control={replyForm.control}
          name="body"
          render={({ field }) => (
            <Suspense
              fallback={
                <CommentComposerFallback
                  density="compact"
                  invalid={Boolean(replyForm.formState.errors.body)}
                  placeholder={replyPlaceholder}
                />
              }
            >
              <CommentComposer
                aria-invalid={Boolean(replyForm.formState.errors.body)}
                density="compact"
                disabled={!activeThread || !canComment || isReplyMutationPending}
                mentionUsers={mentionUsers}
                onBlur={() => handleReplyComposerBlur(field.onBlur)}
                onChange={(value, bodyJson) => handleReplyComposerChange(value, bodyJson, field.onChange)}
                placeholder={replyPlaceholder}
                value={field.value}
              />
            </Suspense>
          )}
        />
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-h-5">
            <FieldError>{replyForm.formState.errors.body?.message}</FieldError>
            {mutationError ? <FieldError>{getErrorMessage(mutationError)}</FieldError> : null}
          </div>
          <Button disabled={!activeThread || !canComment || isReplyMutationPending} size="sm" type="submit">
            {isReplyMutationPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MessageSquareText className="size-4" />
            )}
            Reply
          </Button>
        </div>
      </form>
    );
  }

  function renderInlineEditComposer(comment: CommentResponseDto): ReactNode {
    if (editingComment?.id !== comment.id) {
      return null;
    }

    return (
      <form
        className="mt-2 rounded-(--tabliodb-radius-md) border-2 border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] p-2"
        onSubmit={editForm.handleSubmit(handleEditComment)}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0 text-xs font-extrabold text-[rgb(var(--tabliodb-primary-text))]">Editing comment</div>
          <button
            className="shrink-0 cursor-pointer rounded-full px-2 py-1 text-xs font-extrabold text-[rgb(var(--tabliodb-primary-text))] hover:bg-white/70"
            onClick={handleEditCancel}
            type="button"
          >
            Cancel
          </button>
        </div>
        <Controller
          control={editForm.control}
          name="body"
          render={({ field }) => (
            <Suspense
              fallback={
                <CommentComposerFallback
                  density="compact"
                  invalid={Boolean(editForm.formState.errors.body)}
                  placeholder="Update your comment"
                />
              }
            >
              <CommentComposer
                aria-invalid={Boolean(editForm.formState.errors.body)}
                density="compact"
                disabled={updateCommentMutation.isPending}
                mentionUsers={mentionUsers}
                onBlur={field.onBlur}
                onChange={(value, bodyJson) => {
                  field.onChange(value);
                  editForm.setValue('bodyJson', bodyJson, { shouldDirty: true });
                }}
                placeholder="Update your comment"
                value={field.value}
              />
            </Suspense>
          )}
        />
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-h-5">
            <FieldError>{editForm.formState.errors.body?.message}</FieldError>
            {updateCommentMutation.error ? (
              <FieldError>{getErrorMessage(updateCommentMutation.error)}</FieldError>
            ) : null}
          </div>
          <Button disabled={updateCommentMutation.isPending} size="sm" type="submit">
            {updateCommentMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Save edit
          </Button>
        </div>
      </form>
    );
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="h-[calc(100dvh-32px)] w-[min(96vw,1440px)] max-w-none max-[640px]:h-[100dvh] max-[640px]:max-h-screen max-[640px]:w-screen max-[640px]:rounded-none max-[640px]:border-0">
        <DialogHeader className="border-b border-[rgb(var(--tabliodb-border))] pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle>Comments</DialogTitle>
              <DialogDescription>
                Discuss the diagram, table, column, and schema details without losing editor context.
              </DialogDescription>
            </div>
            <IconButton
              disabled={isMutationPending}
              icon={X}
              label="Close comments"
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="secondary"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-(--tabliodb-radius-lg) border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface))] px-3 py-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-extrabold uppercase text-[rgb(var(--tabliodb-ink-muted))]">
                  Diagram review
                </span>
                <Badge variant={getDiagramReviewStatusBadgeVariant(reviewStatus)}>
                  {formatDiagramReviewStatus(reviewStatus)}
                </Badge>
              </div>
              <p className="mt-1 truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-subtle))]">
                {reviewSummaryQuery.error ? getErrorMessage(reviewSummaryQuery.error) : latestReviewText}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={!canComment || reviewActionMutation.isPending || reviewStatus === 'approved'}
                onClick={() => handleReviewAction('approved')}
                size="sm"
                type="button"
              >
                {reviewActionMutation.isPending && reviewActionMutation.variables?.body.action === 'approved' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Approve
              </Button>
              <Button
                disabled={!canComment || reviewActionMutation.isPending || reviewStatus === 'changes_requested'}
                onClick={() => handleReviewAction('changes_requested')}
                size="sm"
                type="button"
                variant="danger"
              >
                {reviewActionMutation.isPending &&
                reviewActionMutation.variables?.body.action === 'changes_requested' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileWarning className="size-4" />
                )}
                Request changes
              </Button>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="grid min-h-0 flex-1 grid-rows-[minmax(150px,0.38fr)_minmax(0,1fr)] gap-3 overflow-hidden px-2.5 py-2.5 sm:grid-rows-[minmax(180px,0.42fr)_minmax(0,1fr)] sm:px-3 sm:py-3 lg:grid-cols-[300px_minmax(0,1fr)] lg:grid-rows-none">
          <section className="flex min-h-0 flex-col gap-3 overflow-hidden">
            <form
              className="shrink-0 rounded-(--tabliodb-radius-lg) border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface))] p-2.5"
              onSubmit={createForm.handleSubmit(handleCreateThread)}
            >
              <div className="mb-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-extrabold">New thread</div>
                  <p className="mt-1 truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                    {activeTarget.detail}: {activeTarget.label}
                  </p>
                </div>
                <Badge variant={activeTarget.targetType === 'table' ? 'green' : 'blue'}>
                  {formatCommentTargetType(activeTarget.targetType)}
                </Badge>
              </div>
              <Controller
                control={createForm.control}
                name="body"
                render={({ field }) => (
                  <Suspense
                    fallback={
                      <CommentComposerFallback
                        density="compact"
                        invalid={Boolean(createForm.formState.errors.body)}
                        placeholder={canComment ? 'Leave a note with @teammate' : 'Your role can read comments only'}
                      />
                    }
                  >
                    <CommentComposer
                      aria-invalid={Boolean(createForm.formState.errors.body)}
                      density="compact"
                      disabled={!canComment || createThreadMutation.isPending}
                      mentionUsers={mentionUsers}
                      onBlur={field.onBlur}
                      onChange={(value, bodyJson) => {
                        field.onChange(value);
                        createForm.setValue('bodyJson', bodyJson, { shouldDirty: true });
                      }}
                      placeholder={canComment ? 'Leave a note with @teammate' : 'Your role can read comments only'}
                      value={field.value}
                    />
                  </Suspense>
                )}
              />
              <FieldError>{createForm.formState.errors.body?.message}</FieldError>
              <Button className="mt-2.5 w-full" disabled={!canComment || createThreadMutation.isPending} type="submit">
                {createThreadMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MessageSquareText className="size-4" />
                )}
                Start thread
              </Button>
            </form>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-(--tabliodb-radius-lg) border-2 border-[rgb(var(--tabliodb-border))] bg-white">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[rgb(var(--tabliodb-border))] px-3 py-2">
                <div>
                  <div className="text-[13px] font-extrabold">Threads</div>
                  <p className="text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                    {threadsQuery.data?.totalCount ?? threads.length} total
                  </p>
                </div>
                <Badge variant="neutral">{threadsQuery.isFetching ? 'Syncing' : 'Live'}</Badge>
              </div>
              <div className="tabliodb-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 scrollbar-gutter-stable">
                {threadsQuery.isPending ? (
                  <div className="flex items-center gap-2 rounded-(--tabliodb-radius-md) p-3 text-sm font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                    <Loader2 className="size-4 animate-spin" />
                    Loading threads
                  </div>
                ) : threadsQuery.error ? (
                  <div className="rounded-(--tabliodb-radius-md) border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                    {getErrorMessage(threadsQuery.error)}
                  </div>
                ) : threads.length === 0 ? (
                  <div className="rounded-(--tabliodb-radius-md) border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-4 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                    No comments yet
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {threads.map((thread) => {
                      const threadTypingPresences = typingPresencesByThreadId.get(thread.id) ?? [];

                      return (
                        <button
                          aria-pressed={activeThreadId === thread.id}
                          className={cn(
                            'w-full cursor-pointer rounded-(--tabliodb-radius-md) border-2 p-3 text-left transition',
                            activeThreadId === thread.id
                              ? 'border-[rgb(var(--tabliodb-active-chip-border))] bg-[rgb(var(--tabliodb-selected-surface))]'
                              : 'border-[rgb(var(--tabliodb-border))] hover:bg-[rgb(var(--tabliodb-surface))]',
                          )}
                          key={thread.id}
                          onClick={() => handleThreadSelect(thread)}
                          type="button"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-extrabold">
                                {getCommentThreadTargetLabel(model, thread)}
                              </div>
                              <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                                {threadTypingPresences.length > 0
                                  ? formatTypingPresenceText(threadTypingPresences)
                                  : formatDateTime(thread.updatedAt)}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-wrap justify-end gap-1">
                              {thread.unreadCount > 0 ? (
                                <Badge variant="yellow">{formatUnreadCount(thread.unreadCount)}</Badge>
                              ) : null}
                              <Badge
                                className={cn(
                                  'flex items-center gap-1 text-white [text-shadow:var(--tabliodb-solid-text-shadow)]',
                                  thread.status === 'resolved'
                                    ? 'bg-[rgb(var(--tabliodb-lavender))]'
                                    : 'bg-[rgb(var(--tabliodb-primary))]',
                                )}
                              >
                                {thread.status === 'resolved' ? (
                                  <CircleCheck strokeWidth={3} size={12} />
                                ) : (
                                  <CircleDot strokeWidth={3} size={12} />
                                )}
                                {formatCommentThreadStatus(thread.status)}
                              </Badge>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-(--tabliodb-radius-lg) border-2 border-[rgb(var(--tabliodb-border))] bg-white">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[rgb(var(--tabliodb-border))] px-4 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold">{activeThreadTargetLabel ?? 'Select a thread'}</div>
                <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                  {activeThread
                    ? `${formatCommentTargetType(activeThread.targetType)} discussion`
                    : 'Choose a thread from the list or start a new one.'}
                </p>
              </div>
              {activeThread ? (
                <Button
                  disabled={!canComment || isMutationPending}
                  onClick={handleToggleResolved}
                  size="sm"
                  type="button"
                  variant={activeThread.status === 'resolved' ? 'secondary' : 'purple'}
                >
                  {resolveThreadMutation.isPending || unresolveThreadMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  {activeThread.status === 'resolved' ? 'Reopen' : 'Resolve'}
                </Button>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex shrink-0 items-center justify-between gap-3 bg-[rgb(var(--tabliodb-surface))] px-4 py-1.5">
                <div className="min-w-0">
                  <span className="text-xs font-extrabold uppercase text-[rgb(var(--tabliodb-ink-muted))]">
                    Messages
                  </span>
                  {readReceiptText ? (
                    <p className="mt-0.5 truncate text-[11px] font-bold text-[rgb(var(--tabliodb-ink-subtle))]">
                      {readReceiptText}
                    </p>
                  ) : null}
                </div>
                <Badge variant="neutral">
                  {rootCommentsQuery.data?.totalCount ?? rootComments.length}
                  {rootComments.length === 1 ? ' root message' : ' root messages'}
                </Badge>
              </div>
              {activeThreadTypingPresences.length > 0 ? (
                <div className="flex shrink-0 items-center gap-2 border-t border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-sky-soft))] px-4 py-2 text-xs font-extrabold text-[rgb(var(--tabliodb-sky-text))]">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-2 animate-ping rounded-full bg-[rgb(var(--tabliodb-sky))] opacity-50" />
                    <span className="relative inline-flex size-2 rounded-full bg-[rgb(var(--tabliodb-sky))]" />
                  </span>
                  {formatTypingPresenceText(activeThreadTypingPresences)}
                </div>
              ) : null}
              <div className="tabliodb-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 scrollbar-gutter-stable">
                {!activeThread ? (
                  <div className="grid h-full place-items-center rounded-(--tabliodb-radius-md) border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-6 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                    Comments stay anchored to the diagram objects your team is reviewing.
                  </div>
                ) : rootCommentsQuery.isPending ? (
                  <div className="flex items-center gap-2 rounded-(--tabliodb-radius-md) p-3 text-sm font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                    <Loader2 className="size-4 animate-spin" />
                    Loading replies
                  </div>
                ) : rootCommentsQuery.error ? (
                  <div className="rounded-(--tabliodb-radius-md) border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                    {getErrorMessage(rootCommentsQuery.error)}
                  </div>
                ) : rootComments.length === 0 ? (
                  <div className="grid h-full place-items-center rounded-(--tabliodb-radius-md) border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-6 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                    This thread is ready for the first reply.
                  </div>
                ) : (
                  <div className="grid gap-1">
                    {rootComments.map((comment) => (
                      <ThreadCommentItem
                        canModerateComments={canModerateComments}
                        canComment={canComment}
                        comment={comment}
                        currentUserId={currentUserId}
                        deleteConfirmCommentId={deleteConfirmCommentId}
                        deleteError={deleteCommentMutation.error}
                        deletingCommentId={
                          deleteCommentMutation.isPending ? (deleteCommentMutation.variables ?? null) : null
                        }
                        depth={0}
                        key={comment.id}
                        onDeleteCancel={handleDeleteCancel}
                        onDeleteConfirm={handleDeleteConfirm}
                        onDelete={handleDeleteTargetSelect}
                        onEdit={handleEditTargetSelect}
                        onReply={handleReplyTargetSelect}
                        renderEditComposer={renderInlineEditComposer}
                        renderReplyComposer={renderInlineReplyComposer}
                        treeOpen={open}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {replyParentComment ? null : (
              <form
                className="shrink-0 border-t border-[rgb(var(--tabliodb-border))] bg-white/95 p-2.5"
                onSubmit={replyForm.handleSubmit(handleReply)}
              >
                <Controller
                  control={replyForm.control}
                  name="body"
                  render={({ field }) => (
                    <Suspense
                      fallback={
                        <CommentComposerFallback
                          density="compact"
                          invalid={Boolean(replyForm.formState.errors.body)}
                          placeholder={replyPlaceholder}
                        />
                      }
                    >
                      <CommentComposer
                        aria-invalid={Boolean(replyForm.formState.errors.body)}
                        density="compact"
                        disabled={!activeThread || !canComment || isReplyMutationPending}
                        mentionUsers={mentionUsers}
                        menuPlacement="top"
                        onBlur={() => handleReplyComposerBlur(field.onBlur)}
                        onChange={(value, bodyJson) => handleReplyComposerChange(value, bodyJson, field.onChange)}
                        placeholder={replyPlaceholder}
                        value={field.value}
                      />
                    </Suspense>
                  )}
                />
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-h-5">
                    <FieldError>{replyForm.formState.errors.body?.message}</FieldError>
                    {mutationError ? <FieldError>{getErrorMessage(mutationError)}</FieldError> : null}
                  </div>
                  <Button disabled={!activeThread || !canComment || isReplyMutationPending} size="sm" type="submit">
                    {isReplyMutationPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <MessageSquareText className="size-4" />
                    )}
                    Reply
                  </Button>
                </div>
              </form>
            )}
          </section>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function ThreadCommentItem({
  canModerateComments,
  canComment,
  comment,
  currentUserId,
  deleteConfirmCommentId,
  deleteError,
  deletingCommentId,
  depth,
  onDelete,
  onDeleteCancel,
  onDeleteConfirm,
  onEdit,
  onReply,
  renderEditComposer,
  renderReplyComposer,
  treeOpen,
}: {
  canModerateComments: boolean;
  canComment: boolean;
  comment: CommentResponseDto;
  currentUserId: string;
  deleteConfirmCommentId: string | null;
  deleteError: unknown;
  deletingCommentId: string | null;
  depth: number;
  onDelete: (comment: CommentResponseDto) => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: (comment: CommentResponseDto) => void;
  onEdit: (comment: CommentResponseDto) => void;
  onReply: (comment: CommentResponseDto) => void;
  renderEditComposer: (comment: CommentResponseDto) => ReactNode;
  renderReplyComposer: (comment: CommentResponseDto) => ReactNode;
  treeOpen: boolean;
}) {
  const hasReplies = comment.replyCount > 0;
  const isDeleted = Boolean(comment.deletedAt);
  const [areRepliesExpanded, setAreRepliesExpanded] = useState(true);
  const repliesQueryOptions = commentQueries.listReplies(comment.id, commentNestedReplyPageQuery);
  const repliesQuery = useQuery({
    ...repliesQueryOptions,
    // Child replies dibuat lazy per branch sehingga thread besar tidak wajib memuat seluruh tree dalam satu request.
    enabled: treeOpen && hasReplies && areRepliesExpanded && repliesQueryOptions.enabled !== false,
  });
  const replies = repliesQuery.data?.items ?? emptyComments;
  const canEdit = canComment && !isDeleted && comment.createdById === currentUserId;
  const canDelete = canComment && !isDeleted && (comment.createdById === currentUserId || canModerateComments);
  const isDeleteConfirming = deleteConfirmCommentId === comment.id;
  const isDeleting = deletingCommentId === comment.id;
  const inlineEditComposer = isDeleted ? null : renderEditComposer(comment);
  const inlineReplyComposer = isDeleted ? null : renderReplyComposer(comment);
  // Replies dibuka secara default agar thread lama tetap terasa familiar, tetapi cabang ramai bisa ditutup per comment.
  const hasVisibleReplies = hasReplies && areRepliesExpanded;
  const avatarBottomClass = depth === 0 ? 'top-[44px]' : 'top-[40px]';
  const avatarCenterClass = depth === 0 ? 'left-[26px]' : 'left-[24px]';
  const replySpineIndentClass = depth === 0 ? 'ml-[26px]' : 'ml-[24px]';
  const inlineReplyIndentClass = depth === 0 ? 'ml-[56px]' : 'ml-[52px]';

  return (
    <div
      className={cn('relative', depth > 4 && 'rounded-l-(--tabliodb-radius-sm) bg-[rgb(var(--tabliodb-surface))]/60')}
    >
      {depth > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -left-8.5 top-0 h-6 w-11 rounded-bl-[18px] border-b-2 border-l-2 border-[rgb(var(--tabliodb-border-strong))]"
        />
      ) : null}

      <article
        className={cn(
          'group relative flex items-start gap-3 rounded-(--tabliodb-radius-md) px-2 py-2 transition hover:bg-[rgb(var(--tabliodb-surface))]',
          isDeleted && 'text-[rgb(var(--tabliodb-ink-muted))]',
        )}
      >
        {hasVisibleReplies ? (
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute -bottom-1.5 w-px bg-[rgb(var(--tabliodb-border-strong))]',
              avatarBottomClass,
              avatarCenterClass,
            )}
          />
        ) : null}
        {isDeleted ? (
          <span
            className={cn(
              'relative z-10 grid shrink-0 place-items-center rounded-full border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface))] text-[rgb(var(--tabliodb-ink-subtle))] shadow-[0_2px_0_rgb(var(--tabliodb-border))]',
              depth === 0 ? 'size-9' : 'size-8',
            )}
          >
            <MessageSquareText className="size-4" />
          </span>
        ) : (
          <UserAvatar
            className={cn(
              'relative z-10 rounded-full border-[rgb(var(--tabliodb-border))] text-[11px] shadow-[0_2px_0_rgb(var(--tabliodb-border))]',
              depth === 0 ? 'size-9' : 'size-8',
            )}
            user={comment.author}
          />
        )}
        <div className="relative z-10 min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[13px] font-extrabold text-[rgb(var(--tabliodb-ink))]">
              {isDeleted ? 'Deleted comment' : comment.author.name}
            </span>
            <span className="text-[11px] font-bold text-[rgb(var(--tabliodb-ink-subtle))]">
              {formatDateTime(comment.createdAt)}
            </span>
            {!isDeleted && comment.editedAt ? (
              <span className="text-[11px] font-extrabold text-[rgb(var(--tabliodb-ink-subtle))]">edited</span>
            ) : null}
          </div>
          {inlineEditComposer ? (
            inlineEditComposer
          ) : (
            <>
              <CommentBody bodyJson={comment.bodyJson} deleted={isDeleted} fallbackText={comment.body} />
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                {!isDeleted ? (
                  <button
                    className={cn(
                      'rounded-full px-2 py-1 text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))] transition',
                      canComment
                        ? 'cursor-pointer hover:bg-[rgb(var(--tabliodb-primary-soft))] hover:text-[rgb(var(--tabliodb-primary-text))]'
                        : 'cursor-not-allowed opacity-60',
                    )}
                    disabled={!canComment}
                    onClick={() => onReply(comment)}
                    type="button"
                  >
                    Reply
                  </button>
                ) : null}
                {canEdit ? (
                  <button
                    className="cursor-pointer rounded-full px-2 py-1 text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))] transition hover:bg-[rgb(var(--tabliodb-sky-soft))] hover:text-[rgb(var(--tabliodb-sky-text))]"
                    onClick={() => onEdit(comment)}
                    type="button"
                  >
                    Edit
                  </button>
                ) : null}
                {canDelete ? (
                  isDeleteConfirming ? (
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <button
                        className="cursor-pointer rounded-full px-2 py-1 text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))] transition hover:bg-[rgb(var(--tabliodb-surface))]"
                        disabled={isDeleting}
                        onClick={onDeleteCancel}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-[rgb(var(--tabliodb-danger))] px-2 py-1 text-xs font-extrabold text-white [text-shadow:var(--tabliodb-solid-text-shadow)] transition hover:bg-[rgb(var(--tabliodb-danger-hover))] disabled:cursor-wait disabled:opacity-70"
                        disabled={isDeleting}
                        onClick={() => onDeleteConfirm(comment)}
                        type="button"
                      >
                        {isDeleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                        Delete
                      </button>
                    </span>
                  ) : (
                    <button
                      className="cursor-pointer rounded-full px-2 py-1 text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))] transition hover:bg-[rgb(var(--tabliodb-danger-soft))] hover:text-[rgb(var(--tabliodb-danger-text))]"
                      onClick={() => onDelete(comment)}
                      type="button"
                    >
                      Delete
                    </button>
                  )
                ) : null}
                {hasReplies ? (
                  <button
                    aria-expanded={areRepliesExpanded}
                    className="cursor-pointer rounded-full px-2 py-1 text-xs font-extrabold text-[rgb(var(--tabliodb-sky-text))] transition hover:bg-[rgb(var(--tabliodb-sky-soft))]"
                    onClick={() => setAreRepliesExpanded((isExpanded) => !isExpanded)}
                    type="button"
                  >
                    {areRepliesExpanded ? 'Hide replies' : `View ${formatCommentReplyCount(comment.replyCount)}`}
                  </button>
                ) : null}
              </div>
              {hasVisibleReplies && repliesQuery.isPending ? (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-[rgb(var(--tabliodb-ink-subtle))]">
                  <Loader2 className="size-3 animate-spin" />
                  Loading replies
                </div>
              ) : null}
              {hasVisibleReplies && repliesQuery.error ? (
                <div className="mt-1">
                  <FieldError>{getErrorMessage(repliesQuery.error)}</FieldError>
                </div>
              ) : null}
              {isDeleteConfirming && deleteError ? (
                <div className="mt-1">
                  <FieldError>{getErrorMessage(deleteError)}</FieldError>
                </div>
              ) : null}
            </>
          )}
        </div>
      </article>

      {inlineReplyComposer ? (
        <div className={cn('pb-2 pr-2', inlineReplyIndentClass)}>{inlineReplyComposer}</div>
      ) : null}

      {hasVisibleReplies && replies.length > 0 ? (
        <div className={cn('relative -mt-1 pl-8.5', replySpineIndentClass)}>
          {/* The spine sits on the parent avatar centerline, while each elbow overlaps the child avatar edge so nested replies feel physically connected. */}
          <span
            aria-hidden="true"
            className="absolute bottom-3 left-0 -top-1.5 w-px bg-[rgb(var(--tabliodb-border-strong))]"
          />
          <div className="grid gap-0.5">
            {replies.map((reply) => (
              <ThreadCommentItem
                canModerateComments={canModerateComments}
                canComment={canComment}
                comment={reply}
                currentUserId={currentUserId}
                deleteConfirmCommentId={deleteConfirmCommentId}
                deleteError={deleteError}
                deletingCommentId={deletingCommentId}
                depth={depth + 1}
                key={reply.id}
                onDelete={onDelete}
                onDeleteCancel={onDeleteCancel}
                onDeleteConfirm={onDeleteConfirm}
                onEdit={onEdit}
                onReply={onReply}
                renderEditComposer={renderEditComposer}
                renderReplyComposer={renderReplyComposer}
                treeOpen={treeOpen}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatCommentReplyCount(replyCount: number): string {
  return `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`;
}

function getCommentQuotePreview(comment: CommentResponseDto): string {
  if (comment.deletedAt) {
    return 'This comment was deleted.';
  }

  // Quote preview memakai plain text hasil sanitasi server; rendering rich Lexical JSON akan ditambahkan sebagai tahap aman terpisah.
  return comment.body.trim() || 'No preview available.';
}

function getFreshCommentTypingPresences(
  presences: CommentTypingPresence[],
  _typingTick: number,
): CommentTypingPresence[] {
  const now = Date.now();

  return presences.filter((presence) => now - presence.updatedAt <= commentTypingFreshnessMs);
}

function groupTypingPresencesByThreadId(presences: CommentTypingPresence[]): Map<string, CommentTypingPresence[]> {
  const grouped = new Map<string, CommentTypingPresence[]>();

  for (const presence of presences) {
    grouped.set(presence.threadId, [...(grouped.get(presence.threadId) ?? []), presence]);
  }

  return grouped;
}

function formatTypingPresenceText(presences: CommentTypingPresence[]): string {
  const names = presences.map((presence) => presence.user.name);

  if (names.length === 0) {
    return '';
  }

  if (names.length === 1) {
    return `${names[0]} is typing`;
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are typing`;
  }

  return `${names[0]}, ${names[1]}, and ${names.length - 2} more are typing`;
}

function formatUnreadCount(unreadCount: number): string {
  if (unreadCount > 99) {
    return '99+ new';
  }

  return `${unreadCount} new`;
}

function getVisibleThreadReaders(readers: CommentThreadReaderDto[], currentUserId: string): CommentThreadReaderDto[] {
  return readers.filter((reader) => reader.user.id !== currentUserId);
}

function getVisibleThreadReaderCount(
  readers: CommentThreadReaderDto[],
  totalReaderCount: number,
  currentUserId: string,
): number {
  const currentUserIncluded = readers.some((reader) => reader.user.id === currentUserId);

  return Math.max(readers.length - (currentUserIncluded ? 1 : 0), totalReaderCount - (currentUserIncluded ? 1 : 0));
}

function formatReadReceiptText(readers: CommentThreadReaderDto[], totalReaderCount: number): string | null {
  if (totalReaderCount <= 0 || readers.length === 0) {
    return null;
  }

  const visibleNames = readers.map((reader) => reader.user.name);

  if (totalReaderCount === 1) {
    return `Seen by ${visibleNames[0]}`;
  }

  if (totalReaderCount === 2 && visibleNames.length >= 2) {
    return `Seen by ${visibleNames[0]} and ${visibleNames[1]}`;
  }

  if (visibleNames.length >= 2) {
    return `Seen by ${visibleNames[0]}, ${visibleNames[1]}, and ${totalReaderCount - 2} more`;
  }

  return `Seen by ${visibleNames[0]} and ${totalReaderCount - 1} more`;
}

function CommentComposerFallback({
  density = 'default',
  invalid,
  placeholder,
}: {
  density?: 'default' | 'compact';
  invalid: boolean;
  placeholder: string;
}) {
  return (
    <div
      className={cn(
        'rounded-(--tabliodb-radius-md) border bg-white px-3 py-2 text-[13px] font-semibold leading-6 text-[rgb(var(--tabliodb-ink-subtle))]',
        density === 'compact' ? 'min-h-14' : 'min-h-20',
        invalid ? 'border-[rgb(var(--tabliodb-danger-border))]' : 'border-[rgb(var(--tabliodb-border-strong))]',
      )}
    >
      {placeholder}
    </div>
  );
}

function formatCommentThreadStatus(status: CommentThreadListItemDto['status']): string {
  return status === 'resolved' ? 'Resolved' : 'Open';
}

function formatDiagramReviewStatus(status: DiagramReviewStatus): string {
  if (status === 'changes_requested') {
    return 'Changes requested';
  }

  if (status === 'approved') {
    return 'Approved';
  }

  if (status === 'reviewed') {
    return 'Commented';
  }

  return 'Draft';
}

function formatDiagramReviewAction(action: DiagramReviewAction): string {
  if (action === 'changes_requested') {
    return 'Requested changes';
  }

  if (action === 'approved') {
    return 'Approved';
  }

  return 'Commented';
}

function getDiagramReviewStatusBadgeVariant(status: DiagramReviewStatus): 'green' | 'neutral' | 'purple' | 'yellow' {
  if (status === 'approved') {
    return 'green';
  }

  if (status === 'changes_requested') {
    return 'yellow';
  }

  if (status === 'reviewed') {
    return 'purple';
  }

  return 'neutral';
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}
