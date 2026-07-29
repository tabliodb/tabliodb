import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB } from '../schema/index.js';

@Injectable()
export class CommentRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  createThreadWithComment(options: {
    diagramId: string;
    targetType: string;
    targetId: string;
    body: string;
    createdById: string;
  }) {
    return this.db.transaction().execute(async (tx) => {
      const thread = await tx
        .insertInto('comment_threads')
        .values({
          diagramId: options.diagramId,
          targetType: options.targetType,
          targetId: options.targetId,
          createdById: options.createdById,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const comment = await tx
        .insertInto('comments')
        .values({
          threadId: thread.id,
          body: options.body,
          createdById: options.createdById,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return { thread, comment };
    });
  }

  getThreads(diagramId: string) {
    return this.db
      .selectFrom('comment_threads')
      .selectAll()
      .where('diagramId', '=', diagramId)
      .orderBy('updatedAt', 'desc')
      .execute();
  }
}
