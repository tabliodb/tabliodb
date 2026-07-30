import type { Paginated, PaginationQuery } from '@tabliodb/shared';
import type { RequestOpts } from '@oazapfts/runtime';
import { getDiagramReviewSignals, ignoreReviewSignal, unignoreReviewSignal } from '../fetch-client.js';

export type ReviewSignalSeverity = 'info' | 'warning' | 'error' | 'success';

export type ReviewSignalListQuery = PaginationQuery & {
  includeIgnored?: boolean;
};

export type ReviewSignalResponseDto = {
  code: string;
  diagramId: string;
  generatedAt: string;
  id: string;
  ignoredAt: string | null;
  ignoredById: string | null;
  message: string;
  ruleKey: string;
  severity: ReviewSignalSeverity;
  targetId: string | null;
  targetType: string;
  title: string;
};

export type ReviewSignalListResponseDto = Paginated<ReviewSignalResponseDto>;

export type ReviewSignalsResource = {
  ignore: (signalId: string) => Promise<ReviewSignalResponseDto>;
  listByDiagram: (diagramId: string, query?: ReviewSignalListQuery) => Promise<ReviewSignalListResponseDto>;
  unignore: (signalId: string) => Promise<ReviewSignalResponseDto>;
};

export function createReviewSignalsResource(opts?: RequestOpts): ReviewSignalsResource {
  return {
    ignore: (signalId: string) => ignoreReviewSignal({ signalId }, opts) as Promise<ReviewSignalResponseDto>,
    listByDiagram: (diagramId: string, query: ReviewSignalListQuery = {}) =>
      // Public SDK menyimpan pagination dan includeIgnored sebagai query object biasa, sedangkan generated client tetap privat.
      getDiagramReviewSignals({ diagramId, ...query }, opts) as Promise<ReviewSignalListResponseDto>,
    unignore: (signalId: string) => unignoreReviewSignal({ signalId }, opts) as Promise<ReviewSignalResponseDto>,
  };
}
