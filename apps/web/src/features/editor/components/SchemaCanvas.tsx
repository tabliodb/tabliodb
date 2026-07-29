import {
  Graph,
  Shape,
  type Cell,
  type Edge as X6Edge,
  type EdgeMetadata,
  type EdgeView,
  type Node as X6Node,
  type NodeMetadata,
  type PointLike,
} from '@antv/x6';
import {
  applyDiagramCommand,
  getRelationshipColumnPairs,
  getTableColumns,
  type DatabaseColumn,
  type DatabaseTable,
  type DiagramModel,
} from '@tabliodb/schema-core';
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
const relationshipConnectorRadius = 10;
const relationshipEndpointLaneGap = 8;
const relationshipMinimumBridgeGap = 24;
const relationshipNeutralColor = '#9ca3af';
const relationshipPortRadius = 4;
const relationshipRouteGap = 40;
const relationshipRouteLaneGap = 8;
const relationshipRouterName = 'tabliodb-relationship';

let relationshipRouterRegistered = false;
let tableShapeRegistered = false;

export type SchemaCanvasProps = {
  fitSignal: number;
  fitKey: string;
  model: DiagramModel;
  selectedTableId: string | null;
  onModelChange: (model: DiagramModel) => void;
  onSelectedTableChange: (tableId: string | null) => void;
  readOnly?: boolean;
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
  readOnly = false,
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
    registerRelationshipRouter();

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
        connector: { name: 'rounded', args: { radius: relationshipConnectorRadius } },
        connectionPoint: 'boundary',
        highlight: true,
        router: { name: relationshipRouterName },
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
        nodeMovable: !readOnly,
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
      if (readOnly) {
        return;
      }

      const data = node.getData<TableNodeData>();
      const table = modelRef.current.tables[data.tableId];

      if (!table) {
        return;
      }

      const position = node.getPosition();

      onModelChangeRef.current(
        applyDiagramCommand(modelRef.current, {
          type: 'table.move',
          tableId: table.id,
          // X6 owns interaction coordinates while the domain model remains the persistence source for table positions.
          position: {
            x: position.x,
            y: position.y,
          },
        }),
      );
    });

    graphRef.current = graph;

    return () => {
      graph.dispose();
      graphRef.current = null;
    };
  }, [readOnly]);

  useEffect(() => {
    const graph = graphRef.current;

    if (!graph) {
      return;
    }

    syncGraphFromModel(graph, model, selectedTableId, readOnly);

    if (fitKeyRef.current !== fitKey) {
      fitKeyRef.current = fitKey;
      fitGraphContent(graph);
    }
  }, [fitKey, model, readOnly, selectedTableId]);

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

