import { Injectable } from '@nestjs/common';
import { Kysely, sql, type Insertable } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, DiagramShareLinkTable, JsonValue } from '../schema/index.js';
import { decodeOffsetCursor, encodeOffsetCursor } from '../utils/pagination.js';

export type DiagramShareLinkListOptions = {
  cursor?: string;
  limit: number;
};

export type DiagramShareLinkCreateRecord = Insertable<DiagramShareLinkTable>;

export type DiagramShareLinkRecord = {
  accessCount: number;
  createdAt: Date | string;
  createdById: string;
  createdByName: string;
  diagramId: string;
  expiresAt: Date | string | null;
  id: string;
  label: string | null;
  lastUsedAt: Date | string | null;
  revokedAt: Date | string | null;
  snapshotId: string | null;
  targetType: 'diagram' | 'snapshot';
  updatedAt: Date | string;
};

export type DiagramShareLinkAccessContext = {
  dialect: string;
  diagramId: string;
  diagramName: string;
  organizationId: string;
  organizationName: string;
  folderId: string | null;
  folderName: string | null;
};

export type PublicDiagramShareLinkRecord = DiagramShareLinkRecord &
  DiagramShareLinkAccessContext & {
    snapshotCreatedAt: Date | string | null;
    snapshotMessage: string | null;
    snapshotModel: JsonValue | null;
    snapshotVersion: number | null;
  };

@Injectable()
export class DiagramShareLinkRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  async create(record: DiagramShareLinkCreateRecord): Promise<DiagramShareLinkRecord> {
    const shareLink = await this.db
      .insertInto('diagram_share_links')
      .values(record)
      .returning('id')
      .executeTakeFirstOrThrow();

