import { Injectable } from '@nestjs/common';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { BackgroundJobTable, DB, JsonValue } from '../schema/index.js';

export type BackgroundJobRecord = Selectable<BackgroundJobTable>;

export type BackgroundJobEnqueueOptions = {
  maxAttempts?: number;
  payload: JsonValue;
  priority?: number;
  queue?: string;
  scheduledAt?: Date;
  type: string;
};

export type BackgroundJobClaimOptions = {
  limit: number;
  queues: string[];
  workerId: string;
};

@Injectable()
export class BackgroundJobRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  enqueue(options: BackgroundJobEnqueueOptions): Promise<BackgroundJobRecord> {
    const values: Insertable<BackgroundJobTable> = {
      maxAttempts: options.maxAttempts,
      payload: options.payload,
      priority: options.priority,
      queue: options.queue,
      scheduledAt: options.scheduledAt,
      type: options.type,
    };

    return this.db.insertInto('background_jobs').values(values).returningAll().executeTakeFirstOrThrow();
  }

  async claimNextBatch(options: BackgroundJobClaimOptions): Promise<BackgroundJobRecord[]> {
    if (options.limit <= 0 || options.queues.length === 0) {
      return [];
    }

    return this.db.transaction().execute(async (tx) => {
      const candidateRows = await tx
        .selectFrom('background_jobs')
        .select('id')
        .where('queue', 'in', options.queues)
        .where('status', '=', 'queued')
        .where('scheduledAt', '<=', new Date())
        .orderBy('priority', 'desc')
        .orderBy('scheduledAt', 'asc')
        .orderBy('createdAt', 'asc')
        .limit(options.limit)
        // Row-level locks let multiple server instances poll safely without double-processing the same job.
        .forUpdate()
        .skipLocked()
        .execute();
      const ids = candidateRows.map((row) => row.id);

      if (ids.length === 0) {
        return [];
      }

      return tx
        .updateTable('background_jobs')
        .set({
          attempts: (eb) => eb('attempts', '+', 1),
          lockedAt: new Date(),
          lockedBy: options.workerId,
          startedAt: (eb) => eb.fn.coalesce('startedAt', eb.val(new Date())),
          status: 'running',
          updatedAt: new Date(),
        })
        .where('id', 'in', ids)
        .returningAll()
        .execute();
    });
  }

  complete(jobId: string, result: JsonValue): Promise<BackgroundJobRecord> {
    return this.db
      .updateTable('background_jobs')
      .set({
        completedAt: new Date(),
        error: null,
        lockedAt: null,
        lockedBy: null,
        result,
        status: 'completed',
        updatedAt: new Date(),
      })
      .where('id', '=', jobId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  fail(job: BackgroundJobRecord, error: JsonValue, retryAt: Date): Promise<BackgroundJobRecord> {
    const hasAttemptsLeft = job.attempts < job.maxAttempts;

    return this.db
      .updateTable('background_jobs')
      .set({
        error,
        failedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        scheduledAt: hasAttemptsLeft ? retryAt : new Date(),
        status: hasAttemptsLeft ? 'queued' : 'dead',
        updatedAt: new Date(),
      })
      .where('id', '=', job.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async requeueExpiredRunningJobs(lockTtlMs: number): Promise<BackgroundJobRecord[]> {
    const staleBefore = new Date(Date.now() - lockTtlMs);

    const retryableJobs = await this.db
      .updateTable('background_jobs')
      .set({
        error: {
          message: 'Job lock expired before completion.',
          name: 'BackgroundJobLockExpired',
        },
        failedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        scheduledAt: new Date(),
        status: 'queued',
        updatedAt: new Date(),
      })
      .where('status', '=', 'running')
      .where('lockedAt', '<', staleBefore)
      .where('attempts', '<', (eb) => eb.ref('maxAttempts'))
      .returningAll()
      .execute();
    const exhaustedJobs = await this.db
      .updateTable('background_jobs')
      .set({
        error: {
          message: 'Job lock expired after the maximum attempts.',
          name: 'BackgroundJobLockExpired',
        },
        failedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        status: 'dead',
        updatedAt: new Date(),
      })
      .where('status', '=', 'running')
      .where('lockedAt', '<', staleBefore)
      .where('attempts', '>=', (eb) => eb.ref('maxAttempts'))
      .returningAll()
      .execute();

    return [...retryableJobs, ...exhaustedJobs];
  }
}
