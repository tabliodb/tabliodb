import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRole } from '@tabliodb/shared';
import { AuthContext } from '../database.js';
import {
  ProjectArchiveResponseDto,
  ProjectCreateDto,
  ProjectListQueryDto,
  ProjectListResponseDto,
  ProjectMemberCreateDto,
  ProjectMemberDto,
  ProjectMemberListQueryDto,
  ProjectMemberListResponseDto,
  ProjectMemberRemoveResponseDto,
  ProjectMemberUpdateDto,
  ProjectResponseDto,
  ProjectUpdateDto,
} from '../dtos/project.dto.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { toIsoDateTime } from '../utils/date-time.js';
import { clampPaginationLimit } from '../utils/pagination.js';
import { slugify } from '../utils/slug.js';

@Injectable()
export class ProjectService {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly userRepository: UserRepository,
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

  async update(_auth: AuthContext, projectId: string, dto: ProjectUpdateDto): Promise<ProjectResponseDto> {
    if (dto.name === undefined && dto.description === undefined) {
      throw new BadRequestException('At least one project field is required');
    }

    const nextName = dto.name?.trim();
    if (dto.name !== undefined && !nextName) {
      throw new BadRequestException('Project name is required');
    }

    const project = await this.projectRepository.update(projectId, {
      description: dto.description === undefined ? undefined : dto.description?.trim() || null,
      name: nextName,
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.serializeProject(project);
  }

  async archive(_auth: AuthContext, projectId: string): Promise<ProjectArchiveResponseDto> {
    const archived = await this.projectRepository.archive(projectId);

    if (!archived) {
      throw new NotFoundException('Project not found');
    }

    return { successful: true };
  }

  async getMembers(
    _auth: AuthContext,
    projectId: string,
    query: ProjectMemberListQueryDto,
  ): Promise<ProjectMemberListResponseDto> {
    const members = await this.projectRepository.getMembers(projectId, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
    });

    return {
      ...members,
      items: members.items.map((member) => this.serializeMember(member)),
    };
  }

  async addMember(auth: AuthContext, projectId: string, dto: ProjectMemberCreateDto): Promise<ProjectMemberDto> {
    const project = await this.requireProject(auth, projectId);
    const user = await this.userRepository.getByEmail(dto.email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const organizationMembership = await this.organizationRepository.getByIdForUser(user.id, project.organizationId);
    if (!organizationMembership) {
      throw new BadRequestException('User must belong to the project workspace before joining the project');
    }

    const member = await this.projectRepository.upsertMember(projectId, {
      createdById: auth.user.id,
      role: dto.role ?? ProjectRole.Viewer,
      userId: user.id,
    });

    if (!member) {
      throw new NotFoundException('Project member could not be loaded');
    }

    return this.serializeMember(member);
  }

  async updateMember(
    _auth: AuthContext,
    projectId: string,
    userId: string,
    dto: ProjectMemberUpdateDto,
  ): Promise<ProjectMemberDto> {
    await this.assertCanChangeOwnerRole(projectId, userId, dto.role);

    const member = await this.projectRepository.updateMember(projectId, userId, dto.role);
    if (!member) {
      throw new NotFoundException('Project member not found');
    }

    return this.serializeMember(member);
  }

  async removeMember(_auth: AuthContext, projectId: string, userId: string): Promise<ProjectMemberRemoveResponseDto> {
    const currentMember = await this.projectRepository.getMember(projectId, userId);
    if (!currentMember) {
      throw new NotFoundException('Project member not found');
    }

    if (
      currentMember.role === ProjectRole.Owner &&
      (await this.projectRepository.getProjectOwnerCount(projectId)) <= 1
    ) {
      throw new BadRequestException('Project must keep at least one owner');
    }

    await this.projectRepository.removeMember(projectId, userId);

    return { successful: true };
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

  private async assertCanChangeOwnerRole(projectId: string, userId: string, nextRole: ProjectRole): Promise<void> {
    const currentMember = await this.projectRepository.getMember(projectId, userId);
    if (!currentMember) {
      throw new NotFoundException('Project member not found');
    }

    if (currentMember.role === ProjectRole.Owner && nextRole !== ProjectRole.Owner) {
      const ownerCount = await this.projectRepository.getProjectOwnerCount(projectId);

      if (ownerCount <= 1) {
        throw new BadRequestException('Project must keep at least one owner');
      }
    }
  }

  private serializeMember(member: {
    avatarColor: string | null;
    createdAt: Date | string;
    email: string;
    name: string;
    role: ProjectRole;
    updatedAt: Date | string;
    userId: string;
  }): ProjectMemberDto {
    return {
      ...member,
      // Member timestamps follow the rest of the API contract: ISO strings, never Date objects over JSON.
      createdAt: toIsoDateTime(member.createdAt),
      updatedAt: toIsoDateTime(member.updatedAt),
    };
  }
}
