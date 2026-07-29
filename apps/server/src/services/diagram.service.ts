import { Injectable, NotFoundException } from '@nestjs/common';
import type { DatabaseDialect } from '@tabliodb/schema-core';
import { AuthContext } from '../database.js';
import { DiagramCreateDto, DiagramListQueryDto } from '../dtos/diagram.dto.js';
import { DiagramRepository } from '../repositories/diagram.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { toIsoDateTime } from '../utils/date-time.js';
import { clampPaginationLimit } from '../utils/pagination.js';

@Injectable()
export class DiagramService {
  constructor(
    private readonly diagramRepository: DiagramRepository,
    private readonly projectRepository: ProjectRepository,
  ) {}

  async create(auth: AuthContext, dto: DiagramCreateDto) {
    const project = await this.projectRepository.getByIdForUser(auth.user.id, dto.projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const diagram = await this.diagramRepository.create({
      projectId: dto.projectId,
      name: dto.name,
      dialect: dto.dialect,
      createdById: auth.user.id,
    });

    return {
      id: diagram.id,
      projectId: diagram.projectId,
      name: diagram.name,
      // Kysely membaca kolom dialect sebagai text karena database menyimpannya generik, sedangkan kontrak API mengekspos union dialect canonical.
      dialect: diagram.dialect as DatabaseDialect,
      createdAt: toIsoDateTime(diagram.createdAt),
      updatedAt: toIsoDateTime(diagram.updatedAt),
    };
  }

  async getByProject(auth: AuthContext, projectId: string, query: DiagramListQueryDto) {
    const project = await this.projectRepository.getByIdForUser(auth.user.id, projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const diagrams = await this.diagramRepository.getByProject(projectId, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
    });

    return {
      ...diagrams,
      items: diagrams.items.map((diagram) => ({
        ...diagram,
        // Response list mengikuti bentuk JSON yang diterima SDK: timestamp ISO string, bukan Date object server-side.
        createdAt: toIsoDateTime(diagram.createdAt),
        updatedAt: toIsoDateTime(diagram.updatedAt),
      })),
    };
  }

  async requireDiagram(auth: AuthContext, diagramId: string) {
    const role = await this.projectRepository.getDiagramRole(auth.user.id, diagramId);
    if (!role) {
      throw new NotFoundException('Diagram not found');
    }

    const diagram = await this.diagramRepository.getById(diagramId);
    if (!diagram) {
      throw new NotFoundException('Diagram not found');
    }

    return diagram;
  }
}
