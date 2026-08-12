import {
  Graph,
  Shape,
  type Cell,
  type Edge as X6Edge,
  type EdgeMetadata,
  type Node as X6Node,
  type NodeMetadata,
} from '@antv/x6';
import {
  applyDiagramCommand,
  defaultTableMinWidth,
  getRelationshipColumnPairs,
  getTableColumns,
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
  cn,
} from '@tabliodb/ui';
import type { CommentTargetType, CommentThreadTargetSummaryDto } from '@/resources/comments';
import type { AwarenessState } from '@tabliodb/shared';
import {
  useEffect,
  useRef,
  useState,
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
import { formatColumnType } from '../diagram-model';
import { getDisplayTableColor } from '../table-colors';

const tableNodeShape = 'tabliodb-table';
const noteNodeShape = 'tabliodb-note';
const groupNodeIdPrefix = 'tabliodb-group:';

const diagramRouterStepSize = 6; // Setengah dari visual grid agar garis bisa di "antar dot"
const tableNodeWidth = 288; // Default width saat table baru dibuat, bukan batas terkecil saat user resize.
const tableHeaderHeight = 36; // Header dan CSS sama-sama 3 grid unit agar node HTML tidak terpotong di X6.
const tableColumnHeight = 24; // Port dihitung dari tinggi row ini, jadi konektor jatuh tepat di tengah baris kolom.
const tablePaddingBottom = 12; // Padding bawah 1 grid unit menjaga row terakhir tidak mepet radius kartu saat kolom bertambah.
const groupPaddingX = 36; // Group mengikuti grid 12px supaya outline module tetap sejajar dengan table di canvas.
const groupPaddingBottom = 24; // Ruang bawah module dibuat dua grid unit agar table terakhir tidak terasa menempel.
const groupHeaderOffset = 48; // Header module memakai offset empat grid unit agar judul tidak bertabrakan dengan table pertama.
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
const relationshipConnectorRadius = 10;
const relationshipNeutralColor = '#A0A0A0';
const relationshipPortRadius = 4;

const relationshipObstaclePadding = 12;
const minimapAspectRatio = 192 / 124;

let noteShapeRegistered = false;
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
  selectedTableId: string | null;
  selectedColumnId?: string | null;
  onModelChange: (model: DiagramModel) => void;
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

type RemoteCanvasCursorPosition = RemoteCanvasCursor & {
  left: number;
  top: number;
};

type RelationshipMenuState = {
  left: number;
  relationshipId: string;
  top: number;
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
  model,
  onCommentTargetOpen,
  onColumnSelect,
  onLocalCursorChange,
  onModelChange,
  onSelectedTableChange,
  onViewportChange,
  readOnly = false,
  remoteCursors = [],
  selectedColumnId = null,
  selectedTableId,
  toolbar,
  toolbarOffsetLeft = '1rem',
  minimapOffsetRight = '1rem',
}: SchemaCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const fitKeyRef = useRef<string | null>(null);
  const floatingInsetLeftRef = useRef(floatingInsetLeft);
  const floatingInsetRightRef = useRef(floatingInsetRight);
  const modelRef = useRef(model);
  const selectedTableIdRef = useRef(selectedTableId);
  const selectedRelationshipIdRef = useRef<string | null>(null);
  const resizingTableIdRef = useRef<string | null>(null);
  const minimapStaticStateRef = useRef<CanvasMinimapStaticState | null>(null);
  const localCursorFrameRef = useRef(0);
  const pendingLocalCursorRef = useRef<AwarenessState['cursor'] | undefined>(undefined);
  const lastPublishedLocalCursorRef = useRef<AwarenessState['cursor'] | undefined>(undefined);
  const onLocalCursorChangeRef = useRef(onLocalCursorChange);
  const onCommentTargetOpenRef = useRef(onCommentTargetOpen);
  const onColumnSelectRef = useRef(onColumnSelect);
  const onModelChangeRef = useRef(onModelChange);
  const onSelectedTableChangeRef = useRef(onSelectedTableChange);
  const onViewportChangeRef = useRef(onViewportChange);
  const remoteCursorsRef = useRef(remoteCursors);
  const [relationshipMenu, setRelationshipMenu] = useState<RelationshipMenuState | null>(null);
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
    minimapStaticStateRef.current = createCanvasMinimapStaticState(model, selectedTableId);
  }, [model, selectedTableId]);

  useEffect(() => {
    // Graph X6 tidak diremount saat sidebar dibuka-tutup, jadi quick editor relationship membaca safe-area terbaru lewat ref.
    floatingInsetLeftRef.current = floatingInsetLeft;
    floatingInsetRightRef.current = floatingInsetRight;
  }, [floatingInsetLeft, floatingInsetRight]);

  useEffect(() => {
    selectedTableIdRef.current = selectedTableId;
  }, [selectedTableId]);

  useEffect(() => {
    selectedRelationshipIdRef.current = relationshipMenu?.relationshipId ?? null;
  }, [relationshipMenu?.relationshipId]);

  useEffect(() => {
    onModelChangeRef.current = onModelChange;
  }, [onModelChange]);

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
    onSelectedTableChangeRef.current = onSelectedTableChange;
  }, [onSelectedTableChange]);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  useEffect(() => {
    remoteCursorsRef.current = remoteCursors;
  }, [remoteCursors]);

  useEffect(() => {
    if (relationshipMenu && !model.relationships[relationshipMenu.relationshipId]) {
      // Popup relationship ikut ditutup saat relationship dihapus dari model agar UI tidak menunjuk edge stale.
      setRelationshipMenu(null);
    }
  }, [model.relationships, relationshipMenu]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    registerTableNodeShape();
    registerNoteNodeShape();
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
        connector: { name: 'rounded', args: { radius: relationshipConnectorRadius } },
        connectionPoint: 'boundary',
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
      const data = node.getData<TableNodeData | NoteNodeData>();
      setRelationshipMenu(null);

      if (isNoteNodeData(data) && handleNoteActionEvent(e as unknown as MouseEvent, data.noteId)) {
        return;
      }

      if (isTableNodeData(data)) {
        onSelectedTableChangeRef.current(data.tableId);
        return;
      }

      if (isNoteNodeData(data)) {
        onSelectedTableChangeRef.current(null);
      }
    });

    graph.on('blank:click', () => {
      setRelationshipMenu(null);
      onSelectedTableChangeRef.current(null);
    });

    graph.on('edge:click', ({ edge, e }) => {
      const relationship = modelRef.current.relationships[edge.id];

      if (!relationship) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const event = e as unknown as MouseEvent;
      const menuWidth = 330;
      const menuHeight = 128;
      const safeMinLeft = Math.min(
        floatingInsetLeftRef.current + 12,
        Math.max(12, containerRect.width - menuWidth - 12),
      );
      const safeMaxLeft = Math.max(safeMinLeft, containerRect.width - floatingInsetRightRef.current - menuWidth - 12);

      setRelationshipMenu({
        left: clamp(event.clientX - containerRect.left - menuWidth / 2, safeMinLeft, safeMaxLeft),
        relationshipId: relationship.id,
        top: clamp(event.clientY - containerRect.top - menuHeight / 2, 12, containerRect.height - menuHeight - 12),
      });
    });

    graph.on('edge:connected', ({ edge, isNew }) => {
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

      onModelChangeRef.current(applyDiagramCommand(modelRef.current, nextRelationshipCommand));
      onSelectedTableChangeRef.current(nextRelationshipCommand.targetTableId);
      onColumnSelectRef.current?.(nextRelationshipCommand.targetColumnIds[0]);
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

      // Klik row column di canvas memilih table sekaligus column supaya sidebar kiri langsung menunjuk field yang sama.
      event.preventDefault();
      setRelationshipMenu(null);
      onSelectedTableChangeRef.current(tableId);
      onColumnSelectRef.current?.(columnId);
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
    container.addEventListener('mousedown', handleNoteInteractiveMouseDown, true);
    container.addEventListener('click', handleNoteActionClick, true);
    container.addEventListener('focusout', handleNoteFocusOut, true);
    container.addEventListener('keydown', handleNoteKeyDown, true);
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

    graph.on('node:moved', ({ node }) => {
      if (readOnly) {
        return;
      }

      const data = node.getData<TableNodeData | NoteNodeData>();
      const position = node.getPosition();

      if (isTableNodeData(data)) {
        if (resizingTableIdRef.current === data.tableId) {
          // Saat resize dari sisi kiri, node.position() dipanggil secara programmatic; commit model tetap dilakukan sekali di mouseup.
          return;
        }

        const table = modelRef.current.tables[data.tableId];

        if (!table) {
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
      container.removeEventListener('mousedown', handleNoteInteractiveMouseDown, true);
      container.removeEventListener('click', handleNoteActionClick, true);
      container.removeEventListener('focusout', handleNoteFocusOut, true);
      container.removeEventListener('keydown', handleNoteKeyDown, true);
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
  const canShowMinimap = Object.keys(model.tables).length > 0;

  function handleRelationshipCardinalityChange(cardinality: DatabaseRelationship['cardinality']) {
    if (!activeRelationship || readOnly || activeRelationship.cardinality === cardinality) {
      return;
    }

    onModelChange(
      applyDiagramCommand(model, {
        changes: { cardinality },
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
  onCardinalityChange: (cardinality: DatabaseRelationship['cardinality']) => void;
  onClose: () => void;
  onDelete: () => void;
  readOnly: boolean;
  relationship: DatabaseRelationship;
  top: number;
}) {
  const sourceLabel = getRelationshipEndpointLabel(model, relationship, 'source');
  const targetLabel = getRelationshipEndpointLabel(model, relationship, 'target');
  const cardinalityOptions: Array<{ label: string; value: DatabaseRelationship['cardinality'] }> = [
    { label: '1:1', value: 'one_to_one' },
    { label: '1:N', value: 'one_to_many' },
    { label: 'N:N', value: 'many_to_many' },
  ];

  return (
    <section
      aria-label="Relationship actions"
      className="absolute z-40 w-[330px] rounded-[18px] border border-slate-700 bg-slate-900 p-3 text-white shadow-[0_5px_0_rgb(15_23_42),0_18px_36px_rgb(15_23_42/0.24)]"
      onMouseDown={(event) => event.stopPropagation()}
      role="group"
      style={{ left, top }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)_24px] items-center gap-2">
        <RelationshipEndpointPill label={sourceLabel} tone="source" />
        <span className="text-center text-sm font-black text-slate-500">-&gt;</span>
        <RelationshipEndpointPill label={targetLabel} tone="target" />
        <button
          aria-label="Close relationship actions"
          className="grid size-6 cursor-pointer place-items-center rounded-full text-sm font-black text-slate-400 outline-none transition hover:bg-slate-800 hover:text-white focus-visible:ring-[3px] focus-visible:ring-cyan-300"
          onClick={onClose}
          type="button"
        >
          x
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="inline-flex rounded-[12px] bg-slate-800 p-1">
          {cardinalityOptions.map((option) => (
            <button
              aria-pressed={relationship.cardinality === option.value}
              className={cn(
                'h-8 min-w-12 cursor-pointer rounded-[9px] px-3 text-xs font-black outline-none transition focus-visible:ring-[3px] focus-visible:ring-cyan-300',
                relationship.cardinality === option.value
                  ? 'bg-teal-500 text-white shadow-[0_2px_0_rgb(13_148_136)]'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white',
              )}
              disabled={readOnly}
              key={option.value}
              onClick={() => onCardinalityChange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          className="h-8 cursor-pointer rounded-[10px] px-3 text-xs font-black text-slate-400 outline-none transition hover:bg-red-500 hover:text-white focus-visible:ring-[3px] focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={readOnly}
          onClick={onDelete}
          type="button"
        >
          Delete
        </button>
      </div>
    </section>
  );
}

function RelationshipEndpointPill({ label, tone }: { label: string; tone: 'source' | 'target' }) {
  return (
    <div className="min-w-0 rounded-[10px] bg-slate-800 px-3 py-2">
      <span className={cn('mb-1 block size-1.5 rounded-full', tone === 'source' ? 'bg-pink-400' : 'bg-emerald-400')} />
      <span className="block truncate font-mono text-[11px] font-black leading-none text-cyan-200">{label}</span>
    </div>
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

  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(action)}>
      <DialogContent className="w-[min(92vw,420px)]">
        <DialogHeader>
          <DialogTitle>{isNote ? 'Delete note?' : 'Delete relationship?'}</DialogTitle>
          <DialogDescription>
            {isNote
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
): CanvasMinimapStaticState | null {
  const tables = Object.values(model.tables).map<CanvasMinimapTable>((table) => ({
    color: getDisplayTableColor(table.color),
    height: getTableNodeHeight(model, table),
    id: table.id,
    name: table.name,
    selected: table.id === selectedTableId,
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

function syncGraphFromModel(
  graph: Graph,
  model: DiagramModel,
  selectedTableId: string | null,
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
        pointerEvents: 'none',
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
        pointerEvents: 'none',
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

function createTableNodeMetadata(
  model: DiagramModel,
  table: DatabaseTable,
  selectedTableId: string | null,
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
  const portSignature = createColumnPortSignature(table, columns, terminals, readOnly, selected);

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
      selected,
      tableId: table.id,
      tableName: table.name,
    } satisfies TableNodeData,
    height,
    position: table.position,
    ports: createColumnPorts(table, columns, terminals, readOnly, selected),
    shape: tableNodeShape,
    width,
    zIndex: selected ? 2 : 1,
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
  const oneMarker = {
    d: 'M 0 -7 L 0 7',
    fill: 'none',
    name: 'path' as const,
    offsetX: 0,
    stroke,
    strokeWidth,
  };

  // Crow's foot besar — shaft 10px + kaki terbuka 9px (mirip DrawSQL asli)
  const manyMarker = {
    d: 'M -12 -7 L 0 0 L -12 7 M -12 0 L 0 0',
    fill: 'none',
    name: 'path' as const,
    offsetX: 0,
    stroke,
    strokeWidth,
  };

  switch (cardinality) {
    case 'many_to_many':
      return { sourceMarker: manyMarker, targetMarker: manyMarker };
    case 'one_to_one':
      // 1:1 keeps the line plain at both ends; the row-level port already explains the exact column anchor.
      return {};
    case 'one_to_many':
    default:
      return { sourceMarker: oneMarker, targetMarker: manyMarker };
  }
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

    if (!sourceTable || !targetTable || !terminals?.source || !terminals.target) {
      return [];
    }

    const stroke = terminals.source.active ? relationshipActiveColor : relationshipNeutralColor;
    const strokeWidth = terminals.source.active ? 1.7 : 1.5;
    const { sourceMarker, targetMarker } = buildRelationshipMarkers(relationship.cardinality, stroke, strokeWidth);
    const markerAttrs = {
      ...(sourceMarker ? { sourceMarker } : {}),
      ...(targetMarker ? { targetMarker } : {}),
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
          name: 'rounded',
          args: { radius: relationshipConnectorRadius },
        },
        labels: [],
        router: {
          name: 'manhattan',
          args: buildManhattanRouterArgs(terminals.source.side, terminals.target.side),
        },
        source: { cell: relationship.sourceTableId, port: terminals.source.portId },
        target: { cell: relationship.targetTableId, port: terminals.target.portId },
        zIndex: terminals.source.active ? 1 : 0,
      },
    ];
  });
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

  return { terminalsByRelationship, terminalsByTable };
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
        // Hitung urutan terminal di side ini untuk kasih index
        const sideTerminals = terminals
          .filter((t) => t.side === side)
          .sort((a, b) => {
            const aIdx = visibleColumns.findIndex((c) => c.id === a.columnId);
            const bIdx = visibleColumns.findIndex((c) => c.id === b.columnId);
            return aIdx - bIdx;
          });
        const laneIndex = sideTerminals.findIndex((t) => t.columnId === column.id);
        const offset =
          sideTerminals.length > 1
            ? (laneIndex - (sideTerminals.length - 1) / 2) * 6 // 6px = setengah grid
            : 0;
        const y = tableHeaderHeight + columnIndex * tableColumnHeight + tableColumnHeight / 2 + offset;
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
              r: isVisible
                ? terminalSlot?.active
                  ? relationshipPortRadius + 1
                  : relationshipPortRadius
                : relationshipPortRadius,
              stroke: isVisible ? color : 'transparent',
              strokeWidth: isVisible ? (terminalSlot?.related ? 2 : 1.5) : 0,
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
    cardinality: 'one_to_many' as const,
    sourceColumnIds: [primaryPort.columnId],
    sourceTableId: primaryPort.tableId,
    targetColumnIds: [foreignPort.columnId],
    targetTableId: foreignPort.tableId,
    type: 'relationship.create' as const,
  };
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
  const relationshipPlan = createRelationshipPlan(
    previewModel,
    selectedTableId,
    selectedRelationshipId,
    affectedRelationships,
  );
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
    data.readOnly || !data.selected
      ? ''
      : [
          '<button aria-label="Resize table from left" class="tabliodb-table-node__resize-zone tabliodb-table-node__resize-zone--left" data-resize-side="left" type="button"></button>',
          '<button aria-label="Resize table from right" class="tabliodb-table-node__resize-zone tabliodb-table-node__resize-zone--right" data-resize-side="right" type="button"></button>',
        ].join('');

  return `
    <div class="tabliodb-table-node ${data.selected ? 'is-selected' : ''} ${displayClass}" data-tabliodb-table-id="${escapeHtml(data.tableId)}" style="--table-accent: ${escapeHtml(data.color)}">
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
