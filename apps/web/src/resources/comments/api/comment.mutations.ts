import { useMutation } from '@tanstack/react-query';
import {
  createCommentThread,
  deleteComment,
  markCommentThreadRead,
  replyToComment,
  replyToCommentThread,
  resolveCommentThread,
  unresolveCommentThread,
  updateComment,
  type CommentReplyCreateDto as GeneratedCommentReplyCreateDto,
  type CommentThreadCreateDto as GeneratedCommentThreadCreateDto,
  type CommentUpdateDto as GeneratedCommentUpdateDto,
} from '@tabliodb/sdk';
import type {
  CommentReplyCreateDto,
  CommentResponseDto,
  CommentThreadCreateDto,
  CommentThreadDto,
  CommentThreadReadStateDto,
  CommentThreadResponseDto,
  CommentUpdateDto,
} from './comment.types';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { notificationKeys } from '@/resources/notifications';
import { commentKeys } from './comment.keys';

const createCommentThreadMutationFn = (variables: {
  body: CommentThreadCreateDto;
}): Promise<CommentThreadResponseDto> =>
  createCommentThread({
    commentThreadCreateDto: variables.body as unknown as GeneratedCommentThreadCreateDto,
  }) as unknown as Promise<CommentThreadResponseDto>;
const replyToCommentThreadMutationFn = (variables: {
  body: CommentReplyCreateDto;
  threadId: string;
}): Promise<CommentThreadResponseDto> =>
  replyToCommentThread({
    commentReplyCreateDto: variables.body as unknown as GeneratedCommentReplyCreateDto,
    threadId: variables.threadId,
  }) as unknown as Promise<CommentThreadResponseDto>;
const replyToCommentMutationFn = (variables: {
  body: CommentReplyCreateDto;
  commentId: string;
}): Promise<CommentThreadResponseDto> =>
  replyToComment({
    commentId: variables.commentId,
    commentReplyCreateDto: variables.body as unknown as GeneratedCommentReplyCreateDto,
  }) as unknown as Promise<CommentThreadResponseDto>;
const updateCommentMutationFn = (variables: {
  body: CommentUpdateDto;
  commentId: string;
}): Promise<CommentResponseDto> =>
  updateComment({
    commentId: variables.commentId,
    commentUpdateDto: variables.body as unknown as GeneratedCommentUpdateDto,
  }) as unknown as Promise<CommentResponseDto>;
const deleteCommentMutationFn = (commentId: string): Promise<CommentResponseDto> =>
  deleteComment({ commentId }) as unknown as Promise<CommentResponseDto>;
const resolveCommentThreadMutationFn = (threadId: string): Promise<CommentThreadDto> =>
  resolveCommentThread({ threadId }) as unknown as Promise<CommentThreadDto>;
const unresolveCommentThreadMutationFn = (threadId: string): Promise<CommentThreadDto> =>
  unresolveCommentThread({ threadId }) as unknown as Promise<CommentThreadDto>;
const markCommentThreadReadMutationFn = (threadId: string): Promise<CommentThreadReadStateDto> =>
  markCommentThreadRead({ threadId });

type UseCreateCommentThreadMutationParams = {
  mutationConfig?: MutationConfig<typeof createCommentThreadMutationFn>;
};

