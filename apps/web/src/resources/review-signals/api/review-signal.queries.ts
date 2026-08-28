import type {
  ReviewSignalEffectiveSettingsDtoOutput,
  ReviewSignalListResponseDtoOutput,
} from '@tabliodb/sdk';
import { getDiagramReviewSignalSettings, getDiagramReviewSignals } from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { reviewSignalKeys, type ReviewSignalListQuery } from './review-signal.keys';

type ReviewSignalQueries = {
  diagramSettings: (
    diagramId: string,
  ) => AppQueryOptions<ReviewSignalEffectiveSettingsDtoOutput, ReturnType<typeof reviewSignalKeys.diagramSettings>>;
  listByDiagram: (
    diagramId: string,
    query?: ReviewSignalListQuery,
  ) => AppQueryOptions<ReviewSignalListResponseDtoOutput, ReturnType<typeof reviewSignalKeys.listByDiagram>>;
};

export const reviewSignalQueries: ReviewSignalQueries = {
  diagramSettings: (diagramId: string) =>
    appQueryOptions({
      enabled: Boolean(diagramId),
      queryFn: () => getDiagramReviewSignalSettings({ diagramId }),
      queryKey: reviewSignalKeys.diagramSettings(diagramId),
    }),
  listByDiagram: (diagramId: string, query: ReviewSignalListQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(diagramId),
      queryFn: () => getDiagramReviewSignals({ diagramId, ...query }),
      queryKey: reviewSignalKeys.listByDiagram(diagramId, query),
    }),
};
