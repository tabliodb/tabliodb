import {
  DiagramModelSchema,
  getTableColumns,
  serializeDiagramModel,
  type DatabaseColumn,
  type DatabaseRelationship,
  type DatabaseTable,
  type DiagramModel,
} from '@tabliodb/schema-core';

export type GenerateDiagramSvgOptions = {
  background?: string;
  padding?: number;
  showGrid?: boolean;
};

type DiagramBounds = {
  height: number;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
  width: number;
};

type TableLayout = {
  columnCenters: Map<string, number>;
  height: number;
  table: DatabaseTable;
  width: number;
  x: number;
  y: number;
};

type Point = {
  x: number;
  y: number;
};

const defaultBackground = '#fbfdff';
const gridColor = '#e4ebf3';
const inkColor = '#3c3c3c';
const mutedColor = '#6f7782';
const relationshipColor = '#9aa8b6';
const tableBorderColor = '#d0d7de';
const tableHeaderHeight = 38;
const tableRowHeight = 28;
const tablePaddingBottom = 8;
const tableRadius = 14;
const tableMinWidth = 240;

export function generateDiagramSvg(model: DiagramModel, options: GenerateDiagramSvgOptions = {}): string {
  const normalizedModel = serializeDiagramModel(DiagramModelSchema.parse(model));
  const padding = options.padding ?? 72;
  const layouts = createTableLayouts(normalizedModel);
  const bounds = getDiagramBounds(layouts, padding);
  const showGrid = options.showGrid ?? true;
  const background = options.background ?? defaultBackground;
  const content = [
    renderSvgDefinitions(),
    `<rect x="${bounds.minX}" y="${bounds.minY}" width="${bounds.width}" height="${bounds.height}" fill="${background}" />`,
    showGrid
      ? `<rect x="${bounds.minX}" y="${bounds.minY}" width="${bounds.width}" height="${bounds.height}" fill="url(#tabliodb-grid)" />`
      : '',
    renderTitle(normalizedModel, bounds),
    renderGroups(normalizedModel),
    renderRelationships(normalizedModel, layouts),
    ...Object.values(normalizedModel.tables).map((table) => renderTable(normalizedModel, layouts.get(table.id))),
    renderNotes(normalizedModel),
  ].filter(Boolean);

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}" role="img" aria-label="${escapeAttribute(normalizedModel.metadata.name)} schema diagram">`,
    ...content,
    `</svg>`,
  ].join('\n');
}

function createTableLayouts(model: DiagramModel): Map<string, TableLayout> {
  const layouts = new Map<string, TableLayout>();

  for (const table of Object.values(model.tables)) {
    const columns = getTableColumns(model, table.id);
    const visibleColumnCount = table.collapsed || table.displayMode === 'header_only' ? 0 : columns.length;
    const height = tableHeaderHeight + visibleColumnCount * tableRowHeight + tablePaddingBottom;
    const width = Math.max(table.width ?? tableMinWidth, tableMinWidth);
    const columnCenters = new Map<string, number>();

    columns.forEach((column, index) => {
      const y =
        table.collapsed || table.displayMode === 'header_only'
          ? table.position.y + tableHeaderHeight / 2
          : table.position.y + tableHeaderHeight + index * tableRowHeight + tableRowHeight / 2;

      columnCenters.set(column.id, y);
    });

    layouts.set(table.id, {
      columnCenters,
      height,
      table,
      width,
      x: table.position.x,
      y: table.position.y,
    });
  }

  return layouts;
}

function getDiagramBounds(layouts: Map<string, TableLayout>, padding: number): DiagramBounds {
  const values = Array.from(layouts.values());

  if (values.length === 0) {
    return {
      height: 360,
      maxX: 720,
      maxY: 360,
      minX: 0,
      minY: 0,
      width: 720,
    };
  }

  const minX = Math.min(...values.map((layout) => layout.x)) - padding;
  const minY = Math.min(...values.map((layout) => layout.y)) - padding;
  const maxX = Math.max(...values.map((layout) => layout.x + layout.width)) + padding;
  const maxY = Math.max(...values.map((layout) => layout.y + layout.height)) + padding;

  return {
    height: Math.ceil(maxY - minY),
    maxX,
    maxY,
    minX,
    minY,
    width: Math.ceil(maxX - minX),
  };
}

