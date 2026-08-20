import {
  DiagramModelSchema,
  getRelationshipColumnPairs,
  getTableColumns,
  serializeDiagramModel,
  type ColumnTypeSpec,
  type DatabaseColumn,
  type DatabaseIndex,
  type DatabaseRelationship,
  type DatabaseTable,
  type DiagramModel,
} from '@tabliodb/schema-core';

export type GenerateDiagramMarkdownOptions = {
  includeChecks?: boolean;
  includeEnums?: boolean;
  includeIndexes?: boolean;
  includeRelationships?: boolean;
};

export type GenerateDiagramMermaidOptions = {
  includeColumnComments?: boolean;
};

export function generateDiagramMarkdown(model: DiagramModel, options: GenerateDiagramMarkdownOptions = {}): string {
  const normalizedModel = serializeDiagramModel(DiagramModelSchema.parse(model));
  const includeChecks = options.includeChecks ?? true;
  const includeEnums = options.includeEnums ?? true;
  const includeIndexes = options.includeIndexes ?? true;
  const includeRelationships = options.includeRelationships ?? true;
  const sections = [
    renderHeading(normalizedModel),
    renderTableOfContents(normalizedModel),
    ...Object.values(normalizedModel.tables).map((table) => renderTableSection(normalizedModel, table, options)),
    includeRelationships ? renderRelationshipSection(normalizedModel) : '',
    includeIndexes ? renderIndexSection(normalizedModel) : '',
    includeEnums ? renderEnumSection(normalizedModel) : '',
    includeChecks ? renderCheckSection(normalizedModel) : '',
  ].filter((section) => section.trim().length > 0);

  // Markdown exports are deterministic so generated docs can be committed and diffed cleanly.
  return `${sections.join('\n\n')}\n`;
}

export function generateDiagramMermaid(model: DiagramModel, options: GenerateDiagramMermaidOptions = {}): string {
  const normalizedModel = serializeDiagramModel(DiagramModelSchema.parse(model));
  const tableIdentifierFactory = createUniqueMermaidIdentifierFactory({ uppercase: true });
  const tableIdentifiers = new Map<string, string>();
  const lines = ['erDiagram'];

  for (const table of Object.values(normalizedModel.tables)) {
    tableIdentifiers.set(table.id, tableIdentifierFactory(table.schema ? `${table.schema}_${table.name}` : table.name));
  }

  for (const table of Object.values(normalizedModel.tables)) {
    lines.push(...renderMermaidEntity(normalizedModel, table, tableIdentifiers, options));
  }

  for (const relationship of Object.values(normalizedModel.relationships)) {
    const renderedRelationship = renderMermaidRelationship(normalizedModel, relationship, tableIdentifiers);

    if (renderedRelationship) {
      lines.push(renderedRelationship);
    }
  }

  // Mermaid exports are plain text and intentionally stable so docs repositories can diff ERD changes cleanly.
  return `${lines.join('\n')}\n`;
}

