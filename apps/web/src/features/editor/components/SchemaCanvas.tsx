import {
  Graph,
  Shape,
  type Cell,
  type Edge as X6Edge,
  type EdgeMetadata,
  type Node as X6Node,
  type NodeMetadata,
} from '@antv/x6';
import { getTableColumns, type DatabaseColumn, type DatabaseTable, type DiagramModel } from '@tabliodb/schema-core';
import { useEffect, useRef } from 'react';
import { formatColumnType } from '../diagram-model';

const tableNodeShape = 'tabliodb-table';
const tableNodeWidth = 288;
const tableHeaderHeight = 42;
const tableColumnHeight = 30;
const tablePaddingBottom = 10;

let tableShapeRegistered = false;

export type SchemaCanvasProps = {
  fitSignal: number;
  fitKey: string;
  model: DiagramModel;
  selectedTableId: string | null;
  onModelChange: (model: DiagramModel) => void;
  onSelectedTableChange: (tableId: string | null) => void;
};

type TableNodeData = {
  color: string;
  columns: DatabaseColumn[];
  selected: boolean;
  tableId: string;
  tableName: string;
};

export function SchemaCanvas({
  fitKey,
  fitSignal,
  model,
  onModelChange,
  onSelectedTableChange,
  selectedTableId,
}: SchemaCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const fitKeyRef = useRef<string | null>(null);
  const modelRef = useRef(model);
  const onModelChangeRef = useRef(onModelChange);
  const onSelectedTableChangeRef = useRef(onSelectedTableChange);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  useEffect(() => {
    onModelChangeRef.current = onModelChange;
  }, [onModelChange]);

  useEffect(() => {
    onSelectedTableChangeRef.current = onSelectedTableChange;
  }, [onSelectedTableChange]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    registerTableNodeShape();

    const graph = new Graph({
      // HTML table nodes are small enough for synchronous rendering, which avoids queued stale views after drag-end state sync.
      async: false,
      autoResize: true,
      background: {
        color: '#f7f7f7',
      },
      connecting: {
        allowBlank: false,
        allowLoop: false,
        allowMulti: true,
        allowNode: true,
        connector: {
          name: 'rounded',
          args: { radius: 10 },
        },
        connectionPoint: 'boundary',
        highlight: true,
        router: {
          name: 'manhattan',
          args: { padding: 18 },
        },
        snap: { radius: 24 },
      },
      container: containerRef.current,
      grid: {
        visible: true,
        size: 24,
        type: 'dot',
        args: {
          color: '#e5e5e5',
          thickness: 1,
        },
      },
      interacting: {
        edgeLabelMovable: false,
        edgeMovable: false,
        nodeMovable: true,
        vertexAddable: false,
        vertexDeletable: false,
      },
      mousewheel: {
        enabled: true,
        factor: 1.08,
        maxScale: 1.8,
        minScale: 0.45,
        modifiers: ['ctrl', 'meta'],
        zoomAtMousePosition: true,
      },
      panning: {
        enabled: true,
        eventTypes: ['rightMouseDown', 'mouseWheel'],
      },
    });

    graph.on('node:click', ({ node }) => {
      const data = node.getData<TableNodeData>();
      onSelectedTableChangeRef.current(data.tableId);
    });

    graph.on('blank:click', () => {
      onSelectedTableChangeRef.current(null);
    });

    graph.on('node:moved', ({ node }) => {
      const data = node.getData<TableNodeData>();
      const table = modelRef.current.tables[data.tableId];

      if (!table) {
        return;
      }

      const position = node.getPosition();

      onModelChangeRef.current({
        ...modelRef.current,
        tables: {
          ...modelRef.current.tables,
          [data.tableId]: {
            ...table,
            // X6 owns interaction coordinates while the domain model remains the persistence source for table positions.
            position: {
              x: position.x,
              y: position.y,
            },
          },
        },
        metadata: {
          ...modelRef.current.metadata,
          updatedAt: new Date().toISOString(),
        },
      });
    });

    graphRef.current = graph;

    return () => {
      graph.dispose();
      graphRef.current = null;
    };
  }, []);

  useEffect(() => {
    const graph = graphRef.current;

    if (!graph) {
      return;
    }

    syncGraphFromModel(graph, model, selectedTableId);

    if (fitKeyRef.current !== fitKey) {
      fitKeyRef.current = fitKey;
      fitGraphContent(graph);
    }
  }, [fitKey, model, selectedTableId]);

  useEffect(() => {
    const graph = graphRef.current;

    if (graph && fitSignal > 0) {
      fitGraphContent(graph);
    }
  }, [fitSignal]);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-slate-50">
      <div className="tabliodb-x6-canvas absolute inset-0" ref={containerRef} />
    </div>
  );
}