export function useCreateCommentThreadMutation(params: UseCreateCommentThreadMutationParams = {}) {
  return useMutation({
    mutationFn: createCommentThreadMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Thread baru mengubah daftar thread diagram dan membuat comment list thread baru tersedia.
      queryClient.invalidateQueries({ queryKey: commentKeys.summaries() });
      queryClient.invalidateQueries({ queryKey: commentKeys.threadLists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      queryClient.setQueryData(commentKeys.threadComments(data.thread.id, {}), {
        items: [data.comment],
        nextCursor: null,
        totalCount: 1,
      });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseReplyToCommentThreadMutationParams = {
  mutationConfig?: MutationConfig<typeof replyToCommentThreadMutationFn>;
};

export function useReplyToCommentThreadMutation(params: UseReplyToCommentThreadMutationParams = {}) {
  return useMutation({
    mutationFn: replyToCommentThreadMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Reply bisa reopen thread resolved, jadi thread list dan comment list thread perlu disegarkan bersama.
      queryClient.invalidateQueries({ queryKey: commentKeys.summaries() });
      queryClient.invalidateQueries({ queryKey: commentKeys.threadLists() });
      queryClient.invalidateQueries({ queryKey: commentKeys.commentLists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseReplyToCommentMutationParams = {
  mutationConfig?: MutationConfig<typeof replyToCommentMutationFn>;
};

export function useReplyToCommentMutation(params: UseReplyToCommentMutationParams = {}) {
  return useMutation({
    mutationFn: replyToCommentMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Reply langsung ke comment mengubah root/reply tree dan dapat reopen thread yang sudah resolved.
      queryClient.invalidateQueries({ queryKey: commentKeys.summaries() });
      queryClient.invalidateQueries({ queryKey: commentKeys.threadLists() });
      queryClient.invalidateQueries({ queryKey: commentKeys.commentLists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseUpdateCommentMutationParams = {
  mutationConfig?: MutationConfig<typeof updateCommentMutationFn>;
};

export function useUpdateCommentMutation(params: UseUpdateCommentMutationParams = {}) {
  return useMutation({
    mutationFn: updateCommentMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Edited comments keep the same thread but change the visible comment tree and mention metadata.
      queryClient.invalidateQueries({ queryKey: commentKeys.summaries() });
      queryClient.invalidateQueries({ queryKey: commentKeys.commentLists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseDeleteCommentMutationParams = {
  mutationConfig?: MutationConfig<typeof deleteCommentMutationFn>;
};

export function useDeleteCommentMutation(params: UseDeleteCommentMutationParams = {}) {
  return useMutation({
    mutationFn: deleteCommentMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Soft delete turns the message into a tombstone and can change marker/unread counts, so every comment aggregate is refreshed.
      queryClient.invalidateQueries({ queryKey: commentKeys.summaries() });
      queryClient.invalidateQueries({ queryKey: commentKeys.threadLists() });
      queryClient.invalidateQueries({ queryKey: commentKeys.commentLists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseMarkCommentThreadReadMutationParams = {
  mutationConfig?: MutationConfig<typeof markCommentThreadReadMutationFn>;
};

export function useMarkCommentThreadReadMutation(params: UseMarkCommentThreadReadMutationParams = {}) {
  return useMutation({
    mutationFn: markCommentThreadReadMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Read cursor menurunkan unread badge thread list dan menjaga panel aktif punya state "seen by" terbaru.
      queryClient.invalidateQueries({ queryKey: commentKeys.summaries() });
      queryClient.invalidateQueries({ queryKey: commentKeys.threadLists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      queryClient.setQueryData(commentKeys.readState(data.threadId), data);
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseResolveCommentThreadMutationParams = {
  mutationConfig?: MutationConfig<typeof resolveCommentThreadMutationFn>;
};

export function useResolveCommentThreadMutation(params: UseResolveCommentThreadMutationParams = {}) {
  return useMutation({
    mutationFn: resolveCommentThreadMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Resolve hanya mengubah metadata thread, bukan daftar comment.
      queryClient.invalidateQueries({ queryKey: commentKeys.summaries() });
      queryClient.invalidateQueries({ queryKey: commentKeys.threadLists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type UseUnresolveCommentThreadMutationParams = {
  mutationConfig?: MutationConfig<typeof unresolveCommentThreadMutationFn>;
};

export function useUnresolveCommentThreadMutation(params: UseUnresolveCommentThreadMutationParams = {}) {
  return useMutation({
    mutationFn: unresolveCommentThreadMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Unresolve mengembalikan thread ke list aktif tanpa mengubah isi diskusi.
      queryClient.invalidateQueries({ queryKey: commentKeys.summaries() });
      queryClient.invalidateQueries({ queryKey: commentKeys.threadLists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
