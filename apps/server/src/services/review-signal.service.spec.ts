import { NotFoundException } from '@nestjs/common';
import { Permission } from '@tabliodb/shared';
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

describe(ReviewSignalService.name, () => {
  const diagramService = {
    getCurrentModel: vi.fn(),
    requireDiagram: vi.fn(),
  };
  const reviewSignalRepository = {
    getByDiagram: vi.fn(),
    getById: vi.fn(),
    getSettingsForDiagram: vi.fn(),
    ignore: vi.fn(),
    syncGeneratedSignals: vi.fn(),
    unignore: vi.fn(),
    updateDiagramSettings: vi.fn(),
  };

  let service: ReviewSignalService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new ReviewSignalService(diagramService as never, reviewSignalRepository as never);
  });

  it('returns diagram-scoped review settings without a folder override layer', async () => {
    reviewSignalRepository.getSettingsForDiagram.mockResolvedValue({
      diagram: { disabledRuleKeys: ['missing-primary-key'] },
      effective: { disabledRuleKeys: ['missing-primary-key'] },
    });

    const settings = await service.getDiagramSettings(auth, 'diagram-id');

    // Folder/project is only an organization boundary now; review rules are configured from the diagram settings dialog.
    expect(diagramService.requireDiagram).toHaveBeenCalledWith(auth, 'diagram-id', Permission.DiagramRead);
    expect(settings).toEqual({
      diagram: { disabledRuleKeys: ['missing-primary-key'] },
      effective: { disabledRuleKeys: ['missing-primary-key'] },
    });
  });

  it('keeps missing diagrams as not-found instead of falling back to default settings', async () => {
    reviewSignalRepository.getSettingsForDiagram.mockResolvedValue(undefined);

    await expect(service.getDiagramSettings(auth, 'missing-diagram')).rejects.toBeInstanceOf(NotFoundException);
  });
});
