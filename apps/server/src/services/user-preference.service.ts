import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthContext } from '../database.js';
import { CurrentUserEditorPreferenceDto, CurrentUserEditorPreferenceUpdateDto } from '../dtos/auth.dto.js';
import { DiagramRepository } from '../repositories/diagram.repository.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { UserPreferenceRepository } from '../repositories/user-preference.repository.js';
import { toIsoDateTime } from '../utils/date-time.js';

type ResolvedEditorPreferenceTarget = {
  diagram: {
    id: string;
    name: string;
  } | null;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  project: {
    id: string;
    name: string;
    organizationId: string;
  } | null;
};

@Injectable()
export class UserPreferenceService {
  constructor(
    private readonly diagramRepository: DiagramRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly userPreferenceRepository: UserPreferenceRepository,
  ) {}

  async getEditorPreference(auth: AuthContext): Promise<CurrentUserEditorPreferenceDto> {
    const preference = await this.userPreferenceRepository.getEditorPreference(auth.user.id);

    if (!preference?.lastOpenedOrganizationId) {
      return createEmptyEditorPreference();
    }

    const target = await this.resolveEditorPreferenceTarget(auth, {
      diagramId: preference.lastOpenedDiagramId,
      organizationId: preference.lastOpenedOrganizationId,
      projectId: preference.lastOpenedProjectId,
    });

    if (!target) {
      // Stale preferences are deleted lazily when permission/resource checks prove they no longer point to visible data.
      await this.userPreferenceRepository.deleteEditorPreference(auth.user.id);
      return createEmptyEditorPreference();
    }

    return serializeEditorPreferenceTarget(target, preference.updatedAt);
  }

  async updateEditorPreference(
    auth: AuthContext,
    dto: CurrentUserEditorPreferenceUpdateDto,
  ): Promise<CurrentUserEditorPreferenceDto> {
    const target = await this.resolveEditorPreferenceTarget(auth, {
      diagramId: dto.diagramId ?? null,
      organizationId: dto.organizationId,
      projectId: dto.projectId ?? null,
    });

    if (!target) {
      throw new NotFoundException('Editor target is not available');
    }

    const preference = await this.userPreferenceRepository.upsertEditorPreference(auth.user.id, {
      lastOpenedDiagramId: target.diagram?.id ?? null,
      lastOpenedOrganizationId: target.organization.id,
      lastOpenedProjectId: target.project?.id ?? null,
    });

    if (!preference) {
      throw new NotFoundException('Editor preference could not be saved');
    }

    return serializeEditorPreferenceTarget(target, preference.updatedAt);
  }

  private async resolveEditorPreferenceTarget(
    auth: AuthContext,
    input: {
      diagramId: string | null;
      organizationId: string;
      projectId: string | null;
    },
  ): Promise<ResolvedEditorPreferenceTarget | null> {
    const organization = await this.organizationRepository.getSettingsForUser(auth.user.id, input.organizationId);
    if (!organization) {
      return null;
    }

    if (!input.projectId && !input.diagramId) {
      return {
        diagram: null,
        organization,
        project: null,
      };
    }

    const project = input.projectId
      ? ((await this.projectRepository.getByIdForUser(auth.user.id, input.projectId)) ?? null)
      : null;
    if (input.projectId && (!project || project.organizationId !== organization.id)) {
      return null;
    }

    if (!input.diagramId) {
      return {
        diagram: null,
        organization,
        project,
      };
    }

    const [diagram, diagramRole] = await Promise.all([
      this.diagramRepository.getById(input.diagramId),
      this.projectRepository.getDiagramRole(auth.user.id, input.diagramId),
    ]);

    if (!diagram || !diagramRole || diagram.organizationId !== organization.id) {
      return null;
    }

    if (input.projectId && diagram.projectId !== input.projectId) {
      return null;
    }

    return {
      diagram,
      organization,
      // Root diagrams intentionally persist a null project so the next visit can route workspace -> diagram directly.
      project,
    };
  }
}

function createEmptyEditorPreference(): CurrentUserEditorPreferenceDto {
  return {
    diagramId: null,
    diagramName: null,
    organizationId: null,
    organizationName: null,
    projectId: null,
    projectName: null,
    updatedAt: null,
    workspaceSlug: null,
  };
}

function serializeEditorPreferenceTarget(
  target: ResolvedEditorPreferenceTarget,
  updatedAt: Date | string,
): CurrentUserEditorPreferenceDto {
  return {
    diagramId: target.diagram?.id ?? null,
    diagramName: target.diagram?.name ?? null,
    organizationId: target.organization.id,
    organizationName: target.organization.name,
    projectId: target.project?.id ?? null,
    projectName: target.project?.name ?? null,
    updatedAt: toIsoDateTime(updatedAt),
    workspaceSlug: target.organization.slug,
  };
}
