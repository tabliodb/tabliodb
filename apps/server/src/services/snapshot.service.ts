import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { DiagramModel } from '@tabliodb/schema-core';
import { generateMigrationSqlWithWarnings } from '@tabliodb/sql';
import { Permission } from '@tabliodb/shared';
import { AuthContext } from '../database.js';
import { SnapshotCreateDto, SnapshotListQueryDto } from '../dtos/snapshot.dto.js';
import { SnapshotRepository } from '../repositories/snapshot.repository.js';
import { toIsoDateTime } from '../utils/date-time.js';
import { clampPaginationLimit } from '../utils/pagination.js';
import { DiagramService } from './diagram.service.js';
import { ReviewSignalService } from './review-signal.service.js';

@Injectable()
export class SnapshotService {
  constructor(
    private readonly diagramService: DiagramService,
    private readonly reviewSignalService: ReviewSignalService,
    private readonly snapshotRepository: SnapshotRepository,
  ) {}

  async create(auth: AuthContext, dto: SnapshotCreateDto) {
    await this.diagramService.requireDiagram(auth, dto.diagramId, Permission.SnapshotCreate);

    const snapshot = await this.snapshotRepository.create({
      diagramId: dto.diagramId,
      createdById: auth.user.id,
      message: dto.message,
      snapshot: dto.snapshot,
    });

    // Snapshot adalah checkpoint eksplisit; menyimpan ulang signal di sini membuat panel review dan API history tidak basi.
    await this.reviewSignalService.syncDiagramModel(dto.diagramId, dto.snapshot);

    return {
      id: snapshot.id,
      diagramId: snapshot.diagramId,
      version: snapshot.version,
      message: snapshot.message,
      // Kolom JSON di database bertipe longgar; input sudah divalidasi DiagramModelSchema sebelum disimpan.
      snapshot: snapshot.snapshot as DiagramModel,
      restoredFromSnapshotId: snapshot.restoredFromSnapshotId,
      createdAt: toIsoDateTime(snapshot.createdAt),
    };
  }

  async getByDiagram(auth: AuthContext, diagramId: string, query: SnapshotListQueryDto) {
    await this.diagramService.requireDiagram(auth, diagramId, Permission.SnapshotRead);

    const snapshots = await this.snapshotRepository.getByDiagram(diagramId, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
    });