function syncGraphFromModel(
  graph: Graph,
  model: DiagramModel,
  selectedTableId: string | null,
  readOnly: boolean,
): void {
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
        createTableNodeMetadata(
          model,
          table,
          selectedTableId,
          relationshipPlan.terminalsByTable.get(table.id) ?? [],
          readOnly,
        ),
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
  readOnly: boolean,
): NodeMetadata {
  const columns = getTableColumns(model, table.id);
  const height = tableHeaderHeight + columns.length * tableColumnHeight + tablePaddingBottom;
  const width = getTableWidth(table);

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
    ports: createColumnPorts(model, table, terminals, readOnly),
    shape: tableNodeShape,
    width,
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

    // Relationships become active when either endpoint table is selected, so both PK-side and FK-side inspection highlights the same wiring.
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
          args: { radius: relationshipConnectorRadius },
        },
        labels: [],
        router: {
          name: relationshipRouterName,
          args: {
            edgeIndex: index,
            sourceLaneIndex: terminals.source.laneIndex,
            targetLaneIndex: terminals.target.laneIndex,
          },
        },
        source: { cell: relationship.sourceTableId, port: terminals.source.portId },
        target: { cell: relationship.targetTableId, port: terminals.target.portId },
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
    const [columnPair] = getRelationshipColumnPairs(relationship);

    if (!sourceTable || !targetTable || !columnPair) {
      continue;
    }

    const sourceIsLeft =
      sourceTable.position.x + getTableWidth(sourceTable) / 2 <=
      targetTable.position.x + getTableWidth(targetTable) / 2;
    // Selecting either the primary-key table or the foreign-key table should light up the relationship for quick bidirectional tracing.
    const active = selectedTableId === relationship.sourceTableId || selectedTableId === relationship.targetTableId;
    const sourceSide: PortSide = sourceIsLeft ? 'right' : 'left';
    const targetSide: PortSide = sourceIsLeft ? 'left' : 'right';

    pushGroupedTerminal(
      groupedTerminals,
      createTerminalBase({
        active,
        columnId: columnPair.sourceColumnId,
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
        columnId: columnPair.targetColumnId,
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
  readOnly: boolean,
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
      const laneOffset = (terminal.laneIndex - (terminal.laneTotal - 1) / 2) * relationshipEndpointLaneGap;
      const color = terminal.active ? relationshipActiveColor : relationshipNeutralColor;

      return [
        {
          args: {
            x: terminal.side === 'left' ? 0 : getTableWidth(table),
            y: y + laneOffset,
          },
          attrs: {
            portBody: {
              cursor: readOnly ? 'default' : 'crosshair',
              fill: '#ffffff',
              magnet: !readOnly,
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

function getTableWidth(table: DatabaseTable): number {
  return Math.max(table.width, tableNodeWidth);
}

function registerRelationshipRouter(): void {
  if (relationshipRouterRegistered) {
    return;
  }

  Graph.registerRouter(
    relationshipRouterName,
    (vertices, options, edgeView) => createLiveRelationshipRoute(vertices, options, edgeView),
    true,
  );
  relationshipRouterRegistered = true;
}

function createLiveRelationshipRoute(
  vertices: PointLike[],
  options: {
    edgeIndex?: number;
    sourceLaneIndex?: number;
    targetLaneIndex?: number;
  },
  edgeView: EdgeView,
): PointLike[] {
  if (!edgeView.sourceAnchor || !edgeView.targetAnchor) {
    return vertices;
  }

  const source = edgeView.sourceAnchor;
  const target = edgeView.targetAnchor;
  const sourceBBox = edgeView.sourceView?.cell.getBBox();
  const targetBBox = edgeView.targetView?.cell.getBBox();

  if (!sourceBBox || !targetBBox) {
    return vertices;
  }

  const sourceDirection = source.x <= sourceBBox.x + sourceBBox.width / 2 ? -1 : 1;
  const targetDirection = target.x <= targetBBox.x + targetBBox.width / 2 ? -1 : 1;
  const edgeLaneOffset = (((options.edgeIndex ?? 0) % 7) - 3) * relationshipRouteLaneGap;
  const faceToFaceBridgeX = getFaceToFaceBridgeX(
    sourceBBox,
    targetBBox,
    sourceDirection,
    targetDirection,
    edgeLaneOffset,
  );

  // This router is evaluated by X6 during node movement, so the path follows the live drag position instead of stale React model coordinates.
  if (faceToFaceBridgeX !== null) {
    return [
      { x: faceToFaceBridgeX, y: source.y },
      { x: faceToFaceBridgeX, y: target.y },
    ];
  }

  if (sourceDirection === targetDirection) {
    const outerX =
      sourceDirection === -1
        ? Math.min(sourceBBox.x, targetBBox.x) - relationshipRouteGap - Math.abs(edgeLaneOffset)
        : Math.max(sourceBBox.x + sourceBBox.width, targetBBox.x + targetBBox.width) +
          relationshipRouteGap +
          Math.abs(edgeLaneOffset);

    return [
      { x: outerX, y: source.y },
      { x: outerX, y: target.y },
    ];
  }

  const unionLeft = Math.min(sourceBBox.x, targetBBox.x);
  const unionRight = Math.max(sourceBBox.x + sourceBBox.width, targetBBox.x + targetBBox.width);
  const sourceOuterX =
    sourceDirection === -1
      ? unionLeft - relationshipRouteGap - Math.abs(edgeLaneOffset)
      : unionRight + relationshipRouteGap + Math.abs(edgeLaneOffset);
  const targetOuterX =
    targetDirection === -1
      ? unionLeft - relationshipRouteGap - Math.abs(edgeLaneOffset)
      : unionRight + relationshipRouteGap + Math.abs(edgeLaneOffset);
  const detourY = getVerticalDetourY(sourceBBox, targetBBox, source.y, target.y, Math.abs(edgeLaneOffset));

  return [
    { x: sourceOuterX, y: source.y },
    { x: sourceOuterX, y: detourY },
    { x: targetOuterX, y: detourY },
    { x: targetOuterX, y: target.y },
  ];
}

function getFaceToFaceBridgeX(
  sourceBBox: { x: number; width: number },
  targetBBox: { x: number; width: number },
  sourceDirection: -1 | 1,
  targetDirection: -1 | 1,
  laneOffset: number,
): number | null {
  if (sourceDirection === 1 && targetDirection === -1) {
    const sourceRight = sourceBBox.x + sourceBBox.width;
    const targetLeft = targetBBox.x;
    const gap = targetLeft - sourceRight;

    if (gap >= relationshipMinimumBridgeGap) {
      return clamp(sourceRight + gap / 2 + laneOffset, sourceRight + 8, targetLeft - 8);
    }
  }

  if (sourceDirection === -1 && targetDirection === 1) {
    const targetRight = targetBBox.x + targetBBox.width;
    const sourceLeft = sourceBBox.x;
    const gap = sourceLeft - targetRight;

    if (gap >= relationshipMinimumBridgeGap) {
      return clamp(targetRight + gap / 2 + laneOffset, targetRight + 8, sourceLeft - 8);
    }
  }

  return null;
}

function getVerticalDetourY(
  sourceBBox: { y: number; height: number },
  targetBBox: { y: number; height: number },
  sourceY: number,
  targetY: number,
  laneOffset: number,
): number {
  const topY = Math.min(sourceBBox.y, targetBBox.y) - relationshipRouteGap - laneOffset;
  const bottomY =
    Math.max(sourceBBox.y + sourceBBox.height, targetBBox.y + targetBBox.height) + relationshipRouteGap + laneOffset;
  const topCost = Math.abs(sourceY - topY) + Math.abs(targetY - topY);
  const bottomCost = Math.abs(sourceY - bottomY) + Math.abs(targetY - bottomY);

  return topCost <= bottomCost ? topY : bottomY;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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
