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
const tableHeaderHeight = 46;
const tableColumnHeight = 32;
const tablePaddingBottom = 10;
const diagramVisualGridSize = 24;
const diagramDragGridSize = 1;
const relationshipActiveColor = '#58cc02';
const relationshipNeutralColor = '#9ca3af';
const relationshipExitGap = 42;
const relationshipLaneGap = 12;
const relationshipPortRadius = 4;
const relationshipPortGap = 14;
const relationshipSameSideGap = 64;

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

type PortSide = 'left' | 'right';

type RelationshipTerminal = {
  active: boolean;
  columnId: string;
  laneIndex: number;
  laneTotal: number;
  portId: string;
  relationshipId: string;
  role: 'foreign' | 'primary';
  side: PortSide;
  tableId: string;
};

type RelationshipPlan = {
  terminalsByRelationship: Map<string, { source?: RelationshipTerminal; target?: RelationshipTerminal }>;
  terminalsByTable: Map<string, RelationshipTerminal[]>;
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
        connector: { name: 'rounded', args: { radius: 12 } },
        connectionPoint: 'boundary',
        highlight: true,
        router: { name: 'normal' },
        snap: { radius: 24 },
      },
      container: containerRef.current,
      grid: {
        visible: true,
        size: diagramVisualGridSize,
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

    // X6 couples node movement snapping to the visible grid size; keeping the visual grid at 24px while snapping at 1px makes drag placement precise.
    graph.getGridSize = () => diagramDragGridSize;

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
  const relationshipPlan = createRelationshipPlan(model, selectedTableId);
  const nodeIds = new Set(Object.keys(model.tables));
  const edgeMetadata = createRelationshipEdgeMetadata(model, relationshipPlan);
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
      syncTableNode(
        graph,
        createTableNodeMetadata(model, table, selectedTableId, relationshipPlan.terminalsByTable.get(table.id) ?? []),
      );
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
  const nextPorts = metadata.ports;

  if (!isTableNodeDataEqual(currentData, nextData)) {
    existing.setData(nextData, { overwrite: true });
  }

  if (JSON.stringify(existing.getPorts()) !== JSON.stringify(getPortItems(nextPorts))) {
    // Relationship endpoints are rendered as X6 ports, so port metadata must move with column rows and lane offsets.
    existing.setProp('ports', nextPorts);
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
    existing.getTargetCellId() !== getMetadataTerminalCellId(metadata.target) ||
    existing.getSourcePortId() !== getMetadataTerminalPortId(metadata.source) ||
    existing.getTargetPortId() !== getMetadataTerminalPortId(metadata.target)
  ) {
    graph.removeCell(existing);
    graph.addEdge(metadata);
    return;
  }

  existing.setLabels(metadata.labels ?? []);
  existing.setRouter(metadata.router!);
  existing.setConnector(metadata.connector!);
  existing.attr(metadata.attrs ?? {});
  existing.setVertices(metadata.vertices ?? []);
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

function getMetadataTerminalPortId(terminal: EdgeMetadata['source']): string | null {
  if (terminal && typeof terminal === 'object' && 'port' in terminal && typeof terminal.port === 'string') {
    return terminal.port;
  }

  return null;
}

function getPortItems(ports: NodeMetadata['ports'] | undefined): unknown[] {
  if (Array.isArray(ports)) {
    return ports;
  }

  // X6 accepts both a raw port array and a full ports metadata object; normalizing here keeps sync comparisons type-safe.
  return ports?.items ?? [];
}

function createTableNodeMetadata(
  model: DiagramModel,
  table: DatabaseTable,
  selectedTableId: string | null,
  terminals: RelationshipTerminal[],
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
    ports: createColumnPorts(model, table, terminals),
    shape: tableNodeShape,
    width: tableNodeWidth,
    zIndex: table.id === selectedTableId ? 2 : 1,
  };
}

