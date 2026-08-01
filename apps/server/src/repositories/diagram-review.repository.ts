import { Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB } from '../schema/index.js';
import { decodeOffsetCursor, encodeOffsetCursor } from '../utils/pagination.js';

export type DiagramReviewAction = 'approved' | 'changes_requested' | 'commented';
export type DiagramReviewStatus = 'approved' | 'changes_requested' | 'draft' | 'reviewed';

export type DiagramReviewEventListOptions = {
  cursor?: string;
  limit: number;
};

@Injectable()
export class DiagramReviewRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  getDiagramReviewScope(diagramId: string) {
    return this.db
      .selectFrom('diagrams')
      .innerJoin('projects', 'projects.id', 'diagrams.projectId')
      .select([
        'diagrams.id',
        'diagrams.projectId',
        'diagrams.currentSnapshotId',
        'diagrams.status',
        'projects.organizationId',
      ])
      .where('diagrams.id', '=', diagramId)
      .where('diagrams.archivedAt', 'is', null)
      .where('projects.archivedAt', 'is', null)
      .executeTakeFirst();
  }

  async createReviewEvent(options: {
    action: DiagramReviewAction;
    createdById: string;
    diagramId: string;
    message: string | null;
  }) {
    return this.db.transaction().execute(async (tx) => {
      const current = await tx
        .selectFrom('diagrams')
        .innerJoin('projects', 'projects.id', 'diagrams.projectId')
        .select([
          'diagrams.id',
          'diagrams.projectId',
          'diagrams.currentSnapshotId',
          'diagrams.status',
          'projects.organizationId',
        ])
        .where('diagrams.id', '=', options.diagramId)
        .where('diagrams.archivedAt', 'is', null)
        .where('projects.archivedAt', 'is', null)
        .executeTakeFirstOrThrow();
      const now = new Date();
      const nextStatus = getNextDiagramReviewStatus(current.status, options.action);

      await tx
        .updateTable('diagrams')
        .set({
          status: nextStatus,
          updatedAt: now,
        })
        .where('id', '=', options.diagramId)
        .where('archivedAt', 'is', null)
        .execute();

      const event = await tx
        .insertInto('diagram_review_events')
        .values({
          action: options.action,
          createdById: options.createdById,
          diagramId: options.diagramId,
          message: options.message,
          nextStatus,
          previousStatus: current.status,
          // Review event dikaitkan dengan snapshot aktif bila ada, sehingga keputusan reviewer punya konteks versi schema.
          snapshotId: current.currentSnapshotId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return {
        event,
        scope: {
          ...current,
          status: nextStatus,
        },
      };
    });
  }

  async getReviewSummary(diagramId: string) {
    const diagram = await this.getDiagramReviewScope(diagramId);

    if (!diagram) {
      return undefined;
    }

    const [latestEvent, countsRow, recentEvents] = await Promise.all([
      this.createEventResponseQuery()
        .where('diagram_review_events.diagramId', '=', diagramId)
        .orderBy('diagram_review_events.createdAt', 'desc')
        .orderBy('diagram_review_events.id', 'desc')
        .limit(1)
        .executeTakeFirst(),
      this.db
        .selectFrom('diagram_review_events')
        .select([
          sql<number>`count(*)::int`.as('eventCount'),
          sql<number>`count(*) filter (where action = 'commented')::int`.as('commentedCount'),
          sql<number>`count(*) filter (where action = 'approved')::int`.as('approvedCount'),
          sql<number>`count(*) filter (where action = 'changes_requested')::int`.as('changesRequestedCount'),
        ])
        .where('diagramId', '=', diagramId)
        .executeTakeFirstOrThrow(),
      this.createEventResponseQuery()
        .where('diagram_review_events.diagramId', '=', diagramId)
        .orderBy('diagram_review_events.createdAt', 'desc')
        .orderBy('diagram_review_events.id', 'desc')
        .limit(8)
        .execute(),
    ]);

    return {
      approvedCount: Number(countsRow.approvedCount),
      changesRequestedCount: Number(countsRow.changesRequestedCount),
      commentedCount: Number(countsRow.commentedCount),
      diagram,
      eventCount: Number(countsRow.eventCount),
      latestEvent,
      recentEvents,
    };
  }

  async listReviewEvents(diagramId: string, options: DiagramReviewEventListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await this.createEventResponseQuery()
      .where('diagram_review_events.diagramId', '=', diagramId)
      .orderBy('diagram_review_events.createdAt', 'desc')
      .orderBy('diagram_review_events.id', 'desc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('diagram_review_events')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('diagramId', '=', diagramId)
      .executeTakeFirstOrThrow();

    return {
      items: rows.slice(0, options.limit),
      nextCursor: rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.count),
    };
  }

  private createEventResponseQuery() {
    return this.db
      .selectFrom('diagram_review_events')
      .innerJoin('users', 'users.id', 'diagram_review_events.createdById')
      .select([
        'diagram_review_events.id',
        'diagram_review_events.diagramId',
        'diagram_review_events.snapshotId',
        'diagram_review_events.action',
        'diagram_review_events.previousStatus',
        'diagram_review_events.nextStatus',
        'diagram_review_events.message',
        'diagram_review_events.createdById',
        'diagram_review_events.createdAt',
        'users.id as reviewerId',
        'users.email as reviewerEmail',
        'users.name as reviewerName',
        sql<string | null>`case
          when users.avatar_file_id is null then null
          else concat('/api/files/', users.avatar_file_id::text)
        end`.as('reviewerAvatarUrl'),
        'users.cursorColor as reviewerCursorColor',
      ]);
  }
}

function getNextDiagramReviewStatus(
  currentStatus: DiagramReviewStatus,
  action: DiagramReviewAction,
): DiagramReviewStatus {
  if (action === 'approved') {
    return 'approved';
  }

  if (action === 'changes_requested') {
    return 'changes_requested';
  }

  // Commenting should mark a fresh draft as reviewed, but it should not downgrade an explicit final review decision.
  return currentStatus === 'draft' ? 'reviewed' : currentStatus;
}
