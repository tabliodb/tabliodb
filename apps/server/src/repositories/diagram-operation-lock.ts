import { ConflictException } from '@nestjs/common';
import { sql, type Kysely, type Transaction } from 'kysely';
import type { DB } from '../schema/index.js';

export type DiagramOperationLockKind = 'diagram_import_replace' | 'snapshot_create' | 'snapshot_restore';

const DIAGRAM_OPERATION_LOCK_NAMESPACE = 742036911;

export async function acquireDiagramOperationLock(
  db: Kysely<DB> | Transaction<DB>,
  diagramId: string,
  _operation: DiagramOperationLockKind,
): Promise<void> {
  // PostgreSQL advisory transaction lock menjaga operasi pengganti model tetap serial per diagram dan otomatis lepas saat transaction selesai.
  const result = await sql<{ locked: boolean }>`
    select pg_try_advisory_xact_lock(${DIAGRAM_OPERATION_LOCK_NAMESPACE}::integer, hashtext(${diagramId})::integer) as locked
  `.execute(db);

  if (!result.rows[0]?.locked) {
    throw new ConflictException({
      code: 'diagram_operation_in_progress',
      message:
        'Another import, restore, or snapshot save is already running for this diagram. Wait a moment and try again.',
      statusCode: 409,
    });
  }
}
