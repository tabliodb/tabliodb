import type {
  ReviewSignalEffectiveSettingsDto,
  ReviewSignalListQuery,
  ReviewSignalListResponseDto,
  ReviewSignalSettingsDto,
} from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { reviewSignalKeys } from './review-signal.keys';

type ReviewSignalQueries = {
  diagramSettings: (
    diagramId: string,
  ) => AppQueryOptions<ReviewSignalEffectiveSettingsDto, ReturnType<typeof reviewSignalKeys.diagramSettings>>;
  listByDiagram: (
    diagramId: string,
    query?: ReviewSignalListQuery,
  ) => AppQueryOptions<ReviewSignalListResponseDto, ReturnType<typeof reviewSignalKeys.listByDiagram>>;
  projectSettings: (
    projectId: string,
  ) => AppQueryOptions<ReviewSignalSettingsDto, ReturnType<typeof reviewSignalKeys.projectSettings>>;
};

export const reviewSignalQueries: ReviewSignalQueries = {
  diagramSettings: (diagramId: string) =>
    appQueryOptions({
      enabled: Boolean(diagramId),
      queryFn: () => sdk.reviewSignals.getDiagramSettings(diagramId),
      queryKey: reviewSignalKeys.diagramSettings(diagramId),
    }),
  listByDiagram: (diagramId: string, query: ReviewSignalListQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(diagramId),
      queryFn: () => sdk.reviewSignals.listByDiagram(diagramId, query),
      queryKey: reviewSignalKeys.listByDiagram(diagramId, query),
    }),
  projectSettings: (projectId: string) =>
    appQueryOptions({
      enabled: Boolean(projectId),
      queryFn: () => sdk.reviewSignals.getProjectSettings(projectId),
      queryKey: reviewSignalKeys.projectSettings(projectId),
    }),
};
