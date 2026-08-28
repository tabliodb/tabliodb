import { Injectable } from '@nestjs/common';
import type { Insertable } from 'kysely';
import { Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { AuditLogTable, DB, JsonValue } from '../schema/index.js';
import { decodeOffsetCursor, encodeOffsetCursor } from '../utils/pagination.js';

export type AuditLogListOptions = {
  cursor?: string;
  limit: number;
  organizationId: string;
};

export type AuditLogCreateOptions = Insertable<AuditLogTable>;

@Injectable()
export class AuditLogRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  create(dto: AuditLogCreateOptions) {
    return this.db.insertInto('audit_logs').values(dto).execute();
  }

  async listForOrganization(options: AuditLogListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await this.db
      .selectFrom('audit_logs')
      .leftJoin('users', 'users.id', 'audit_logs.actorId')
      .select([
        'audit_logs.id',
        'audit_logs.organizationId',
        'audit_logs.folderId',
        'audit_logs.diagramId',
        'audit_logs.actorId',
        'users.name as actorName',
        'users.email as actorEmail',
        'audit_logs.action',
        'audit_logs.entityType',
        'audit_logs.entityId',
        'audit_logs.metadata',
        'audit_logs.ipAddress',
        'audit_logs.userAgent',
        'audit_logs.requestId',
        'audit_logs.createdAt',
      ])
      .where('audit_logs.organizationId', '=', options.organizationId)
      .orderBy('audit_logs.createdAt', 'desc')
      .orderBy('audit_logs.id', 'desc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('audit_logs')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('organizationId', '=', options.organizationId)
      .executeTakeFirstOrThrow();

    return {
      // Audit logs are offset-paginated for the first UI pass; the response contract can later move to keyset cursors.
      items: rows.slice(0, options.limit).map((row) => ({
        ...row,
        metadata: row.metadata as JsonValue,
      })),
      nextCursor: rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.count),
    };
  }
}