    return this.getByIdForDiagram(record.diagramId, shareLink.id) as Promise<DiagramShareLinkRecord>;
  }

  async getByIdForDiagram(diagramId: string, shareLinkId: string): Promise<DiagramShareLinkRecord | undefined> {
    const row = await this.baseShareLinkQuery()
      .where('diagram_share_links.diagramId', '=', diagramId)
      .where('diagram_share_links.id', '=', shareLinkId)
      .executeTakeFirst();

    return row ? this.toShareLinkRecord(row) : undefined;
  }

  async getDiagramAccessContext(diagramId: string): Promise<DiagramShareLinkAccessContext | undefined> {
    return this.db
      .selectFrom('diagrams')
      .leftJoin('folders', 'folders.id', 'diagrams.folderId')
      .innerJoin('organizations', 'organizations.id', 'diagrams.organizationId')
      .select([
        'diagrams.id as diagramId',
        'diagrams.name as diagramName',
        'diagrams.dialect',
        'diagrams.folderId',
        'folders.name as folderName',
        'organizations.id as organizationId',
        'organizations.name as organizationName',
      ])
      .where('diagrams.id', '=', diagramId)
      .where('diagrams.archivedAt', 'is', null)
      .where((eb) => eb.or([eb('diagrams.folderId', 'is', null), eb('folders.archivedAt', 'is', null)]))
      .where('organizations.archivedAt', 'is', null)
      .executeTakeFirst();
  }

  async getByDiagram(diagramId: string, options: DiagramShareLinkListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await this.baseShareLinkQuery()
      .where('diagram_share_links.diagramId', '=', diagramId)
      .orderBy('diagram_share_links.createdAt', 'desc')
      .orderBy('diagram_share_links.id', 'desc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('diagram_share_links')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('diagramId', '=', diagramId)
      .executeTakeFirstOrThrow();

    return {
      // Share links dipaginasi sejak awal karena enterprise folder bisa membuat banyak link untuk stakeholder berbeda.
      items: rows.slice(0, options.limit).map((row) => this.toShareLinkRecord(row)),
      nextCursor: rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.count),
    };
  }

  async getActiveByTokenHash(tokenHash: Buffer): Promise<PublicDiagramShareLinkRecord | undefined> {
    const row = await this.baseShareLinkQuery()
      .innerJoin('diagrams', 'diagrams.id', 'diagram_share_links.diagramId')
      .leftJoin('folders', 'folders.id', 'diagrams.folderId')
      .innerJoin('organizations', 'organizations.id', 'diagrams.organizationId')
      .leftJoin('diagram_snapshots', 'diagram_snapshots.id', 'diagram_share_links.snapshotId')
      .select([
        'diagrams.name as diagramName',
        'diagrams.dialect',
        'diagrams.folderId',
        'folders.name as folderName',
        'organizations.id as organizationId',
        'organizations.name as organizationName',
        'diagram_snapshots.version as snapshotVersion',
        'diagram_snapshots.message as snapshotMessage',
        'diagram_snapshots.snapshot as snapshotModel',
        'diagram_snapshots.createdAt as snapshotCreatedAt',
      ])
      .where('diagram_share_links.tokenHash', '=', tokenHash)
      .where('diagram_share_links.revokedAt', 'is', null)
      .where((eb) =>
        eb.or([eb('diagram_share_links.expiresAt', 'is', null), eb('diagram_share_links.expiresAt', '>', new Date())]),
      )
      .where('diagrams.archivedAt', 'is', null)
      .where((eb) => eb.or([eb('diagrams.folderId', 'is', null), eb('folders.archivedAt', 'is', null)]))
      .where('organizations.archivedAt', 'is', null)
      .executeTakeFirst();

    return row
      ? {
          ...this.toShareLinkRecord(row),
          dialect: row.dialect,
          diagramName: row.diagramName,
          organizationId: row.organizationId,
          organizationName: row.organizationName,
          folderId: row.folderId,
          folderName: row.folderName,
          snapshotCreatedAt: row.snapshotCreatedAt,
          snapshotMessage: row.snapshotMessage,
          snapshotModel: row.snapshotModel as JsonValue | null,
          snapshotVersion: row.snapshotVersion,
        }
      : undefined;
  }

  async hasSnapshotInDiagram(diagramId: string, snapshotId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('diagram_snapshots')
      .select('id')
      .where('id', '=', snapshotId)
      .where('diagramId', '=', diagramId)
      .executeTakeFirst();

    return Boolean(row);
  }

  async markUsed(shareLinkId: string): Promise<void> {
    await this.db
      .updateTable('diagram_share_links')
      .set({
        accessCount: sql<number>`access_count + 1`,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where('id', '=', shareLinkId)
      .execute();
  }

  async revoke(diagramId: string, shareLinkId: string): Promise<DiagramShareLinkRecord | undefined> {
    const shareLink = await this.db
      .updateTable('diagram_share_links')
      .set({
        // Revoke bersifat soft-delete supaya audit dan UI masih bisa menjelaskan link mana yang dimatikan.
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where('diagramId', '=', diagramId)
      .where('id', '=', shareLinkId)
      .where('revokedAt', 'is', null)
      .returning('id')
      .executeTakeFirst();

    return shareLink ? this.getByIdForDiagram(diagramId, shareLink.id) : undefined;
  }

  private baseShareLinkQuery() {
    return this.db
      .selectFrom('diagram_share_links')
      .innerJoin('users as created_by', 'created_by.id', 'diagram_share_links.createdById')
      .select([
        'diagram_share_links.id',
        'diagram_share_links.diagramId',
        'diagram_share_links.snapshotId',
        'diagram_share_links.targetType',
        'diagram_share_links.label',
        'diagram_share_links.expiresAt',
        'diagram_share_links.revokedAt',
        'diagram_share_links.createdById',
        'created_by.name as createdByName',
        'diagram_share_links.accessCount',
        'diagram_share_links.lastUsedAt',
        'diagram_share_links.createdAt',
        'diagram_share_links.updatedAt',
      ]);
  }

  private toShareLinkRecord(row: DiagramShareLinkRecord): DiagramShareLinkRecord {
    return {
      ...row,
      // Check constraint menjaga nilai target_type; cast ini membuat service tidak perlu membawa string mentah database.
      targetType: row.targetType,
    };
  }
}
