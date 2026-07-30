import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { DatabaseDialect } from '@tabliodb/schema-core';
import { Permission, ProjectRole, isGranted, permissionsForProjectRole } from '@tabliodb/shared';
import { AuthContext } from '../database.js';
import { DiagramCreateDto, DiagramListQueryDto, DiagramResponseDto, DiagramUpdateDto } from '../dtos/diagram.dto.js';
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

  async create(auth: AuthContext, dto: DiagramCreateDto): Promise<DiagramResponseDto> {
    const project = await this.projectRepository.getByIdForUser(auth.user.id, dto.projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    this.assertProjectPermission(project.projectRole, Permission.DiagramCreate);

    const diagram = await this.diagramRepository.create({
      projectId: dto.projectId,
      name: dto.name,
      dialect: dto.dialect,
      createdById: auth.user.id,
    });

    return this.serializeDiagram(diagram);
  }

  async getByProject(auth: AuthContext, projectId: string, query: DiagramListQueryDto) {
    const project = await this.projectRepository.getByIdForUser(auth.user.id, projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    this.assertProjectPermission(project.projectRole, Permission.DiagramRead);

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

  async requireDiagram(auth: AuthContext, diagramId: string, permission: Permission = Permission.DiagramRead) {
    const role = await this.projectRepository.getDiagramRole(auth.user.id, diagramId);
    if (!role) {
      throw new NotFoundException('Diagram not found');
    }

    this.assertProjectPermission(role.role, permission);

    const diagram = await this.diagramRepository.getById(diagramId);
    if (!diagram) {
      throw new NotFoundException('Diagram not found');
    }

    return diagram;
  }

  async update(auth: AuthContext, diagramId: string, dto: DiagramUpdateDto): Promise<DiagramResponseDto> {
    if (dto.name === undefined && dto.dialect === undefined) {
      throw new BadRequestException('At least one diagram field is required');
    }

    const nextName = dto.name?.trim();
    if (dto.name !== undefined && !nextName) {
      throw new BadRequestException('Diagram name is required');
    }

    // requireDiagram centralizes project-role lookup, archived filtering, and permission enforcement for every diagram write.
    await this.requireDiagram(auth, diagramId, Permission.DiagramUpdate);

    const diagram = await this.diagramRepository.update(diagramId, {
      dialect: dto.dialect,
      name: nextName,
    });

    if (!diagram) {
      throw new NotFoundException('Diagram not found');
    }

    return this.serializeDiagram(diagram);
  }

  private assertProjectPermission(role: ProjectRole, permission: Permission): void {
    if (
      !isGranted({
        current: permissionsForProjectRole(role),
        requested: [permission],
      })
    ) {
      throw new ForbiddenException(`${permission} permission is required`);
    }
  }

  private serializeDiagram(
    diagram: NonNullable<Awaited<ReturnType<DiagramRepository['getById']>>>,
  ): DiagramResponseDto {
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
}
