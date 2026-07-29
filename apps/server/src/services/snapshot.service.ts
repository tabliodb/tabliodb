import { Injectable } from '@nestjs/common';
import { AuthContext } from '../database.js';
import { SnapshotCreateDto } from '../dtos/snapshot.dto.js';
import { SnapshotRepository } from '../repositories/snapshot.repository.js';
import { DiagramService } from './diagram.service.js';

@Injectable()
export class SnapshotService {
  constructor(
    private readonly diagramService: DiagramService,
    private readonly snapshotRepository: SnapshotRepository,
  ) {}

  async create(auth: AuthContext, dto: SnapshotCreateDto) {
    await this.diagramService.requireDiagram(auth, dto.diagramId);

    return this.snapshotRepository.create({
      diagramId: dto.diagramId,
      createdById: auth.user.id,
      message: dto.message,
      snapshot: dto.snapshot,
    });
  }

  async getByDiagram(auth: AuthContext, diagramId: string) {
    await this.diagramService.requireDiagram(auth, diagramId);
    return this.snapshotRepository.getByDiagram(diagramId);
  }
}