    return {
      ...snapshots,
      items: snapshots.items.map((snapshot) => ({
        ...snapshot,
        // Snapshot history dikirim sebagai JSON murni agar generated SDK tidak membawa tipe Date browser yang palsu.
        createdAt: toIsoDateTime(snapshot.createdAt),
      })),
    };
  }

  async getDiff(auth: AuthContext, fromSnapshotId: string, toSnapshotId: string) {
    const [fromSnapshot, toSnapshot] = await Promise.all([
      this.snapshotRepository.getById(fromSnapshotId),
      this.snapshotRepository.getById(toSnapshotId),
    ]);

    if (!fromSnapshot || !toSnapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    if (fromSnapshot.diagramId !== toSnapshot.diagramId) {
      throw new BadRequestException('Snapshots must belong to the same diagram');
    }

    await this.diagramService.requireDiagram(auth, fromSnapshot.diagramId, Permission.SnapshotRead);

    return createSnapshotDiff(
      {
        ...fromSnapshot,
        snapshot: fromSnapshot.snapshot as DiagramModel,
      },
      {
        ...toSnapshot,
        snapshot: toSnapshot.snapshot as DiagramModel,
      },
    );
  }

  async restore(auth: AuthContext, snapshotId: string) {
    const sourceSnapshot = await this.snapshotRepository.getById(snapshotId);
    if (!sourceSnapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    await this.diagramService.requireDiagram(auth, sourceSnapshot.diagramId, Permission.SnapshotCreate);

    const restoredSnapshot = await this.snapshotRepository.restore(snapshotId, auth.user.id);
    if (!restoredSnapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    // Restore membuat checkpoint baru dan menghidrasi diagram_documents, jadi review cache harus ikut membaca model hasil restore.
    await this.reviewSignalService.syncDiagramModel(
      restoredSnapshot.diagramId,
      restoredSnapshot.snapshot as DiagramModel,
    );

    return {
      id: restoredSnapshot.id,
      diagramId: restoredSnapshot.diagramId,
      version: restoredSnapshot.version,
      message: restoredSnapshot.message,
      snapshot: restoredSnapshot.snapshot as DiagramModel,
      restoredFromSnapshotId: restoredSnapshot.restoredFromSnapshotId,
      createdAt: toIsoDateTime(restoredSnapshot.createdAt),
    };
  }
}

type SnapshotDiffSource = NonNullable<Awaited<ReturnType<SnapshotRepository['getById']>>> & {
  snapshot: DiagramModel;
};

function createSnapshotDiff(fromSnapshot: SnapshotDiffSource, toSnapshot: SnapshotDiffSource) {
  const fromModel = fromSnapshot.snapshot;
  const toModel = toSnapshot.snapshot;
  const tableChanges = countRecordChanges(fromModel.tables, toModel.tables, omitTableName);
  const migrationSql = generateMigrationSqlWithWarnings(fromModel, toModel, {
    dialect: toModel.dialect,
    includeComments: true,
  });

  return {
    fromSnapshot: toSnapshotReference(fromSnapshot),
    toSnapshot: toSnapshotReference(toSnapshot),
    migrationSql: {
      dialect: toModel.dialect,
      // The preview is generated from canonical models, not from already summarized counts, so SQL details stay aligned with entity IDs.
      sql: migrationSql.sql,
      warnings: migrationSql.warnings,
    },
    tables: {
      ...tableChanges,
      // Rename dipisahkan dari perubahan visual table seperti position/width/color supaya diff lebih mudah dibaca manusia.
      renamed: Object.keys(fromModel.tables)
        .filter((tableId) => toModel.tables[tableId] && fromModel.tables[tableId].name !== toModel.tables[tableId].name)
        .map((tableId) => ({
          id: tableId,
          fromName: fromModel.tables[tableId].name,
          toName: toModel.tables[tableId].name,
        })),
    },
    columns: countRecordChanges(fromModel.columns, toModel.columns),
    relationships: countRecordChanges(fromModel.relationships, toModel.relationships),
    indexes: countRecordChanges(fromModel.indexes, toModel.indexes),
    enums: countRecordChanges(fromModel.enums, toModel.enums),
    checks: countRecordChanges(fromModel.checks, toModel.checks),
    notes: countRecordChanges(fromModel.notes, toModel.notes),
    groups: countRecordChanges(fromModel.groups, toModel.groups),
    dialectChanged: fromModel.dialect !== toModel.dialect,
    metadataChanged:
      stableStringify(omitUpdatedAt(fromModel.metadata)) !== stableStringify(omitUpdatedAt(toModel.metadata)),
    schemaVersionChanged: fromModel.schemaVersion !== toModel.schemaVersion,
  };
}

function countRecordChanges<T>(
  fromRecord: Record<string, T>,
  toRecord: Record<string, T>,
  normalize: (value: T) => unknown = (value) => value,
) {
  const fromIds = new Set(Object.keys(fromRecord));
  const toIds = new Set(Object.keys(toRecord));
  const commonIds = [...fromIds].filter((id) => toIds.has(id));

  return {
    added: [...toIds].filter((id) => !fromIds.has(id)).length,
    removed: [...fromIds].filter((id) => !toIds.has(id)).length,
    changed: commonIds.filter(
      (id) => stableStringify(normalize(fromRecord[id])) !== stableStringify(normalize(toRecord[id])),
    ).length,
  };
}

function toSnapshotReference(snapshot: SnapshotDiffSource) {
  return {
    id: snapshot.id,
    diagramId: snapshot.diagramId,
    version: snapshot.version,
    message: snapshot.message,
    restoredFromSnapshotId: snapshot.restoredFromSnapshotId,
    createdAt: toIsoDateTime(snapshot.createdAt),
  };
}

function omitTableName(table: DiagramModel['tables'][string]) {
  const { name: _name, ...rest } = table;

  return rest;
}

function omitUpdatedAt(metadata: DiagramModel['metadata']) {
  const { updatedAt: _updatedAt, ...rest } = metadata;

  return rest;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, item]) => [key, sortJsonValue(item)]),
  );
}