function renderSvgDefinitions(): string {
  return [
    `<defs>`,
    `<pattern id="tabliodb-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${gridColor}" /></pattern>`,
    `<filter id="tabliodb-shadow" x="-16" y="-16" width="140%" height="140%"><feDropShadow dx="0" dy="5" stdDeviation="0" flood-color="#000000" flood-opacity="0.18" /></filter>`,
    `<marker id="tabliodb-one" markerHeight="14" markerUnits="userSpaceOnUse" markerWidth="14" orient="auto-start-reverse" refX="7" refY="7"><path d="M7 1 L7 13" fill="none" stroke="${relationshipColor}" stroke-linecap="round" stroke-width="2.5" /></marker>`,
    `<marker id="tabliodb-many" markerHeight="18" markerUnits="userSpaceOnUse" markerWidth="18" orient="auto-start-reverse" refX="14" refY="9"><path d="M3 2 L14 9 L3 16 M3 9 L14 9" fill="none" stroke="${relationshipColor}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" /></marker>`,
    `<style><![CDATA[
      .tabliodb-title { fill: ${inkColor}; font: 800 18px Nunito, Arial, sans-serif; }
      .tabliodb-subtitle { fill: ${mutedColor}; font: 700 12px Nunito, Arial, sans-serif; }
      .tabliodb-table-title { fill: ${inkColor}; font: 800 14px Nunito, Arial, sans-serif; }
      .tabliodb-table-count { fill: ${mutedColor}; font: 800 11px Nunito, Arial, sans-serif; }
      .tabliodb-column-name { fill: ${inkColor}; font: 800 12px Nunito, Arial, sans-serif; }
      .tabliodb-column-type { fill: ${mutedColor}; font: 700 11px Nunito, Arial, sans-serif; }
      .tabliodb-badge { fill: #6f7782; font: 800 9px Nunito, Arial, sans-serif; }
    ]]></style>`,
    `</defs>`,
  ].join('\n');
}

function renderTitle(model: DiagramModel, bounds: DiagramBounds): string {
  const titleX = bounds.minX + 24;
  const titleY = bounds.minY + 32;

  return [
    `<text class="tabliodb-title" x="${titleX}" y="${titleY}">${escapeText(model.metadata.name)}</text>`,
    `<text class="tabliodb-subtitle" x="${titleX}" y="${titleY + 20}">${escapeText(model.dialect)} / schema v${model.schemaVersion}</text>`,
  ].join('\n');
}

function renderGroups(model: DiagramModel): string {
  return Object.values(model.groups)
    .map((group) => {
      const color = group.color ?? '#ce82ff';

      return [
        `<g opacity="0.82">`,
        `<rect x="${group.position.x}" y="${group.position.y}" width="${group.width}" height="${group.height}" rx="18" fill="${withAlpha(color, '20')}" stroke="${escapeAttribute(color)}" stroke-width="2" stroke-dasharray="6 6" />`,
        `<text class="tabliodb-subtitle" x="${group.position.x + 16}" y="${group.position.y + 24}">${escapeText(group.name)}</text>`,
        `</g>`,
      ].join('\n');
    })
    .join('\n');
}

function renderRelationships(model: DiagramModel, layouts: Map<string, TableLayout>): string {
  return Object.values(model.relationships)
    .flatMap((relationship) => {
      const source = layouts.get(relationship.sourceTableId);
      const target = layouts.get(relationship.targetTableId);

      if (!source || !target) {
        return [];
      }

      const sourceColumnId = relationship.sourceColumnIds[0];
      const targetColumnId = relationship.targetColumnIds[0];
      const sourceY = sourceColumnId ? source.columnCenters.get(sourceColumnId) : undefined;
      const targetY = targetColumnId ? target.columnCenters.get(targetColumnId) : undefined;

      if (!sourceY || !targetY) {
        return [];
      }

      const sourceIsLeft = source.x + source.width < target.x;
      const start = {
        x: sourceIsLeft ? source.x + source.width : source.x,
        y: sourceY,
      };
      const end = {
        x: sourceIsLeft ? target.x : target.x + target.width,
        y: targetY,
      };

      return [
        `<path d="${renderOrthogonalPath(start, end)}" fill="none" marker-end="url(#${getTargetMarkerId(relationship)})" marker-start="url(#${getSourceMarkerId(relationship)})" stroke="${relationshipColor}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4" />`,
      ];
    })
    .join('\n');
}

function renderTable(model: DiagramModel, layout: TableLayout | undefined): string {
  if (!layout) {
    return '';
  }

  const table = layout.table;
  const columns = getTableColumns(model, table.id);
  const color = table.color ?? '#58cc02';
  const rows =
    table.collapsed || table.displayMode === 'header_only'
      ? ''
      : columns.map((column, index) => renderColumnRow(column, layout, index)).join('\n');

  return [
    `<g filter="url(#tabliodb-shadow)">`,
    `<rect x="${layout.x}" y="${layout.y}" width="${layout.width}" height="${layout.height}" rx="${tableRadius}" fill="#ffffff" stroke="${tableBorderColor}" stroke-width="1.5" />`,
    `<rect x="${layout.x}" y="${layout.y}" width="${layout.width}" height="${tableHeaderHeight}" rx="${tableRadius}" fill="#ffffff" stroke="none" />`,
    `<path d="M ${layout.x} ${layout.y + tableHeaderHeight} H ${layout.x + layout.width}" stroke="#e5e7eb" stroke-width="1" />`,
    `<circle cx="${layout.x + 18}" cy="${layout.y + 19}" r="7" fill="${escapeAttribute(color)}" />`,
    `<text class="tabliodb-table-title" x="${layout.x + 34}" y="${layout.y + 24}">${escapeText(truncateText(table.name, 30))}</text>`,
    `<text class="tabliodb-table-count" text-anchor="end" x="${layout.x + layout.width - 16}" y="${layout.y + 23}">${columns.length}</text>`,
    rows,
    `<rect x="${layout.x}" y="${layout.y}" width="${layout.width}" height="${layout.height}" rx="${tableRadius}" fill="none" stroke="${escapeAttribute(color)}" stroke-width="2" />`,
    `</g>`,
  ].join('\n');
}

