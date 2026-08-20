import {
  parseDiagramReviewSettings,
  type DiagramReviewSettings,
  type DiagramReviewSignal,
} from '@tabliodb/schema-core';
import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, JsonValue } from '../schema/index.js';
import { decodeOffsetCursor, encodeOffsetCursor } from '../utils/pagination.js';

export type ReviewSignalListOptions = {
  cursor?: string;
  includeIgnored?: boolean;
  limit: number;
};

@Injectable()
export class ReviewSignalRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  async syncGeneratedSignals(diagramId: string, signals: DiagramReviewSignal[]) {
    await this.db.transaction().execute(async (tx) => {
      const ignoredSignals = await tx
        .selectFrom('diagram_review_signals')
        .select(['ruleKey', 'targetType', 'targetId'])
        .where('diagramId', '=', diagramId)
        .where('ignoredAt', 'is not', null)
        .execute();
      const ignoredKeys = new Set(ignoredSignals.map(createStoredSignalKey));
      const activeSignals = signals.filter((signal) => !ignoredKeys.has(createReviewSignalKey(signal)));

      await tx
        .deleteFrom('diagram_review_signals')
        .where('diagramId', '=', diagramId)
        .where('ignoredAt', 'is', null)
        .execute();

      if (activeSignals.length === 0) {
        return;
      }

      await tx
        .insertInto('diagram_review_signals')
        .values(
          activeSignals.map((signal) => ({
            diagramId,
            message: signal.message,
            metadata: {
              code: signal.code,
              title: signal.title,
            } satisfies JsonValue,
            ruleKey: signal.code,
            severity: signal.severity,
            targetId: signal.target.id,
            targetType: signal.target.type,
          })),
        )
        .execute();
    });
  }

  async getByDiagram(diagramId: string, options: ReviewSignalListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    let query = this.db
      .selectFrom('diagram_review_signals')
      .selectAll()
      .where('diagramId', '=', diagramId)
      .orderBy('generatedAt', 'desc')
      .orderBy('id', 'desc')
      .limit(options.limit + 1)
      .offset(offset);
    let countQuery = this.db
      .selectFrom('diagram_review_signals')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('diagramId', '=', diagramId);

    if (!options.includeIgnored) {
      // Ignored rows stay in storage so the same signal does not reappear every time lint sync runs.
      query = query.where('ignoredAt', 'is', null);
      countQuery = countQuery.where('ignoredAt', 'is', null);
    }

    const rows = await query.execute();
    const totalRow = await countQuery.executeTakeFirstOrThrow();

    return {
      items: rows.slice(0, options.limit),
      nextCursor: rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.count),
    };
  }

  async getSettingsForDiagram(diagramId: string) {
    const row = await this.db
      .selectFrom('diagrams')
      .leftJoin('projects', 'projects.id', 'diagrams.projectId')
      .select(['diagrams.reviewSettings as diagramSettings', 'projects.reviewSettings as projectSettings'])
      .where('diagrams.id', '=', diagramId)
      .where('diagrams.archivedAt', 'is', null)
      .where((eb) => eb.or([eb('diagrams.projectId', 'is', null), eb('projects.archivedAt', 'is', null)]))
      .executeTakeFirst();

    if (!row) {
      return undefined;
    }

    const project = row.projectSettings ? parseDiagramReviewSettings(row.projectSettings) : { disabledRuleKeys: [] };
    const diagram = parseDiagramReviewSettings(row.diagramSettings);

    return {
      diagram,
      // Effective settings adalah union: project memberi baseline, diagram boleh menambah pengecualian tanpa menghapus default project.
      effective: mergeReviewSettings(project, diagram),
      project,
    };
  }

  async getProjectSettings(projectId: string) {
    const row = await this.db
      .selectFrom('projects')
      .select('reviewSettings')
      .where('id', '=', projectId)
      .where('archivedAt', 'is', null)
      .executeTakeFirst();

    return row ? parseDiagramReviewSettings(row.reviewSettings) : undefined;
  }

  async updateProjectSettings(projectId: string, settings: DiagramReviewSettings) {
    const row = await this.db
      .updateTable('projects')
      .set({
        reviewSettings: settings,
        updatedAt: new Date(),
      })
      .where('id', '=', projectId)
      .where('archivedAt', 'is', null)
      .returning('reviewSettings')
      .executeTakeFirst();

    return row ? parseDiagramReviewSettings(row.reviewSettings) : undefined;
  }

  async updateDiagramSettings(diagramId: string, settings: DiagramReviewSettings) {
    const row = await this.db
      .updateTable('diagrams')
      .set({
        reviewSettings: settings,
        updatedAt: new Date(),
      })
      .where('id', '=', diagramId)
      .where('archivedAt', 'is', null)
      .returning('reviewSettings')
      .executeTakeFirst();

    return row ? parseDiagramReviewSettings(row.reviewSettings) : undefined;
  }

  getById(signalId: string) {
    return this.db.selectFrom('diagram_review_signals').selectAll().where('id', '=', signalId).executeTakeFirst();
  }

  ignore(signalId: string, ignoredById: string) {
    return this.db
      .updateTable('diagram_review_signals')
      .set({
        ignoredAt: new Date(),
        ignoredById,
      })
      .where('id', '=', signalId)
      .returningAll()
      .executeTakeFirst();
  }

  unignore(signalId: string) {
    return this.db
      .updateTable('diagram_review_signals')
      .set({
        ignoredAt: null,
        ignoredById: null,
      })
      .where('id', '=', signalId)
      .returningAll()
      .executeTakeFirst();
  }
}

function createReviewSignalKey(signal: DiagramReviewSignal): string {
  return createStoredSignalKey({
    ruleKey: signal.code,
    targetId: signal.target.id,
    targetType: signal.target.type,
  });
}

function createStoredSignalKey(input: { ruleKey: string; targetId: string | null; targetType: string }): string {
  return `${input.ruleKey}:${input.targetType}:${input.targetId ?? ''}`;
}

function mergeReviewSettings(project: DiagramReviewSettings, diagram: DiagramReviewSettings): DiagramReviewSettings {
  return {
    disabledRuleKeys: Array.from(
      new Set([...project.disabledRuleKeys, ...diagram.disabledRuleKeys]),
    ) as DiagramReviewSettings['disabledRuleKeys'],
  };
}