function renderHeading(model: DiagramModel): string {
  return [
    `# ${escapeMarkdownText(model.metadata.name)}`,
    '',
    `- Dialect: \`${model.dialect}\``,
    `- Schema version: \`${model.schemaVersion}\``,
    `- Tables: \`${Object.keys(model.tables).length}\``,
    `- Relationships: \`${Object.keys(model.relationships).length}\``,
    model.metadata.updatedAt ? `- Updated at: \`${model.metadata.updatedAt}\`` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function renderTableOfContents(model: DiagramModel): string {
  const tableLinks = Object.values(model.tables).map(
    (table) => `- [${escapeMarkdownText(table.name)}](#${slugify(table.name)})`,
  );

  return ['## Tables', ...tableLinks].join('\n');
}

function renderTableSection(
  model: DiagramModel,
  table: DatabaseTable,
  options: GenerateDiagramMarkdownOptions,
): string {
  const includeChecks = options.includeChecks ?? true;
  const includeIndexes = options.includeIndexes ?? true;
  const includeRelationships = options.includeRelationships ?? true;
  const columns = getTableColumns(model, table.id);
  const tableIndexes = Object.values(model.indexes).filter((index) => index.tableId === table.id);
  const tableChecks = Object.values(model.checks).filter((check) => check.tableId === table.id);
  const incomingRelationships = Object.values(model.relationships).filter(
    (relationship) => relationship.targetTableId === table.id,
  );
  const outgoingRelationships = Object.values(model.relationships).filter(
    (relationship) => relationship.sourceTableId === table.id,
  );
  const lines = [
    `## ${escapeMarkdownText(table.name)}`,
    table.schema ? `Schema: \`${table.schema}\`` : '',
    table.comment ? escapeMarkdownText(table.comment) : '',
    '',
    renderColumnTable(columns),
    includeIndexes && tableIndexes.length > 0
      ? ['', '### Indexes', renderIndexTable(model, tableIndexes)].join('\n')
      : '',
    includeRelationships && (incomingRelationships.length > 0 || outgoingRelationships.length > 0)
      ? [
          '',
          '### Relationships',
          renderTableRelationshipList(model, [...outgoingRelationships, ...incomingRelationships]),
        ].join('\n')
      : '',
    includeChecks && tableChecks.length > 0 ? ['', '### Checks', renderCheckTable(tableChecks)].join('\n') : '',
  ];

  return lines.filter(Boolean).join('\n');
}

function renderColumnTable(columns: DatabaseColumn[]): string {
  if (columns.length === 0) {
    return '_No columns yet._';
  }

  const rows = columns.map((column) =>
    [
      escapeMarkdownTableCell(column.name),
      escapeMarkdownTableCell(formatColumnType(column.type)),
      column.nullable ? 'Yes' : 'No',
      column.primaryKey ? 'Yes' : 'No',
      column.unique ? 'Yes' : 'No',
      column.defaultValue ? `\`${escapeMarkdownTableCell(column.defaultValue)}\`` : '',
      column.comment ? escapeMarkdownTableCell(column.comment) : '',
    ].join(' | '),
  );

  return [
    '| Column | Type | Nullable | PK | Unique | Default | Comment |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((row) => `| ${row} |`),
  ].join('\n');
}

function renderRelationshipSection(model: DiagramModel): string {
  const relationships = Object.values(model.relationships);

  if (relationships.length === 0) {
    return '';
  }

  return ['## Relationships', renderRelationshipTable(model, relationships)].join('\n');
}

function renderRelationshipTable(model: DiagramModel, relationships: DatabaseRelationship[]): string {
  const rows = relationships.map((relationship) =>
    [
      escapeMarkdownTableCell(relationship.name ?? relationship.id),
      escapeMarkdownTableCell(formatRelationshipSide(model, relationship.sourceTableId, relationship.sourceColumnIds)),
      escapeMarkdownTableCell(formatRelationshipSide(model, relationship.targetTableId, relationship.targetColumnIds)),
      formatCardinality(relationship.cardinality),
      relationship.onDelete ? `ON DELETE ${relationship.onDelete.replaceAll('_', ' ').toUpperCase()}` : '',
      relationship.onUpdate ? `ON UPDATE ${relationship.onUpdate.replaceAll('_', ' ').toUpperCase()}` : '',
    ].join(' | '),
  );

  return [
    '| Name | Referenced | Foreign key | Cardinality | Delete | Update |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map((row) => `| ${row} |`),
  ].join('\n');
}

function renderTableRelationshipList(model: DiagramModel, relationships: DatabaseRelationship[]): string {
  return relationships
    .map((relationship) => {
      const pairs = getRelationshipColumnPairs(relationship)
        .map((pair) => {
          const sourceColumn = model.columns[pair.sourceColumnId];
          const targetColumn = model.columns[pair.targetColumnId];
          return sourceColumn && targetColumn ? `${sourceColumn.name} -> ${targetColumn.name}` : null;
        })
        .filter((pair): pair is string => Boolean(pair))
        .join(', ');

      return `- \`${relationship.name ?? relationship.id}\`: ${formatRelationshipSide(
        model,
        relationship.sourceTableId,
        relationship.sourceColumnIds,
      )} -> ${formatRelationshipSide(model, relationship.targetTableId, relationship.targetColumnIds)}${
        pairs ? ` (${pairs})` : ''
      }`;
    })
    .join('\n');
}

function renderIndexSection(model: DiagramModel): string {
  const indexes = Object.values(model.indexes);

  if (indexes.length === 0) {
    return '';
  }

  return ['## Indexes', renderIndexTable(model, indexes)].join('\n');
}

function renderIndexTable(model: DiagramModel, indexes: DatabaseIndex[]): string {
  const rows = indexes.map((index) => {
    const table = model.tables[index.tableId];
    const columns = index.columns
      .map((indexColumn) => {
        const column = model.columns[indexColumn.columnId];
        const direction = indexColumn.order ? ` ${indexColumn.order.toUpperCase()}` : '';
        const nulls = indexColumn.nulls ? ` NULLS ${indexColumn.nulls.toUpperCase()}` : '';
        return column ? `${column.name}${direction}${nulls}` : indexColumn.columnId;
      })
      .join(', ');

    return [
      escapeMarkdownTableCell(index.name),
      escapeMarkdownTableCell(table?.name ?? index.tableId),
      escapeMarkdownTableCell(columns),
      index.unique ? 'Yes' : 'No',
      index.method ?? '',
      index.where ? `\`${escapeMarkdownTableCell(index.where)}\`` : '',
    ].join(' | ');
  });

  return [
    '| Name | Table | Columns | Unique | Method | Filter |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map((row) => `| ${row} |`),
  ].join('\n');
}

function renderEnumSection(model: DiagramModel): string {
  const enums = Object.values(model.enums);

  if (enums.length === 0) {
    return '';
  }

  const rows = enums.map((databaseEnum) =>
    [
      escapeMarkdownTableCell(databaseEnum.name),
      databaseEnum.schema ? escapeMarkdownTableCell(databaseEnum.schema) : '',
      escapeMarkdownTableCell(databaseEnum.values.join(', ')),
      databaseEnum.comment ? escapeMarkdownTableCell(databaseEnum.comment) : '',
    ].join(' | '),
  );

  return [
    '## Enums',
    '| Name | Schema | Values | Comment |',
    '| --- | --- | --- | --- |',
    ...rows.map((row) => `| ${row} |`),
  ].join('\n');
}

function renderCheckSection(model: DiagramModel): string {
  const checks = Object.values(model.checks);

  if (checks.length === 0) {
    return '';
  }

  return ['## Checks', renderCheckTable(checks)].join('\n');
}

function renderCheckTable(checks: Array<{ comment?: string; expression: string; name: string }>): string {
  const rows = checks.map((check) =>
    [
      escapeMarkdownTableCell(check.name),
      `\`${escapeMarkdownTableCell(check.expression)}\``,
      check.comment ? escapeMarkdownTableCell(check.comment) : '',
    ].join(' | '),
  );

  return ['| Name | Expression | Comment |', '| --- | --- | --- |', ...rows.map((row) => `| ${row} |`)].join('\n');
}

function renderMermaidEntity(
  model: DiagramModel,
  table: DatabaseTable,
  tableIdentifiers: Map<string, string>,
  options: GenerateDiagramMermaidOptions,
): string[] {
  const tableIdentifier = tableIdentifiers.get(table.id) ?? toMermaidIdentifier(table.name, { uppercase: true });
  const foreignKeyColumnIds = new Set(
    Object.values(model.relationships).flatMap((relationship) =>
      relationship.targetTableId === table.id ? relationship.targetColumnIds : [],
    ),
  );
  const columnIdentifierFactory = createUniqueMermaidIdentifierFactory();
  const columnLines = getTableColumns(model, table.id).map((column) =>
    renderMermaidColumn(column, foreignKeyColumnIds, columnIdentifierFactory, options),
  );

  if (columnLines.length === 0) {
    return [`  ${tableIdentifier} {`, '  }'];
  }

  return [`  ${tableIdentifier} {`, ...columnLines, '  }'];
}

function renderMermaidColumn(
  column: DatabaseColumn,
  foreignKeyColumnIds: Set<string>,
  columnIdentifierFactory: (value: string) => string,
  options: GenerateDiagramMermaidOptions,
): string {
  const keys = [
    column.primaryKey ? 'PK' : '',
    foreignKeyColumnIds.has(column.id) ? 'FK' : '',
    column.unique ? 'UK' : '',
  ].filter(Boolean);
  const comment =
    options.includeColumnComments !== false && column.comment ? ` "${escapeMermaidQuotedText(column.comment)}"` : '';
  const keySuffix = keys.length > 0 ? ` ${keys.join(', ')}` : '';

  return `    ${toMermaidTypeToken(formatColumnType(column.type))} ${columnIdentifierFactory(column.name)}${keySuffix}${comment}`;
}

function renderMermaidRelationship(
  model: DiagramModel,
  relationship: DatabaseRelationship,
  tableIdentifiers: Map<string, string>,
): string | null {
  const sourceTable = model.tables[relationship.sourceTableId];
  const targetTable = model.tables[relationship.targetTableId];
  const sourceIdentifier = tableIdentifiers.get(relationship.sourceTableId);
  const targetIdentifier = tableIdentifiers.get(relationship.targetTableId);

  if (!sourceTable || !targetTable || !sourceIdentifier || !targetIdentifier) {
    return null;
  }

  const [sourceCardinality, targetCardinality] = getMermaidCardinality(relationship.cardinality);
  const label = relationship.name ?? createMermaidRelationshipLabel(model, relationship);

  return `  ${sourceIdentifier} ${sourceCardinality}--${targetCardinality} ${targetIdentifier} : ${escapeMermaidRelationshipLabel(label)}`;
}

function getMermaidCardinality(cardinality: DatabaseRelationship['cardinality']): [string, string] {
  return {
    many_to_many: ['}o', 'o{'],
    one_to_many: ['||', 'o{'],
    one_to_one: ['||', '||'],
  }[cardinality] as [string, string];
}

function createMermaidRelationshipLabel(model: DiagramModel, relationship: DatabaseRelationship): string {
  const pairs = getRelationshipColumnPairs(relationship)
    .map((pair) => {
      const sourceColumn = model.columns[pair.sourceColumnId];
      const targetColumn = model.columns[pair.targetColumnId];

      return sourceColumn && targetColumn ? `${sourceColumn.name}_to_${targetColumn.name}` : null;
    })
    .filter((pair): pair is string => Boolean(pair));

  return pairs.length > 0 ? pairs.join('_and_') : 'relates_to';
}

function formatRelationshipSide(model: DiagramModel, tableId: string, columnIds: string[]): string {
  const table = model.tables[tableId];
  const columnNames = columnIds.map((columnId) => model.columns[columnId]?.name ?? columnId).join(', ');

  return `${table?.name ?? tableId}.${columnNames}`;
}

function formatCardinality(cardinality: DatabaseRelationship['cardinality']): string {
  return {
    many_to_many: 'many to many',
    one_to_many: 'one to many',
    one_to_one: 'one to one',
  }[cardinality];
}

function formatColumnType(type: ColumnTypeSpec): string {
  if (type.raw) {
    return type.raw;
  }

  if (type.family === 'varchar' && type.length) {
    return `varchar(${type.length})`;
  }

  if (type.family === 'decimal') {
    return `decimal(${type.precision ?? 10}, ${type.scale ?? 2})`;
  }

  if (type.family === 'enum') {
    return type.enumId ? `enum:${type.enumId}` : 'enum';
  }

  return type.family;
}

function createUniqueMermaidIdentifierFactory(options: { uppercase?: boolean } = {}): (value: string) => string {
  const usedIdentifiers = new Map<string, number>();

  return (value) => {
    const baseIdentifier = toMermaidIdentifier(value, options);
    const nextCount = (usedIdentifiers.get(baseIdentifier) ?? 0) + 1;

    usedIdentifiers.set(baseIdentifier, nextCount);

    return nextCount === 1 ? baseIdentifier : `${baseIdentifier}_${nextCount}`;
  };
}

function toMermaidIdentifier(value: string, options: { uppercase?: boolean } = {}): string {
  const identifier = value
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    // Mermaid entity and column identifiers cannot safely start with a digit, so prefix one with an underscore.
    .replace(/^([0-9])/, '_$1')
    .replace(/^_+|_+$/g, '');

  const fallback = options.uppercase ? 'ENTITY' : 'field';

  return options.uppercase ? (identifier || fallback).toUpperCase() : identifier || fallback;
}

function toMermaidTypeToken(value: string): string {
  const token = value
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return token.length > 0 ? token.toLowerCase() : 'unknown';
}

function escapeMermaidRelationshipLabel(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9_ -]/g, '_')
      .replace(/\s+/g, '_') || 'relates_to'
  );
}

function escapeMermaidQuotedText(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', ' ');
}

function escapeMarkdownText(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('|', '\\|').replaceAll('[', '\\[').replaceAll(']', '\\]');
}

function escapeMarkdownTableCell(value: string): string {
  return escapeMarkdownText(value).replaceAll('\n', '<br />');
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
