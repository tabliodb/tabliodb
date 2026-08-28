import {
  Graph,
  Shape,
  type Cell,
  type ConnectorDefinition,
  type Edge as X6Edge,
  type EdgeMetadata,
  type Node as X6Node,
  type NodeMetadata,
  type PointLike,
} from '@antv/x6';
import {
  applyDiagramCommand,
  createDiagramEntityId,
  defaultTableMinWidth,
  getRelationshipColumnPairs,
  getTableColumns,
  normalizeDiagramModel,
  type DatabaseColumn,
  type DatabaseRelationship,
  type DatabaseTable,
  type DiagramGroup,
  type DiagramModel,
  type DiagramNote,
  type TableDisplayMode,
} from '@tabliodb/schema-core';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  WithTooltip,
  cn,
  toast,
} from '@tabliodb/ui';
import type { CommentTargetType, CommentThreadTargetSummaryDto } from '@/resources/comments';
import type { AwarenessState } from '@tabliodb/shared';
import {
  ArrowRight,
  Copy,
  FileText,
  KeyRound,
  ListPlus,
  MessageSquareText,
  Palette,
  Scissors,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  createCommentMarkerSummary,
  formatCommentMarkerCount,
  formatCommentMarkerTitle,
  getColumnCommentMarkerCount,
  getCommentMarkerCountForTarget,
  getTableCommentMarkerCount,
  hasOpenCommentMarkers,
  type CommentMarkerCount,
  type CommentMarkerSummary,
} from '../comment-markers';
import {
  copyTableToClipboard,
  createUniqueColumnName,
  createUniqueIndexName,
  duplicateTableInModel,
} from '../diagram-table-actions';
import { formatColumnType } from '../diagram-model';
import { getDisplayTableColor, getTableColorLabel, tableColorOptions } from '../table-colors';

const tableNodeShape = 'tabliodb-table';
const noteNodeShape = 'tabliodb-note';
const groupNodeIdPrefix = 'tabliodb-group:';

const diagramRouterStepSize = 6; // Setengah dari visual grid agar garis bisa di "antar dot"
const tableNodeWidth = 288; // Default width saat table baru dibuat, bukan batas terkecil saat user resize.
const tableHeaderHeight = 36; // Header dan CSS sama-sama 3 grid unit agar node HTML tidak terpotong di X6.
const tableColumnHeight = 24; // Port dihitung dari tinggi row ini, jadi konektor jatuh tepat di tengah baris kolom.
const tablePaddingBottom = 12; // Padding bawah 1 grid unit menjaga row terakhir tidak mepet radius kartu saat kolom bertambah.
const groupPaddingX = 36; // Group mengikuti grid 12px supaya outline group tetap sejajar dengan table di canvas.
const groupPaddingBottom = 24; // Ruang bawah group dibuat dua grid unit agar table terakhir tidak terasa menempel.
const groupHeaderOffset = 48; // Header group memakai offset empat grid unit agar judul tidak bertabrakan dengan table pertama.
const noteNodeDefaultWidth = 264; // Width note juga grid-aligned sehingga add-note di viewport terasa presisi.
const noteNodeMinHeight = 120; // Min-height note stabil untuk textarea kosong dan tetap mudah di-drag.
const noteNodeMaxHeight = 216; // Max-height mencegah note panjang mendominasi canvas saat belum ada fitur rich note penuh.
const tableResizeMaxWidth = 720; // Max width tetap grid-aligned agar relasi tidak perlu koreksi sub-pixel saat resize.
const tableResizeMinWidth = defaultTableMinWidth; // Mengikuti schema-core agar preview canvas dan model tidak berbeda saat resize mentok.

const diagramVisualGridSize = 12;
const diagramDragGridSize = 12;
// Canvas colors are fixed hex values because X6 receives them outside CSS class resolution.
const canvasBackgroundColor = '#F6F6F6';
const canvasGridColor = '#AAAAAA';
const relationshipActiveColor = '#58cc02';
const relationshipConnectorName = 'tabliodb-relationship-orthogonal-rounded';
const relationshipConnectorRadius = 10;
const relationshipNeutralColor = '#A0A0A0';
const relationshipPortRadius = 4;
const relationshipQuickEditorHeight = 156;
const relationshipQuickEditorWidth = 360;

const relationshipObstaclePadding = 12;
const relationshipRouteFanLength = 18;
const relationshipRouteStepSize = 3;
const relationshipRouteStubLength = 18;
const relationshipRouteUTurnGap = 48;
const relationshipEndpointGap = 3;
const relationshipLaneGap = 3;
const relationshipLaneSearchRadius = 14;
const relationshipConnectorStraightEndpointVertices = 1; // Vertex paling dekat port tetap lurus agar line-in tidak punya lekukan mikro.
const relationshipConnectorMinimumRoundedSegment = diagramRouterStepSize * 2; // Corner baru dibulatkan saat dua segmennya cukup panjang untuk tidak terlihat bergelombang.
const relationshipManyMarkerLength = 16; // Crow-foot lebih panjang dari default agar cardinality tetap terbaca pada zoom editor.
const relationshipManyMarkerSpread = 7; // Spread 7px membuat tiga cabang many terlihat jelas tanpa terlalu berat di light theme.
const relationshipManyMarkerOutset = relationshipManyMarkerLength / 2; // X6 men-center marker bbox, jadi endpoint many perlu maju setengah marker ke luar table.
const minimapAspectRatio = 192 / 124;

let noteShapeRegistered = false;
let relationshipConnectorRegistered = false;
let tableShapeRegistered = false;

export type SchemaCanvasProps = {
  commentTargetSummaries?: CommentThreadTargetSummaryDto[];
  fitSignal: number;
  fitKey: string;
  floatingInsetLeft?: number;
  floatingInsetRight?: number;
  minimapToggleSignal?: number;
  model: DiagramModel;
  onLocalCursorChange?: (cursor: AwarenessState['cursor']) => void;
  onViewportChange?: (viewport: CanvasViewportRect) => void;
  onCommentTargetOpen?: (target: { targetId: string; targetType: CommentTargetType }) => void;
  onColumnSelect?: (columnId: string) => void;
  onTableDocsOpen?: (tableId: string) => void;
  selectedTableIds?: string[];
  selectedTableId: string | null;
  selectedColumnId?: string | null;
  onModelChange: (model: DiagramModel) => void;
  onSelectedTableIdsChange?: (tableIds: string[]) => void;
  onSelectedTableChange: (tableId: string | null) => void;
  remoteCursors?: RemoteCanvasCursor[];
  readOnly?: boolean;
  toolbar?: ReactNode;
  toolbarOffsetLeft?: string;
  minimapOffsetRight?: string;
};

export type CanvasViewportRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type RemoteCanvasCursor = {
  clientIds: number[];
  cursor: NonNullable<AwarenessState['cursor']>;
  user: AwarenessState['user'];
};

type TableNodeData = {
  kind: 'table';
  color: string;
  columnCommentMarkers: Record<string, CommentMarkerCount>;
  columns: DatabaseColumn[];
  columnCountLabel: string;
  commentMarker: CommentMarkerCount;
  displayMode: TableDisplayMode;
  portSignature: string;
  readOnly: boolean;
  selectedColumnId: string | null;
  multiSelected: boolean;
  selected: boolean;
  tableId: string;
  tableName: string;
};

type GroupNodeData = {
  kind: 'group';
  color: string;
  groupId: string;
  groupName: string;
  tableCount: number;
};

type NoteNodeData = {
  kind: 'note';
  color: string;
  commentMarker: CommentMarkerCount;
  noteId: string;
  readOnly: boolean;
  text: string;
};

type PortSide = 'left' | 'right';

type RelationshipTerminal = {
  active: boolean;
  columnId: string;
  portId: string;
  relationshipId: string;
  role: 'foreign' | 'primary';
  side: PortSide;
  tableId: string;
};

type RelationshipPlan = {
  routesByRelationship: Map<string, RelationshipRoute>;
  terminalsByRelationship: Map<string, { source?: RelationshipTerminal; target?: RelationshipTerminal }>;
  terminalsByTable: Map<string, RelationshipTerminal[]>;
};

type RelationshipTableGeometry = {
  centerX: number;
  centerY: number;
};

type RelationshipTerminalSlot = {
  active: boolean;
  related: boolean;
};

type RelationshipTerminalPoint = {
  bounds: CanvasRect;
  x: number;
  y: number;
};

type RelationshipHorizontalSegment = {
  relationshipId: string;
  x1: number;
  x2: number;
  y: number;
};

type RelationshipRoute = {
  horizontalSegments: RelationshipHorizontalSegment[];
  sourcePoint: { x: number; y: number };
  targetPoint: { x: number; y: number };
  vertices: Array<{ x: number; y: number }>;
};

type RelationshipRouteInput = {
  relationship: DatabaseRelationship;
  sourcePoint: RelationshipTerminalPoint;
  sourceTerminal: RelationshipTerminal;
  targetPoint: RelationshipTerminalPoint;
  targetTerminal: RelationshipTerminal;
};

type RelationshipConnectorOptions = {
  minimumRoundedSegment?: number;
  radius?: number;
  raw?: boolean;
  straightEndpointVertices?: number;
};

type RelationshipPathPoint = {
  x: number;
  y: number;
};

type RemoteCanvasCursorPosition = RemoteCanvasCursor & {
  left: number;
  top: number;
};

type RelationshipMenuState = {
  left: number;
  relationshipId: string;
  top: number;
};

type TableContextMenuState = {
  left: number;
  tableId: string;
  top: number;
};

type GroupContextMenuState = {
  groupId: string;
  left: number;
  top: number;
};

type TableSelectionBoxState = {
  count: number;
  height: number;
  left: number;
  top: number;
  width: number;
};

type TableSelectionDragState = {
  startClientX: number;
  startClientY: number;
};

type MultiTableMoveDragState = {
  activeTableId: string;
  latestPositions: Record<string, DatabaseTable['position']>;
  startPositions: Record<string, DatabaseTable['position']>;
  tableIds: string[];
};

type CanvasConfirmAction =
  | {
      id: string;
      name: string;
      type: 'note';
    }
  | {
      id: string;
      name: string;
      type: 'relationship';
    }
  | {
      id: string;
      name: string;
      type: 'table';
    };

type ParsedColumnPortId = {
  columnId: string;
  side: PortSide;
  tableId: string;
};

type CanvasRect = CanvasViewportRect;

type CanvasMinimapTable = CanvasRect & {
  color: string;
  id: string;
  name: string;
  selected: boolean;
};

type CanvasMinimapState = {
  groups: CanvasMinimapTable[];
  notes: CanvasMinimapTable[];
  tables: CanvasMinimapTable[];
  viewBox: CanvasRect;
  viewport: CanvasRect;
};

type CanvasMinimapStaticState = {
  contentBounds: CanvasRect;
  groups: CanvasMinimapTable[];
  notes: CanvasMinimapTable[];
  tables: CanvasMinimapTable[];
};