function registerTableNodeShape(): void {
  if (tableShapeRegistered) {
    return;
  }

  Shape.HTML.register({
    effect: ['data'],
    height: tableHeaderHeight + tableColumnHeight + tablePaddingBottom,
    html: (cell: Cell) => renderTableNode(cell.getData<TableNodeData>()),
    shape: tableNodeShape,
    width: tableNodeWidth,
  });

  tableShapeRegistered = true;
}

function syncGraphFromModel(graph: Graph, model: DiagramModel, selectedTableId: string | null): void {
  const nodeIds = new Set(Object.keys(model.tables));
  const edgeMetadata = createRelationshipEdgeMetadata(model);
  const edgeIds = new Set(edgeMetadata.map((edge) => edge.id).filter((id): id is string => Boolean(id)));

  graph.batchUpdate('tabliodb-model-sync', () => {
    for (const node of graph.getNodes()) {
      if (!nodeIds.has(node.id)) {
        graph.removeCell(node);
      }
    }

    for (const edge of graph.getEdges()) {
      if (!edgeIds.has(edge.id)) {
        graph.removeCell(edge);
      }
    }

    for (const table of Object.values(model.tables)) {
      syncTableNode(graph, createTableNodeMetadata(model, table, selectedTableId));
    }

    for (const edge of edgeMetadata) {
      syncRelationshipEdge(graph, edge);
    }
  });
}

function syncTableNode(graph: Graph, metadata: NodeMetadata): void {
  const existing = graph.getCellById(metadata.id!) as X6Node | null | undefined;

  if (!existing?.isNode()) {
    graph.addNode(metadata);
    return;
  }

  const nextData = metadata.data as TableNodeData;
  const currentData = existing.getData<TableNodeData>();
  const currentPosition = existing.getPosition();
  const currentSize = existing.getSize();
  const nextPosition = metadata.position ?? { x: metadata.x ?? 0, y: metadata.y ?? 0 };
  const nextSize = metadata.size ?? {
    width: metadata.width ?? tableNodeWidth,
    height: metadata.height ?? tableHeaderHeight,
  };

  if (!isTableNodeDataEqual(currentData, nextData)) {
    existing.setData(nextData, { overwrite: true });
  }

  if (currentSize.width !== nextSize.width || currentSize.height !== nextSize.height) {
    existing.resize(nextSize.width, nextSize.height);
  }

  if (currentPosition.x !== nextPosition.x || currentPosition.y !== nextPosition.y) {
    // Programmatic position sync only runs when React receives a new model; drag itself remains owned by X6 during interaction.
    existing.position(nextPosition.x, nextPosition.y);
  }

  existing.setZIndex(metadata.zIndex ?? 1);
}

function syncRelationshipEdge(graph: Graph, metadata: EdgeMetadata): void {
  const existing = graph.getCellById(metadata.id!) as X6Edge | null | undefined;

  if (!existing?.isEdge()) {
    graph.addEdge(metadata);
    return;
  }

  if (
    existing.getSourceCellId() !== getMetadataTerminalCellId(metadata.source) ||
    existing.getTargetCellId() !== getMetadataTerminalCellId(metadata.target)
  ) {
    graph.removeCell(existing);
    graph.addEdge(metadata);
    return;
  }

  existing.setLabels(metadata.labels ?? []);
  existing.setRouter(metadata.router!);
  existing.setConnector(metadata.connector!);
  existing.attr(metadata.attrs ?? {});
  existing.setZIndex(metadata.zIndex ?? 0);
}

function getMetadataTerminalCellId(terminal: EdgeMetadata['source']): string | null {
  if (typeof terminal === 'string') {
    return terminal;
  }

  if (terminal && typeof terminal === 'object' && 'cell' in terminal && typeof terminal.cell === 'string') {
    return terminal.cell;
  }

  return null;
}

