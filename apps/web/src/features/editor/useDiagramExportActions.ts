import { generateDiagramMarkdown, generateDiagramMermaid } from '@tabliodb/docs';
import { generateDiagramSvg } from '@tabliodb/render';
import {
  getDiagramModelIntegrityWarnings,
  stringifyDiagramModel,
  type DatabaseDialect,
  type DiagramModel,
} from '@tabliodb/schema-core';
import { Dialect as SdkDialect, Format as SdkExportFormat, type DiagramExportResponseDtoOutput } from '@tabliodb/sdk';
import { generateCreateSchemaSqlWithWarnings, type SqlGenerationWarning } from '@tabliodb/sql';
import { toast } from '@tabliodb/ui';
import { useMemo, useState } from 'react';
import { getErrorMessage } from '@/features/app/RouteStates';
import { type DiagramExportQuery, useExportDiagramMutation } from '@/resources/diagrams';
import {
  copyTextToClipboard,
  createExportFileStem,
  createPngBlobFromSvg,
  downloadBlobFile,
  downloadTextFile,
  toDiagramExportWarnings,
} from './export-utils';
import { createDiagramModelSignature } from './model-history';

type DiagramExportResponseDto = DiagramExportResponseDtoOutput;
type DiagramExportFormat = 'tabliodb_json' | 'sql' | 'markdown' | 'mermaid' | 'svg';

export type DiagramSqlPreview = {
  sql: string;
  warnings: SqlGenerationWarning[];
};

const sdkDialectByValue: Record<DatabaseDialect, SdkDialect> = {
  mariadb: SdkDialect.Mariadb,
  mysql: SdkDialect.Mysql,
  postgresql: SdkDialect.Postgresql,
  sqlite: SdkDialect.Sqlite,
  sqlserver: SdkDialect.Sqlserver,
};

const sdkExportFormatByValue: Record<DiagramExportFormat, SdkExportFormat> = {
  markdown: SdkExportFormat.Markdown,
  mermaid: SdkExportFormat.Mermaid,
  sql: SdkExportFormat.Sql,
  svg: SdkExportFormat.Svg,
  tabliodb_json: SdkExportFormat.TabliodbJson,
};