export function SchemaCanvas({
  commentTargetSummaries = [],
  fitKey,
  fitSignal,
  floatingInsetLeft = 16,
  floatingInsetRight = 16,
  minimapToggleSignal = 0,
  model: rawModel,
  onCommentTargetOpen,
  onColumnSelect,
  onLocalCursorChange,
  onModelChange,
  onSelectedTableIdsChange,
  onSelectedTableChange,
  onTableDocsOpen,
  onViewportChange,
  readOnly = false,
  remoteCursors = [],
  selectedColumnId = null,
  selectedTableIds = [],
  selectedTableId,
  toolbar,
  toolbarOffsetLeft = '1rem',
  minimapOffsetRight = '1rem',
}: SchemaCanvasProps) {
  const model = useMemo(() => normalizeDiagramModel(rawModel), [rawModel]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const fitKeyRef = useRef<string | null>(null);
  const floatingInsetLeftRef = useRef(floatingInsetLeft);
  const floatingInsetRightRef = useRef(floatingInsetRight);
  const modelRef = useRef(model);
  const pendingRelationshipMenuRef = useRef<RelationshipMenuState | null>(null);
  const selectedTableIdRef = useRef(selectedTableId);
  const selectedTableIdsRef = useRef(selectedTableIds);
  const selectedRelationshipIdRef = useRef<string | null>(null);
  const resizingTableIdRef = useRef<string | null>(null);
  const selectionDragRef = useRef<TableSelectionDragState | null>(null);
  const multiTableMoveDragRef = useRef<MultiTableMoveDragState | null>(null);
  const suppressTableClickUntilRef = useRef(0);
  const minimapStaticStateRef = useRef<CanvasMinimapStaticState | null>(null);
  const localCursorFrameRef = useRef(0);
  const pendingLocalCursorRef = useRef<AwarenessState['cursor'] | undefined>(undefined);
  const lastPublishedLocalCursorRef = useRef<AwarenessState['cursor'] | undefined>(undefined);
  const onLocalCursorChangeRef = useRef(onLocalCursorChange);
  const onCommentTargetOpenRef = useRef(onCommentTargetOpen);
  const onColumnSelectRef = useRef(onColumnSelect);
  const onModelChangeRef = useRef(onModelChange);
  const onSelectedTableIdsChangeRef = useRef(onSelectedTableIdsChange);
  const onSelectedTableChangeRef = useRef(onSelectedTableChange);
  const onTableDocsOpenRef = useRef(onTableDocsOpen);
  const onViewportChangeRef = useRef(onViewportChange);
  const remoteCursorsRef = useRef(remoteCursors);
  const [relationshipMenu, setRelationshipMenu] = useState<RelationshipMenuState | null>(null);
  const [tableContextMenu, setTableContextMenu] = useState<TableContextMenuState | null>(null);
  const [groupContextMenu, setGroupContextMenu] = useState<GroupContextMenuState | null>(null);
  const [selectionBox, setSelectionBox] = useState<TableSelectionBoxState | null>(null);
  const [confirmAction, setConfirmAction] = useState<CanvasConfirmAction | null>(null);
  const [remoteCursorPositions, setRemoteCursorPositions] = useState<RemoteCanvasCursorPosition[]>([]);
  // Minimap dimulai dalam keadaan minimized agar editor pertama kali terbuka dengan fokus penuh ke canvas.
  const [minimapOpen, setMinimapOpen] = useState(false);
  const [minimapState, setMinimapState] = useState<CanvasMinimapState | null>(null);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  useEffect(() => {
    // Item minimap yang berasal dari model dihitung saat model/selection berubah saja; loop RAF cukup menggabungkan viewport live.
    minimapStaticStateRef.current = createCanvasMinimapStaticState(model, selectedTableId, selectedTableIds);
  }, [model, selectedTableId, selectedTableIds]);

  useEffect(() => {
    // Graph X6 tidak diremount saat sidebar dibuka-tutup, jadi quick editor relationship membaca safe-area terbaru lewat ref.
    floatingInsetLeftRef.current = floatingInsetLeft;
    floatingInsetRightRef.current = floatingInsetRight;
  }, [floatingInsetLeft, floatingInsetRight]);

  useEffect(() => {
    selectedTableIdRef.current = selectedTableId;
  }, [selectedTableId]);

  useEffect(() => {
    selectedTableIdsRef.current = selectedTableIds;
  }, [selectedTableIds]);

  useEffect(() => {
    selectedRelationshipIdRef.current = relationshipMenu?.relationshipId ?? null;
  }, [relationshipMenu?.relationshipId]);

  useEffect(() => {
    onModelChangeRef.current = onModelChange;
  }, [onModelChange]);

  useEffect(() => {
    onSelectedTableIdsChangeRef.current = onSelectedTableIdsChange;
  }, [onSelectedTableIdsChange]);

  useEffect(() => {
    onLocalCursorChangeRef.current = onLocalCursorChange;
  }, [onLocalCursorChange]);

  useEffect(() => {
    onCommentTargetOpenRef.current = onCommentTargetOpen;
  }, [onCommentTargetOpen]);

  useEffect(() => {
    onColumnSelectRef.current = onColumnSelect;
  }, [onColumnSelect]);

  useEffect(() => {
    onTableDocsOpenRef.current = onTableDocsOpen;
  }, [onTableDocsOpen]);

  useEffect(() => {
    onSelectedTableChangeRef.current = onSelectedTableChange;
  }, [onSelectedTableChange]);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  useEffect(() => {
    remoteCursorsRef.current = remoteCursors;
  }, [remoteCursors]);

  useEffect(() => {
    const pendingRelationshipMenu = pendingRelationshipMenuRef.current;

    if (!pendingRelationshipMenu || !model.relationships[pendingRelationshipMenu.relationshipId]) {
      return;
    }

    // Auto-open relationship actions only after React receives the created relationship in the canonical model.
    // This avoids a transient render where the menu points to an ID that still looks missing.
    pendingRelationshipMenuRef.current = null;
    setRelationshipMenu(pendingRelationshipMenu);
  }, [model.relationships]);

  useEffect(() => {
    if (relationshipMenu && !model.relationships[relationshipMenu.relationshipId]) {
      // Popup relationship ikut ditutup saat relationship dihapus dari model agar UI tidak menunjuk edge stale.
      setRelationshipMenu(null);
    }
  }, [model.relationships, relationshipMenu]);

  useEffect(() => {
    if (tableContextMenu && !model.tables[tableContextMenu.tableId]) {
      setTableContextMenu(null);
    }
  }, [model.tables, tableContextMenu]);

  useEffect(() => {
    if (groupContextMenu && !model.groups[groupContextMenu.groupId]) {
      setGroupContextMenu(null);
    }
  }, [groupContextMenu, model.groups]);

  useEffect(() => {
    if (!tableContextMenu && !groupContextMenu) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      const target = getElementFromEventTarget(event.target);

      if (target?.closest('[data-tabliodb-table-context-menu],[data-tabliodb-group-context-menu]')) {
        return;
      }

      setTableContextMenu(null);
      setGroupContextMenu(null);
    };
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTableContextMenu(null);
        setGroupContextMenu(null);
      }
    };

    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('keydown', handleEscapeKey);

    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [groupContextMenu, tableContextMenu]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    registerTableNodeShape();
    registerNoteNodeShape();
    registerRelationshipConnector();
    // registerRelationshipRouter();

    const container = containerRef.current;
    const graph = new Graph({
      // HTML table nodes are small enough for synchronous rendering, which avoids queued stale views after drag-end state sync.
      async: false,
      autoResize: true,
      background: {
        color: canvasBackgroundColor,
      },
      connecting: {
        allowBlank: false,
        allowLoop: false,
        allowMulti: true,
        allowNode: true,
        connector: {
          name: relationshipConnectorName,
          args: {
            minimumRoundedSegment: relationshipConnectorMinimumRoundedSegment,
            radius: relationshipConnectorRadius,
            straightEndpointVertices: relationshipConnectorStraightEndpointVertices,
          },
        },
        connectionPoint: 'boundary',
        createEdge() {
          // The temporary drag edge should look like Tabliodb relationships, not X6's black arrow default.
          return this.createEdge(createDraftRelationshipEdgeMetadata());
        },
        highlight: true,
        router: { name: 'manhattan', args: buildManhattanRouterArgs() },
        snap: { radius: 24 },
      },
      container,
      grid: {
        visible: true,
        size: diagramVisualGridSize,
        type: 'dot',
        args: {
          color: canvasGridColor,
          thickness: 1,
        },
      },
      interacting: {
        edgeLabelMovable: false,
        edgeMovable: false,
        nodeMovable: (cellView) => !readOnly && isMovableCanvasNodeData(cellView.cell.getData()),
        vertexAddable: false,
        vertexDeletable: false,
      },
      mousewheel: {
        enabled: true,
        factor: 1.08,
        maxScale: 1.8,
        minScale: 0.45,
        zoomAtMousePosition: true,
      },
      panning: {
        enabled: true,
        eventTypes: ['leftMouseDown'],
      },
    });

    // X6 couples node movement snapping to the visible grid size; keeping the visual grid at 24px while snapping at 1px makes drag placement precise.
    graph.getGridSize = () => diagramDragGridSize;

    const createRelationshipMenuStateFromEvent = (
      event: MouseEvent,
      relationshipId: string,
    ): RelationshipMenuState => {
      const containerRect = container.getBoundingClientRect();
      const safeMinLeft = Math.min(
        floatingInsetLeftRef.current + 12,
        Math.max(12, containerRect.width - relationshipQuickEditorWidth - 12),
      );
      const safeMaxLeft = Math.max(
        safeMinLeft,
        containerRect.width - floatingInsetRightRef.current - relationshipQuickEditorWidth - 12,
      );

      return {
        left: clamp(event.clientX - containerRect.left - relationshipQuickEditorWidth / 2, safeMinLeft, safeMaxLeft),
        relationshipId,
        top: clamp(
          event.clientY - containerRect.top - relationshipQuickEditorHeight / 2,
          12,
          containerRect.height - relationshipQuickEditorHeight - 12,
        ),
      };
    };

    const createGroupMenuStateFromEvent = (event: MouseEvent, groupId: string): GroupContextMenuState => {
      const containerRect = container.getBoundingClientRect();
      const menuWidth = 288;
      const menuHeight = 220;
      const safeMinLeft = Math.min(
        floatingInsetLeftRef.current + 12,
        Math.max(12, containerRect.width - menuWidth - 12),
      );
      const safeMaxLeft = Math.max(safeMinLeft, containerRect.width - floatingInsetRightRef.current - menuWidth - 12);

      return {
        groupId,
        left: clamp(event.clientX - containerRect.left, safeMinLeft, safeMaxLeft),
        top: clamp(event.clientY - containerRect.top, 12, containerRect.height - menuHeight - 12),
      };
    };

    const openGroupContextMenu = (event: MouseEvent, groupId: string) => {
      event.preventDefault();
      event.stopPropagation();
      setRelationshipMenu(null);
      setTableContextMenu(null);
      setGroupContextMenu(createGroupMenuStateFromEvent(event, groupId));
    };

    const getCommentMarkerFromEvent = (event: MouseEvent) => {
      const target = getElementFromEventTarget(event.target);
      return target?.closest<HTMLElement>('.tabliodb-table-node__comment-marker') ?? null;
    };

    const getColumnRowFromEvent = (event: MouseEvent) => {
      const target = getElementFromEventTarget(event.target);

      if (!target || target.closest('.tabliodb-table-node__comment-marker')) {
        return null;
      }

      return target.closest<HTMLElement>('.tabliodb-table-node__column');
    };

    const getTableNodeFromEvent = (event: MouseEvent) => {
      const target = getElementFromEventTarget(event.target);

      if (
        !target ||
        target.closest('.tabliodb-table-node__comment-marker') ||
        target.closest('.tabliodb-table-node__resize-zone')
      ) {
        return null;
      }

      return target.closest<HTMLElement>('[data-tabliodb-table-id]');
    };

    const getNoteNodeFromEvent = (event: MouseEvent) => {
      const target = getElementFromEventTarget(event.target);

      return target?.closest<HTMLElement>('[data-tabliodb-note-id]') ?? null;
    };

    const applySingleTableSelection = (tableId: string | null) => {
      // Single-select dan multi-select sengaja saling eksklusif supaya sidebar kiri tidak menampilkan dua konteks edit sekaligus.
      selectedTableIdRef.current = tableId;
      selectedTableIdsRef.current = [];
      onSelectedTableIdsChangeRef.current?.([]);
      onSelectedTableChangeRef.current(tableId);
    };

    const applyMultiTableSelection = (tableIds: string[]) => {
      // Multi-select tidak memakai selectedTableId karena selectedTableId berarti user sedang mengedit satu table secara detail.
      selectedTableIdRef.current = null;
      selectedTableIdsRef.current = tableIds;
      onSelectedTableChangeRef.current(null);
      onSelectedTableIdsChangeRef.current?.(tableIds);
    };

    const toggleMultiTableSelection = (tableId: string) => {
      const currentTableIds = selectedTableIdsRef.current;
      const nextTableIds = currentTableIds.includes(tableId)
        ? currentTableIds.filter((currentTableId) => currentTableId !== tableId)
        : [...currentTableIds, tableId];

      applyMultiTableSelection(nextTableIds);
    };

    const shouldStartTableSelectionBox = (event: MouseEvent) => {
      if (event.button !== 0 || !event.shiftKey) {
        return false;
      }

      const target = getElementFromEventTarget(event.target);

      return Boolean(
        target &&
          !target.closest(
            [
              '[data-tabliodb-table-id]',
              '[data-tabliodb-note-id]',
              '[data-tabliodb-table-context-menu]',
              '.tabliodb-editor-chrome',
              'button',
              'input',
              'textarea',
              'select',
              '[contenteditable="true"]',
              '[data-lexical-editor="true"]',
            ].join(', '),
          ),
      );
    };

    const updateTableSelectionBox = (event: MouseEvent) => {
      const dragState = selectionDragRef.current;

      if (!dragState) {
        return [];
      }

      const containerRect = container.getBoundingClientRect();
      const localStartPoint = graph.clientToLocal(dragState.startClientX, dragState.startClientY);
      const localEndPoint = graph.clientToLocal(event.clientX, event.clientY);
      const localSelectionRect = createRectFromPoints(localStartPoint, localEndPoint);
      const selectedTableIdsInBox = getTableIdsInLocalSelection(modelRef.current, localSelectionRect);
      const screenSelectionRect = createScreenSelectionRect(
        containerRect,
        dragState.startClientX,
        dragState.startClientY,
        event.clientX,
        event.clientY,
      );

      setSelectionBox({
        count: selectedTableIdsInBox.length,
        height: screenSelectionRect.height,
        left: screenSelectionRect.x,
        top: screenSelectionRect.y,
        width: screenSelectionRect.width,
      });

      if (!areTableSelectionIdsEqual(selectedTableIdsRef.current, selectedTableIdsInBox)) {
        applyMultiTableSelection(selectedTableIdsInBox);
      }

      return selectedTableIdsInBox;
    };

    const handleTableSelectionBoxMouseDown = (event: MouseEvent) => {
      if (!shouldStartTableSelectionBox(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      selectionDragRef.current = {
        startClientX: event.clientX,
        startClientY: event.clientY,
      };
      setRelationshipMenu(null);
      setTableContextMenu(null);
      setGroupContextMenu(null);
      applyMultiTableSelection([]);
      updateTableSelectionBox(event);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();
        updateTableSelectionBox(moveEvent);
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        const selectedTableIdsInBox = updateTableSelectionBox(upEvent);

        selectionDragRef.current = null;
        setSelectionBox(null);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);

        if (selectedTableIdsInBox.length > 0) {
          suppressTableClickUntilRef.current = Date.now() + 120;
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    };

    const getNoteActionFromEvent = (event: Event, fallbackNoteId?: string) => {
      const target = getElementFromEventTarget(event.target);
      const actionButton = target?.closest<HTMLButtonElement>('[data-note-action]');

      if (!actionButton) {
        return null;
      }

      const noteElement = actionButton.closest<HTMLElement>('[data-tabliodb-note-id]');
      const noteId = noteElement?.dataset.tabliodbNoteId ?? fallbackNoteId;
      const action = actionButton.dataset.noteAction;

      if (!noteId || (action !== 'comment' && action !== 'delete')) {
        return null;
      }

      return { action, noteId };
    };

    const handleNoteActionEvent = (event: Event, fallbackNoteId?: string) => {
      const noteAction = getNoteActionFromEvent(event, fallbackNoteId);

      if (!noteAction) {
        return false;
      }

      // Button note berada di HTML node milik X6; action diproses sebelum X6 mengubah selection/drag state.
      event.preventDefault();
      event.stopPropagation();

      if (noteAction.action === 'comment') {
        onCommentTargetOpenRef.current?.({ targetId: noteAction.noteId, targetType: 'note' });
        return true;
      }

      if (readOnly) {
        return true;
      }

      const note = modelRef.current.notes[noteAction.noteId];

      if (!note) {
        return true;
      }

      setConfirmAction({
        id: noteAction.noteId,
        name: note.text.slice(0, 48) || 'Untitled note',
        type: 'note',
      });

      return true;
    };

    graph.on('node:click', ({ e, node }) => {
      const data = node.getData<TableNodeData | NoteNodeData | GroupNodeData>();
      setRelationshipMenu(null);
      setTableContextMenu(null);
      setGroupContextMenu(null);

      if (isNoteNodeData(data) && handleNoteActionEvent(e as unknown as MouseEvent, data.noteId)) {
        return;
      }

      if (isGroupNodeData(data)) {
        return;
      }

      if (isTableNodeData(data)) {
        if ((e as unknown as MouseEvent).shiftKey) {
          toggleMultiTableSelection(data.tableId);
          return;
        }

        applySingleTableSelection(data.tableId);
        return;
      }

      if (isNoteNodeData(data)) {
        applySingleTableSelection(null);
      }
    });

    graph.on('blank:click', () => {
      if (Date.now() < suppressTableClickUntilRef.current) {
        return;
      }

      setRelationshipMenu(null);
      setTableContextMenu(null);
      setGroupContextMenu(null);
      applySingleTableSelection(null);
    });

    graph.on('edge:click', ({ edge, e }) => {
      const relationship = modelRef.current.relationships[edge.id];

      if (!relationship) {
        return;
      }

      const event = e as unknown as MouseEvent;

      setRelationshipMenu(createRelationshipMenuStateFromEvent(event, relationship.id));
      setTableContextMenu(null);
      setGroupContextMenu(null);
      applyMultiTableSelection([]);
    });

    graph.on('node:contextmenu', ({ e, node }) => {
      const data = node.getData<TableNodeData | NoteNodeData | GroupNodeData>();

      if (!isGroupNodeData(data) || !modelRef.current.groups[data.groupId]) {
        return;
      }

      openGroupContextMenu(e as unknown as MouseEvent, data.groupId);
    });

    graph.on('edge:connected', ({ edge, e, isNew }) => {
      if (!isNew || readOnly) {
        return;
      }

      const sourcePort = parseColumnPortId(edge.getSourcePortId() ?? undefined);
      const targetPort = parseColumnPortId(edge.getTargetPortId() ?? undefined);

      // Edge hasil drag X6 hanya menjadi relationship domain kalau dua endpoint benar-benar berasal dari port column.
      graph.removeCell(edge);

      if (!sourcePort || !targetPort || sourcePort.tableId === targetPort.tableId) {
        return;
      }

      const nextRelationshipCommand = createRelationshipCommandFromPorts(modelRef.current, sourcePort, targetPort);

      if (!nextRelationshipCommand) {
        return;
      }

      // The quick editor opens after the new relationship appears in React state, so the menu always points to a real edge.
      pendingRelationshipMenuRef.current = createRelationshipMenuStateFromEvent(
        e as unknown as MouseEvent,
        nextRelationshipCommand.relationshipId,
      );
      onModelChangeRef.current(applyDiagramCommand(modelRef.current, nextRelationshipCommand));
      applySingleTableSelection(nextRelationshipCommand.targetTableId);
      onColumnSelectRef.current?.(nextRelationshipCommand.targetColumnIds[0]);
      setTableContextMenu(null);
      setGroupContextMenu(null);
    });

    graph.on('edge:change:target', ({ edge }) => {
      if (readOnly || modelRef.current.relationships[edge.id]) {
        return;
      }

      // While the user is dragging a connector, X6 keeps updating the target point.
      // Rebuilding the temporary route here makes the live preview use the same orthogonal route language as saved edges.
      refreshDraftRelationshipPreview(
        edge as X6Edge,
        modelRef.current,
        selectedTableIdRef.current,
        selectedRelationshipIdRef.current,
      );
    });

    const handleCommentMarkerMouseDown = (event: MouseEvent) => {
      if (!getCommentMarkerFromEvent(event)) {
        return;
      }

      // Marker komentar adalah action di dalam HTML node; event ditahan di DOM agar X6 tidak memulai drag node.
      event.stopPropagation();
    };

    const handleCommentMarkerClick = (event: MouseEvent) => {
      const marker = getCommentMarkerFromEvent(event);

      if (!marker) {
        return;
      }

      const targetId = marker.dataset.commentTargetId;
      const targetType = marker.dataset.commentTargetType;

      if (!targetId || !isCanvasCommentTargetType(targetType)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onCommentTargetOpenRef.current?.({ targetId, targetType });
    };

    const handleColumnRowClick = (event: MouseEvent) => {
      const columnRow = getColumnRowFromEvent(event);
      const columnId = columnRow?.dataset.tabliodbColumnId;
      const tableId = columnRow?.closest<HTMLElement>('[data-tabliodb-table-id]')?.dataset.tabliodbTableId;

      if (!columnRow || !columnId || !tableId) {
        return;
      }

      if (event.shiftKey) {
        // Shift-click di row tetap dianggap memilih table, bukan memilih column, supaya gesture multi-select konsisten.
        event.preventDefault();
        event.stopPropagation();
        toggleMultiTableSelection(tableId);
        return;
      }

      // Klik row column di canvas memilih table sekaligus column supaya sidebar kiri langsung menunjuk field yang sama.
      event.preventDefault();
      setRelationshipMenu(null);
      setGroupContextMenu(null);
      applySingleTableSelection(tableId);
      onColumnSelectRef.current?.(columnId);
    };

    const handleTableNodeClick = (event: MouseEvent) => {
      const tableElement = getTableNodeFromEvent(event);
      const tableId = tableElement?.dataset.tabliodbTableId;

      if (!tableElement || !tableId) {
        return;
      }

      if (Date.now() < suppressTableClickUntilRef.current) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        toggleMultiTableSelection(tableId);
        return;
      }

      // Selection diproses di click, bukan mousedown, supaya React tidak me-render ulang HTML node tepat saat X6 memulai drag pertama.
      event.stopPropagation();
      setRelationshipMenu(null);
      setTableContextMenu(null);
      setGroupContextMenu(null);
      applySingleTableSelection(tableId);
    };

    const handleTableContextMenu = (event: MouseEvent) => {
      const tableElement = getTableNodeFromEvent(event);
      const tableId = tableElement?.dataset.tabliodbTableId;

      if (!tableElement || !tableId || !modelRef.current.tables[tableId]) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const containerRect = container.getBoundingClientRect();
      const menuWidth = 256;
      const menuHeight = 318;
      const safeMinLeft = Math.min(
        floatingInsetLeftRef.current + 12,
        Math.max(12, containerRect.width - menuWidth - 12),
      );
      const safeMaxLeft = Math.max(safeMinLeft, containerRect.width - floatingInsetRightRef.current - menuWidth - 12);

      // X6 HTML nodes are mounted outside React's synthetic event ownership, so right-click is captured with a native listener.
      setRelationshipMenu(null);
      setGroupContextMenu(null);
      setTableContextMenu({
        left: clamp(event.clientX - containerRect.left, safeMinLeft, safeMaxLeft),
        tableId,
        top: clamp(event.clientY - containerRect.top, 12, containerRect.height - menuHeight - 12),
      });

      if (!selectedTableIdsRef.current.includes(tableId)) {
        applySingleTableSelection(tableId);
      }
    };

    const handleGroupContextMenu = (event: MouseEvent) => {
      if (getTableNodeFromEvent(event) || getNoteNodeFromEvent(event)) {
        return;
      }

      const point = graph.clientToLocal(event.clientX, event.clientY);
      const group = getGroupAtLocalPoint(modelRef.current, point);

      if (!group) {
        return;
      }

      openGroupContextMenu(event, group.id);
    };

    const handleNoteInteractiveMouseDown = (event: MouseEvent) => {
      if (handleNoteActionEvent(event)) {
        return;
      }

      const target = getElementFromEventTarget(event.target);

      if (target?.closest('.tabliodb-note-node__textarea')) {
        // Text editing lives inside an X6 HTML node; stopping mousedown keeps the graph from starting a drag.
        event.stopPropagation();
      }
    };

    const handleNoteActionClick = (event: MouseEvent) => {
      handleNoteActionEvent(event);
    };

    const handleNoteFocusOut = (event: FocusEvent) => {
      const target = event.target;

      if (!(target instanceof HTMLTextAreaElement) || !target.classList.contains('tabliodb-note-node__textarea')) {
        return;
      }

      const noteId = target.closest<HTMLElement>('[data-tabliodb-note-id]')?.dataset.tabliodbNoteId;
      const note = noteId ? modelRef.current.notes[noteId] : null;

      if (!note || readOnly) {
        return;
      }

      const nextText = target.value.trim() || 'New note';

      if (nextText !== note.text) {
        onModelChangeRef.current(
          applyDiagramCommand(modelRef.current, {
            changes: {
              text: nextText,
            },
            noteId: note.id,
            type: 'note.update',
          }),
        );
      }
    };

    const handleNoteKeyDown = (event: KeyboardEvent) => {
      const target = event.target;

      if (!(target instanceof HTMLTextAreaElement) || !target.classList.contains('tabliodb-note-node__textarea')) {
        return;
      }

      event.stopPropagation();

      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        target.blur();
      }
    };

    const handleResizeMouseDown = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const handle = target.closest<HTMLElement>('.tabliodb-table-node__resize-zone');
      const tableElement = handle?.closest<HTMLElement>('[data-tabliodb-table-id]');
      const tableId = tableElement?.dataset.tabliodbTableId;
      const resizeSide = handle?.dataset.resizeSide === 'left' ? 'left' : 'right';

      if (!handle || !tableId || readOnly || !tableElement?.classList.contains('is-selected')) {
        return;
      }

      const table = modelRef.current.tables[tableId];
      const node = graph.getCellById(tableId) as X6Node | null | undefined;

      if (!table || !node?.isNode()) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onSelectedTableChangeRef.current(tableId);
      resizingTableIdRef.current = tableId;

      const startClientX = event.clientX;
      const startPosition = node.getPosition();
      const startWidth = getTableWidth(table);
      const graphScale = getGraphScale(graph);
      let latestWidth = startWidth;
      let latestPosition = startPosition;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();
        const pointerDelta = (moveEvent.clientX - startClientX) / graphScale;
        const snappedDelta = Math.round(pointerDelta / diagramDragGridSize) * diagramDragGridSize;
        const rawWidth = resizeSide === 'left' ? startWidth - snappedDelta : startWidth + snappedDelta;
        const snappedWidth = Math.round(rawWidth / diagramDragGridSize) * diagramDragGridSize;
        latestWidth = clampTableNodeWidth(snappedWidth);
        latestPosition =
          resizeSide === 'left'
            ? { x: startPosition.x + (startWidth - latestWidth), y: startPosition.y }
            : startPosition;

        // Resize kiri menggeser posisi x agar sisi kanan tetap terkunci, mirip editor diagram profesional.
        node.position(latestPosition.x, latestPosition.y);
        node.resize(latestWidth, node.getSize().height);
        refreshTableResizePreview(
          graph,
          modelRef.current,
          tableId,
          latestWidth,
          latestPosition,
          selectedTableIdRef.current,
          selectedRelationshipIdRef.current,
          readOnly,
        );
      };

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        resizingTableIdRef.current = null;

        if (latestWidth !== startWidth || latestPosition.x !== startPosition.x) {
          // Model tetap di-commit sekali pada drag-end, sementara X6 menerima preview live agar edge tidak tertinggal.
          let nextModel = modelRef.current;

          if (latestPosition.x !== startPosition.x || latestPosition.y !== startPosition.y) {
            nextModel = applyDiagramCommand(nextModel, {
              type: 'table.move',
              tableId,
              position: latestPosition,
            });
          }

          if (latestWidth !== startWidth) {
            const finalWidth = Math.round(latestWidth / diagramDragGridSize) * diagramDragGridSize;

            nextModel = applyDiagramCommand(nextModel, {
              type: 'table.resize',
              tableId,
              width: clampTableNodeWidth(finalWidth),
            });
          }

          onModelChangeRef.current(nextModel);
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    };

    container.addEventListener('mousedown', handleCommentMarkerMouseDown, true);
    container.addEventListener('click', handleCommentMarkerClick, true);
    container.addEventListener('click', handleColumnRowClick, true);
    container.addEventListener('click', handleTableNodeClick, true);
    container.addEventListener('contextmenu', handleTableContextMenu, true);
    container.addEventListener('contextmenu', handleGroupContextMenu, true);
    container.addEventListener('mousedown', handleNoteInteractiveMouseDown, true);
    container.addEventListener('click', handleNoteActionClick, true);
    container.addEventListener('focusout', handleNoteFocusOut, true);
    container.addEventListener('keydown', handleNoteKeyDown, true);
    container.addEventListener('mousedown', handleTableSelectionBoxMouseDown, true);
    container.addEventListener('mousedown', handleResizeMouseDown, true);

    const publishLocalCursor = (cursor: AwarenessState['cursor'] | undefined, immediate = false) => {
      pendingLocalCursorRef.current = cursor;

      if (immediate) {
        if (localCursorFrameRef.current) {
          window.cancelAnimationFrame(localCursorFrameRef.current);
          localCursorFrameRef.current = 0;
        }

        if (!areAwarenessCursorsEqual(lastPublishedLocalCursorRef.current, cursor)) {
          lastPublishedLocalCursorRef.current = cursor;
          onLocalCursorChangeRef.current?.(cursor);
        }

        return;
      }

      if (localCursorFrameRef.current) {
        return;
      }

      localCursorFrameRef.current = window.requestAnimationFrame(() => {
        localCursorFrameRef.current = 0;
        const nextCursor = pendingLocalCursorRef.current;

        if (!areAwarenessCursorsEqual(lastPublishedLocalCursorRef.current, nextCursor)) {
          // Pointermove bisa datang ratusan kali per detik; publish awareness cukup sekali per frame agar Yjs tidak kebanjiran update.
          lastPublishedLocalCursorRef.current = nextCursor;
          onLocalCursorChangeRef.current?.(nextCursor);
        }
      });
    };

    const handleCursorPointerMove = (event: PointerEvent) => {
      const point = graph.clientToLocal(event.clientX, event.clientY);

      // Awareness cursor disimpan dalam coordinate system local X6 supaya posisi remote user tetap akurat saat canvas di-pan atau di-zoom.
      publishLocalCursor({
        x: Math.round(point.x),
        y: Math.round(point.y),
      });
    };

    const handleCursorPointerLeave = () => {
      // Menghapus cursor ketika pointer keluar canvas mencegah user lain melihat pointer stale di diagram.
      publishLocalCursor(undefined, true);
    };

    container.addEventListener('pointerleave', handleCursorPointerLeave);
    container.addEventListener('pointermove', handleCursorPointerMove);

    const handleCanvasWheel = (event: WheelEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('.tabliodb-note-node__textarea')) {
        return;
      }

      // Wheel di canvas mengikuti DrawSQL: zoom at pointer, bukan pan vertikal yang membuat user merasa halaman sedang scroll.
      event.preventDefault();
    };

    container.addEventListener('wheel', handleCanvasWheel, { passive: false });

    graph.on('node:moving', ({ node }) => {
      if (readOnly) {
        return;
      }

      const data = node.getData<TableNodeData | NoteNodeData>();

      if (!isTableNodeData(data) || resizingTableIdRef.current === data.tableId) {
        return;
      }

      const activeMultiSelection = selectedTableIdsRef.current.filter((tableId) => modelRef.current.tables[tableId]);

      if (activeMultiSelection.length > 1 && activeMultiSelection.includes(data.tableId)) {
        if (multiTableMoveDragRef.current && multiTableMoveDragRef.current.activeTableId !== data.tableId) {
          // Node pendamping ikut diposisikan lewat programmatic move; hanya node yang dipegang pointer user yang boleh menghitung delta.
          return;
        }

        const dragState =
          multiTableMoveDragRef.current?.activeTableId === data.tableId
            ? multiTableMoveDragRef.current
            : createMultiTableMoveDragState(modelRef.current, activeMultiSelection, data.tableId);

        if (!dragState) {
          return;
        }

        multiTableMoveDragRef.current = dragState;

        const draggedPosition = node.getPosition();
        const activeStartPosition = dragState.startPositions[data.tableId];
        const delta = {
          x: draggedPosition.x - activeStartPosition.x,
          y: draggedPosition.y - activeStartPosition.y,
        };
        const latestPositions: Record<string, DatabaseTable['position']> = {};

        graph.batchUpdate('tabliodb-multi-table-move', () => {
          for (const tableId of dragState.tableIds) {
            const startPosition = dragState.startPositions[tableId];
            const nextPosition = {
              x: startPosition.x + delta.x,
              y: startPosition.y + delta.y,
            };

            latestPositions[tableId] = nextPosition;

            if (tableId === data.tableId) {
              continue;
            }

            const selectedNode = graph.getCellById(tableId) as X6Node | null | undefined;

            if (selectedNode?.isNode()) {
              // Node pendamping mengikuti node yang sedang diseret secara live; commit model tetap dilakukan sekali di node:moved.
              selectedNode.position(nextPosition.x, nextPosition.y);
            }
          }

          refreshTablesMovePreview(
            graph,
            modelRef.current,
            latestPositions,
            selectedTableIdRef.current,
            selectedRelationshipIdRef.current,
          );
        });

        dragState.latestPositions = latestPositions;
        return;
      }

      refreshTableMovePreview(
        graph,
        modelRef.current,
        data.tableId,
        node.getPosition(),
        selectedTableIdRef.current,
        selectedRelationshipIdRef.current,
      );
    });

    graph.on('node:moved', ({ node }) => {
      if (readOnly) {
        return;
      }

      const data = node.getData<TableNodeData | NoteNodeData>();
      const position = node.getPosition();

      if (isTableNodeData(data)) {
        if (multiTableMoveDragRef.current && multiTableMoveDragRef.current.activeTableId !== data.tableId) {
          // Programmatic move untuk anggota selection tidak boleh berubah menjadi commit single-table.
          return;
        }

        if (resizingTableIdRef.current === data.tableId) {
          // Saat resize dari sisi kiri, node.position() dipanggil secara programmatic; commit model tetap dilakukan sekali di mouseup.
          return;
        }

        const table = modelRef.current.tables[data.tableId];

        if (!table) {
          return;
        }

        const multiDragState = multiTableMoveDragRef.current;

        if (multiDragState?.activeTableId === data.tableId && multiDragState.tableIds.length > 1) {
          let nextModel = modelRef.current;
          const nextSelectedTableIds: string[] = [];

          for (const tableId of multiDragState.tableIds) {
            const nextPosition = multiDragState.latestPositions[tableId];
            const currentTable = nextModel.tables[tableId];

            if (!currentTable || !nextPosition) {
              continue;
            }

            nextSelectedTableIds.push(tableId);

            if (currentTable.position.x === nextPosition.x && currentTable.position.y === nextPosition.y) {
              continue;
            }

            nextModel = applyDiagramCommand(nextModel, {
              position: nextPosition,
              tableId,
              type: 'table.move',
            });
          }

          multiTableMoveDragRef.current = null;
          suppressTableClickUntilRef.current = Date.now() + 160;
          onModelChangeRef.current(nextModel);
          onSelectedTableChangeRef.current(null);
          onSelectedTableIdsChangeRef.current?.(nextSelectedTableIds);
          return;
        }

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
        // Drag table yang belum selected tetap berakhir dengan table tersebut aktif, tanpa memutus gesture drag pertamanya.
        applySingleTableSelection(table.id);
        return;
      }

      if (isNoteNodeData(data) && modelRef.current.notes[data.noteId]) {
        onModelChangeRef.current(
          applyDiagramCommand(modelRef.current, {
            noteId: data.noteId,
            position: {
              x: position.x,
              y: position.y,
            },
            type: 'note.move',
          }),
        );
      }
    });

    graphRef.current = graph;

    let isSpacePressed = false;
    let isCustomPanning = false;
    let panAnchor = { x: 0, y: 0 };
    let panTranslate = { x: 0, y: 0 };

    // Reset cursor saat mount agar tidak tertinggal 'grab' dari sesi sebelumnya
    container.style.cursor = '';

    const handleSpaceKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isEditableShortcutTarget(e.target)) {
        container.classList.add('is-space-pressed');
        isSpacePressed = true;
        container.style.cursor = 'grab';
        e.preventDefault(); // cegah halaman scroll ke bawah
      }
    };

    const handleSpaceKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        container.classList.remove('is-space-pressed');
        isSpacePressed = false;
        if (!isCustomPanning) {
          container.style.cursor = '';
        }
      }
    };

    const handlePanMouseDown = (e: MouseEvent) => {
      // button 1 = middle mouse (scroll wheel press)
      // button 0 + space = left click while holding space
      if (e.button === 1 || (isSpacePressed && e.button === 0)) {
        isCustomPanning = true;
        panAnchor = { x: e.clientX, y: e.clientY };
        const t = graph.translate();
        panTranslate = { x: t.tx, y: t.ty };
        container.style.cursor = 'grabbing';
        e.preventDefault();
        e.stopPropagation(); // jangan trigger node selection/move
      }
    };

    const handlePanMouseMove = (e: MouseEvent) => {
      if (!isCustomPanning) return;
      const dx = e.clientX - panAnchor.x;
      const dy = e.clientY - panAnchor.y;
      graph.translate(panTranslate.x + dx, panTranslate.y + dy);
    };

    const handlePanMouseUp = () => {
      if (isCustomPanning) {
        isCustomPanning = false;
        container.style.cursor = isSpacePressed ? 'grab' : '';
      }
    };

    // Cegah browser default behavior untuk middle-mouse (scroll mode di Firefox, dsb)
    const suppressMiddleMouseDefault = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleSpaceKeyDown);
    window.addEventListener('keyup', handleSpaceKeyUp);
    container.addEventListener('mousedown', handlePanMouseDown, true);
    window.addEventListener('mousemove', handlePanMouseMove);
    window.addEventListener('mouseup', handlePanMouseUp);
    window.addEventListener('mousedown', suppressMiddleMouseDefault, true);

    return () => {
      container.removeEventListener('mousedown', handleCommentMarkerMouseDown, true);
      container.removeEventListener('click', handleCommentMarkerClick, true);
      container.removeEventListener('click', handleColumnRowClick, true);
      container.removeEventListener('click', handleTableNodeClick, true);
      container.removeEventListener('contextmenu', handleTableContextMenu, true);
      container.removeEventListener('contextmenu', handleGroupContextMenu, true);
      container.removeEventListener('mousedown', handleNoteInteractiveMouseDown, true);
      container.removeEventListener('click', handleNoteActionClick, true);
      container.removeEventListener('focusout', handleNoteFocusOut, true);
      container.removeEventListener('keydown', handleNoteKeyDown, true);
      container.removeEventListener('mousedown', handleTableSelectionBoxMouseDown, true);
      container.removeEventListener('mousedown', handleResizeMouseDown, true);
      container.removeEventListener('pointerleave', handleCursorPointerLeave);
      container.removeEventListener('pointermove', handleCursorPointerMove);
      container.removeEventListener('wheel', handleCanvasWheel);
      if (localCursorFrameRef.current) {
        window.cancelAnimationFrame(localCursorFrameRef.current);
        localCursorFrameRef.current = 0;
      }
      graph.dispose();
      graphRef.current = null;

      // === cleanup custom panning ===
      window.removeEventListener('keydown', handleSpaceKeyDown);
      window.removeEventListener('keyup', handleSpaceKeyUp);
      container.removeEventListener('mousedown', handlePanMouseDown, true);
      window.removeEventListener('mousemove', handlePanMouseMove);
      window.removeEventListener('mouseup', handlePanMouseUp);
      window.removeEventListener('mousedown', suppressMiddleMouseDefault, true);
    };
  }, [readOnly]);

  useEffect(() => {
    const graph = graphRef.current;

    if (!graph) {
      return;
    }

    syncGraphFromModel(
      graph,
      model,
      selectedTableId,
      selectedTableIds,
      selectedColumnId,
      relationshipMenu?.relationshipId ?? null,
      commentTargetSummaries,
      readOnly,
    );

    if (fitKeyRef.current !== fitKey) {
      fitKeyRef.current = fitKey;
      fitGraphContent(graph);
    }
  }, [
    commentTargetSummaries,
    fitKey,
    model,
    readOnly,
    relationshipMenu?.relationshipId,
    selectedColumnId,
    selectedTableId,
    selectedTableIds,
  ]);

  useEffect(() => {
    const graph = graphRef.current;

    if (graph && fitSignal > 0) {
      fitGraphContent(graph);
    }
  }, [fitSignal]);

  useEffect(() => {
    const graph = graphRef.current;
    const container = containerRef.current;

    if (!graph || !container) {
      return;
    }

    let animationFrameId = 0;
    let disposed = false;
    let lastViewport: CanvasViewportRect | null = null;

    const syncViewport = () => {
      if (disposed) {
        return;
      }

      const nextViewport = roundCanvasRect(
        getSafeCanvasViewportRect(graph, container, {
          left: floatingInsetLeftRef.current,
          right: floatingInsetRightRef.current,
        }),
      );

      if (!lastViewport || !areCanvasRectsEqual(lastViewport, nextViewport)) {
        lastViewport = nextViewport;
        // Parent editor stores this in a ref, so reporting viewport changes does not cause canvas re-renders.
        onViewportChangeRef.current?.(nextViewport);
      }

      animationFrameId = window.requestAnimationFrame(syncViewport);
    };

    syncViewport();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    if (minimapToggleSignal > 0) {
      // Parent editor hanya mengirim sinyal; canvas tetap memiliki state minimap lokal agar tombol Map di dalam canvas bekerja mandiri.
      setMinimapOpen((open) => !open);
    }
  }, [minimapToggleSignal]);

  useEffect(() => {
    const graph = graphRef.current;
    const container = containerRef.current;

    if (!graph || !container || remoteCursors.length === 0) {
      setRemoteCursorPositions([]);
      return;
    }

    let animationFrameId = 0;
    let disposed = false;

    const syncRemoteCursorPositions = () => {
      if (disposed) {
        return;
      }

      const nextPositions = createRemoteCursorPositions(graph, container, remoteCursorsRef.current);
      setRemoteCursorPositions((currentPositions) =>
        areRemoteCursorPositionsEqual(currentPositions, nextPositions) ? currentPositions : nextPositions,
      );

      // X6 pan/zoom updates can happen outside React renders, so the lightweight RAF sync keeps cursor overlays glued to the live graph matrix.
      animationFrameId = window.requestAnimationFrame(syncRemoteCursorPositions);
    };

    syncRemoteCursorPositions();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [remoteCursors.length]);

  useEffect(() => {
    const graph = graphRef.current;
    const container = containerRef.current;

    if (!graph || !container || !minimapOpen) {
      setMinimapState(null);
      return;
    }

    let animationFrameId = 0;
    let disposed = false;

    const syncMinimapState = () => {
      if (disposed) {
        return;
      }

      const staticState = minimapStaticStateRef.current;
      const nextState = staticState ? createCanvasMinimapState(graph, container, staticState) : null;
      setMinimapState((currentState) =>
        areCanvasMinimapStatesEqual(currentState, nextState) ? currentState : nextState,
      );
      // Saat terbuka, minimap mengikuti transform X6 live; static item diagram tetap di-cache agar pan/zoom tidak scan semua table.
      animationFrameId = window.requestAnimationFrame(syncMinimapState);
    };

    syncMinimapState();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [minimapOpen, model, selectedTableId]);

  function handleMinimapCenter(x: number, y: number) {
    graphRef.current?.centerPoint(x, y);
  }

  const activeRelationship = relationshipMenu ? (model.relationships[relationshipMenu.relationshipId] ?? null) : null;
  const activeContextTable = tableContextMenu ? (model.tables[tableContextMenu.tableId] ?? null) : null;
  const activeContextTableColumns = activeContextTable ? getTableColumns(model, activeContextTable.id) : [];
  const activeContextGroup = groupContextMenu ? (model.groups[groupContextMenu.groupId] ?? null) : null;
  const canShowMinimap = Object.keys(model.tables).length > 0;

  function closeTableContextMenu() {
    setTableContextMenu(null);
  }

  function closeGroupContextMenu() {
    setGroupContextMenu(null);
  }

  function handleGroupNameCommit(group: DiagramGroup, value: string) {
    if (readOnly) {
      return;
    }

    const name = value.trim();

    if (!name || name === group.name) {
      return;
    }

    onModelChangeRef.current(
      applyDiagramCommand(modelRef.current, {
        changes: { name },
        groupId: group.id,
        type: 'group.update',
      }),
    );
  }

  function handleGroupColorChange(group: DiagramGroup, color: string) {
    if (readOnly || color === getDisplayTableColor(group.color)) {
      return;
    }

    onModelChangeRef.current(
      applyDiagramCommand(modelRef.current, {
        changes: { color },
        groupId: group.id,
        type: 'group.update',
      }),
    );
  }

  function handleTableDiscuss(table: DatabaseTable) {
    closeTableContextMenu();
    onCommentTargetOpenRef.current?.({ targetId: table.id, targetType: 'table' });
  }

  function handleTableDocsOpen(table: DatabaseTable) {
    closeTableContextMenu();
    onTableDocsOpenRef.current?.(table.id);
  }

  function handleCopyTable(table: DatabaseTable) {
    closeTableContextMenu();

    void copyTableToClipboard(modelRef.current, table)
      .then(() => {
        toast.success({
          description: `"${table.name}" is now available as a Tabliodb table payload.`,
          title: 'Table copied',
        });
      })
      .catch(() => {
        toast.warning({
          description: 'Your browser blocked clipboard access, so the table could not be copied.',
          title: 'Copy failed',
        });
      });
  }

  function handleDuplicateTable(table: DatabaseTable) {
    if (readOnly) {
      closeTableContextMenu();
      return;
    }

    const result = duplicateTableInModel(modelRef.current, table.id);

    closeTableContextMenu();

    if (!result) {
      return;
    }

    onModelChangeRef.current(result.model);
    onSelectedTableChangeRef.current(result.tableId);
  }

  function handleAddContextColumn(table: DatabaseTable) {
    if (readOnly) {
      closeTableContextMenu();
      return;
    }

    const currentModel = modelRef.current;
    const columns = getTableColumns(currentModel, table.id);
    const columnId = createDiagramEntityId('column');
    const nextModel = applyDiagramCommand(currentModel, {
      columnId,
      columnType: { family: 'varchar', length: 160 },
      name: createUniqueColumnName(columns, 'new_column'),
      nullable: false,
      tableId: table.id,
      type: 'column.create',
    });

    closeTableContextMenu();
    onModelChangeRef.current(nextModel);
    onSelectedTableChangeRef.current(table.id);
    onColumnSelectRef.current?.(columnId);
  }

  function handleAddContextIndex(table: DatabaseTable) {
    if (readOnly) {
      closeTableContextMenu();
      return;
    }

    const currentModel = modelRef.current;
    const columns = getTableColumns(currentModel, table.id);
    const firstColumn = columns[0];

    closeTableContextMenu();

    if (!firstColumn) {
      toast.warning({
        description: 'Add a column first, then Tabliodb can create an index for this table.',
        title: 'No column to index',
      });
      return;
    }

    onModelChangeRef.current(
      applyDiagramCommand(currentModel, {
        columns: [{ columnId: firstColumn.id }],
        name: createUniqueIndexName(currentModel, table, firstColumn.name),
        tableId: table.id,
        type: 'index.create',
      }),
    );
    onSelectedTableChangeRef.current(table.id);
  }

  function handleDeleteContextTable(table: DatabaseTable) {
    closeTableContextMenu();

    if (readOnly) {
      return;
    }

    setConfirmAction({
      id: table.id,
      name: table.name,
      type: 'table',
    });
  }

  function handleRelationshipCardinalityChange(intent: RelationshipQuickCardinalityIntent) {
    if (!activeRelationship || readOnly) {
      return;
    }

    if (intent === 'one_to_one') {
      if (activeRelationship.cardinality === 'one_to_one') {
        return;
      }

      onModelChange(
        applyDiagramCommand(model, {
          changes: { cardinality: 'one_to_one' },
          relationshipId: activeRelationship.id,
          type: 'relationship.update',
        }),
      );
      return;
    }

    const sourceIsVisuallyFirst = isRelationshipSourceVisuallyFirst(model, activeRelationship);
    const sourceShouldBeVisuallyFirst = intent === 'one_to_many';
    const shouldReverseEndpoints = sourceIsVisuallyFirst !== sourceShouldBeVisuallyFirst;

    if (activeRelationship.cardinality === 'one_to_many' && !shouldReverseEndpoints) {
      return;
    }

    // 1:N and N:1 are UI intents relative to the visible left-to-right order.
    // The stored model remains normalized: source is the referenced side, target is the FK side.
    const changes: Partial<Omit<DatabaseRelationship, 'id'>> = shouldReverseEndpoints
      ? {
          cardinality: 'one_to_many',
          sourceColumnIds: activeRelationship.targetColumnIds,
          sourceTableId: activeRelationship.targetTableId,
          targetColumnIds: activeRelationship.sourceColumnIds,
          targetTableId: activeRelationship.sourceTableId,
        }
      : { cardinality: 'one_to_many' };

    onModelChange(
      applyDiagramCommand(model, {
        changes,
        relationshipId: activeRelationship.id,
        type: 'relationship.update',
      }),
    );
  }

  function handleRelationshipDelete() {
    if (!activeRelationship || readOnly) {
      return;
    }

    setConfirmAction({
      id: activeRelationship.id,
      name: getRelationshipEndpointLabel(model, activeRelationship, 'target'),
      type: 'relationship',
    });
  }

  function handleConfirmActionClose(open: boolean) {
    if (!open) {
      setConfirmAction(null);
    }
  }

  function handleConfirmAction() {
    if (!confirmAction || readOnly) {
      return;
    }

    const currentModel = modelRef.current;

    if (confirmAction.type === 'table' && currentModel.tables[confirmAction.id]) {
      onModelChangeRef.current(applyDiagramCommand(currentModel, { tableId: confirmAction.id, type: 'table.delete' }));
      onSelectedTableChangeRef.current(null);
      setConfirmAction(null);
      return;
    }

    if (confirmAction.type === 'note' && currentModel.notes[confirmAction.id]) {
      // Note deletion mutates the canonical model, so snapshot/save/history paths observe the same operation.
      onModelChangeRef.current(applyDiagramCommand(currentModel, { noteId: confirmAction.id, type: 'note.delete' }));
      setConfirmAction(null);
      return;
    }

    if (confirmAction.type === 'relationship' && currentModel.relationships[confirmAction.id]) {
      onModelChangeRef.current(
        applyDiagramCommand(currentModel, {
          relationshipId: confirmAction.id,
          type: 'relationship.delete',
        }),
      );
      setRelationshipMenu(null);
      setConfirmAction(null);
    }
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-[rgb(var(--tabliodb-canvas))]">
      <div className="tabliodb-x6-canvas absolute inset-0" ref={containerRef} />
      {selectionBox ? (
        <div
          className="pointer-events-none absolute z-20 rounded-[14px] border-2 border-dashed border-[#ff4fb3] bg-[#fff1f8]/70 shadow-[0_0_0_1px_rgba(255,79,179,0.18)_inset]"
          style={{
            height: selectionBox.height,
            left: selectionBox.left,
            top: selectionBox.top,
            width: selectionBox.width,
          }}
        >
          {selectionBox.count > 0 ? (
            <span className="absolute -top-7 left-0 rounded-full border border-[#ff9ad0] bg-white px-2.5 py-1 text-[11px] font-extrabold text-[#d61b82] shadow-[0_2px_0_rgba(255,154,208,0.45)]">
              {selectionBox.count} selected
            </span>
          ) : null}
        </div>
      ) : null}
      {toolbar ? (
        <div className="absolute top-4 z-20 transition-[left] duration-200" style={{ left: toolbarOffsetLeft }}>
          {toolbar}
        </div>
      ) : null}
      {minimapOpen && minimapState ? (
        <CanvasMinimap
          offsetRight={minimapOffsetRight}
          onCenter={handleMinimapCenter}
          onClose={() => setMinimapOpen(false)}
          state={minimapState}
        />
      ) : !minimapOpen && canShowMinimap ? (
        <button
          aria-label="Show minimap"
          className="tabliodb-editor-chrome absolute bottom-4 z-20 h-9 cursor-pointer rounded-(--tabliodb-radius-md) px-3 text-xs font-extrabold text-[rgb(var(--tabliodb-ink))] transition-[right,background,box-shadow,transform] duration-200 hover:bg-[rgb(var(--tabliodb-surface-raised))] active:translate-y-0.5 active:shadow-[0_1px_0_rgb(var(--tabliodb-border-strong))]"
          onClick={() => setMinimapOpen(true)}
          style={{ right: minimapOffsetRight }}
          type="button"
        >
          Map
        </button>
      ) : null}
      {relationshipMenu && activeRelationship ? (
        <RelationshipQuickEditor
          left={relationshipMenu.left}
          model={model}
          onCardinalityChange={handleRelationshipCardinalityChange}
          onClose={() => setRelationshipMenu(null)}
          onDelete={handleRelationshipDelete}
          readOnly={readOnly}
          relationship={activeRelationship}
          top={relationshipMenu.top}
        />
      ) : null}
      {activeContextTable && tableContextMenu ? (
        <TableNodeContextMenu
          canEdit={!readOnly}
          canOpenDocs={Boolean(onTableDocsOpen)}
          columnCount={activeContextTableColumns.length}
          left={tableContextMenu.left}
          onAddColumn={() => handleAddContextColumn(activeContextTable)}
          onAddIndex={() => handleAddContextIndex(activeContextTable)}
          onCopy={() => handleCopyTable(activeContextTable)}
          onCut={() => undefined}
          onDelete={() => handleDeleteContextTable(activeContextTable)}
          onDiscuss={() => handleTableDiscuss(activeContextTable)}
          onDuplicate={() => handleDuplicateTable(activeContextTable)}
          onViewDocs={() => handleTableDocsOpen(activeContextTable)}
          table={activeContextTable}
          top={tableContextMenu.top}
        />
      ) : null}
      {activeContextGroup && groupContextMenu ? (
        <GroupNodeContextMenu
          group={activeContextGroup}
          left={groupContextMenu.left}
          onClose={closeGroupContextMenu}
          onColorChange={(color) => handleGroupColorChange(activeContextGroup, color)}
          onRename={(name) => handleGroupNameCommit(activeContextGroup, name)}
          readOnly={readOnly}
          top={groupContextMenu.top}
        />
      ) : null}
      <CanvasConfirmDialog
        action={confirmAction}
        onConfirm={handleConfirmAction}
        onOpenChange={handleConfirmActionClose}
      />
      {remoteCursorPositions.length > 0 ? (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          {remoteCursorPositions.map((cursor) => (
            <div
              className="absolute left-0 top-0 flex max-w-45 items-start gap-1.5"
              key={`${cursor.user.id}:${cursor.clientIds.join('-')}`}
              style={{ transform: `translate3d(${cursor.left}px, ${cursor.top}px, 0)` }}
            >
              <svg
                aria-hidden="true"
                className="size-5 shrink-0 drop-shadow-[0_2px_0_rgba(15,23,42,0.18)]"
                style={{ color: cursor.user.cursorColor }}
                viewBox="0 0 24 24"
              >
                <path
                  d="M4 3.5 19.5 11 12.7 13.2 10.4 20.2 4 3.5Z"
                  fill="currentColor"
                  stroke="white"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                />
              </svg>
              <span
                className="mt-4 max-w-35 truncate rounded-full border-2 border-white px-2.5 py-1 text-[11px] font-extrabold leading-none text-white shadow-[0_2px_0_rgba(15,23,42,0.18)]"
                style={{ backgroundColor: cursor.user.cursorColor }}
              >
                {cursor.user.name}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CanvasMinimap({
  offsetRight,
  onCenter,
  onClose,
  state,
}: {
  offsetRight: string;
  onCenter: (x: number, y: number) => void;
  onClose: () => void;
  state: CanvasMinimapState;
}) {
  function centerFromPointer(event: ReactPointerEvent<SVGSVGElement>) {
    const svgRect = event.currentTarget.getBoundingClientRect();
    const localX = state.viewBox.x + ((event.clientX - svgRect.left) / svgRect.width) * state.viewBox.width;
    const localY = state.viewBox.y + ((event.clientY - svgRect.top) / svgRect.height) * state.viewBox.height;

    onCenter(localX, localY);
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    centerFromPointer(event);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.buttons !== 1) {
      return;
    }

    centerFromPointer(event);
  }

  function handleKeyDown(event: ReactKeyboardEvent<SVGSVGElement>) {
    const centerX = state.viewport.x + state.viewport.width / 2;
    const centerY = state.viewport.y + state.viewport.height / 2;
    const stepX = Math.max(state.viewport.width * 0.35, 80);
    const stepY = Math.max(state.viewport.height * 0.35, 80);
    let nextX = centerX;
    let nextY = centerY;

    if (event.key === 'ArrowLeft') {
      nextX -= stepX;
    } else if (event.key === 'ArrowRight') {
      nextX += stepX;
    } else if (event.key === 'ArrowUp') {
      nextY -= stepY;
    } else if (event.key === 'ArrowDown') {
      nextY += stepY;
    } else if (event.key === 'Enter' || event.key === ' ') {
      // Enter/Space tetap dikonsumsi agar minimap terasa seperti control keyboard yang stabil, bukan SVG pasif yang menggulir halaman.
    } else {
      return;
    }

    event.preventDefault();

    const halfWidth = state.viewport.width / 2;
    const halfHeight = state.viewport.height / 2;
    const minX = Math.min(state.viewBox.x + halfWidth, state.viewBox.x + state.viewBox.width - halfWidth);
    const maxX = Math.max(state.viewBox.x + halfWidth, state.viewBox.x + state.viewBox.width - halfWidth);
    const minY = Math.min(state.viewBox.y + halfHeight, state.viewBox.y + state.viewBox.height - halfHeight);
    const maxY = Math.max(state.viewBox.y + halfHeight, state.viewBox.y + state.viewBox.height - halfHeight);

    // Clamp menjaga keyboard panning tidak membawa viewport keluar dari bounding box diagram yang dihitung minimap.
    onCenter(clamp(nextX, minX, maxX), clamp(nextY, minY, maxY));
  }

  return (
    <section
      className="tabliodb-editor-chrome absolute bottom-4 z-20 w-[clamp(144px,16vw,192px)] rounded-(--tabliodb-radius-lg) p-2 transition-[right] duration-200"
      style={{ right: offsetRight }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Minimap
        </span>
        <button
          aria-label="Hide minimap"
          className="grid size-5 cursor-pointer place-items-center rounded-full text-[13px] font-extrabold leading-none text-[rgb(var(--tabliodb-ink-muted))] transition hover:bg-[rgb(var(--tabliodb-surface))] hover:text-[rgb(var(--tabliodb-ink))]"
          onClick={onClose}
          type="button"
        >
          x
        </button>
      </div>
      <svg
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
        aria-label="Diagram minimap. Drag or use arrow keys to move the viewport."
        className="block aspect-192/124 w-full cursor-crosshair rounded-[10px] border border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-canvas))] outline-none focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--tabliodb-focus-ring))]"
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        preserveAspectRatio="none"
        role="button"
        tabIndex={0}
        viewBox={`${state.viewBox.x} ${state.viewBox.y} ${state.viewBox.width} ${state.viewBox.height}`}
      >
        <rect
          fill="rgb(var(--tabliodb-sky-soft))"
          height={state.viewBox.height}
          opacity="0.45"
          width={state.viewBox.width}
          x={state.viewBox.x}
          y={state.viewBox.y}
        />
        {state.groups.map((group) => (
          <rect
            fill={group.color}
            fillOpacity="0.08"
            height={group.height}
            key={group.id}
            rx="16"
            stroke={group.color}
            strokeDasharray="14 10"
            strokeOpacity="0.45"
            strokeWidth="5"
            width={group.width}
            x={group.x}
            y={group.y}
          >
            <title>{group.name}</title>
          </rect>
        ))}
        {state.tables.map((table) => (
          <rect
            fill={table.color}
            fillOpacity={table.selected ? 0.32 : 0.16}
            height={table.height}
            key={table.id}
            rx="12"
            stroke={table.selected ? 'rgb(var(--tabliodb-primary))' : table.color}
            strokeWidth={table.selected ? 8 : 4}
            width={table.width}
            x={table.x}
            y={table.y}
          >
            <title>{table.name}</title>
          </rect>
        ))}
        {state.notes.map((note) => (
          <rect
            fill={note.color}
            fillOpacity="0.24"
            height={note.height}
            key={note.id}
            rx="12"
            stroke={note.color}
            strokeWidth="4"
            width={note.width}
            x={note.x}
            y={note.y}
          >
            <title>{note.name}</title>
          </rect>
        ))}
        <rect
          fill="rgb(var(--tabliodb-primary-soft))"
          fillOpacity="0.18"
          height={state.viewport.height}
          pointerEvents="none"
          rx="10"
          stroke="rgb(var(--tabliodb-primary))"
          strokeDasharray="18 10"
          strokeWidth="6"
          width={state.viewport.width}
          x={state.viewport.x}
          y={state.viewport.y}
        />
      </svg>
    </section>
  );
}

function RelationshipQuickEditor({
  left,
  model,
  onCardinalityChange,
  onClose,
  onDelete,
  readOnly,
  relationship,
  top,
}: {
  left: number;
  model: DiagramModel;
  onCardinalityChange: (intent: RelationshipQuickCardinalityIntent) => void;
  onClose: () => void;
  onDelete: () => void;
  readOnly: boolean;
  relationship: DatabaseRelationship;
  top: number;
}) {
  const sourceEndpoint = getRelationshipQuickEndpoint(model, relationship, 'source');
  const targetEndpoint = getRelationshipQuickEndpoint(model, relationship, 'target');
  const sourceIsVisuallyFirst = isRelationshipSourceVisuallyFirst(model, relationship);
  const leftEndpoint = sourceIsVisuallyFirst ? sourceEndpoint : targetEndpoint;
  const rightEndpoint = sourceIsVisuallyFirst ? targetEndpoint : sourceEndpoint;
  const activeIntent = getRelationshipQuickCardinalityIntent(model, relationship);
  const cardinalityOptions: RelationshipQuickCardinalityOption[] = [
    { intent: 'one_to_one', label: '1:1' },
    { intent: 'one_to_many', label: '1:N' },
    { intent: 'many_to_one', label: 'N:1' },
  ];

  return (
    <section
      aria-label="Relationship actions"
      className="absolute z-40 w-[360px] rounded-[20px] border border-[rgb(var(--tabliodb-border-strong))] bg-white p-3 text-[rgb(var(--tabliodb-ink))] shadow-[0_3px_0_rgb(var(--tabliodb-border-strong)),0_18px_42px_rgb(15_23_42/0.14)]"
      onMouseDown={(event) => event.stopPropagation()}
      role="group"
      style={{ left, top }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)_28px] items-center gap-2">
        <RelationshipEndpointPill color={leftEndpoint.color} label={leftEndpoint.label} />
        <ArrowRight className="mx-auto size-4 text-[rgb(var(--tabliodb-ink-subtle))]" />
        <RelationshipEndpointPill color={rightEndpoint.color} label={rightEndpoint.label} />
        <button
          aria-label="Close relationship actions"
          className="grid size-7 cursor-pointer place-items-center rounded-full text-[rgb(var(--tabliodb-ink-muted))] outline-none transition hover:bg-[rgb(var(--tabliodb-surface))] hover:text-[rgb(var(--tabliodb-ink))] focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--tabliodb-focus-ring))]"
          onClick={onClose}
          type="button"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="inline-flex rounded-[14px] border border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface))] p-1">
          {cardinalityOptions.map((option) => (
            <button
              aria-pressed={activeIntent === option.intent}
              className={cn(
                'h-8 min-w-12 cursor-pointer rounded-[10px] px-3 text-xs font-black outline-none transition-[background,border-color,box-shadow,color,transform] focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--tabliodb-focus-ring))] disabled:cursor-not-allowed disabled:opacity-50',
                activeIntent === option.intent
                  ? 'bg-[rgb(var(--tabliodb-primary))] text-white shadow-[0_2px_0_rgb(var(--tabliodb-primary-shadow))]'
                  : 'text-[rgb(var(--tabliodb-ink-muted))] hover:bg-[rgb(var(--tabliodb-primary-soft))] hover:text-[rgb(var(--tabliodb-primary-text))]',
              )}
              disabled={readOnly}
              key={option.label}
              onClick={() => onCardinalityChange(option.intent)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[10px] border border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] px-3 text-xs font-black text-[rgb(var(--tabliodb-danger-text))] outline-none transition hover:bg-white focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--tabliodb-danger-border))] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={readOnly}
          onClick={onDelete}
          type="button"
        >
          <Trash2 className="size-3.5" />
          Delete
        </button>
      </div>
    </section>
  );
}

type RelationshipQuickCardinalityIntent = 'one_to_one' | 'one_to_many' | 'many_to_one';

type RelationshipQuickCardinalityOption = {
  intent: RelationshipQuickCardinalityIntent;
  label: string;
};

type RelationshipQuickEndpoint = {
  color: string;
  label: string;
};

function getRelationshipQuickEndpoint(
  model: DiagramModel,
  relationship: DatabaseRelationship,
  role: 'source' | 'target',
): RelationshipQuickEndpoint {
  const tableId = role === 'source' ? relationship.sourceTableId : relationship.targetTableId;

  return {
    // Endpoint pills mirror the actual table color so relationship editing keeps the same visual language as the canvas.
    color: getDisplayTableColor(model.tables[tableId]?.color),
    label: getRelationshipEndpointLabel(model, relationship, role),
  };
}

function getRelationshipQuickCardinalityIntent(
  model: DiagramModel,
  relationship: DatabaseRelationship,
): RelationshipQuickCardinalityIntent | null {
  if (relationship.cardinality === 'one_to_one') {
    return 'one_to_one';
  }

  if (relationship.cardinality !== 'one_to_many') {
    return null;
  }

  // DrawSQL reads the popover from the visible left endpoint to the visible right endpoint.
  // When the normalized source is on the right, the user-facing relationship becomes N:1.
  return isRelationshipSourceVisuallyFirst(model, relationship) ? 'one_to_many' : 'many_to_one';
}

function isRelationshipSourceVisuallyFirst(model: DiagramModel, relationship: DatabaseRelationship): boolean {
  const sourceCenter = getRelationshipTableVisualCenter(model.tables[relationship.sourceTableId]);
  const targetCenter = getRelationshipTableVisualCenter(model.tables[relationship.targetTableId]);

  if (sourceCenter.x !== targetCenter.x) {
    return sourceCenter.x < targetCenter.x;
  }

  if (sourceCenter.y !== targetCenter.y) {
    return sourceCenter.y < targetCenter.y;
  }

  return relationship.sourceTableId.localeCompare(relationship.targetTableId) <= 0;
}

function getRelationshipTableVisualCenter(table?: DatabaseTable): { x: number; y: number } {
  if (!table) {
    return { x: 0, y: 0 };
  }

  return {
    x: table.position.x + (table.width ?? defaultTableMinWidth) / 2,
    y: table.position.y,
  };
}

function RelationshipEndpointPill({ color, label }: { color: string; label: string }) {
  const style = {
    '--relationship-accent': color,
    backgroundColor: `color-mix(in srgb, ${color} 10%, white)`,
    borderColor: `color-mix(in srgb, ${color} 42%, rgb(var(--tabliodb-border-strong)))`,
    color: `color-mix(in srgb, ${color} 62%, rgb(var(--tabliodb-ink)))`,
  } as CSSProperties;

  return (
    <div
      className="min-w-0 rounded-[13px] border px-3 py-2 shadow-[0_1px_0_rgb(var(--tabliodb-border))]"
      style={style}
    >
      <span className="mb-1 block size-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="block truncate font-mono text-[11px] font-black leading-none">
        {label}
      </span>
    </div>
  );
}

function TableNodeContextMenu({
  canEdit,
  canOpenDocs,
  columnCount,
  left,
  onAddColumn,
  onAddIndex,
  onCopy,
  onCut,
  onDelete,
  onDiscuss,
  onDuplicate,
  onViewDocs,
  table,
  top,
}: {
  canEdit: boolean;
  canOpenDocs: boolean;
  columnCount: number;
  left: number;
  onAddColumn: () => void;
  onAddIndex: () => void;
  onCopy: () => void;
  onCut: () => void;
  onDelete: () => void;
  onDiscuss: () => void;
  onDuplicate: () => void;
  onViewDocs: () => void;
  table: DatabaseTable;
  top: number;
}) {
  return (
    <section
      aria-label={`Actions for ${table.name}`}
      className="absolute z-40 w-64 rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border-strong))] bg-white p-1.5 text-[rgb(var(--tabliodb-ink))] shadow-[0_3px_0_rgb(var(--tabliodb-border-strong)),0_18px_42px_rgb(15_23_42/0.16)]"
      data-tabliodb-table-context-menu=""
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={(event) => event.stopPropagation()}
      role="menu"
      style={{ left, top }}
    >
      <TableNodeContextMenuItem icon={MessageSquareText} label="Discuss" onSelect={onDiscuss} shortcut="Ctrl+Shift+;" />
      <TableNodeContextMenuItem disabled={!canOpenDocs} icon={FileText} label="View docs" onSelect={onViewDocs} />

      <div className="-mx-0.5 my-1 h-px bg-[rgb(var(--tabliodb-border))]" />

      <TableNodeContextMenuItem icon={Copy} label="Copy" onSelect={onCopy} shortcut="Ctrl+C" />
      <TableNodeContextMenuItem disabled icon={Scissors} label="Cut" onSelect={onCut} shortcut="Ctrl+X" />
      <TableNodeContextMenuItem
        disabled={!canEdit}
        icon={Copy}
        label="Duplicate"
        onSelect={onDuplicate}
        shortcut="Ctrl+D"
      />
      <TableNodeContextMenuItem
        disabled={!canEdit}
        icon={ListPlus}
        label="Add column"
        onSelect={onAddColumn}
        shortcut="Ctrl+Enter"
      />
      <TableNodeContextMenuItem
        disabled={!canEdit || columnCount === 0}
        icon={KeyRound}
        label="Add index"
        onSelect={onAddIndex}
        shortcut="Ctrl+'"
      />

      <div className="-mx-0.5 my-1 h-px bg-[rgb(var(--tabliodb-border))]" />

      <TableNodeContextMenuItem
        destructive
        disabled={!canEdit}
        icon={Trash2}
        label="Delete"
        onSelect={onDelete}
        shortcut="Del"
      />
    </section>
  );
}

function TableNodeContextMenuItem({
  destructive,
  disabled,
  icon: Icon,
  label,
  onSelect,
  shortcut,
}: {
  destructive?: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
  shortcut?: string;
}) {
  return (
    <button
      className={cn(
        'grid min-h-9 w-full cursor-pointer grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--tabliodb-radius-sm)] px-3 py-2 text-left text-[13px] font-bold outline-none transition-colors hover:bg-[rgb(var(--tabliodb-selected-surface))] hover:text-[rgb(var(--tabliodb-primary-text))] focus-visible:bg-[rgb(var(--tabliodb-selected-surface))] focus-visible:text-[rgb(var(--tabliodb-primary-text))] disabled:cursor-not-allowed disabled:opacity-50',
        destructive &&
          'text-[rgb(var(--tabliodb-danger))] hover:bg-[rgb(var(--tabliodb-danger-soft))] hover:text-[rgb(var(--tabliodb-danger))] focus-visible:bg-[rgb(var(--tabliodb-danger-soft))] focus-visible:text-[rgb(var(--tabliodb-danger))]',
      )}
      disabled={disabled}
      onClick={onSelect}
      role="menuitem"
      type="button"
    >
      <Icon className="size-4" />
      <span className="min-w-0 truncate">{label}</span>
      {shortcut ? (
        <span
          className={cn(
            'ml-5 text-[12px] font-extrabold text-[rgb(var(--tabliodb-ink-subtle))]',
            destructive && 'text-[rgb(var(--tabliodb-danger))]',
          )}
        >
          {shortcut}
        </span>
      ) : (
        <span />
      )}
    </button>
  );
}

function GroupNodeContextMenu({
  group,
  left,
  onClose,
  onColorChange,
  onRename,
  readOnly,
  top,
}: {
  group: DiagramGroup;
  left: number;
  onClose: () => void;
  onColorChange: (color: string) => void;
  onRename: (name: string) => void;
  readOnly: boolean;
  top: number;
}) {
  const displayColor = getDisplayTableColor(group.color);
  const colorChoices = useMemo(() => Array.from(new Set([displayColor, ...tableColorOptions])), [displayColor]);
  const [draftName, setDraftName] = useState(group.name);

  useEffect(() => {
    setDraftName(group.name);
  }, [group.id, group.name]);

  function commitName() {
    onRename(draftName);
  }

  return (
    <section
      aria-label={`Group actions for ${group.name}`}
      className="absolute z-40 w-72 rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border-strong))] bg-white p-2 text-[rgb(var(--tabliodb-ink))] shadow-[0_3px_0_rgb(var(--tabliodb-border-strong)),0_18px_42px_rgb(15_23_42/0.16)]"
      data-tabliodb-group-context-menu=""
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={(event) => event.stopPropagation()}
      role="menu"
      style={{ left, top }}
    >
      <div className="flex items-start gap-2 px-1 pb-2 pt-1">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-[var(--tabliodb-radius-md)] border border-white shadow-[0_0_0_1px_rgb(var(--tabliodb-border-strong)),0_1px_0_rgb(var(--tabliodb-border-strong))]"
          style={{ backgroundColor: hexToRgba(displayColor, 0.16), color: displayColor }}
        >
          <Palette className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
            Group
          </div>
          <div className="truncate text-[14px] font-extrabold text-[rgb(var(--tabliodb-ink))]">{group.name}</div>
        </div>
        <button
          aria-label="Close group menu"
          className="flex size-8 cursor-pointer items-center justify-center rounded-[var(--tabliodb-radius-sm)] text-[rgb(var(--tabliodb-ink-muted))] transition hover:bg-[rgb(var(--tabliodb-surface))] hover:text-[rgb(var(--tabliodb-ink))]"
          onClick={onClose}
          type="button"
        >
          <X className="size-4" />
        </button>
      </div>

      <label className="block px-1 text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
        Group name
      </label>
      <input
        className="mt-1 h-10 w-full rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 text-[14px] font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:shadow-[0_0_0_3px_rgb(var(--tabliodb-primary)/0.18)] disabled:cursor-not-allowed disabled:bg-[rgb(var(--tabliodb-surface))] disabled:text-[rgb(var(--tabliodb-ink-muted))]"
        disabled={readOnly}
        onBlur={commitName}
        onChange={(event) => setDraftName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }

          if (event.key === 'Escape') {
            setDraftName(group.name);
            event.currentTarget.blur();
          }
        }}
        placeholder="Group name"
        value={draftName}
      />

      <div className="-mx-0.5 my-2 h-px bg-[rgb(var(--tabliodb-border))]" />

      <div className="px-1 text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
        Color
      </div>
      <div className="mt-2 flex flex-wrap gap-2 px-1 pb-1">
        {colorChoices.map((color) => {
          const colorLabel = getTableColorLabel(color);
          const selected = color === displayColor;

          return (
            <WithTooltip content={`Set group color to ${colorLabel}`} key={color}>
              <button
                aria-label={`Use ${colorLabel} for group`}
                aria-pressed={selected}
                className="size-7 cursor-pointer rounded-full border-2 border-white transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-55"
                disabled={readOnly}
                onClick={() => onColorChange(color)}
                style={{
                  backgroundColor: color,
                  boxShadow: selected
                    ? `0 0 0 1px #ffffff, 0 0 0 4px ${color}, 0 1px 0 rgb(var(--tabliodb-border-strong))`
                    : '0 0 0 1px rgb(var(--tabliodb-border-strong)), 0 1px 0 rgb(var(--tabliodb-border-strong))',
                }}
                type="button"
              />
            </WithTooltip>
          );
        })}
      </div>
    </section>
  );
}

function CanvasConfirmDialog({
  action,
  onConfirm,
  onOpenChange,
}: {
  action: CanvasConfirmAction | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const isNote = action?.type === 'note';
  const isTable = action?.type === 'table';

  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(action)}>
      <DialogContent className="w-[min(92vw,420px)]">
        <DialogHeader>
          <DialogTitle>{isTable ? 'Delete table?' : isNote ? 'Delete note?' : 'Delete relationship?'}</DialogTitle>
          <DialogDescription>
            {isTable
              ? `Remove "${action?.name ?? 'this table'}", its columns, indexes, checks, and connected relationships from the diagram draft.`
              : isNote
                ? `Remove "${action?.name ?? 'this note'}" from the diagram draft.`
                : `Remove the relationship connected to "${action?.name ?? 'this column'}".`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button" variant="secondary">
            Cancel
          </Button>
          <Button onClick={onConfirm} type="button" variant="danger">
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function createCanvasMinimapStaticState(
  model: DiagramModel,
  selectedTableId: string | null,
  selectedTableIds: string[] = [],
): CanvasMinimapStaticState | null {
  const selectedTableIdSet = new Set(selectedTableIds);
  const tables = Object.values(model.tables).map<CanvasMinimapTable>((table) => ({
    color: getDisplayTableColor(table.color),
    height: getTableNodeHeight(model, table),
    id: table.id,
    name: table.name,
    selected: table.id === selectedTableId || selectedTableIdSet.has(table.id),
    width: getTableWidth(table),
    x: table.position.x,
    y: table.position.y,
  }));
  const groups = Object.values(model.groups).map<CanvasMinimapTable>((group) => ({
    ...getRenderedGroupBounds(model, group),
    color: getDisplayTableColor(group.color),
    id: group.id,
    name: group.name,
    selected: false,
  }));
  const notes = Object.values(model.notes).map<CanvasMinimapTable>((note) => ({
    color: note.color ?? '#ffc800',
    height: getNoteNodeHeight(note),
    id: note.id,
    name: note.text.slice(0, 32) || 'Note',
    selected: false,
    width: getNoteWidth(note),
    x: note.position.x,
    y: note.position.y,
  }));

  if (tables.length === 0) {
    return null;
  }

  const contentBounds = getCanvasContentBounds([...groups, ...tables, ...notes]);

  return {
    contentBounds,
    groups: groups.map(roundCanvasMinimapTable),
    notes: notes.map(roundCanvasMinimapTable),
    tables: tables.map(roundCanvasMinimapTable),
  };
}

function createCanvasMinimapState(
  graph: Graph,
  container: HTMLElement,
  staticState: CanvasMinimapStaticState,
): CanvasMinimapState {
  const viewport = getCanvasViewportRect(graph, container);
  const contentBounds = mergeCanvasRects(staticState.contentBounds, viewport);
  const viewBox = normalizeRectToAspect(padCanvasRect(contentBounds, 96), minimapAspectRatio);

  return {
    groups: staticState.groups,
    notes: staticState.notes,
    tables: staticState.tables,
    viewBox: roundCanvasRect(viewBox),
    viewport: roundCanvasRect(viewport),
  };
}

function getCanvasViewportRect(graph: Graph, container: HTMLElement): CanvasRect {
  const containerRect = container.getBoundingClientRect();
  const topLeft = graph.clientToLocal(containerRect.left, containerRect.top);
  const bottomRight = graph.clientToLocal(containerRect.right, containerRect.bottom);
  const x = Math.min(topLeft.x, bottomRight.x);
  const y = Math.min(topLeft.y, bottomRight.y);

  return {
    height: Math.max(1, Math.abs(bottomRight.y - topLeft.y)),
    width: Math.max(1, Math.abs(bottomRight.x - topLeft.x)),
    x,
    y,
  };
}

function getSafeCanvasViewportRect(
  graph: Graph,
  container: HTMLElement,
  inset: { left: number; right: number },
): CanvasRect {
  const containerRect = container.getBoundingClientRect();
  const visibleLeft = Math.min(containerRect.right, containerRect.left + inset.left);
  const visibleRight = Math.max(visibleLeft + 1, containerRect.right - inset.right);
  const topLeft = graph.clientToLocal(visibleLeft, containerRect.top);
  const bottomRight = graph.clientToLocal(visibleRight, containerRect.bottom);
  const x = Math.min(topLeft.x, bottomRight.x);
  const y = Math.min(topLeft.y, bottomRight.y);

  return {
    height: Math.max(1, Math.abs(bottomRight.y - topLeft.y)),
    width: Math.max(1, Math.abs(bottomRight.x - topLeft.x)),
    x,
    y,
  };
}

function getCanvasContentBounds(rects: CanvasRect[]): CanvasRect {
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));

  return {
    height: Math.max(1, bottom - top),
    width: Math.max(1, right - left),
    x: left,
    y: top,
  };
}

function mergeCanvasRects(left: CanvasRect, right: CanvasRect): CanvasRect {
  const minX = Math.min(left.x, right.x);
  const minY = Math.min(left.y, right.y);
  const maxX = Math.max(left.x + left.width, right.x + right.width);
  const maxY = Math.max(left.y + left.height, right.y + right.height);

  return {
    height: Math.max(1, maxY - minY),
    width: Math.max(1, maxX - minX),
    x: minX,
    y: minY,
  };
}

function padCanvasRect(rect: CanvasRect, padding: number): CanvasRect {
  return {
    height: rect.height + padding * 2,
    width: rect.width + padding * 2,
    x: rect.x - padding,
    y: rect.y - padding,
  };
}

function normalizeRectToAspect(rect: CanvasRect, aspectRatio: number): CanvasRect {
  const currentAspectRatio = rect.width / rect.height;

  if (currentAspectRatio === aspectRatio) {
    return rect;
  }

  if (currentAspectRatio < aspectRatio) {
    const nextWidth = rect.height * aspectRatio;

    return {
      ...rect,
      width: nextWidth,
      x: rect.x - (nextWidth - rect.width) / 2,
    };
  }

  const nextHeight = rect.width / aspectRatio;

  return {
    ...rect,
    height: nextHeight,
    y: rect.y - (nextHeight - rect.height) / 2,
  };
}

function roundCanvasMinimapTable(table: CanvasMinimapTable): CanvasMinimapTable {
  return {
    ...table,
    ...roundCanvasRect(table),
  };
}

function roundCanvasRect(rect: CanvasRect): CanvasRect {
  return {
    height: Math.round(rect.height),
    width: Math.round(rect.width),
    x: Math.round(rect.x),
    y: Math.round(rect.y),
  };
}

function areCanvasMinimapStatesEqual(
  currentState: CanvasMinimapState | null,
  nextState: CanvasMinimapState | null,
): boolean {
  if (!currentState || !nextState) {
    return currentState === nextState;
  }

  return (
    areCanvasRectsEqual(currentState.viewBox, nextState.viewBox) &&
    areCanvasRectsEqual(currentState.viewport, nextState.viewport) &&
    areCanvasMinimapItemsEqual(currentState.groups, nextState.groups) &&
    areCanvasMinimapItemsEqual(currentState.notes, nextState.notes) &&
    areCanvasMinimapItemsEqual(currentState.tables, nextState.tables)
  );
}

function areCanvasMinimapItemsEqual(currentItems: CanvasMinimapTable[], nextItems: CanvasMinimapTable[]): boolean {
  if (currentItems === nextItems) {
    return true;
  }

  return (
    currentItems.length === nextItems.length &&
    currentItems.every((item, index) => {
      const nextItem = nextItems[index];

      return (
        nextItem &&
        item.id === nextItem.id &&
        item.name === nextItem.name &&
        item.color === nextItem.color &&
        item.selected === nextItem.selected &&
        areCanvasRectsEqual(item, nextItem)
      );
    })
  );
}

function areCanvasRectsEqual(left: CanvasRect, right: CanvasRect): boolean {
  return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;
}

function areAwarenessCursorsEqual(
  left: AwarenessState['cursor'] | undefined,
  right: AwarenessState['cursor'] | undefined,
): boolean {
  if (!left || !right) {
    return left === right;
  }

  return left.x === right.x && left.y === right.y;
}

function createRemoteCursorPositions(
  graph: Graph,
  container: HTMLElement,
  remoteCursors: RemoteCanvasCursor[],
): RemoteCanvasCursorPosition[] {
  const containerRect = container.getBoundingClientRect();

  return remoteCursors.flatMap<RemoteCanvasCursorPosition>((cursor) => {
    const point = graph.localToClient(cursor.cursor.x, cursor.cursor.y);
    const left = Math.round(point.x - containerRect.left);
    const top = Math.round(point.y - containerRect.top);

    if (left < -80 || top < -80 || left > containerRect.width + 180 || top > containerRect.height + 80) {
      return [];
    }

    return [
      {
        ...cursor,
        left,
        top,
      },
    ];
  });
}

function areRemoteCursorPositionsEqual(
  currentPositions: RemoteCanvasCursorPosition[],
  nextPositions: RemoteCanvasCursorPosition[],
): boolean {
  if (currentPositions.length !== nextPositions.length) {
    return false;
  }

  return currentPositions.every((current, index) => {
    const next = nextPositions[index];

    if (!next) {
      return false;
    }

    return (
      current.left === next.left &&
      current.top === next.top &&
      current.cursor.x === next.cursor.x &&
      current.cursor.y === next.cursor.y &&
      current.user.id === next.user.id &&
      current.user.name === next.user.name &&
      current.user.cursorColor === next.user.cursorColor &&
      current.user.avatarUrl === next.user.avatarUrl &&
      current.clientIds.join(',') === next.clientIds.join(',')
    );
  });
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

function registerNoteNodeShape(): void {
  if (noteShapeRegistered) {
    return;
  }

  Shape.HTML.register({
    effect: ['data'],
    height: noteNodeMinHeight,
    html: (cell: Cell) => renderNoteNode(cell.getData<NoteNodeData>()),
    shape: noteNodeShape,
    width: noteNodeDefaultWidth,
  });

  noteShapeRegistered = true;
}

function registerRelationshipConnector(): void {
  if (relationshipConnectorRegistered) {
    return;
  }

  Graph.registerConnector(relationshipConnectorName, createRelationshipConnector(), true);
  relationshipConnectorRegistered = true;
}

function createRelationshipConnector(): ConnectorDefinition<RelationshipConnectorOptions> {
  return (sourcePoint, targetPoint, routePoints, options = {}) => {
    const points = [
      normalizeRelationshipPathPoint(sourcePoint),
      ...routePoints.map((point) => normalizeRelationshipPathPoint(point)),
      normalizeRelationshipPathPoint(targetPoint),
    ];

    if (points.length === 0) {
      return '';
    }

    let path = `M ${formatRelationshipPathCoordinate(points[0].x)} ${formatRelationshipPathCoordinate(points[0].y)}`;
    const radius = options.radius ?? relationshipConnectorRadius;
    const straightEndpointVertices = options.straightEndpointVertices ?? relationshipConnectorStraightEndpointVertices;
    const minimumRoundedSegment = options.minimumRoundedSegment ?? relationshipConnectorMinimumRoundedSegment;

    for (let index = 1; index < points.length - 1; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      const next = points[index + 1];

      if (!shouldRoundRelationshipPathCorner(points, index, radius, straightEndpointVertices, minimumRoundedSegment)) {
        path += ` L ${formatRelationshipPathCoordinate(current.x)} ${formatRelationshipPathCoordinate(current.y)}`;
        continue;
      }

      const previousDistance = getRelationshipPathDistance(current, previous);
      const nextDistance = getRelationshipPathDistance(current, next);
      const cornerRadius = Math.min(radius, previousDistance / 2, nextDistance / 2);
      const roundedStart = moveRelationshipPathPoint(current, previous, cornerRadius);
      const roundedEnd = moveRelationshipPathPoint(current, next, cornerRadius);
      const controlStart = {
        x: roundedStart.x / 3 + (current.x * 2) / 3,
        y: (current.y * 2) / 3 + roundedStart.y / 3,
      };
      const controlEnd = {
        x: roundedEnd.x / 3 + (current.x * 2) / 3,
        y: (current.y * 2) / 3 + roundedEnd.y / 3,
      };

      // Koordinat tidak dibulatkan ke integer agar garis horizontal yang jatuh di .5px tidak berubah menjadi slope halus.
      path += ` L ${formatRelationshipPathCoordinate(roundedStart.x)} ${formatRelationshipPathCoordinate(
        roundedStart.y,
      )}`;
      path += ` C ${formatRelationshipPathCoordinate(controlStart.x)} ${formatRelationshipPathCoordinate(
        controlStart.y,
      )} ${formatRelationshipPathCoordinate(controlEnd.x)} ${formatRelationshipPathCoordinate(
        controlEnd.y,
      )} ${formatRelationshipPathCoordinate(roundedEnd.x)} ${formatRelationshipPathCoordinate(roundedEnd.y)}`;
    }

    const target = points[points.length - 1];

    return `${path} L ${formatRelationshipPathCoordinate(target.x)} ${formatRelationshipPathCoordinate(target.y)}`;
  };
}

function normalizeRelationshipPathPoint(point: PointLike): RelationshipPathPoint {
  return {
    x: point.x,
    y: point.y,
  };
}

function shouldRoundRelationshipPathCorner(
  points: RelationshipPathPoint[],
  index: number,
  radius: number,
  straightEndpointVertices: number,
  minimumRoundedSegment: number,
): boolean {
  if (radius <= 0 || index <= straightEndpointVertices || index >= points.length - 1 - straightEndpointVertices) {
    return false;
  }

  const previous = points[index - 1];
  const current = points[index];
  const next = points[index + 1];
  const incomingHorizontal = nearlyEqualRelationshipPathCoordinate(previous.y, current.y);
  const incomingVertical = nearlyEqualRelationshipPathCoordinate(previous.x, current.x);
  const outgoingHorizontal = nearlyEqualRelationshipPathCoordinate(current.y, next.y);
  const outgoingVertical = nearlyEqualRelationshipPathCoordinate(current.x, next.x);
  const isOrthogonalCorner = (incomingHorizontal && outgoingVertical) || (incomingVertical && outgoingHorizontal);

  if (!isOrthogonalCorner) {
    return false;
  }

  // Corner mikro di area fan-in dekat port sengaja tetap siku/lurus agar garis tidak tampak bergelombang.
  return (
    getRelationshipPathDistance(current, previous) >= minimumRoundedSegment &&
    getRelationshipPathDistance(current, next) >= minimumRoundedSegment
  );
}

function moveRelationshipPathPoint(
  from: RelationshipPathPoint,
  toward: RelationshipPathPoint,
  distance: number,
): RelationshipPathPoint {
  const fullDistance = getRelationshipPathDistance(from, toward);

  if (fullDistance === 0) {
    return from;
  }

  const ratio = distance / fullDistance;

  return {
    x: from.x + (toward.x - from.x) * ratio,
    y: from.y + (toward.y - from.y) * ratio,
  };
}

function getRelationshipPathDistance(first: RelationshipPathPoint, second: RelationshipPathPoint): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function nearlyEqualRelationshipPathCoordinate(first: number, second: number): boolean {
  return Math.abs(first - second) < 0.001;
}

function formatRelationshipPathCoordinate(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function syncGraphFromModel(
  graph: Graph,
  model: DiagramModel,
  selectedTableId: string | null,
  selectedTableIds: string[],
  selectedColumnId: string | null,
  selectedRelationshipId: string | null,
  commentTargetSummaries: CommentThreadTargetSummaryDto[],
  readOnly: boolean,
): void {
  const relationshipPlan = createRelationshipPlan(model, selectedTableId, selectedRelationshipId);
  // Marker summary dihitung sekali per sync supaya node table tidak mengulang scan thread untuk setiap row.
  const commentMarkerSummary = createCommentMarkerSummary(model, commentTargetSummaries);
  const groupMetadata = Object.values(model.groups).map((group) => createGroupNodeMetadata(model, group));
  const noteMetadata = Object.values(model.notes).map((note) =>
    createNoteNodeMetadata(note, commentMarkerSummary, readOnly),
  );
  const nodeIds = new Set([
    ...Object.keys(model.tables),
    ...groupMetadata.map((metadata) => metadata.id).filter((id): id is string => Boolean(id)),
    ...noteMetadata.map((metadata) => metadata.id).filter((id): id is string => Boolean(id)),
  ]);
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

    for (const group of groupMetadata) {
      syncGroupNode(graph, group);
    }

    for (const table of Object.values(model.tables)) {
      syncTableNode(
        graph,
        createTableNodeMetadata(
          model,
          table,
          selectedTableId,
          selectedTableIds,
          selectedColumnId,
          relationshipPlan.terminalsByTable.get(table.id) ?? [],
          commentMarkerSummary,
          readOnly,
        ),
      );
    }

    for (const note of noteMetadata) {
      syncNoteNode(graph, note);
    }

    for (const edge of edgeMetadata) {
      syncRelationshipEdge(graph, edge);
    }
  });
}

function createGroupNodeMetadata(model: DiagramModel, group: DiagramGroup): NodeMetadata {
  const bounds = getRenderedGroupBounds(model, group);
  const color = getDisplayTableColor(group.color);

  return {
    attrs: {
      body: {
        fill: hexToRgba(color, 0.1),
        cursor: 'context-menu',
        // Isi group tetap tidak menangkap pointer supaya table di dalamnya masih mudah dipilih dan di-drag.
        pointerEvents: 'visibleStroke',
        rx: 18,
        ry: 18,
        stroke: color,
        strokeDasharray: '9 7',
        strokeOpacity: 0.58,
        strokeWidth: 2,
      },
      label: {
        fill: color,
        fontFamily: 'Nunito, ui-sans-serif, system-ui, sans-serif',
        fontSize: 13,
        fontWeight: 900,
        cursor: 'context-menu',
        pointerEvents: 'visiblePainted',
        refX: 16,
        refY: 17,
        text: `${group.name}  ${group.tableIds.length}`,
        textAnchor: 'start',
        textVerticalAnchor: 'middle',
      },
    },
    data: {
      color,
      groupId: group.id,
      groupName: group.name,
      kind: 'group',
      tableCount: group.tableIds.length,
    } satisfies GroupNodeData,
    height: bounds.height,
    id: getGroupNodeId(group.id),
    position: { x: bounds.x, y: bounds.y },
    shape: 'rect',
    width: bounds.width,
    zIndex: -20,
  };
}

function syncGroupNode(graph: Graph, metadata: NodeMetadata): void {
  const existing = graph.getCellById(metadata.id!) as X6Node | null | undefined;

  if (!existing?.isNode()) {
    graph.addNode(metadata);
    return;
  }

  const nextData = metadata.data as GroupNodeData;
  const currentData = existing.getData<GroupNodeData>();
  const currentPosition = existing.getPosition();
  const currentSize = existing.getSize();
  const nextPosition = metadata.position ?? { x: metadata.x ?? 0, y: metadata.y ?? 0 };
  const nextSize = metadata.size ?? {
    height: metadata.height ?? 1,
    width: metadata.width ?? 1,
  };

  if (!areGroupNodeDataEqual(currentData, nextData)) {
    existing.setData(nextData, { overwrite: true });
  }

  existing.attr(metadata.attrs ?? {});

  if (currentSize.width !== nextSize.width || currentSize.height !== nextSize.height) {
    existing.resize(nextSize.width, nextSize.height);
  }

  if (currentPosition.x !== nextPosition.x || currentPosition.y !== nextPosition.y) {
    existing.position(nextPosition.x, nextPosition.y);
  }

  existing.setZIndex(metadata.zIndex ?? -20);
}

function createNoteNodeMetadata(
  note: DiagramNote,
  commentMarkerSummary: CommentMarkerSummary,
  readOnly: boolean,
): NodeMetadata {
  const width = getNoteWidth(note);

  return {
    data: {
      color: note.color ?? '#ffc800',
      commentMarker: getCommentMarkerCountForTarget(commentMarkerSummary, 'note', note.id),
      kind: 'note',
      noteId: note.id,
      readOnly,
      text: note.text,
    } satisfies NoteNodeData,
    height: getNoteNodeHeight(note),
    id: note.id,
    position: note.position,
    shape: noteNodeShape,
    width,
    zIndex: 3,
  };
}

function syncNoteNode(graph: Graph, metadata: NodeMetadata): void {
  const existing = graph.getCellById(metadata.id!) as X6Node | null | undefined;

  if (!existing?.isNode()) {
    graph.addNode(metadata);
    return;
  }

  const nextData = metadata.data as NoteNodeData;
  const currentData = existing.getData<NoteNodeData>();
  const currentPosition = existing.getPosition();
  const currentSize = existing.getSize();
  const nextPosition = metadata.position ?? { x: metadata.x ?? 0, y: metadata.y ?? 0 };
  const nextSize = metadata.size ?? {
    height: metadata.height ?? noteNodeMinHeight,
    width: metadata.width ?? noteNodeDefaultWidth,
  };

  if (!areNoteNodeDataEqual(currentData, nextData)) {
    existing.setData(nextData, { overwrite: true });
  }

  if (currentSize.width !== nextSize.width || currentSize.height !== nextSize.height) {
    existing.resize(nextSize.width, nextSize.height);
  }

  if (currentPosition.x !== nextPosition.x || currentPosition.y !== nextPosition.y) {
    existing.position(nextPosition.x, nextPosition.y);
  }

  existing.setZIndex(metadata.zIndex ?? 3);
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
  const shouldSyncPorts = currentData?.portSignature !== nextData.portSignature;

  if (!isTableNodeDataEqual(currentData, nextData)) {
    existing.setData(nextData, { overwrite: true });
  }

  if (shouldSyncPorts) {
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

  if (getRelationshipTerminalSignature(existing.getSource()) !== getRelationshipTerminalSignature(metadata.source)) {
    // Endpoint relationship tersimpan bisa berupa absolute point supaya marker pada satu column tidak saling menimpa.
    existing.setSource(metadata.source as never);
  }

  if (getRelationshipTerminalSignature(existing.getTarget()) !== getRelationshipTerminalSignature(metadata.target)) {
    // Target point ikut disinkronkan saat drag/resize agar preview live sama dengan hasil final setelah mouse dilepas.
    existing.setTarget(metadata.target as never);
  }

  existing.setLabels(metadata.labels ?? []);
  existing.setRouter(metadata.router!);
  existing.setConnector(metadata.connector!);
  // X6 merges attrs, so markers from the previous cardinality must be cleared before applying the next edge style.
  // Without this reset, changing 1:N to 1:1 can keep the old crow-foot marker on screen.
  existing.attr('line/sourceMarker', null);
  existing.attr('line/targetMarker', null);
  existing.attr(metadata.attrs ?? {});
  existing.setVertices(metadata.vertices ?? []);
  existing.setZIndex(metadata.zIndex ?? 0);
}

function createDraftRelationshipEdgeMetadata(): EdgeMetadata {
  return {
    attrs: {
      line: {
        // Draft edges use the same neutral language as saved relationships and explicitly remove X6's default arrow marker.
        sourceMarker: null,
        stroke: relationshipNeutralColor,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeWidth: 1.5,
        targetMarker: null,
      },
    },
    connector: {
      name: relationshipConnectorName,
      args: {
        minimumRoundedSegment: relationshipConnectorMinimumRoundedSegment,
        radius: relationshipConnectorRadius,
        straightEndpointVertices: relationshipConnectorStraightEndpointVertices,
      },
    },
    labels: [],
    router: { name: 'manhattan', args: buildManhattanRouterArgs() },
    zIndex: 2,
  };
}

function refreshDraftRelationshipPreview(
  edge: X6Edge,
  model: DiagramModel,
  selectedTableId: string | null,
  selectedRelationshipId: string | null,
): void {
  const sourcePort = parseColumnPortId(edge.getSourcePortId() ?? undefined);

  if (!sourcePort) {
    return;
  }

  const targetPort = parseColumnPortId(edge.getTargetPortId() ?? undefined);

  if (targetPort && targetPort.tableId !== sourcePort.tableId) {
    const previewRelationship = createPreviewRelationshipFromPorts(edge.id, model, sourcePort, targetPort);

    if (!previewRelationship) {
      return;
    }

    const previewModel = {
      ...model,
      relationships: {
        ...model.relationships,
        [previewRelationship.id]: previewRelationship,
      },
    };
    const relationshipPlan = createRelationshipPlan(previewModel, selectedTableId, selectedRelationshipId, [
      ...Object.values(model.relationships),
      previewRelationship,
    ]);
    const [metadata] = createRelationshipEdgeMetadata(previewModel, relationshipPlan, [previewRelationship]);

    if (metadata) {
      // Once the drag target snaps to a real column port, reuse the exact same route planner as saved relationships.
      applyDraftRelationshipEdgeRoute(edge, metadata.vertices ?? []);
    }

    return;
  }

  const targetPoint = edge.getTargetPoint();
  const route = createFreeTargetRelationshipRoute(model, edge.id, sourcePort, {
    x: targetPoint.x,
    y: targetPoint.y,
  });

  if (route) {
    // Before snap, there is no real target column yet, so route from the source port to the pointer with the same stub/spine rules.
    applyDraftRelationshipEdgeRoute(edge, route.vertices, { keepEndpointCornersStraight: false });
  }
}

function createPreviewRelationshipFromPorts(
  relationshipId: string,
  model: DiagramModel,
  sourcePort: ParsedColumnPortId,
  targetPort: ParsedColumnPortId,
): DatabaseRelationship | null {
  const sourceColumn = model.columns[sourcePort.columnId];
  const targetColumn = model.columns[targetPort.columnId];

  if (!sourceColumn || !targetColumn) {
    return null;
  }

  return {
    cardinality: 'one_to_one',
    id: relationshipId,
    sourceColumnIds: [sourcePort.columnId],
    sourceTableId: sourcePort.tableId,
    targetColumnIds: [targetPort.columnId],
    targetTableId: targetPort.tableId,
  };
}

function createFreeTargetRelationshipRoute(
  model: DiagramModel,
  relationshipId: string,
  sourcePort: ParsedColumnPortId,
  targetPoint: { x: number; y: number },
): RelationshipRoute | null {
  const sourceTerminal = createTerminalBase({
    active: false,
    columnId: sourcePort.columnId,
    relationshipId,
    role: 'primary',
    side: sourcePort.side,
    tableId: sourcePort.tableId,
  });
  const sourcePoint = getRelationshipTerminalPoint(model, sourceTerminal);

  if (!sourcePoint) {
    return null;
  }

  const targetTerminal = createTerminalBase({
    active: false,
    columnId: 'draft-target',
    relationshipId,
    role: 'foreign',
    side: targetPoint.x >= sourcePoint.x ? 'left' : 'right',
    tableId: 'draft-target',
  });
  const targetTerminalPoint: RelationshipTerminalPoint = {
    bounds: {
      height: 0,
      width: 0,
      x: targetPoint.x,
      y: targetPoint.y,
    },
    x: targetPoint.x,
    y: targetPoint.y,
  };

  return createRelationshipRoute(
    relationshipId,
    sourceTerminal,
    targetTerminal,
    sourcePoint,
    targetTerminalPoint,
    0,
    0,
    0,
  );
}

function applyDraftRelationshipEdgeRoute(
  edge: X6Edge,
  vertices: Array<{ x: number; y: number }>,
  options: { keepEndpointCornersStraight?: boolean } = {},
): void {
  const keepEndpointCornersStraight = options.keepEndpointCornersStraight ?? true;

  edge.setRouter({ name: 'normal' });
  edge.setConnector({
    name: relationshipConnectorName,
    args: {
      minimumRoundedSegment: relationshipConnectorMinimumRoundedSegment,
      radius: relationshipConnectorRadius,
      // Free-drag has no final target port yet, so its first corner can be rounded.
      // Once snapped to a column, we switch back to the exact saved-edge endpoint rule.
      straightEndpointVertices: keepEndpointCornersStraight ? relationshipConnectorStraightEndpointVertices : 0,
    },
  });
  edge.attr('line/sourceMarker', null);
  edge.attr('line/targetMarker', null);
  edge.attr({
    line: {
      // Live preview stays visually identical to a freshly created 1:1 relationship: neutral, rounded, and marker-free.
      sourceMarker: null,
      stroke: relationshipNeutralColor,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: 1.5,
      targetMarker: null,
    },
  });
  edge.setVertices(vertices);
  edge.setZIndex(2);
}

function getRelationshipTerminalSignature(terminal: unknown): string {
  if (typeof terminal === 'string') {
    return `cell:${terminal}`;
  }

  if (!terminal || typeof terminal !== 'object') {
    return 'empty';
  }

  const terminalRecord = terminal as { cell?: unknown; port?: unknown; x?: unknown; y?: unknown };

  if (typeof terminalRecord.cell === 'string' || typeof terminalRecord.port === 'string') {
    return `cell:${String(terminalRecord.cell ?? '')}:port:${String(terminalRecord.port ?? '')}`;
  }

  if (typeof terminalRecord.x === 'number' && typeof terminalRecord.y === 'number') {
    return `point:${terminalRecord.x}:${terminalRecord.y}`;
  }

  return JSON.stringify(terminalRecord);
}

function createTableNodeMetadata(
  model: DiagramModel,
  table: DatabaseTable,
  selectedTableId: string | null,
  selectedTableIds: string[],
  selectedColumnId: string | null,
  terminals: RelationshipTerminal[],
  commentMarkerSummary: CommentMarkerSummary,
  readOnly: boolean,
): NodeMetadata {
  const columns = getVisibleTableColumns(model, table);
  const totalColumnCount = table.columnIds.length;
  const displayMode = getEffectiveTableDisplayMode(table);
  const height = getTableNodeHeight(model, table);
  const width = getTableWidth(table);
  const selected = table.id === selectedTableId;
  const multiSelected = selectedTableIds.includes(table.id);
  const portsVisible = selected || multiSelected;
  const portSignature = createColumnPortSignature(table, columns, terminals, readOnly, portsVisible);

  return {
    id: table.id,
    data: {
      color: getDisplayTableColor(table.color),
      kind: 'table',
      columnCommentMarkers: Object.fromEntries(
        columns.map((column) => [column.id, getColumnCommentMarkerCount(commentMarkerSummary, column.id)]),
      ),
      columns,
      columnCountLabel:
        displayMode === 'all_columns' ? String(totalColumnCount) : `${columns.length}/${totalColumnCount}`,
      commentMarker: getTableCommentMarkerCount(commentMarkerSummary, table.id),
      displayMode,
      portSignature,
      readOnly,
      selectedColumnId,
      multiSelected,
      selected,
      tableId: table.id,
      tableName: table.name,
    } satisfies TableNodeData,
    height,
    position: table.position,
    ports: createColumnPorts(table, columns, terminals, readOnly, portsVisible),
    shape: tableNodeShape,
    width,
    zIndex: selected || multiSelected ? 2 : 1,
  };
}

// excludeShapes: ['rect'] itu kunci — tanpa ini, kotak group yang murni dekoratif
// (pointerEvents: 'none', cuma background) ikut dianggap penghalang. startDirections/
// endDirections dikunci ke sisi port fisiknya (kiri/kanan) supaya garis tetap keluar
// dari baris kolom yang benar, bukan cari jalan pintas lewat sisi lain tabel.
function buildManhattanRouterArgs(sourceSide?: PortSide, targetSide?: PortSide) {
  return {
    endDirections: targetSide ? [targetSide] : ['left', 'right'],
    excludeShapes: ['rect'],
    padding: relationshipObstaclePadding, // tetap 12, karena 12 adalah kelipatan 6
    startDirections: sourceSide ? [sourceSide] : ['left', 'right'],
    step: diagramRouterStepSize, // <-- ubah dari diagramVisualGridSize (12) jadi 6
  };
}

function buildRelationshipMarkers(
  cardinality: 'one_to_one' | 'one_to_many' | 'many_to_many',
  stroke: string,
  strokeWidth: number,
) {
  const targetManyMarker = {
    // Marker path dibiarkan centered oleh X6; endpoint many yang digeser keluar agar crow-foot tidak tertanam di table.
    d: `M -${relationshipManyMarkerLength} -${relationshipManyMarkerSpread} L 0 0 L -${relationshipManyMarkerLength} ${relationshipManyMarkerSpread} M -${relationshipManyMarkerLength} 0 L 0 0`,
    fill: 'none',
    name: 'path' as const,
    offsetX: 0,
    stroke,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth,
  };
  const sourceManyMarker = {
    // Source marker harus mirror dari target marker karena marker-start mengikuti arah keluar dari table.
    d: `M ${relationshipManyMarkerLength} -${relationshipManyMarkerSpread} L 0 0 L ${relationshipManyMarkerLength} ${relationshipManyMarkerSpread} M ${relationshipManyMarkerLength} 0 L 0 0`,
    fill: 'none',
    name: 'path' as const,
    offsetX: 0,
    stroke,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth,
  };

  switch (cardinality) {
    case 'many_to_many':
      return { sourceMarker: sourceManyMarker, targetMarker: targetManyMarker };
    case 'one_to_one':
      // 1:1 keeps the line plain at both ends; the row-level port already explains the exact column anchor.
      return {};
    case 'one_to_many':
    default:
      // Sisi "one" sengaja plain line; kardinalitas hanya ditandai di sisi "many".
      return { targetMarker: targetManyMarker };
  }
}

function createRelationshipRouteMap(
  model: DiagramModel,
  relationships: DatabaseRelationship[],
  terminalsByRelationship: RelationshipPlan['terminalsByRelationship'],
): Map<string, RelationshipRoute> {
  const routesByRelationship = new Map<string, RelationshipRoute>();
  const usedHorizontalSegments: RelationshipHorizontalSegment[] = [];
  const laneOffsetCandidates = createRelationshipLaneOffsetCandidates();
  const routeInputs: RelationshipRouteInput[] = relationships
    .flatMap((relationship) => {
      const terminals = terminalsByRelationship.get(relationship.id);

      if (!terminals?.source || !terminals.target) {
        return [];
      }

      const sourcePoint = getRelationshipTerminalPoint(model, terminals.source);
      const targetPoint = getRelationshipTerminalPoint(model, terminals.target);

      if (!sourcePoint || !targetPoint) {
        return [];
      }

      return [
        {
          relationship,
          sourcePoint,
          sourceTerminal: terminals.source,
          targetPoint,
          targetTerminal: terminals.target,
        },
      ];
    })
    .sort((a, b) => {
      const aLeft = Math.min(a.sourcePoint.x, a.targetPoint.x);
      const bLeft = Math.min(b.sourcePoint.x, b.targetPoint.x);
      const aTop = Math.min(a.sourcePoint.y, a.targetPoint.y);
      const bTop = Math.min(b.sourcePoint.y, b.targetPoint.y);

      return (
        aLeft - bLeft ||
        aTop - bTop ||
        a.sourcePoint.y - b.sourcePoint.y ||
        a.targetPoint.y - b.targetPoint.y ||
        a.relationship.id.localeCompare(b.relationship.id)
      );
    });
  const endpointOffsets = createRelationshipEndpointOffsetMap(routeInputs);

  for (const routeInput of routeInputs) {
    const sourceEndpointOffset =
      endpointOffsets.get(createRelationshipEndpointOffsetKey(routeInput.relationship.id, 'source')) ?? 0;
    const targetEndpointOffset =
      endpointOffsets.get(createRelationshipEndpointOffsetKey(routeInput.relationship.id, 'target')) ?? 0;
    let selectedRoute: RelationshipRoute | null = null;

    for (const laneOffset of laneOffsetCandidates) {
      const route = createRelationshipRoute(
        routeInput.relationship.id,
        routeInput.sourceTerminal,
        routeInput.targetTerminal,
        routeInput.sourcePoint,
        routeInput.targetPoint,
        sourceEndpointOffset,
        targetEndpointOffset,
        laneOffset,
      );

      if (!hasRelationshipHorizontalSegmentConflict(route.horizontalSegments, usedHorizontalSegments)) {
        selectedRoute = route;
        break;
      }
    }

    // Kandidat terakhir tetap dipakai sebagai fallback agar edge tidak hilang ketika canvas sudah sangat padat.
    const route =
      selectedRoute ??
      createRelationshipRoute(
        routeInput.relationship.id,
        routeInput.sourceTerminal,
        routeInput.targetTerminal,
        routeInput.sourcePoint,
        routeInput.targetPoint,
        sourceEndpointOffset,
        targetEndpointOffset,
        laneOffsetCandidates[laneOffsetCandidates.length - 1] ?? 0,
      );

    routesByRelationship.set(routeInput.relationship.id, route);
    usedHorizontalSegments.push(...route.horizontalSegments);
  }

  return routesByRelationship;
}

function createRelationshipRoute(
  relationshipId: string,
  sourceTerminal: RelationshipTerminal,
  targetTerminal: RelationshipTerminal,
  sourcePoint: RelationshipTerminalPoint,
  targetPoint: RelationshipTerminalPoint,
  sourceEndpointOffset: number,
  targetEndpointOffset: number,
  laneOffset: number,
): RelationshipRoute {
  const sourceDockPoint = {
    ...sourcePoint,
    y: sourcePoint.y + sourceEndpointOffset,
  };
  const targetDockPoint = {
    ...targetPoint,
    y: targetPoint.y + targetEndpointOffset,
  };
  const sourceStubX = snapRelationshipCoordinate(
    sourceDockPoint.x + getRelationshipPortSideDirection(sourceTerminal.side) * relationshipRouteFanLength,
  );
  const targetStubX = snapRelationshipCoordinate(
    targetDockPoint.x + getRelationshipPortSideDirection(targetTerminal.side) * relationshipRouteFanLength,
  );
  const spineX = getRelationshipSpineX(sourceTerminal, targetTerminal, sourcePoint, targetPoint, laneOffset);
  const vertices = dedupeRelationshipVertices([
    // Route dibuat dock -> stub -> spine -> stub -> dock agar segmen yang masuk ke table selalu horizontal tegas.
    { x: sourceStubX, y: sourceDockPoint.y },
    // Lane offset sekarang hanya memengaruhi posisi spine X; Y endpoint tidak dibelokkan lagi tepat sebelum port.
    { x: spineX, y: sourceDockPoint.y },
    { x: spineX, y: targetDockPoint.y },
    { x: targetStubX, y: targetDockPoint.y },
  ]);
  const routePoints = [
    { x: sourceDockPoint.x, y: sourceDockPoint.y },
    ...vertices,
    { x: targetDockPoint.x, y: targetDockPoint.y },
  ];

  return {
    horizontalSegments: createRelationshipHorizontalSegments(relationshipId, routePoints),
    sourcePoint: { x: sourceDockPoint.x, y: sourceDockPoint.y },
    targetPoint: { x: targetDockPoint.x, y: targetDockPoint.y },
    vertices,
  };
}

function getRelationshipTerminalPoint(
  model: DiagramModel,
  terminal: RelationshipTerminal,
): RelationshipTerminalPoint | null {
  const table = model.tables[terminal.tableId];

  if (!table) {
    return null;
  }

  const visibleColumns = getVisibleTableColumns(model, table);
  const columnIndex = visibleColumns.findIndex((column) => column.id === terminal.columnId);

  if (columnIndex === -1) {
    return null;
  }

  const bounds = {
    height: getTableNodeHeight(model, table),
    width: getTableWidth(table),
    x: table.position.x,
    y: table.position.y,
  };

  return {
    bounds,
    x: terminal.side === 'left' ? bounds.x : bounds.x + bounds.width,
    y: bounds.y + tableHeaderHeight + columnIndex * tableColumnHeight + tableColumnHeight / 2,
  };
}

function createRelationshipEndpointOffsetMap(routeInputs: RelationshipRouteInput[]): Map<string, number> {
  const offsetByRelationshipRole = new Map<string, number>();
  const terminalGroups = new Map<
    string,
    Array<{
      oppositeY: number;
      relationshipId: string;
      role: 'source' | 'target';
    }>
  >();

  for (const routeInput of routeInputs) {
    const sourceKey = createRelationshipTerminalVisualKey(routeInput.sourceTerminal);
    const targetKey = createRelationshipTerminalVisualKey(routeInput.targetTerminal);

    terminalGroups.set(sourceKey, [
      ...(terminalGroups.get(sourceKey) ?? []),
      {
        oppositeY: routeInput.targetPoint.y,
        relationshipId: routeInput.relationship.id,
        role: 'source',
      },
    ]);
    terminalGroups.set(targetKey, [
      ...(terminalGroups.get(targetKey) ?? []),
      {
        oppositeY: routeInput.sourcePoint.y,
        relationshipId: routeInput.relationship.id,
        role: 'target',
      },
    ]);
  }

  for (const entries of terminalGroups.values()) {
    if (entries.length <= 1) {
      continue;
    }

    entries
      .sort(
        (a, b) =>
          a.oppositeY - b.oppositeY || a.relationshipId.localeCompare(b.relationshipId) || a.role.localeCompare(b.role),
      )
      .forEach((entry, index) => {
        // DrawSQL-like fan-in: relationship punya dock point tipis di sisi table agar marker tidak bertumpuk di satu pixel.
        offsetByRelationshipRole.set(
          createRelationshipEndpointOffsetKey(entry.relationshipId, entry.role),
          (index - (entries.length - 1) / 2) * relationshipEndpointGap,
        );
      });
  }

  return offsetByRelationshipRole;
}

function createRelationshipTerminalVisualKey(terminal: RelationshipTerminal): string {
  return [terminal.tableId, terminal.columnId, terminal.side].join(':');
}

function createRelationshipEndpointOffsetKey(relationshipId: string, role: 'source' | 'target'): string {
  return `${relationshipId}:${role}`;
}

function getRelationshipSpineX(
  sourceTerminal: RelationshipTerminal,
  targetTerminal: RelationshipTerminal,
  sourcePoint: RelationshipTerminalPoint,
  targetPoint: RelationshipTerminalPoint,
  laneOffset: number,
): number {
  if (shouldUseCenteredRelationshipSpine(sourceTerminal, targetTerminal, sourcePoint, targetPoint)) {
    // DrawSQL-like: jika dua table saling berhadapan dan ada ruang, siku utama jatuh di tengah gap table kiri/kanan.
    return snapRelationshipCoordinate((sourcePoint.x + targetPoint.x) / 2);
  }

  const uTurnSide = getRelationshipUTurnSide(sourceTerminal, targetTerminal);
  const direction = getRelationshipPortSideDirection(uTurnSide);
  const edgeX =
    uTurnSide === 'left'
      ? Math.min(sourcePoint.bounds.x, targetPoint.bounds.x)
      : Math.max(sourcePoint.bounds.x + sourcePoint.bounds.width, targetPoint.bounds.x + targetPoint.bounds.width);

  // Lane offset juga memisahkan trunk U-turn supaya beberapa relasi vertikal tidak memakai spine yang sama.
  return snapRelationshipCoordinate(edgeX + direction * (relationshipRouteUTurnGap + Math.abs(laneOffset)));
}

function shouldUseCenteredRelationshipSpine(
  sourceTerminal: RelationshipTerminal,
  targetTerminal: RelationshipTerminal,
  sourcePoint: RelationshipTerminalPoint,
  targetPoint: RelationshipTerminalPoint,
): boolean {
  const minimumClearGap = relationshipRouteFanLength * 2 + relationshipLaneGap * 2;

  return (
    (sourceTerminal.side === 'right' &&
      targetTerminal.side === 'left' &&
      targetPoint.x - sourcePoint.x >= minimumClearGap) ||
    (sourceTerminal.side === 'left' &&
      targetTerminal.side === 'right' &&
      sourcePoint.x - targetPoint.x >= minimumClearGap)
  );
}

function getRelationshipUTurnSide(
  sourceTerminal: RelationshipTerminal,
  targetTerminal: RelationshipTerminal,
): PortSide {
  if (sourceTerminal.side === targetTerminal.side) {
    return sourceTerminal.side;
  }

  // Saat table terlalu dekat/overlap, pilih sisi keluar source agar garis tidak dipaksa patah di area sempit antar table.
  return sourceTerminal.side;
}

function getRelationshipPortSideDirection(side: PortSide): -1 | 1 {
  return side === 'left' ? -1 : 1;
}

function snapRelationshipCoordinate(value: number): number {
  // Route final memakai step 3px supaya fan-in rapat tetap punya pemisahan halus; grid visual canvas tetap 12px.
  return Math.round(value / relationshipRouteStepSize) * relationshipRouteStepSize;
}

function dedupeRelationshipVertices(vertices: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  return vertices.filter((vertex, index) => {
    const previous = vertices[index - 1];

    return !previous || previous.x !== vertex.x || previous.y !== vertex.y;
  });
}

function createRelationshipHorizontalSegments(
  relationshipId: string,
  points: Array<{ x: number; y: number }>,
): RelationshipHorizontalSegment[] {
  return points.flatMap((point, index) => {
    const nextPoint = points[index + 1];

    if (!nextPoint || point.y !== nextPoint.y) {
      return [];
    }

    const x1 = Math.min(point.x, nextPoint.x);
    const x2 = Math.max(point.x, nextPoint.x);

    // Stub pendek dari port memang boleh berbagi titik; yang perlu dipisah adalah body horizontal panjang.
    if (x2 - x1 < relationshipRouteStubLength + relationshipLaneGap) {
      return [];
    }

    return [
      {
        relationshipId,
        x1,
        x2,
        y: point.y,
      },
    ];
  });
}

function createRelationshipLaneOffsetCandidates(): number[] {
  return Array.from({ length: relationshipLaneSearchRadius + 1 }).flatMap((_, index) => {
    if (index === 0) {
      return [0];
    }

    const offset = index * relationshipLaneGap;

    return [offset, -offset];
  });
}

function hasRelationshipHorizontalSegmentConflict(
  segments: RelationshipHorizontalSegment[],
  usedSegments: RelationshipHorizontalSegment[],
): boolean {
  return segments.some((segment) =>
    usedSegments.some(
      (usedSegment) =>
        Math.abs(segment.y - usedSegment.y) < relationshipLaneGap &&
        Math.min(segment.x2, usedSegment.x2) - Math.max(segment.x1, usedSegment.x1) > relationshipLaneGap,
    ),
  );
}

function createRelationshipEdgeMetadata(
  model: DiagramModel,
  plan: RelationshipPlan,
  relationships: DatabaseRelationship[] = Object.values(model.relationships),
): EdgeMetadata[] {
  return relationships.flatMap<EdgeMetadata>((relationship) => {
    const sourceTable = model.tables[relationship.sourceTableId];
    const targetTable = model.tables[relationship.targetTableId];
    const terminals = plan.terminalsByRelationship.get(relationship.id);
    const route = plan.routesByRelationship.get(relationship.id);

    if (!sourceTable || !targetTable || !terminals?.source || !terminals.target || !route) {
      return [];
    }

    const stroke = terminals.source.active ? relationshipActiveColor : relationshipNeutralColor;
    const strokeWidth = terminals.source.active ? 1.7 : 1.5;
    const { sourceMarker, targetMarker } = buildRelationshipMarkers(relationship.cardinality, stroke, strokeWidth);
    const sourcePoint = getRelationshipVisualEndpoint(
      route.sourcePoint,
      terminals.source,
      isRelationshipSourceMany(relationship.cardinality),
    );
    const targetPoint = getRelationshipVisualEndpoint(
      route.targetPoint,
      terminals.target,
      isRelationshipTargetMany(relationship.cardinality),
    );
    const markerAttrs = {
      // Markers are explicit on every render so the edge can move between 1:1 and 1:N without stale SVG marker state.
      sourceMarker: sourceMarker ?? null,
      targetMarker: targetMarker ?? null,
    };

    return [
      {
        id: relationship.id,
        attrs: {
          line: {
            ...markerAttrs,
            stroke,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeWidth,
          },
        },
        connector: {
          // Rounded tetap dipakai untuk belokan DrawSQL-like; endpoint Y sudah presisi sehingga tidak memaksa garis patah di dekat port.
          name: relationshipConnectorName,
          args: {
            minimumRoundedSegment: relationshipConnectorMinimumRoundedSegment,
            radius: relationshipConnectorRadius,
            straightEndpointVertices: relationshipConnectorStraightEndpointVertices,
          },
        },
        labels: [],
        router: {
          name: 'normal',
        },
        // Relationship yang sudah tersimpan memakai endpoint visual hasil routing, bukan port X6 mentah, agar marker bisa fan-in tanpa bertumpuk.
        source: sourcePoint,
        target: targetPoint,
        vertices: route.vertices,
        zIndex: terminals.source.active ? 1 : 0,
      },
    ];
  });
}

function isRelationshipSourceMany(cardinality: DatabaseRelationship['cardinality']): boolean {
  return cardinality === 'many_to_many';
}

function isRelationshipTargetMany(cardinality: DatabaseRelationship['cardinality']): boolean {
  return cardinality === 'one_to_many' || cardinality === 'many_to_many';
}

function getRelationshipVisualEndpoint(
  point: RelationshipRoute['sourcePoint'],
  terminal: RelationshipTerminal,
  isMany: boolean,
): RelationshipRoute['sourcePoint'] {
  if (!isMany) {
    return point;
  }

  const direction = getRelationshipPortSideDirection(terminal.side);

  return {
    // Crow-foot marker X6 dicenter pada endpoint; endpoint many dimajukan keluar agar marker tidak masuk ke area table.
    x: point.x + direction * relationshipManyMarkerOutset,
    y: point.y,
  };
}

function createRelationshipPlan(
  model: DiagramModel,
  selectedTableId: string | null,
  selectedRelationshipId: string | null,
  relationships: DatabaseRelationship[] = Object.values(model.relationships),
): RelationshipPlan {
  const terminalsByRelationship = new Map<string, { source?: RelationshipTerminal; target?: RelationshipTerminal }>();
  const terminalsByTable = new Map<string, RelationshipTerminal[]>();
  const tableGeometryById = createRelationshipTableGeometry(model, relationships);

  for (const relationship of relationships) {
    const sourceTable = model.tables[relationship.sourceTableId];
    const targetTable = model.tables[relationship.targetTableId];
    const sourceGeometry = tableGeometryById.get(relationship.sourceTableId);
    const targetGeometry = tableGeometryById.get(relationship.targetTableId);
    const [columnPair] = getRelationshipColumnPairs(relationship);

    if (!sourceTable || !targetTable || !sourceGeometry || !targetGeometry || !columnPair) {
      continue;
    }

    const dx = Math.abs(targetGeometry.centerX - sourceGeometry.centerX);
    const dy = Math.abs(targetGeometry.centerY - sourceGeometry.centerY);

    let sourceSide: PortSide;
    let targetSide: PortSide;

    if (dy > dx * 1.5) {
      // Vertikal dominance: pakai sisi yang sama — prioritas kiri untuk alignment rapi
      if (sourceGeometry.centerX <= targetGeometry.centerX) {
        sourceSide = 'left';
        targetSide = 'left';
      } else {
        sourceSide = 'right';
        targetSide = 'right';
      }
    } else {
      // Horizontal dominance: logika asli (berhadapan)
      const sourceIsLeft = sourceGeometry.centerX <= targetGeometry.centerX;
      sourceSide = sourceIsLeft ? 'right' : 'left';
      targetSide = sourceIsLeft ? 'left' : 'right';
    }

    const active =
      selectedRelationshipId === relationship.id ||
      selectedTableId === relationship.sourceTableId ||
      selectedTableId === relationship.targetTableId;
    const sourceTerminal = createTerminalBase({
      active,
      columnId: columnPair.sourceColumnId,
      relationshipId: relationship.id,
      role: 'primary',
      side: sourceSide,
      tableId: relationship.sourceTableId,
    });
    const targetTerminal = createTerminalBase({
      active,
      columnId: columnPair.targetColumnId,
      relationshipId: relationship.id,
      role: 'foreign',
      side: targetSide,
      tableId: relationship.targetTableId,
    });

    terminalsByRelationship.set(relationship.id, {
      source: sourceTerminal,
      target: targetTerminal,
    });
    terminalsByTable.set(sourceTerminal.tableId, [
      ...(terminalsByTable.get(sourceTerminal.tableId) ?? []),
      sourceTerminal,
    ]);
    terminalsByTable.set(targetTerminal.tableId, [
      ...(terminalsByTable.get(targetTerminal.tableId) ?? []),
      targetTerminal,
    ]);
  }

  const routesByRelationship = createRelationshipRouteMap(model, relationships, terminalsByRelationship);

  return { routesByRelationship, terminalsByRelationship, terminalsByTable };
}

function createRelationshipTableGeometry(
  model: DiagramModel,
  relationships?: DatabaseRelationship[],
): Map<string, RelationshipTableGeometry> {
  const geometryById = new Map<string, RelationshipTableGeometry>();
  const tables = relationships
    ? Array.from(
        new Set(relationships.flatMap((relationship) => [relationship.sourceTableId, relationship.targetTableId])),
      )
        .map((tableId) => model.tables[tableId])
        .filter((table): table is DatabaseTable => Boolean(table))
    : Object.values(model.tables);

  for (const table of tables) {
    geometryById.set(table.id, {
      centerX: table.position.x + getTableWidth(table) / 2,
      centerY: table.position.y + getTableNodeHeight(model, table) / 2,
    });
  }

  return geometryById;
}

function createTerminalBase(options: {
  active: boolean;
  columnId: string;
  relationshipId: string;
  role: RelationshipTerminal['role'];
  side: PortSide;
  tableId: string;
}): RelationshipTerminal {
  return {
    ...options,
    // Port id stabil per column membuat banyak garis di column yang sama menyatu pada satu titik, seperti DrawSQL.
    portId: createColumnPortId(options.tableId, options.columnId, options.side),
  };
}

function createColumnPorts(
  table: DatabaseTable,
  visibleColumns: DatabaseColumn[],
  terminals: RelationshipTerminal[],
  readOnly: boolean,
  selected: boolean,
): NodeMetadata['ports'] {
  const portSides: PortSide[] = ['left', 'right'];
  const terminalSlots = createRelationshipTerminalSlotMap(terminals);
  const width = getTableWidth(table);

  return {
    groups: {
      absolute: {
        markup: [{ selector: 'portBody', tagName: 'circle' }],
        position: 'absolute',
      },
    },
    items: visibleColumns.flatMap((column, columnIndex) =>
      portSides.map((side) => {
        const y = tableHeaderHeight + columnIndex * tableColumnHeight + tableColumnHeight / 2;
        const terminalSlot = terminalSlots.get(createRelationshipTerminalSlotKey(column.id, side));

        const isVisible = selected || Boolean(terminalSlot?.active);
        const color = terminalSlot?.active ? relationshipActiveColor : '#5865f2';

        return {
          args: {
            x: side === 'left' ? 0 : width,
            y,
          },
          attrs: {
            portBody: {
              cursor: readOnly ? 'default' : 'crosshair',
              fill: isVisible ? color : 'transparent',
              magnet: !readOnly,
              opacity: isVisible ? 1 : 0,
              r: relationshipPortRadius,
              stroke: isVisible ? color : 'transparent',
              strokeWidth: isVisible ? 1.5 : 0,
            },
          },
          group: 'absolute',
          id: createColumnPortId(table.id, column.id, side),
          zIndex: 10,
        };
      }),
    ),
  };
}

function createColumnPortSignature(
  table: DatabaseTable,
  visibleColumns: DatabaseColumn[],
  terminals: RelationshipTerminal[],
  readOnly: boolean,
  selected: boolean,
): string {
  const terminalSignature = terminals
    .map((terminal) =>
      [
        terminal.columnId,
        terminal.side,
        terminal.active ? 'active' : 'idle',
        terminal.role,
        terminal.relationshipId,
      ].join(':'),
    )
    .sort()
    .join('|');

  return [
    getTableWidth(table),
    readOnly ? 'readonly' : 'editable',
    selected ? 'selected' : 'idle',
    visibleColumns.map((column) => column.id).join(','),
    terminalSignature,
  ].join('::');
}

function createRelationshipTerminalSlotMap(terminals: RelationshipTerminal[]): Map<string, RelationshipTerminalSlot> {
  const slots = new Map<string, RelationshipTerminalSlot>();

  for (const terminal of terminals) {
    const key = createRelationshipTerminalSlotKey(terminal.columnId, terminal.side);
    const currentSlot = slots.get(key);

    slots.set(key, {
      active: Boolean(currentSlot?.active || terminal.active),
      related: true,
    });
  }

  return slots;
}

function createRelationshipTerminalSlotKey(columnId: string, side: PortSide): string {
  return `${columnId}:${side}`;
}

function createColumnPortId(tableId: string, columnId: string, side: PortSide): string {
  return `column-port:${tableId}:${columnId}:${side}`;
}

function parseColumnPortId(portId: string | null | undefined): ParsedColumnPortId | null {
  const parts = portId?.split(':') ?? [];
  const side = parts[3];

  if (parts.length !== 4 || parts[0] !== 'column-port' || (side !== 'left' && side !== 'right')) {
    return null;
  }

  return {
    columnId: parts[2],
    side,
    tableId: parts[1],
  };
}

function createRelationshipCommandFromPorts(
  model: DiagramModel,
  sourcePort: ParsedColumnPortId,
  targetPort: ParsedColumnPortId,
) {
  const sourceColumn = model.columns[sourcePort.columnId];
  const targetColumn = model.columns[targetPort.columnId];

  if (!sourceColumn || !targetColumn) {
    return null;
  }

  const targetLooksPrimary = targetColumn.primaryKey && !sourceColumn.primaryKey;
  const primaryPort = targetLooksPrimary ? targetPort : sourcePort;
  const foreignPort = targetLooksPrimary ? sourcePort : targetPort;
  const duplicate = Object.values(model.relationships).some(
    (relationship) =>
      relationship.sourceTableId === primaryPort.tableId &&
      relationship.targetTableId === foreignPort.tableId &&
      relationship.sourceColumnIds[0] === primaryPort.columnId &&
      relationship.targetColumnIds[0] === foreignPort.columnId,
  );

  if (duplicate) {
    return null;
  }

  return {
    // New drag-created relationships start as 1:1 so the visual result is a plain line first.
    // The quick editor opens immediately after creation for choosing 1:N or N:1 when needed.
    cardinality: 'one_to_one' as const,
    relationshipId: createDiagramEntityId('relationship'),
    sourceColumnIds: [primaryPort.columnId],
    sourceTableId: primaryPort.tableId,
    targetColumnIds: [foreignPort.columnId],
    targetTableId: foreignPort.tableId,
    type: 'relationship.create' as const,
  };
}

function refreshTableMovePreview(
  graph: Graph,
  model: DiagramModel,
  tableId: string,
  position: DatabaseTable['position'],
  selectedTableId: string | null,
  selectedRelationshipId: string | null,
): void {
  const table = model.tables[tableId];

  if (!table) {
    return;
  }

  refreshTablesMovePreview(graph, model, { [tableId]: position }, selectedTableId, selectedRelationshipId);
}

function refreshTablesMovePreview(
  graph: Graph,
  model: DiagramModel,
  tablePositions: Record<string, DatabaseTable['position']>,
  selectedTableId: string | null,
  selectedRelationshipId: string | null,
): void {
  const tableIds = Object.keys(tablePositions).filter((tableId) => model.tables[tableId]);

  if (tableIds.length === 0) {
    return;
  }

  const previewModel = {
    ...model,
    tables: Object.fromEntries(
      Object.entries(model.tables).map(([currentTableId, currentTable]) => [
        currentTableId,
        tablePositions[currentTableId] ? { ...currentTable, position: tablePositions[currentTableId] } : currentTable,
      ]),
    ),
  };
  const movedTableIds = new Set(tableIds);
  const affectedRelationships = Object.values(previewModel.relationships).filter(
    (relationship) => movedTableIds.has(relationship.sourceTableId) || movedTableIds.has(relationship.targetTableId),
  );

  if (affectedRelationships.length === 0) {
    return;
  }

  const relationshipPlan = createRelationshipPlan(previewModel, selectedTableId, selectedRelationshipId);

  graph.batchUpdate('tabliodb-move-preview', () => {
    for (const edgeMetadata of createRelationshipEdgeMetadata(previewModel, relationshipPlan, affectedRelationships)) {
      // Drag preview memakai route generator yang sama dengan model final agar garis tidak membentuk path sementara yang patah.
      syncRelationshipEdge(graph, edgeMetadata);
    }
  });
}

function refreshTableResizePreview(
  graph: Graph,
  model: DiagramModel,
  tableId: string,
  width: number,
  position: DatabaseTable['position'],
  selectedTableId: string | null,
  selectedRelationshipId: string | null,
  readOnly: boolean,
): void {
  const table = model.tables[tableId];
  const node = graph.getCellById(tableId) as X6Node | null | undefined;

  if (!table || !node?.isNode()) {
    return;
  }

  const previewTable = {
    ...table,
    position,
    width,
  };
  const previewModel = {
    ...model,
    tables: {
      ...model.tables,
      [tableId]: previewTable,
    },
  };
  const affectedRelationships = Object.values(previewModel.relationships).filter(
    (relationship) => relationship.sourceTableId === tableId || relationship.targetTableId === tableId,
  );
  const relationshipPlan = createRelationshipPlan(previewModel, selectedTableId, selectedRelationshipId);
  const visibleColumns = getVisibleTableColumns(previewModel, previewTable);

  graph.batchUpdate('tabliodb-resize-preview', () => {
    node.setProp(
      'ports',
      createColumnPorts(
        previewTable,
        visibleColumns,
        relationshipPlan.terminalsByTable.get(tableId) ?? [],
        readOnly,
        tableId === selectedTableId,
      ),
    );

    for (const edgeMetadata of createRelationshipEdgeMetadata(previewModel, relationshipPlan, affectedRelationships)) {
      // Reapplying affected edge metadata forces X6 to recalculate endpoints against the live resized port positions.
      syncRelationshipEdge(graph, edgeMetadata);
    }
  });
}

function getTableWidth(table: DatabaseTable): number {
  return Math.max(table.width, tableResizeMinWidth);
}

function getNoteWidth(note: DiagramNote): number {
  return Math.max(note.width ?? noteNodeDefaultWidth, 180);
}

function getNoteNodeHeight(note: DiagramNote): number {
  const width = getNoteWidth(note);
  const charactersPerLine = Math.max(24, Math.floor((width - 32) / 7));
  const lineCount = note.text
    .split('\n')
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0);

  return Math.min(noteNodeMaxHeight, Math.max(noteNodeMinHeight, 48 + lineCount * 19));
}

function getGroupNodeId(groupId: string): string {
  return `${groupNodeIdPrefix}${groupId}`;
}

function getRenderedGroupBounds(model: DiagramModel, group: DiagramGroup): CanvasRect {
  const memberRects = group.tableIds.flatMap<CanvasRect>((tableId) => {
    const table = model.tables[tableId];

    if (!table) {
      return [];
    }

    return [
      {
        height: getTableNodeHeight(model, table),
        width: getTableWidth(table),
        x: table.position.x,
        y: table.position.y,
      },
    ];
  });

  if (memberRects.length === 0) {
    return {
      height: group.height,
      width: group.width,
      x: group.position.x,
      y: group.position.y,
    };
  }

  const contentBounds = getCanvasContentBounds(memberRects);

  return {
    height: contentBounds.height + groupHeaderOffset + groupPaddingBottom,
    width: contentBounds.width + groupPaddingX * 2,
    x: contentBounds.x - groupPaddingX,
    y: contentBounds.y - groupHeaderOffset,
  };
}

function getTableNodeHeight(model: DiagramModel, table: DatabaseTable): number {
  const columns = getVisibleTableColumns(model, table);

  return tableHeaderHeight + columns.length * tableColumnHeight + (columns.length > 0 ? tablePaddingBottom : 0);
}

function getEffectiveTableDisplayMode(table: DatabaseTable): TableDisplayMode {
  if (table.collapsed || table.displayMode === 'header_only') {
    return 'header_only';
  }

  return table.displayMode ?? 'all_columns';
}

function getVisibleTableColumns(model: DiagramModel, table: DatabaseTable): DatabaseColumn[] {
  const columns = getTableColumns(model, table.id);
  const displayMode = getEffectiveTableDisplayMode(table);

  if (displayMode === 'header_only') {
    return [];
  }

  if (displayMode === 'pk_fk_only') {
    const relationshipColumnIds = getRelationshipColumnIdsForTable(model, table.id);

    return columns.filter((column) => column.primaryKey || relationshipColumnIds.has(column.id));
  }

  return columns;
}

function getRelationshipColumnIdsForTable(model: DiagramModel, tableId: string): Set<string> {
  const columnIds = new Set<string>();

  for (const relationship of Object.values(model.relationships)) {
    if (relationship.sourceTableId === tableId) {
      relationship.sourceColumnIds.forEach((columnId) => columnIds.add(columnId));
    }

    if (relationship.targetTableId === tableId) {
      relationship.targetColumnIds.forEach((columnId) => columnIds.add(columnId));
    }
  }

  return columnIds;
}

function isTableNodeData(data: unknown): data is TableNodeData {
  return Boolean(data && typeof data === 'object' && 'kind' in data && data.kind === 'table');
}

function isNoteNodeData(data: unknown): data is NoteNodeData {
  return Boolean(data && typeof data === 'object' && 'kind' in data && data.kind === 'note');
}

function isGroupNodeData(data: unknown): data is GroupNodeData {
  return Boolean(data && typeof data === 'object' && 'kind' in data && data.kind === 'group');
}

function isMovableCanvasNodeData(data: unknown): data is TableNodeData | NoteNodeData {
  return isTableNodeData(data) || isNoteNodeData(data);
}

function getElementFromEventTarget(target: EventTarget | null): Element | null {
  if (target instanceof Element) {
    return target;
  }

  // X6 HTML nodes hidup di dalam foreignObject; kadang target click adalah text node, bukan Element.
  if (target instanceof Node && target.parentElement instanceof Element) {
    return target.parentElement;
  }

  return null;
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  const element = target instanceof Element ? target : null;

  return Boolean(element?.closest('input, textarea, select, [contenteditable="true"], [data-lexical-editor="true"]'));
}

function areGroupNodeDataEqual(current: GroupNodeData | undefined, next: GroupNodeData): boolean {
  return Boolean(
    current &&
    current.color === next.color &&
    current.groupId === next.groupId &&
    current.groupName === next.groupName &&
    current.kind === next.kind &&
    current.tableCount === next.tableCount,
  );
}

function hexToRgba(hexColor: string, opacity: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hexColor);

  if (!match) {
    return hexColor;
  }

  const value = Number.parseInt(match[1], 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampTableNodeWidth(value: number): number {
  return clamp(Math.round(value), tableResizeMinWidth, tableResizeMaxWidth);
}

function createMultiTableMoveDragState(
  model: DiagramModel,
  tableIds: string[],
  activeTableId: string,
): MultiTableMoveDragState | null {
  const existingTableIds = Array.from(new Set(tableIds)).filter((tableId) => model.tables[tableId]);

  if (!existingTableIds.includes(activeTableId)) {
    return null;
  }

  const startPositions = Object.fromEntries(
    existingTableIds.map((tableId) => {
      const table = model.tables[tableId];

      return [tableId, { ...table.position }];
    }),
  );

  return {
    activeTableId,
    latestPositions: { ...startPositions },
    startPositions,
    tableIds: existingTableIds,
  };
}

function createRectFromPoints(startPoint: PointLike, endPoint: PointLike): CanvasRect {
  const left = Math.min(startPoint.x, endPoint.x);
  const top = Math.min(startPoint.y, endPoint.y);

  return {
    height: Math.abs(endPoint.y - startPoint.y),
    width: Math.abs(endPoint.x - startPoint.x),
    x: left,
    y: top,
  };
}

function getGroupAtLocalPoint(model: DiagramModel, point: PointLike): DiagramGroup | null {
  const candidates = Object.values(model.groups)
    .map((group) => ({
      area: 0,
      bounds: getRenderedGroupBounds(model, group),
      group,
    }))
    .filter(({ bounds }) => {
      return (
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height
      );
    })
    .map((candidate) => ({
      ...candidate,
      area: candidate.bounds.width * candidate.bounds.height,
    }))
    .sort((first, second) => first.area - second.area);

  return candidates[0]?.group ?? null;
}

function createScreenSelectionRect(
  containerRect: DOMRect,
  startClientX: number,
  startClientY: number,
  endClientX: number,
  endClientY: number,
): CanvasRect {
  const rawLeft = Math.min(startClientX, endClientX) - containerRect.left;
  const rawTop = Math.min(startClientY, endClientY) - containerRect.top;
  const rawRight = Math.max(startClientX, endClientX) - containerRect.left;
  const rawBottom = Math.max(startClientY, endClientY) - containerRect.top;
  const left = clamp(rawLeft, 0, containerRect.width);
  const top = clamp(rawTop, 0, containerRect.height);
  const right = clamp(rawRight, 0, containerRect.width);
  const bottom = clamp(rawBottom, 0, containerRect.height);

  return {
    height: Math.max(1, bottom - top),
    width: Math.max(1, right - left),
    x: left,
    y: top,
  };
}

function getTableIdsInLocalSelection(model: DiagramModel, selectionRect: CanvasRect): string[] {
  return Object.values(model.tables)
    .filter((table) => doCanvasRectsIntersect(selectionRect, getTableCanvasRect(model, table)))
    .map((table) => table.id);
}

function getTableCanvasRect(model: DiagramModel, table: DatabaseTable): CanvasRect {
  return {
    height: getTableNodeHeight(model, table),
    width: getTableWidth(table),
    x: table.position.x,
    y: table.position.y,
  };
}

function doCanvasRectsIntersect(first: CanvasRect, second: CanvasRect): boolean {
  return (
    first.x <= second.x + second.width &&
    first.x + first.width >= second.x &&
    first.y <= second.y + second.height &&
    first.y + first.height >= second.y
  );
}

function areTableSelectionIdsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const rightIds = new Set(right);

  return left.every((tableId) => rightIds.has(tableId));
}

function getGraphScale(graph: Graph): number {
  const zoom = graph.zoom();

  return typeof zoom === 'number' && Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

function isTableNodeDataEqual(current: TableNodeData | undefined, next: TableNodeData): boolean {
  if (!current) {
    return false;
  }

  return (
    current.color === next.color &&
    current.columnCountLabel === next.columnCountLabel &&
    current.displayMode === next.displayMode &&
    current.portSignature === next.portSignature &&
    current.readOnly === next.readOnly &&
    current.selectedColumnId === next.selectedColumnId &&
    current.multiSelected === next.multiSelected &&
    current.selected === next.selected &&
    current.tableId === next.tableId &&
    current.tableName === next.tableName &&
    current.commentMarker.open === next.commentMarker.open &&
    current.commentMarker.total === next.commentMarker.total &&
    current.columns.length === next.columns.length &&
    current.columns.every((column, index) => {
      const nextColumn = next.columns[index];
      const currentColumnMarker = current.columnCommentMarkers[column.id] ?? { open: 0, total: 0 };
      const nextColumnMarker = next.columnCommentMarkers[nextColumn.id] ?? { open: 0, total: 0 };

      return (
        column.id === nextColumn.id &&
        column.name === nextColumn.name &&
        formatColumnType(column.type) === formatColumnType(nextColumn.type) &&
        column.nullable === nextColumn.nullable &&
        column.primaryKey === nextColumn.primaryKey &&
        column.unique === nextColumn.unique &&
        currentColumnMarker.open === nextColumnMarker.open &&
        currentColumnMarker.total === nextColumnMarker.total
      );
    })
  );
}

function areNoteNodeDataEqual(current: NoteNodeData | undefined, next: NoteNodeData): boolean {
  return Boolean(
    current &&
    current.color === next.color &&
    current.commentMarker.open === next.commentMarker.open &&
    current.commentMarker.total === next.commentMarker.total &&
    current.kind === next.kind &&
    current.noteId === next.noteId &&
    current.readOnly === next.readOnly &&
    current.text === next.text,
  );
}

function fitGraphContent(graph: Graph): void {
  graph.zoomToFit({
    maxScale: 1,
    padding: 80,
  });
  graph.centerContent();
}

function getRelationshipEndpointLabel(
  model: DiagramModel,
  relationship: DatabaseRelationship,
  role: 'source' | 'target',
): string {
  const tableId = role === 'source' ? relationship.sourceTableId : relationship.targetTableId;
  const columnIds = role === 'source' ? relationship.sourceColumnIds : relationship.targetColumnIds;
  const table = model.tables[tableId];
  const columns = columnIds.map((columnId) => model.columns[columnId]?.name ?? columnId).join(', ');

  return `${table?.name ?? tableId}.${columns || '?'}`;
}

function renderNoteNode(data: NoteNodeData): string {
  const commentMarker = renderCommentMarker(data.commentMarker, 'note', 'note', data.noteId);
  const deleteButton = data.readOnly
    ? ''
    : '<button aria-label="Delete note" class="tabliodb-note-node__action" data-note-action="delete" type="button">x</button>';

  return `
    <article class="tabliodb-note-node" data-tabliodb-note-id="${escapeHtml(data.noteId)}" style="--note-accent: ${escapeHtml(data.color)}">
      <header class="tabliodb-note-node__header">
        <span class="tabliodb-note-node__title">Note</span>
        <span class="tabliodb-note-node__actions">
          ${commentMarker}
          <button aria-label="Discuss note" class="tabliodb-note-node__action" data-note-action="comment" type="button">+</button>
          ${deleteButton}
        </span>
      </header>
      <textarea class="tabliodb-note-node__textarea" ${data.readOnly ? 'readonly' : ''} spellcheck="true">${escapeHtml(data.text)}</textarea>
    </article>
  `;
}

function renderTableNode(data: TableNodeData): string {
  const rows = data.columns
    .map((column) => renderColumnRow(column, data.columnCommentMarkers[column.id], data.selectedColumnId === column.id))
    .join('');
  const commentMarker = renderCommentMarker(data.commentMarker, `table ${data.tableName}`, 'table', data.tableId);
  const displayClass = data.columns.length === 0 ? 'is-collapsed' : '';
  const resizeHandle =
    data.readOnly || !data.selected || data.multiSelected
      ? ''
      : [
          '<button aria-label="Resize table from left" class="tabliodb-table-node__resize-zone tabliodb-table-node__resize-zone--left" data-resize-side="left" type="button"></button>',
          '<button aria-label="Resize table from right" class="tabliodb-table-node__resize-zone tabliodb-table-node__resize-zone--right" data-resize-side="right" type="button"></button>',
        ].join('');
  const selectionClass = [data.selected ? 'is-selected' : '', data.multiSelected ? 'is-multi-selected' : '']
    .filter(Boolean)
    .join(' ');

  return `
    <div class="tabliodb-table-node ${selectionClass} ${displayClass}" data-tabliodb-table-id="${escapeHtml(data.tableId)}" style="--table-accent: ${escapeHtml(data.color)}">
      <div class="tabliodb-table-node__header">
        <span class="tabliodb-table-node__status"></span>
        <span class="tabliodb-table-node__name">${escapeHtml(data.tableName)}</span>
        <span class="tabliodb-table-node__header-meta">
          ${commentMarker}
          <span class="tabliodb-table-node__count">${escapeHtml(data.columnCountLabel)}</span>
        </span>
      </div>
      <div class="tabliodb-table-node__columns">${rows}</div>
      ${resizeHandle}
    </div>
  `;
}

const keyRoundSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-key-round-icon lucide-key-round"><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></svg>`.trim();
const SnowFlakeSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-snowflake-icon lucide-snowflake"><path d="m10 20-1.25-2.5L6 18"/><path d="M10 4 8.75 6.5 6 6"/><path d="m14 20 1.25-2.5L18 18"/><path d="m14 4 1.25 2.5L18 6"/><path d="m17 21-3-6h-4"/><path d="m17 3-3 6 1.5 3"/><path d="M2 12h6.5L10 9"/><path d="m20 10-1.5 2 1.5 2"/><path d="M22 12h-6.5L14 15"/><path d="m4 10 1.5 2L4 14"/><path d="m7 21 3-6-1.5-3"/><path d="m7 3 3 6h4"/></svg>`.trim();

function renderColumnRow(
  column: DatabaseColumn,
  commentMarkerCount: CommentMarkerCount | undefined,
  selected: boolean,
): string {
  const commentMarker = renderCommentMarker(commentMarkerCount, `column ${column.name}`, 'column', column.id);
  const badges = [
    column.primaryKey ? `<span class="tabliodb-table-node__badge">${keyRoundSvg}</span>` : '',
    column.unique ? `<span class="tabliodb-table-node__badge">${SnowFlakeSvg}</span>` : '',
  ].join('');

  return `
    <div class="tabliodb-table-node__column ${selected ? 'is-selected' : ''}" data-tabliodb-column-id="${escapeHtml(column.id)}">
      <span class="tabliodb-table-node__column-name ${column.primaryKey ? 'font-extrabold! text-black!' : ''}">${escapeHtml(column.name)}</span>
      <span class="tabliodb-table-node__column-type">${escapeHtml(formatColumnType(column.type))}${column.nullable ? '<span class="font-extrabold!">?</span>' : ''}</span>
      <span class="tabliodb-table-node__badges">${commentMarker}${badges}</span>
    </div>
  `;
}

function renderCommentMarker(
  count: CommentMarkerCount | undefined,
  label: string,
  targetType: CommentTargetType,
  targetId: string,
): string {
  if (!count || !hasOpenCommentMarkers(count)) {
    return '';
  }

  return `<button aria-label="${escapeHtml(formatCommentMarkerTitle(count, label))}" class="tabliodb-table-node__comment-marker" data-comment-target-id="${escapeHtml(targetId)}" data-comment-target-type="${escapeHtml(targetType)}" type="button">${escapeHtml(formatCommentMarkerCount(count))}</button>`;
}

function isCanvasCommentTargetType(value: string | undefined): value is CommentTargetType {
  return (
    value === 'diagram' ||
    value === 'table' ||
    value === 'column' ||
    value === 'relationship' ||
    value === 'index' ||
    value === 'enum' ||
    value === 'check' ||
    value === 'note' ||
    value === 'group'
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
