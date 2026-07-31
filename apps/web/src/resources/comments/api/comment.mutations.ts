import { useMutation } from '@tanstack/react-query';
import type {
  CommentReplyCreateDto,
  CommentResponseDto,
  CommentThreadCreateDto,
  CommentThreadDto,
  CommentThreadReadStateDto,
  CommentThreadResponseDto,
  CommentUpdateDto,
} from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { commentKeys } from './comment.keys';

const createCommentThreadMutationFn = (variables: {
  body: CommentThreadCreateDto;
}): Promise<CommentThreadResponseDto> => sdk.comments.createThread(variables.body);
const replyToCommentThreadMutationFn = (variables: {
  body: CommentReplyCreateDto;
  threadId: string;
}): Promise<CommentThreadResponseDto> => sdk.comments.replyToThread(variables.threadId, variables.body);
const updateCommentMutationFn = (variables: {
  body: CommentUpdateDto;
  commentId: string;
}): Promise<CommentResponseDto> => sdk.comments.updateComment(variables.commentId, variables.body);
const resolveCommentThreadMutationFn = (threadId: string): Promise<CommentThreadDto> =>
  sdk.comments.resolveThread(threadId);
const unresolveCommentThreadMutationFn = (threadId: string): Promise<CommentThreadDto> =>
  sdk.comments.unresolveThread(threadId);
const markCommentThreadReadMutationFn = (threadId: string): Promise<CommentThreadReadStateDto> =>
  sdk.comments.markThreadRead(threadId);

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
