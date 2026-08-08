import type { getDiagramReviewSignals } from '@tabliodb/sdk';

export type ReviewSignalListQuery = Omit<Parameters<typeof getDiagramReviewSignals>[0], 'diagramId'>;

export const reviewSignalKeys = {
  all: ['review-signals'] as const,
  lists: () => [...reviewSignalKeys.all, 'list'] as const,
  listByDiagram: (diagramId: string, query: ReviewSignalListQuery = {}) =>
    [...reviewSignalKeys.lists(), { diagramId }, query] as const,
  settings: () => [...reviewSignalKeys.all, 'settings'] as const,
  diagramSettings: (diagramId: string) => [...reviewSignalKeys.settings(), 'diagram', diagramId] as const,
  projectSettings: (projectId: string) => [...reviewSignalKeys.settings(), 'project', projectId] as const,
};