export function useDiagramExportActions({
  activeDiagramId,
  diagramName,
  model,
  persistedDraftSignature,
  projectName,
}: {
  activeDiagramId: string | null;
  diagramName?: string;
  model: DiagramModel | null;
  persistedDraftSignature: string | null;
  projectName?: string;
}) {
  const [copiedSql, setCopiedSql] = useState(false);
  const exportDiagramMutation = useExportDiagramMutation();

  const fileStem = useMemo(
    () => createExportFileStem(projectName, diagramName ?? model?.metadata.name),
    [diagramName, model?.metadata.name, projectName],
  );
  const sqlPreview = useMemo<DiagramSqlPreview>(() => {
    if (!model) {
      return { sql: '', warnings: [] };
    }

    // Preview memakai generator lokal supaya dialog SQL selalu mencerminkan draft canvas yang sedang dilihat user.
    return generateCreateSchemaSqlWithWarnings(model, { dialect: model.dialect });
  }, [model]);

  async function copySql() {
    if (!model) {
      return;
    }

    const payload = await resolveDiagramExport(
      {
        dialect: sdkDialectByValue[model.dialect],
        format: sdkExportFormatByValue.sql,
      },
      () => {
        const generatedSql = generateCreateSchemaSqlWithWarnings(model, { dialect: model.dialect });

        return {
          content: generatedSql.sql,
          filename: `${fileStem}.${model.dialect}.sql`,
          format: sdkExportFormatByValue.sql,
          mediaType: 'application/sql',
          warnings: toDiagramExportWarnings(generatedSql.warnings),
        };
      },
    );

    try {
      // Copy memakai payload final supaya server export dan fallback lokal punya output clipboard yang identik.
      await copyTextToClipboard(payload.content);
      setCopiedSql(true);
      window.setTimeout(() => setCopiedSql(false), 1600);
    } catch {
      toast.warning({
        description: 'Your browser blocked clipboard access. Download the SQL file instead.',
        title: 'Copy SQL failed',
      });
    }
  }

  async function downloadSql() {
    if (!model) {
      return;
    }

    const payload = await resolveDiagramExport(
      {
        dialect: sdkDialectByValue[model.dialect],
        format: sdkExportFormatByValue.sql,
      },
      () => {
        const generatedSql = generateCreateSchemaSqlWithWarnings(model, { dialect: model.dialect });

        return {
          content: generatedSql.sql,
          filename: `${fileStem}.${model.dialect}.sql`,
          format: sdkExportFormatByValue.sql,
          mediaType: 'application/sql',
          warnings: toDiagramExportWarnings(generatedSql.warnings),
        };
      },
    );

    downloadTextFile(payload.filename, payload.content, `${payload.mediaType};charset=utf-8`);
  }

  async function exportJson() {
    if (!model) {
      return;
    }

    const payload = await resolveDiagramExport({ format: sdkExportFormatByValue.tabliodb_json }, () => ({
      content: `${stringifyDiagramModel(model)}\n`,
      filename: `${fileStem}.tabliodb.json`,
      format: sdkExportFormatByValue.tabliodb_json,
      mediaType: 'application/json',
      warnings: toDiagramExportWarnings(getDiagramModelIntegrityWarnings(model)),
    }));

    downloadTextFile(payload.filename, payload.content, `${payload.mediaType};charset=utf-8`);
  }

  async function exportMarkdown() {
    if (!model) {
      return;
    }

    const payload = await resolveDiagramExport({ format: sdkExportFormatByValue.markdown }, () => ({
      content: generateDiagramMarkdown(model),
      filename: `${fileStem}.schema.md`,
      format: sdkExportFormatByValue.markdown,
      mediaType: 'text/markdown',
      warnings: toDiagramExportWarnings(getDiagramModelIntegrityWarnings(model)),
    }));

    downloadTextFile(payload.filename, payload.content, `${payload.mediaType};charset=utf-8`);
  }

  async function exportMermaid() {
    if (!model) {
      return;
    }

    const payload = await resolveDiagramExport({ format: sdkExportFormatByValue.mermaid }, () => ({
      content: generateDiagramMermaid(model),
      filename: `${fileStem}.erd.mmd`,
      format: sdkExportFormatByValue.mermaid,
      mediaType: 'text/vnd.mermaid',
      warnings: toDiagramExportWarnings(getDiagramModelIntegrityWarnings(model)),
    }));

    // Mermaid `.mmd` bisa langsung dipakai di dokumentasi dan tooling diagram-as-code.
    downloadTextFile(payload.filename, payload.content, `${payload.mediaType};charset=utf-8`);
  }

  async function exportSvg() {
    if (!model) {
      return;
    }

    const payload = await resolveDiagramExport({ format: sdkExportFormatByValue.svg }, () => ({
      content: generateDiagramSvg(model),
      filename: `${fileStem}.diagram.svg`,
      format: sdkExportFormatByValue.svg,
      mediaType: 'image/svg+xml',
      warnings: toDiagramExportWarnings(getDiagramModelIntegrityWarnings(model)),
    }));

    downloadTextFile(payload.filename, payload.content, `${payload.mediaType};charset=utf-8`);
  }

  async function exportPng() {
    if (!model) {
      return;
    }

    try {
      const svg = generateDiagramSvg(model);
      const pngBlob = await createPngBlobFromSvg(svg);

      // PNG dibuat dari SVG yang sama supaya bounds export image tetap konsisten dengan export diagram.
      downloadBlobFile(`${fileStem}.diagram.png`, pngBlob);
    } catch (error) {
      console.error(error);
      toast.danger({
        description: 'Please try exporting SVG instead.',
        title: 'PNG export failed',
      });
    }
  }

  async function resolveDiagramExport(
    query: DiagramExportQuery,
    createLocalPayload: () => DiagramExportResponseDto,
  ): Promise<DiagramExportResponseDto> {
    if (model && activeDiagramId && isCurrentDraftPersisted(model)) {
      try {
        // Draft yang sudah tersimpan memakai endpoint resmi supaya UI export dan SDK publik berbagi kontrak yang sama.
        return await exportDiagramMutation.mutateAsync({
          diagramId: activeDiagramId,
          query,
        });
      } catch (error) {
        toast.warning({
          description: `Server export failed, so Tabliodb used the current local draft instead. ${getErrorMessage(error)}`,
          title: 'Using local export',
        });
      }
    }

    // Draft lokal yang belum tersimpan harus tetap mengekspor persis diagram yang sedang dilihat user di canvas.
    return createLocalPayload();
  }

  function isCurrentDraftPersisted(currentModel: DiagramModel): boolean {
    return persistedDraftSignature === createDiagramModelSignature(currentModel);
  }

  return {
    copiedSql,
    copySql,
    downloadSql,
    exportJson,
    exportMarkdown,
    exportMermaid,
    exportPng,
    exportSvg,
    isExporting: exportDiagramMutation.isPending,
    sqlPreview,
  };
}
