import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthContext } from '../database.js';
import { ProjectCreateDto, ProjectListQueryDto, ProjectListResponseDto } from '../dtos/project.dto.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { clampPaginationLimit } from '../utils/pagination.js';
import { slugify } from '../utils/slug.js';

@Injectable()
export class ProjectService {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly projectRepository: ProjectRepository,
  ) {}

  getAll(auth: AuthContext, query: ProjectListQueryDto): Promise<ProjectListResponseDto> {
    return this.projectRepository.getVisibleToUser(auth.user.id, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
    });
  }

  async create(auth: AuthContext, dto: ProjectCreateDto) {
    // Sign-up already creates a personal organization, so project creation reuses it instead of creating a duplicate slug.
    const existingOrganization = dto.organizationId
      ? null
      : await this.organizationRepository.getFirstForUser(auth.user.id);
    const organizationId =
      dto.organizationId ??
      existingOrganization?.id ??
      (
        await this.organizationRepository.createPersonalOrganization({
          userId: auth.user.id,
          name: `${auth.user.name}'s Workspace`,
        })
      ).id;

    return this.projectRepository.create({
      organizationId,
      name: dto.name,
      slug: slugify(dto.name),
      description: dto.description ?? null,
      createdById: auth.user.id,
    });
  }

  async requireProject(auth: AuthContext, projectId: string) {
    const project = await this.projectRepository.getByIdForUser(auth.user.id, projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }
}
