import { Injectable, NotFoundException } from '@nestjs/common';
import {
  defaultDiagramReviewSettings,
  getDiagramReviewSignals,
  parseDiagramReviewSettings,
  type DiagramModel,
} from '@tabliodb/schema-core';
import { Permission } from '@tabliodb/shared';
import type { AuthContext } from '../database.js';
import type {
  ReviewSignalEffectiveSettingsDto,
  ReviewSignalListQueryDto,
  ReviewSignalResponseDto,
  ReviewSignalSettingsDto,
} from '../dtos/review-signal.dto.js';
import { ReviewSignalRepository } from '../repositories/review-signal.repository.js';
import type { JsonValue } from '../schema/index.js';
import { toIsoDateTime, toNullableIsoDateTime } from '../utils/date-time.js';
import { clampPaginationLimit } from '../utils/pagination.js';
import { DiagramService } from './diagram.service.js';

@Injectable()
export class ReviewSignalService {
  constructor(
    private readonly diagramService: DiagramService,
    private readonly reviewSignalRepository: ReviewSignalRepository,
  ) {}

  async syncDiagramModel(diagramId: string, model: DiagramModel) {
    const settings = await this.reviewSignalRepository.getSettingsForDiagram(diagramId);

    // Lint engine berada di schema-core agar backend, SDK automation, dan frontend membaca rule yang sama.
    await this.reviewSignalRepository.syncGeneratedSignals(
      diagramId,
      getDiagramReviewSignals(model, settings?.effective ?? defaultDiagramReviewSettings),
    );
  }

  async getByDiagram(auth: AuthContext, diagramId: string, query: ReviewSignalListQueryDto) {
    const model = await this.diagramService.getCurrentModel(auth, diagramId, Permission.DiagramRead);

    await this.syncDiagramModel(diagramId, model);

    const signals = await this.reviewSignalRepository.getByDiagram(diagramId, {
      cursor: query.cursor,
      includeIgnored: query.includeIgnored,
      limit: clampPaginationLimit(query.limit),
    });

    return {
      ...signals,
      items: signals.items.map(serializeReviewSignal),
    };
  }

  async getDiagramSettings(auth: AuthContext, diagramId: string): Promise<ReviewSignalEffectiveSettingsDto> {
    await this.diagramService.requireDiagram(auth, diagramId, Permission.DiagramRead);

    const settings = await this.reviewSignalRepository.getSettingsForDiagram(diagramId);
    if (!settings) {
      throw new NotFoundException('Diagram not found');
    }

    return serializeEffectiveReviewSettings(settings);
  }

  async updateDiagramSettings(
    auth: AuthContext,
    diagramId: string,
    dto: ReviewSignalSettingsDto,
  ): Promise<ReviewSignalEffectiveSettingsDto> {
    await this.diagramService.requireDiagram(auth, diagramId, Permission.DiagramUpdate);

    const settings = parseDiagramReviewSettings(dto);
    const updatedSettings = await this.reviewSignalRepository.updateDiagramSettings(diagramId, settings);

    if (!updatedSettings) {
      throw new NotFoundException('Diagram not found');
    }

    // Diagram-level settings affect the currently open review panel immediately, so the cached signals are refreshed right away.
    await this.syncDiagramModel(
      diagramId,
      await this.diagramService.getCurrentModel(auth, diagramId, Permission.DiagramRead),
    );

    return this.getDiagramSettings(auth, diagramId);
  }

  async ignore(auth: AuthContext, signalId: string): Promise<ReviewSignalResponseDto> {
    const signal = await this.reviewSignalRepository.getById(signalId);
    if (!signal) {
      throw new NotFoundException('Review signal not found');
    }

    await this.diagramService.requireDiagram(auth, signal.diagramId, Permission.DiagramUpdate);

    const updatedSignal = await this.reviewSignalRepository.ignore(signalId, auth.user.id);
    if (!updatedSignal) {
      throw new NotFoundException('Review signal not found');
    }

    return serializeReviewSignal(updatedSignal);
  }

  async unignore(auth: AuthContext, signalId: string): Promise<ReviewSignalResponseDto> {
    const signal = await this.reviewSignalRepository.getById(signalId);
    if (!signal) {
      throw new NotFoundException('Review signal not found');
    }

    await this.diagramService.requireDiagram(auth, signal.diagramId, Permission.DiagramUpdate);

    const updatedSignal = await this.reviewSignalRepository.unignore(signalId);
    if (!updatedSignal) {
      throw new NotFoundException('Review signal not found');
    }

    return serializeReviewSignal(updatedSignal);
  }

}

function serializeReviewSettings(settings: ReturnType<typeof parseDiagramReviewSettings>): ReviewSignalSettingsDto {
  return {
    disabledRuleKeys: settings.disabledRuleKeys,
  };
}

function serializeEffectiveReviewSettings(settings: {
  diagram: ReturnType<typeof parseDiagramReviewSettings>;
  effective: ReturnType<typeof parseDiagramReviewSettings>;
}): ReviewSignalEffectiveSettingsDto {
  return {
    diagram: serializeReviewSettings(settings.diagram),
    effective: serializeReviewSettings(settings.effective),
  };
}

function serializeReviewSignal(
  signal: NonNullable<Awaited<ReturnType<ReviewSignalRepository['getById']>>>,
): ReviewSignalResponseDto {
  const metadata = readReviewSignalMetadata(signal.metadata);

  return {
    code: metadata.code ?? signal.ruleKey,
    diagramId: signal.diagramId,
    generatedAt: toIsoDateTime(signal.generatedAt),
    id: signal.id,
    ignoredAt: toNullableIsoDateTime(signal.ignoredAt),
    ignoredById: signal.ignoredById,
    message: signal.message,
    ruleKey: signal.ruleKey,
    severity: signal.severity,
    targetId: signal.targetId,
    targetType: signal.targetType,
    title: metadata.title ?? signal.ruleKey,
  };
}

function readReviewSignalMetadata(metadata: JsonValue): { code?: string; title?: string } {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  return {
    code: typeof metadata.code === 'string' ? metadata.code : undefined,
    title: typeof metadata.title === 'string' ? metadata.title : undefined,
  };
}
