import type { ReviewSignalListQuery, ReviewSignalListResponseDto } from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { reviewSignalKeys } from './review-signal.keys';

type ReviewSignalQueries = {
  listByDiagram: (
    diagramId: string,
    query?: ReviewSignalListQuery,
  ) => AppQueryOptions<ReviewSignalListResponseDto, ReturnType<typeof reviewSignalKeys.listByDiagram>>;
};

export const reviewSignalQueries: ReviewSignalQueries = {
  listByDiagram: (diagramId: string, query: ReviewSignalListQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(diagramId),
      queryFn: () => sdk.reviewSignals.listByDiagram(diagramId, query),
      queryKey: reviewSignalKeys.listByDiagram(diagramId, query),
    }),
};
