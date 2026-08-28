import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthContext } from '../database.js';
import { CurrentUserEditorPreferenceDto, CurrentUserEditorPreferenceUpdateDto } from '../dtos/auth.dto.js';
import { DiagramRepository } from '../repositories/diagram.repository.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { FolderRepository } from '../repositories/folder.repository.js';
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
  folder: {
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
    private readonly folderRepository: FolderRepository,
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
      folderId: preference.lastOpenedFolderId,
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
      folderId: dto.folderId ?? null,
    });

    if (!target) {
      throw new NotFoundException('Editor target is not available');
    }

    const preference = await this.userPreferenceRepository.upsertEditorPreference(auth.user.id, {
      lastOpenedDiagramId: target.diagram?.id ?? null,
      lastOpenedOrganizationId: target.organization.id,
      lastOpenedFolderId: target.folder?.id ?? null,
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
      folderId: string | null;
    },
  ): Promise<ResolvedEditorPreferenceTarget | null> {
    const organization = await this.organizationRepository.getSettingsForUser(auth.user.id, input.organizationId);
    if (!organization) {
      return null;
    }

    if (!input.folderId && !input.diagramId) {
      return {
        diagram: null,
        organization,
        folder: null,
      };
    }

    const folder = input.folderId
      ? ((await this.folderRepository.getByIdForUser(auth.user.id, input.folderId)) ?? null)
      : null;
    if (input.folderId && (!folder || folder.organizationId !== organization.id)) {
      return null;
    }

    if (!input.diagramId) {
      return {
        diagram: null,
        organization,
        folder,
      };
    }

    const [diagram, diagramRole] = await Promise.all([
      this.diagramRepository.getById(input.diagramId),
      this.folderRepository.getDiagramRole(auth.user.id, input.diagramId),
    ]);

    if (!diagram || !diagramRole || diagram.organizationId !== organization.id) {
      return null;
    }

    if (input.folderId && diagram.folderId !== input.folderId) {
      return null;
    }

    return {
      diagram,
      organization,
      // Root diagrams intentionally persist a null folder so the next visit can route workspace -> diagram directly.
      folder,
    };
  }
}

function createEmptyEditorPreference(): CurrentUserEditorPreferenceDto {
  return {
    diagramId: null,
    diagramName: null,
    organizationId: null,
    organizationName: null,
    folderId: null,
    folderName: null,
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
    folderId: target.folder?.id ?? null,
    folderName: target.folder?.name ?? null,
    updatedAt: toIsoDateTime(updatedAt),
    workspaceSlug: target.organization.slug,
  };
}
