import { ForbiddenException } from '@nestjs/common';
import { Permission, ProjectRole } from '@tabliodb/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../database.js';
import { ReviewSignalService } from './review-signal.service.js';

const auth: AuthContext = {
  user: {
    avatarUrl: null,
    cursorColor: '#58cc02',
    email: 'editor@tabliodb.local',
    id: 'user-id',
    name: 'Editor User',
    passwordChangeRequired: false,
  },
};

const authWithReadApiKey: AuthContext = {
  ...auth,
  apiKey: {
    id: 'api-key-id',
    permissions: [Permission.ProjectRead],
  },
};

describe(ReviewSignalService.name, () => {
  const diagramService = {
    getCurrentModel: vi.fn(),
    requireDiagram: vi.fn(),
  };
  const projectRepository = {
    getByIdForUser: vi.fn(),
  };
  const reviewSignalRepository = {
    getByDiagram: vi.fn(),
    getById: vi.fn(),
    getProjectSettings: vi.fn(),
    getSettingsForDiagram: vi.fn(),
    ignore: vi.fn(),
    syncGeneratedSignals: vi.fn(),
    unignore: vi.fn(),
    updateDiagramSettings: vi.fn(),
    updateProjectSettings: vi.fn(),
  };

  let service: ReviewSignalService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new ReviewSignalService(
      diagramService as never,
      projectRepository as never,
      reviewSignalRepository as never,
    );
  });

  it('blocks low-scope API keys before project review settings lookups', async () => {
    await expect(
      service.updateProjectSettings(authWithReadApiKey, 'project-id', {
        disabledRuleKeys: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // API-key scope must fail before loading the project so low-scope tokens cannot probe project existence.
    expect(projectRepository.getByIdForUser).not.toHaveBeenCalled();
    expect(reviewSignalRepository.updateProjectSettings).not.toHaveBeenCalled();
  });

  it('blocks project viewers from updating project review settings at the service boundary', async () => {
    projectRepository.getByIdForUser.mockResolvedValue({
      projectRole: ProjectRole.Viewer,
    });

    await expect(
      service.updateProjectSettings(auth, 'project-id', {
        disabledRuleKeys: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Controller metadata is not the only write protection for review settings.
    expect(reviewSignalRepository.updateProjectSettings).not.toHaveBeenCalled();
  });
});