function createRelationshipEdgeMetadata(model: DiagramModel, plan: RelationshipPlan): EdgeMetadata[] {
  return Object.values(model.relationships).flatMap<EdgeMetadata>((relationship, index) => {
    const sourceTable = model.tables[relationship.sourceTableId];
    const targetTable = model.tables[relationship.targetTableId];
    const terminals = plan.terminalsByRelationship.get(relationship.id);

    if (!sourceTable || !targetTable || !terminals?.source || !terminals.target) {
      return [];
    }

    // Only relationships owned by the selected primary-key table use the active Duolingo green, so inactive wiring stays readable but subdued.
    const stroke = terminals.source.active ? relationshipActiveColor : relationshipNeutralColor;
    const strokeWidth = terminals.source.active ? 3 : 2;

    return [
      {
        id: relationship.id,
        attrs: {
          line: {
            sourceMarker: {
              d: 'M 0 -8 L 0 8',
              fill: 'none',
              name: 'path',
              offsetX: -5,
              stroke,
              strokeWidth,
            },
            stroke,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeWidth,
            targetMarker: {
              // DrawSQL-style crow's foot marker communicates the many side of the relationship at the foreign-key endpoint.
              d: 'M 10 -9 L 0 0 L 10 9 M 0 0 L 10 0',
              fill: 'none',
              name: 'path',
              offsetX: 1,
              stroke,
              strokeWidth,
            },
          },
        },
        connector: {
          name: 'rounded',
          args: { radius: 12 },
        },
        labels: [],
        router: {
          name: 'normal',
        },
        source: { cell: relationship.sourceTableId, port: terminals.source.portId },
        target: { cell: relationship.targetTableId, port: terminals.target.portId },
        vertices: createRelationshipVertices(sourceTable, targetTable, terminals.source, terminals.target, index),
        zIndex: terminals.source.active ? 1 : 0,
      },
    ];
  });
}

function createRelationshipPlan(model: DiagramModel, selectedTableId: string | null): RelationshipPlan {
  const groupedTerminals = new Map<string, Omit<RelationshipTerminal, 'laneIndex' | 'laneTotal'>[]>();
  const terminalsByRelationship = new Map<string, { source?: RelationshipTerminal; target?: RelationshipTerminal }>();
  const terminalsByTable = new Map<string, RelationshipTerminal[]>();

  for (const relationship of Object.values(model.relationships)) {
    const sourceTable = model.tables[relationship.sourceTableId];
    const targetTable = model.tables[relationship.targetTableId];

    if (!sourceTable || !targetTable) {
      continue;
    }

    const sourceIsLeft = sourceTable.position.x + tableNodeWidth / 2 <= targetTable.position.x + tableNodeWidth / 2;
    const active = selectedTableId === relationship.sourceTableId;
    const sourceSide: PortSide = sourceIsLeft ? 'right' : 'left';
    const targetSide: PortSide = sourceIsLeft ? 'left' : 'right';

    pushGroupedTerminal(
      groupedTerminals,
      createTerminalBase({
        active,
        columnId: relationship.sourceColumnId,
        relationshipId: relationship.id,
        role: 'primary',
        side: sourceSide,
        tableId: relationship.sourceTableId,
      }),
    );
    pushGroupedTerminal(
      groupedTerminals,
      createTerminalBase({
        active,
        columnId: relationship.targetColumnId,
        relationshipId: relationship.id,
        role: 'foreign',
        side: targetSide,
        tableId: relationship.targetTableId,
      }),
    );
  }

  for (const terminals of groupedTerminals.values()) {
    terminals.forEach((terminal, laneIndex) => {
      // Endpoints that share the same table, column, and side receive separate lanes so multiple wires do not collapse into one line.
      const hydratedTerminal: RelationshipTerminal = {
        ...terminal,
        laneIndex,
        laneTotal: terminals.length,
      };
      const existing = terminalsByRelationship.get(terminal.relationshipId) ?? {};

      terminalsByRelationship.set(terminal.relationshipId, {
        source: terminal.role === 'primary' ? hydratedTerminal : existing.source,
        target: terminal.role === 'foreign' ? hydratedTerminal : existing.target,
      });

      terminalsByTable.set(terminal.tableId, [...(terminalsByTable.get(terminal.tableId) ?? []), hydratedTerminal]);
    });
  }

  return { terminalsByRelationship, terminalsByTable };
}

function createTerminalBase(options: {
  active: boolean;
  columnId: string;
  relationshipId: string;
  role: RelationshipTerminal['role'];
  side: PortSide;
  tableId: string;
}): Omit<RelationshipTerminal, 'laneIndex' | 'laneTotal'> {
  return {
    ...options,
    portId: `${options.relationshipId}:${options.role}:${options.columnId}:${options.side}`,
  };
}

