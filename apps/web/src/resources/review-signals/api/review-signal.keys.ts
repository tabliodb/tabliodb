import type { ReviewSignalListQuery } from '@tabliodb/sdk';

export const reviewSignalKeys = {
  all: ['review-signals'] as const,
  lists: () => [...reviewSignalKeys.all, 'list'] as const,
  listByDiagram: (diagramId: string, query: ReviewSignalListQuery = {}) =>
    [...reviewSignalKeys.lists(), { diagramId }, query] as const,
  settings: () => [...reviewSignalKeys.all, 'settings'] as const,
  diagramSettings: (diagramId: string) => [...reviewSignalKeys.settings(), 'diagram', diagramId] as const,
  projectSettings: (projectId: string) => [...reviewSignalKeys.settings(), 'project', projectId] as const,
};
