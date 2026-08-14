import { getTableColumns, type DatabaseIndex, type DatabaseTable, type DiagramModel } from '@tabliodb/schema-core';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@tabliodb/ui';
import { Copy, FileText } from 'lucide-react';
import { formatColumnType } from '../diagram-model';

export function TableDocsDialog({
  model,
  onCopy,
  onOpenChange,
  tableId,
}: {
  model: DiagramModel;
  onCopy: (content: string) => void;
  onOpenChange: (open: boolean) => void;
  tableId: string | null;
}) {
  const table = tableId ? (model.tables[tableId] ?? null) : null;
  const docs = table ? createTableDocsMarkdown(model, table) : '';
  const columns = table ? getTableColumns(model, table.id) : [];
  const indexes = table ? getDocsTableIndexes(model, table) : [];

  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(table)}>
      {table ? (
        <DialogContent className="w-[min(94vw,760px)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5 text-[rgb(var(--tabliodb-sky-text))]" />
              {table.name} docs
            </DialogTitle>
            <DialogDescription>
              Quick table documentation for columns, indexes, and relationship count in the current draft.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="grid gap-4">
            <section className="grid gap-3 rounded-[18px] border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] p-4 sm:grid-cols-3">
              <TableDocsMetric label="Columns" value={columns.length} />
              <TableDocsMetric label="Indexes" value={indexes.length} />
              <TableDocsMetric label="Relationships" value={getTableRelationshipCount(model, table.id)} />
            </section>

            <pre className="tabliodb-scrollbar max-h-[52dvh] overflow-auto rounded-[18px] border-2 border-[rgb(var(--tabliodb-ink))] bg-[rgb(var(--tabliodb-ink))] p-4 text-[12px] font-semibold leading-5 text-white shadow-[0_4px_0_rgb(var(--tabliodb-border-strong))]">
              <code>{docs}</code>
            </pre>
          </DialogBody>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="secondary">
              Close
            </Button>
            <Button onClick={() => onCopy(docs)} type="button" variant="sky">
              <Copy className="size-4" />
              Copy docs
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function TableDocsMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[14px] border border-[rgb(var(--tabliodb-border))] bg-white px-3 py-2">
      <div className="text-[11px] font-extrabold uppercase text-[rgb(var(--tabliodb-ink-muted))]">{label}</div>
      <div className="mt-1 text-xl font-black text-[rgb(var(--tabliodb-ink))]">{value}</div>
    </div>
  );
}

function createTableDocsMarkdown(model: DiagramModel, table: DatabaseTable): string {
  const columns = getTableColumns(model, table.id);
  const indexes = getDocsTableIndexes(model, table);
  const relationships = Object.values(model.relationships).filter(
    (relationship) => relationship.sourceTableId === table.id || relationship.targetTableId === table.id,
  );
  const lines = [
    `# Table: ${table.name}`,
    '',
    `- Schema: ${table.schema ?? 'Main schema'}`,
    `- Columns: ${columns.length}`,
    `- Indexes: ${indexes.length}`,
    `- Relationships: ${relationships.length}`,
  ];

  if (table.comment) {
    lines.push(`- Comment: ${table.comment}`);
  }

  lines.push('', '## Columns', '', '| Name | Type | Nullable | Key | Unique | Default | Comment |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');

  if (columns.length === 0) {
    lines.push('| _No columns_ | - | - | - | - | - | - |');
  } else {
    for (const column of columns) {
      lines.push(
        `| ${[
          escapeMarkdownCell(column.name),
          escapeMarkdownCell(formatColumnType(column.type)),
          column.nullable ? 'Yes' : 'No',
          column.primaryKey ? 'PK' : '-',
          column.unique ? 'Yes' : 'No',
          escapeMarkdownCell(column.defaultValue ?? '-'),
          escapeMarkdownCell(column.comment ?? '-'),
        ].join(' | ')} |`,
      );
    }
  }

  lines.push('', '## Indexes', '');

  if (indexes.length === 0) {
    lines.push('- No indexes');
  } else {
    indexes.forEach((index) => {
      lines.push(`- ${formatTableDocsIndex(model, index)}`);
    });
  }

  lines.push('', '## Relationships', '');

  if (relationships.length === 0) {
    lines.push('- No relationships');
  } else {
    relationships.forEach((relationship) => {
      const sourceTable = model.tables[relationship.sourceTableId];
      const targetTable = model.tables[relationship.targetTableId];
      const sourceColumns = relationship.sourceColumnIds
        .map((columnId) => model.columns[columnId]?.name ?? columnId)
        .join(', ');
      const targetColumns = relationship.targetColumnIds
        .map((columnId) => model.columns[columnId]?.name ?? columnId)
        .join(', ');

      lines.push(
        `- ${sourceTable?.name ?? relationship.sourceTableId}.${sourceColumns || '?'} -> ${targetTable?.name ?? relationship.targetTableId}.${targetColumns || '?'} (${formatRelationshipCardinality(relationship.cardinality)})`,
      );
    });
  }

  return lines.join('\n');
}

function getDocsTableIndexes(model: DiagramModel, table: DatabaseTable): DatabaseIndex[] {
  return table.indexIds.flatMap((indexId) => {
    const index = model.indexes[indexId];

    return index ? [index] : [];
  });
}

function getTableRelationshipCount(model: DiagramModel, tableId: string): number {
  return Object.values(model.relationships).filter(
    (relationship) => relationship.sourceTableId === tableId || relationship.targetTableId === tableId,
  ).length;
}

function formatTableDocsIndex(model: DiagramModel, index: DatabaseIndex): string {
  const columnNames = index.columns.map((column) => model.columns[column.columnId]?.name ?? column.columnId).join(', ');
  const uniquePrefix = index.unique ? 'unique ' : '';
  const methodSuffix = index.method ? ` using ${index.method}` : '';

  return `${index.name}: ${uniquePrefix}(${columnNames || '?'})${methodSuffix}`;
}

function formatRelationshipCardinality(cardinality: DiagramModel['relationships'][string]['cardinality']): string {
  if (cardinality === 'one_to_one') {
    return '1:1';
  }

  if (cardinality === 'many_to_many') {
    return 'N:N';
  }

  return '1:N';
}

function escapeMarkdownCell(value: string): string {
  // Markdown table cells need escaping here because docs preview is generated from user-authored table/column text.
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, '<br />');
}
