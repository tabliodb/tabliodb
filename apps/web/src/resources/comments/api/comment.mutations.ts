import { useMutation } from '@tanstack/react-query';
import type {
  CommentReplyCreateDto,
  CommentThreadCreateDto,
  CommentThreadDto,
  CommentThreadResponseDto,
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
const resolveCommentThreadMutationFn = (threadId: string): Promise<CommentThreadDto> =>
  sdk.comments.resolveThread(threadId);
const unresolveCommentThreadMutationFn = (threadId: string): Promise<CommentThreadDto> =>
  sdk.comments.unresolveThread(threadId);

type UseCreateCommentThreadMutationParams = {
  mutationConfig?: MutationConfig<typeof createCommentThreadMutationFn>;
};

export function useCreateCommentThreadMutation(params: UseCreateCommentThreadMutationParams = {}) {
  return useMutation({
    mutationFn: createCommentThreadMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Thread baru mengubah daftar thread diagram dan membuat comment list thread baru tersedia.
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
      queryClient.invalidateQueries({ queryKey: commentKeys.threadLists() });
      queryClient.invalidateQueries({ queryKey: commentKeys.commentLists() });
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
      queryClient.invalidateQueries({ queryKey: commentKeys.threadLists() });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
