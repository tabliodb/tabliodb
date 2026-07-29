import { Injectable } from '@nestjs/common';
import type { DiagramModel } from '@tabliodb/schema-core';
import { AuthContext } from '../database.js';
import { SnapshotCreateDto, SnapshotListQueryDto } from '../dtos/snapshot.dto.js';
import { SnapshotRepository } from '../repositories/snapshot.repository.js';
import { toIsoDateTime } from '../utils/date-time.js';
import { clampPaginationLimit } from '../utils/pagination.js';
import { DiagramService } from './diagram.service.js';

@Injectable()
export class SnapshotService {
  constructor(
    private readonly diagramService: DiagramService,
    private readonly snapshotRepository: SnapshotRepository,
  ) {}

  async create(auth: AuthContext, dto: SnapshotCreateDto) {
    await this.diagramService.requireDiagram(auth, dto.diagramId);

    const snapshot = await this.snapshotRepository.create({
      diagramId: dto.diagramId,
      createdById: auth.user.id,
      message: dto.message,
      snapshot: dto.snapshot,
    });

    return {
      id: snapshot.id,
      diagramId: snapshot.diagramId,
      version: snapshot.version,
      message: snapshot.message,
      // Kolom JSON di database bertipe longgar; input sudah divalidasi DiagramModelSchema sebelum disimpan.
      snapshot: snapshot.snapshot as DiagramModel,
      createdAt: toIsoDateTime(snapshot.createdAt),
    };
  }

  async getByDiagram(auth: AuthContext, diagramId: string, query: SnapshotListQueryDto) {
    await this.diagramService.requireDiagram(auth, diagramId);

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
}
