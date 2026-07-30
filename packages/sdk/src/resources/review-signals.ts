import type { Paginated, PaginationQuery } from '@tabliodb/shared';
import type { DiagramReviewSignalCode } from '@tabliodb/schema-core';
import type { RequestOpts } from '@oazapfts/runtime';
import {
  getDiagramReviewSignalSettings,
  getDiagramReviewSignals,
  getProjectReviewSignalSettings,
  ignoreReviewSignal,
  unignoreReviewSignal,
  updateDiagramReviewSignalSettings,
  updateProjectReviewSignalSettings,
  type ReviewSignalSettingsDto as GeneratedReviewSignalSettingsDto,
} from '../fetch-client.js';

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

export type ReviewSignalSettingsDto = {
  disabledRuleKeys: DiagramReviewSignalCode[];
};

export type ReviewSignalEffectiveSettingsDto = {
  diagram: ReviewSignalSettingsDto;
  effective: ReviewSignalSettingsDto;
  project: ReviewSignalSettingsDto;
};

export type ReviewSignalsResource = {
  getDiagramSettings: (diagramId: string) => Promise<ReviewSignalEffectiveSettingsDto>;
  getProjectSettings: (projectId: string) => Promise<ReviewSignalSettingsDto>;
  ignore: (signalId: string) => Promise<ReviewSignalResponseDto>;
  listByDiagram: (diagramId: string, query?: ReviewSignalListQuery) => Promise<ReviewSignalListResponseDto>;
  unignore: (signalId: string) => Promise<ReviewSignalResponseDto>;
  updateDiagramSettings: (
    diagramId: string,
    body: ReviewSignalSettingsDto,
  ) => Promise<ReviewSignalEffectiveSettingsDto>;
  updateProjectSettings: (projectId: string, body: ReviewSignalSettingsDto) => Promise<ReviewSignalSettingsDto>;
};

export function createReviewSignalsResource(opts?: RequestOpts): ReviewSignalsResource {
  return {
    getDiagramSettings: (diagramId: string) =>
      getDiagramReviewSignalSettings({ diagramId }, opts) as Promise<ReviewSignalEffectiveSettingsDto>,
    getProjectSettings: (projectId: string) =>
      getProjectReviewSignalSettings({ projectId }, opts) as Promise<ReviewSignalSettingsDto>,
    ignore: (signalId: string) => ignoreReviewSignal({ signalId }, opts) as Promise<ReviewSignalResponseDto>,
    listByDiagram: (diagramId: string, query: ReviewSignalListQuery = {}) =>
      // Public SDK menyimpan pagination dan includeIgnored sebagai query object biasa, sedangkan generated client tetap privat.
      getDiagramReviewSignals({ diagramId, ...query }, opts) as Promise<ReviewSignalListResponseDto>,
    unignore: (signalId: string) => unignoreReviewSignal({ signalId }, opts) as Promise<ReviewSignalResponseDto>,
    updateDiagramSettings: (diagramId: string, body: ReviewSignalSettingsDto) =>
      // Resource menjaga schema-core rule key sebagai tipe publik; generated DTO tetap detail internal dari OpenAPI generator.
      updateDiagramReviewSignalSettings(
        { diagramId, reviewSignalSettingsDto: toGeneratedReviewSignalSettingsDto(body) },
        opts,
      ) as Promise<ReviewSignalEffectiveSettingsDto>,
    updateProjectSettings: (projectId: string, body: ReviewSignalSettingsDto) =>
      updateProjectReviewSignalSettings(
        { projectId, reviewSignalSettingsDto: toGeneratedReviewSignalSettingsDto(body) },
        opts,
      ) as Promise<ReviewSignalSettingsDto>,
  };
}

function toGeneratedReviewSignalSettingsDto(body: ReviewSignalSettingsDto): GeneratedReviewSignalSettingsDto {
  // Generated OpenAPI enum dibuat sebagai enum TypeScript, sedangkan SDK publik memakai union dari schema-core agar consumer tidak bergantung ke fetch-client.
  return body as unknown as GeneratedReviewSignalSettingsDto;
}