function renderColumnRow(column: DatabaseColumn, layout: TableLayout, index: number): string {
  const y = layout.y + tableHeaderHeight + index * tableRowHeight;
  const rowCenter = y + tableRowHeight / 2;
  const typeText = formatColumnType(column);
  const badgeLabels = [
    column.primaryKey ? 'PK' : null,
    column.nullable ? null : 'NN',
    column.unique ? 'UQ' : null,
  ].filter((label): label is string => Boolean(label));

  return [
    `<path d="M ${layout.x} ${y} H ${layout.x + layout.width}" stroke="#edf0f3" stroke-width="1" />`,
    `<text class="tabliodb-column-name" x="${layout.x + 16}" y="${rowCenter + 4}">${escapeText(truncateText(column.name, 24))}</text>`,
    `<text class="tabliodb-column-type" text-anchor="end" x="${layout.x + layout.width - 64}" y="${rowCenter + 4}">${escapeText(truncateText(typeText, 18))}</text>`,
    renderBadges(layout.x + layout.width - 56, rowCenter, badgeLabels),
  ]
    .filter(Boolean)
    .join('\n');
}

function renderBadges(x: number, y: number, labels: string[]): string {
  return labels
    .map((label, index) => {
      const badgeX = x + index * 28;

      return [
        `<rect x="${badgeX}" y="${y - 10}" width="24" height="18" rx="7" fill="#f1f3f5" />`,
        `<text class="tabliodb-badge" text-anchor="middle" x="${badgeX + 12}" y="${y + 3}">${label}</text>`,
      ].join('\n');
    })
    .join('\n');
}

function renderNotes(model: DiagramModel): string {
  return Object.values(model.notes)
    .map((note) => {
      const width = note.width ?? 220;
      const lines = wrapText(note.text, 34).slice(0, 6);
      const height = 36 + lines.length * 18;

      return [
        `<g>`,
        `<rect x="${note.position.x}" y="${note.position.y}" width="${width}" height="${height}" rx="16" fill="${withAlpha(note.color ?? '#ffc800', '24')}" stroke="${escapeAttribute(note.color ?? '#ffc800')}" stroke-width="1.5" />`,
        ...lines.map(
          (line, index) =>
            `<text class="tabliodb-subtitle" x="${note.position.x + 14}" y="${note.position.y + 24 + index * 18}">${escapeText(line)}</text>`,
        ),
        `</g>`,
      ].join('\n');
    })
    .join('\n');
}

function renderOrthogonalPath(start: Point, end: Point): string {
  const bridgeX = start.x + (end.x - start.x) / 2;
  const radius = Math.min(10, Math.abs(bridgeX - start.x) / 2, Math.abs(end.y - start.y) / 2 || 10);
  const verticalDirection = end.y >= start.y ? 1 : -1;
  const horizontalDirection = end.x >= start.x ? 1 : -1;

  if (Math.abs(end.y - start.y) < 2) {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }

  return [
    `M ${start.x} ${start.y}`,
    `H ${bridgeX - radius * horizontalDirection}`,
    `Q ${bridgeX} ${start.y} ${bridgeX} ${start.y + radius * verticalDirection}`,
    `V ${end.y - radius * verticalDirection}`,
    `Q ${bridgeX} ${end.y} ${bridgeX + radius * horizontalDirection} ${end.y}`,
    `H ${end.x}`,
  ].join(' ');
}

function getSourceMarkerId(relationship: DatabaseRelationship): string {
  return relationship.cardinality === 'many_to_many' ? 'tabliodb-many' : 'tabliodb-one';
}

function getTargetMarkerId(relationship: DatabaseRelationship): string {
  return relationship.cardinality === 'one_to_one' ? 'tabliodb-one' : 'tabliodb-many';
}

function formatColumnType(column: DatabaseColumn): string {
  if (column.type.raw) {
    return column.type.raw;
  }

  if (column.type.family === 'varchar' && column.type.length) {
    return `varchar(${column.type.length})`;
  }

  if (column.type.family === 'decimal') {
    return `decimal(${column.type.precision ?? 10}, ${column.type.scale ?? 2})`;
  }

  if (column.type.family === 'enum') {
    return column.type.enumId ? `enum:${column.type.enumId}` : 'enum';
  }

  return column.type.family;
}

function wrapText(value: string, maxLength: number): string[] {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length > maxLength && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, Math.max(maxLength - 1, 0))}...` : value;
}

function withAlpha(color: string, alphaHex: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alphaHex}` : color;
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', '&quot;');
}