function pushGroupedTerminal(
  groupedTerminals: Map<string, Omit<RelationshipTerminal, 'laneIndex' | 'laneTotal'>[]>,
  terminal: Omit<RelationshipTerminal, 'laneIndex' | 'laneTotal'>,
): void {
  const key = `${terminal.tableId}:${terminal.columnId}:${terminal.side}`;
  groupedTerminals.set(key, [...(groupedTerminals.get(key) ?? []), terminal]);
}

function createColumnPorts(
  model: DiagramModel,
  table: DatabaseTable,
  terminals: RelationshipTerminal[],
): NodeMetadata['ports'] {
  const columns = getTableColumns(model, table.id);

  return {
    groups: {
      absolute: {
        markup: [{ selector: 'portBody', tagName: 'circle' }],
        position: 'absolute',
      },
    },
    items: terminals.flatMap((terminal) => {
      const columnIndex = columns.findIndex((column) => column.id === terminal.columnId);

      if (columnIndex < 0) {
        return [];
      }

      const y = tableHeaderHeight + columnIndex * tableColumnHeight + tableColumnHeight / 2;
      // The vertical lane offset makes several relationships to the same id row visually distinct while keeping every endpoint attached to the real column.
      const laneOffset = (terminal.laneIndex - (terminal.laneTotal - 1) / 2) * 8;
      const color = terminal.active ? relationshipActiveColor : relationshipNeutralColor;

      return [
        {
          args: {
            x: getPortX(terminal.side),
            y: y + laneOffset,
          },
          attrs: {
            portBody: {
              cursor: 'crosshair',
              fill: '#ffffff',
              magnet: true,
              r: terminal.active ? relationshipPortRadius + 1 : relationshipPortRadius,
              stroke: color,
              strokeWidth: terminal.active ? 3 : 2,
            },
          },
          group: 'absolute',
          id: terminal.portId,
          zIndex: 10,
        },
      ];
    }),
  };
}

function createRelationshipVertices(
  sourceTable: DatabaseTable,
  targetTable: DatabaseTable,
  source: RelationshipTerminal,
  target: RelationshipTerminal,
  index: number,
): Array<{ x: number; y: number }> {
  const sourcePoint = getTerminalPoint(sourceTable, source);
  const targetPoint = getTerminalPoint(targetTable, target);
  const sourceDirection = getSideDirection(source.side);
  const targetDirection = getSideDirection(target.side);
  // A stable per-relationship lane nudges parallel routes apart without changing their FK/PK attachment points.
  const laneOffset = ((index % 9) - 4) * relationshipLaneGap;
  const sourceExitDistance = relationshipExitGap + source.laneIndex * relationshipLaneGap;
  const targetExitDistance = relationshipExitGap + target.laneIndex * relationshipLaneGap;
  const sourceExit = {
    x: sourcePoint.x + sourceDirection * sourceExitDistance,
    y: sourcePoint.y,
  };
  const targetExit = {
    x: targetPoint.x + targetDirection * targetExitDistance,
    y: targetPoint.y,
  };

  if (source.side !== target.side) {
    const midX = (sourceExit.x + targetExit.x) / 2 + laneOffset;

    return [sourceExit, { x: midX, y: sourcePoint.y }, { x: midX, y: targetPoint.y }, targetExit];
  }

  const outerX =
    source.side === 'left'
      ? Math.min(sourceExit.x, targetExit.x) - relationshipSameSideGap - Math.abs(laneOffset)
      : Math.max(sourceExit.x, targetExit.x) + relationshipSameSideGap + Math.abs(laneOffset);

  return [sourceExit, { x: outerX, y: sourcePoint.y }, { x: outerX, y: targetPoint.y }, targetExit];
}

function getTerminalPoint(table: DatabaseTable, terminal: RelationshipTerminal): { x: number; y: number } {
  const columnIndex = table.columnIds.indexOf(terminal.columnId);
  const laneOffset = (terminal.laneIndex - (terminal.laneTotal - 1) / 2) * 8;

  return {
    x: table.position.x + getPortX(terminal.side),
    y:
      table.position.y +
      tableHeaderHeight +
      Math.max(columnIndex, 0) * tableColumnHeight +
      tableColumnHeight / 2 +
      laneOffset,
  };
}

function getPortX(side: PortSide): number {
  return side === 'left' ? -relationshipPortGap : tableNodeWidth + relationshipPortGap;
}

function getSideDirection(side: PortSide): -1 | 1 {
  return side === 'left' ? -1 : 1;
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
