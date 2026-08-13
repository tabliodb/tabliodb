import type { AwarenessState } from '@tabliodb/shared';
import type { CommentTargetType } from '@/resources/comments';

export type EditorCommentTarget = {
  targetId: string | null;
  targetType: CommentTargetType;
};

export type CommentTargetReference = {
  targetId: string | null;
  targetType: CommentTargetType;
};

export type CommentThreadOpenRequest = {
  requestId: number;
  target: CommentTargetReference;
};

export type CommentTypingPresence = {
  clientIds: number[];
  parentCommentId: string | null;
  threadId: string;
  updatedAt: number;
  user: AwarenessState['user'];
};