function createTableNodeMetadata(
  model: DiagramModel,
  table: DatabaseTable,
  selectedTableId: string | null,
): NodeMetadata {
  const columns = getTableColumns(model, table.id);
  const height = tableHeaderHeight + columns.length * tableColumnHeight + tablePaddingBottom;

  return {
    id: table.id,
    data: {
      color: table.color ?? '#0f766e',
      columns,
      selected: table.id === selectedTableId,
      tableId: table.id,
      tableName: table.name,
    } satisfies TableNodeData,
    height,
    position: table.position,
    shape: tableNodeShape,
    width: tableNodeWidth,
    zIndex: table.id === selectedTableId ? 2 : 1,
  };
}

function createRelationshipEdgeMetadata(model: DiagramModel): EdgeMetadata[] {
  return Object.values(model.relationships).flatMap<EdgeMetadata>((relationship) => {
    const sourceTable = model.tables[relationship.sourceTableId];
    const targetTable = model.tables[relationship.targetTableId];

    if (!sourceTable || !targetTable) {
      return [];
    }

    const sourceColumn = model.columns[relationship.sourceColumnId];
    const targetColumn = model.columns[relationship.targetColumnId];
    const label = `${sourceColumn?.name ?? 'id'} -> ${targetColumn?.name ?? 'id'}`;

    return [
      {
        id: relationship.id,
        attrs: {
          line: {
            sourceMarker: {
              name: 'circle',
              size: 6,
            },
            stroke: '#58cc02',
            strokeWidth: 2,
            targetMarker: {
              name: 'classic',
              size: 8,
            },
          },
        },
        connector: {
          name: 'rounded',
          args: { radius: 10 },
        },
        labels: [label],
        router: {
          name: 'manhattan',
          args: { padding: 18 },
        },
        source: { cell: relationship.sourceTableId },
        target: { cell: relationship.targetTableId },
        zIndex: 0,
      },
    ];
  });
}

function isTableNodeDataEqual(current: TableNodeData | undefined, next: TableNodeData): boolean {
  if (!current) {
    return false;
  }

  return (
    current.color === next.color &&
    current.selected === next.selected &&
    current.tableId === next.tableId &&
    current.tableName === next.tableName &&
    current.columns.length === next.columns.length &&
    current.columns.every((column, index) => {
      const nextColumn = next.columns[index];

      return (
        column.id === nextColumn.id &&
        column.name === nextColumn.name &&
        formatColumnType(column.type) === formatColumnType(nextColumn.type) &&
        column.nullable === nextColumn.nullable &&
        column.primaryKey === nextColumn.primaryKey &&
        column.unique === nextColumn.unique
      );
    })
  );
}

function fitGraphContent(graph: Graph): void {
  graph.zoomToFit({
    maxScale: 1,
    padding: 80,
  });
  graph.centerContent();
}

function renderTableNode(data: TableNodeData): string {
  const rows = data.columns.map((column) => renderColumnRow(column)).join('');

  return `
    <div class="tabliodb-table-node ${data.selected ? 'is-selected' : ''}" style="--table-accent: ${escapeHtml(data.color)}">
      <div class="tabliodb-table-node__header">
        <span class="tabliodb-table-node__status"></span>
        <span class="tabliodb-table-node__name">${escapeHtml(data.tableName)}</span>
        <span class="tabliodb-table-node__count">${data.columns.length}</span>
      </div>
      <div class="tabliodb-table-node__columns">${rows}</div>
    </div>
  `;
}

function renderColumnRow(column: DatabaseColumn): string {
  const badges = [
    column.primaryKey ? '<span class="tabliodb-table-node__badge">PK</span>' : '',
    column.unique ? '<span class="tabliodb-table-node__badge">UQ</span>' : '',
    !column.nullable ? '<span class="tabliodb-table-node__badge">NN</span>' : '',
  ].join('');

  return `
    <div class="tabliodb-table-node__column">
      <span class="tabliodb-table-node__column-name">${escapeHtml(column.name)}</span>
      <span class="tabliodb-table-node__column-type">${escapeHtml(formatColumnType(column.type))}</span>
      <span class="tabliodb-table-node__badges">${badges}</span>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
