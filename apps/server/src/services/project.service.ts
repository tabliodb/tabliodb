import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthContext } from '../database.js';
import {
  ProjectCreateDto,
  ProjectListQueryDto,
  ProjectListResponseDto,
  ProjectResponseDto,
} from '../dtos/project.dto.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { toIsoDateTime } from '../utils/date-time.js';
import { clampPaginationLimit } from '../utils/pagination.js';
import { slugify } from '../utils/slug.js';

@Injectable()
export class ProjectService {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly projectRepository: ProjectRepository,
  ) {}

  async getAll(auth: AuthContext, query: ProjectListQueryDto): Promise<ProjectListResponseDto> {
    const projects = await this.projectRepository.getVisibleToUser(auth.user.id, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
    });

    return {
      ...projects,
      items: projects.items.map((project) => this.serializeProject(project)),
    };
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

    const project = await this.projectRepository.create({
      organizationId,
      name: dto.name,
      slug: slugify(dto.name),
      description: dto.description ?? null,
      createdById: auth.user.id,
    });

    return this.serializeProject(project);
  }

  async requireProject(auth: AuthContext, projectId: string) {
    const project = await this.projectRepository.getByIdForUser(auth.user.id, projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  private serializeProject(project: {
    createdAt: Date | string;
    description: string | null;
    id: string;
    name: string;
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    slug: string;
    updatedAt: Date | string;
  }): ProjectResponseDto {
    return {
      ...project,
      // Project API contract memakai ISO string agar browser SDK tidak perlu menebak timezone dari Date object.
      createdAt: toIsoDateTime(project.createdAt),
      updatedAt: toIsoDateTime(project.updatedAt),
    };
  }
}
