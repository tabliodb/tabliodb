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
  getRelationshipColumnPairs,
  getTableColumns,
  type DatabaseColumn,
  type DatabaseTable,
  type DiagramGroup,
  type DiagramModel,
  type DiagramNote,
  type TableDisplayMode,
} from '@tabliodb/schema-core';
import type { CommentTargetType, CommentThreadTargetSummaryDto } from '@tabliodb/sdk';
import type { AwarenessState } from '@tabliodb/shared';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
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

const tableNodeWidth = 288; // 288 / 12 = 24 grid units (Pas!)
const tableHeaderHeight = 36; // Disarankan ubah 38 -> 36 (36 / 12 = 3 units)
const tableColumnHeight = 24; // Disarankan ubah 26 -> 24 (24 / 12 = 2 units)
const tablePaddingBottom = 12; // Disarankan ubah 6 -> 12 (1 unit)
const groupPaddingX = 36; // 36 / 12 = 3 units (Pas!)
const groupPaddingBottom = 24; // Disarankan ubah 28 -> 24 (2 units)
const groupHeaderOffset = 48; // Disarankan ubah 42 -> 48 (4 units)
const noteNodeDefaultWidth = 264; // Disarankan ubah 260 -> 264 (22 units)
const noteNodeMinHeight = 120; // Disarankan ubah 118 -> 120 (10 units)
const noteNodeMaxHeight = 216; // Disarankan ubah 220 -> 216 (18 units)
const tableResizeMaxWidth = 720; // 720 / 12 = 60 units (Pas!)
const tableResizeMinWidth = 240; // 240 / 12 = 20 units (Pas!)

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
  model: DiagramModel;
  onLocalCursorChange?: (cursor: AwarenessState['cursor']) => void;
  onCommentTargetOpen?: (target: { targetId: string; targetType: CommentTargetType }) => void;
  selectedTableId: string | null;
  onModelChange: (model: DiagramModel) => void;
  onSelectedTableChange: (tableId: string | null) => void;
  remoteCursors?: RemoteCanvasCursor[];
  readOnly?: boolean;
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
  readOnly: boolean;
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

type RemoteCanvasCursorPosition = RemoteCanvasCursor & {
  left: number;
  top: number;
};

type CanvasRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

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

export function SchemaCanvas({
  commentTargetSummaries = [],
  fitKey,
  fitSignal,
  model,
  onCommentTargetOpen,
  onLocalCursorChange,
  onModelChange,
  onSelectedTableChange,
  readOnly = false,
  remoteCursors = [],
  selectedTableId,
}: SchemaCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const fitKeyRef = useRef<string | null>(null);
  const modelRef = useRef(model);
  const onLocalCursorChangeRef = useRef(onLocalCursorChange);
  const onCommentTargetOpenRef = useRef(onCommentTargetOpen);
  const onModelChangeRef = useRef(onModelChange);
  const onSelectedTableChangeRef = useRef(onSelectedTableChange);
  const remoteCursorsRef = useRef(remoteCursors);
  const [remoteCursorPositions, setRemoteCursorPositions] = useState<RemoteCanvasCursorPosition[]>([]);
  const [minimapOpen, setMinimapOpen] = useState(true);
  const [minimapState, setMinimapState] = useState<CanvasMinimapState | null>(null);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

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
    onSelectedTableChangeRef.current = onSelectedTableChange;
  }, [onSelectedTableChange]);

  useEffect(() => {
    remoteCursorsRef.current = remoteCursors;
  }, [remoteCursors]);

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
        modifiers: ['ctrl', 'meta'],
        zoomAtMousePosition: true,
      },
      panning: {
        enabled: true,
        eventTypes: ['leftMouseDown', 'mouseWheel'],
      },
    });

    // X6 couples node movement snapping to the visible grid size; keeping the visual grid at 24px while snapping at 1px makes drag placement precise.
    graph.getGridSize = () => diagramDragGridSize;

    graph.on('node:click', ({ node }) => {
      const data = node.getData<TableNodeData>();

      if (isTableNodeData(data)) {
        onSelectedTableChangeRef.current(data.tableId);
        return;
      }

      if (isNoteNodeData(data)) {
        onSelectedTableChangeRef.current(null);
      }
    });

    graph.on('blank:click', () => {
      onSelectedTableChangeRef.current(null);
    });

    const getCommentMarkerFromEvent = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return null;
      }

      return target.closest<HTMLElement>('.tabliodb-table-node__comment-marker');
    };

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

    const handleNoteInteractiveMouseDown = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.closest('.tabliodb-note-node__textarea, .tabliodb-note-node__action')) {
        // Text editing and note actions live inside an X6 HTML node; stopping mousedown keeps the graph from starting a drag.
        event.stopPropagation();
      }
    };

    const handleNoteActionClick = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const actionButton = target.closest<HTMLButtonElement>('[data-note-action]');
      const noteElement = actionButton?.closest<HTMLElement>('[data-tabliodb-note-id]');
      const noteId = noteElement?.dataset.tabliodbNoteId;

      if (!actionButton || !noteId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (actionButton.dataset.noteAction === 'comment') {
        onCommentTargetOpenRef.current?.({ targetId: noteId, targetType: 'note' });
        return;
      }

      if (actionButton.dataset.noteAction === 'delete' && !readOnly) {
        const note = modelRef.current.notes[noteId];

        if (!note || !window.confirm('Delete this note?')) {
          return;
        }

        onModelChangeRef.current(applyDiagramCommand(modelRef.current, { noteId, type: 'note.delete' }));
      }
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

      const handle = target.closest<HTMLElement>('.tabliodb-table-node__resize-handle');
      const tableElement = handle?.closest<HTMLElement>('[data-tabliodb-table-id]');
      const tableId = tableElement?.dataset.tabliodbTableId;

      if (!handle || !tableId || readOnly) {
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

      const startClientX = event.clientX;
      const startWidth = getTableWidth(table);
      const graphScale = getGraphScale(graph);
      let latestWidth = startWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();
        const rawWidth = startWidth + (moveEvent.clientX - startClientX) / graphScale;
        const snappedWidth = Math.round(rawWidth / diagramDragGridSize) * diagramDragGridSize;
        latestWidth = clampTableNodeWidth(snappedWidth);
        node.resize(latestWidth, node.getSize().height);
      };

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);

        if (latestWidth !== startWidth) {
          // Width is committed once at drag-end so quick resize movement does not spam snapshot model updates.
          const finalWidth = Math.round(latestWidth / diagramDragGridSize) * diagramDragGridSize;
          onModelChangeRef.current(
            applyDiagramCommand(modelRef.current, {
              type: 'table.resize',
              tableId,
              width: clampTableNodeWidth(finalWidth),
            }),
          );
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    };

    container.addEventListener('mousedown', handleCommentMarkerMouseDown, true);
    container.addEventListener('click', handleCommentMarkerClick, true);
    container.addEventListener('mousedown', handleNoteInteractiveMouseDown, true);
    container.addEventListener('click', handleNoteActionClick, true);
    container.addEventListener('focusout', handleNoteFocusOut, true);
    container.addEventListener('keydown', handleNoteKeyDown, true);
    container.addEventListener('mousedown', handleResizeMouseDown, true);

    const handleCursorPointerMove = (event: PointerEvent) => {
      const point = graph.clientToLocal(event.clientX, event.clientY);

      // Awareness cursor disimpan dalam coordinate system local X6 supaya posisi remote user tetap akurat saat canvas di-pan atau di-zoom.
      onLocalCursorChangeRef.current?.({
        x: Math.round(point.x),
        y: Math.round(point.y),
      });
    };

    const handleCursorPointerLeave = () => {
      // Menghapus cursor ketika pointer keluar canvas mencegah user lain melihat pointer stale di diagram.
      onLocalCursorChangeRef.current?.(undefined);
    };

    container.addEventListener('pointerleave', handleCursorPointerLeave);
    container.addEventListener('pointermove', handleCursorPointerMove);

    graph.on('node:moved', ({ node }) => {
      if (readOnly) {
        return;
      }

      const data = node.getData<TableNodeData | NoteNodeData>();
      const position = node.getPosition();

      if (isTableNodeData(data)) {
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
      container.removeEventListener('mousedown', handleNoteInteractiveMouseDown, true);
      container.removeEventListener('click', handleNoteActionClick, true);
      container.removeEventListener('focusout', handleNoteFocusOut, true);
      container.removeEventListener('keydown', handleNoteKeyDown, true);
      container.removeEventListener('mousedown', handleResizeMouseDown, true);
      container.removeEventListener('pointerleave', handleCursorPointerLeave);
      container.removeEventListener('pointermove', handleCursorPointerMove);
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

    syncGraphFromModel(graph, model, selectedTableId, commentTargetSummaries, readOnly);

    if (fitKeyRef.current !== fitKey) {
      fitKeyRef.current = fitKey;
      fitGraphContent(graph);
    }
  }, [commentTargetSummaries, fitKey, model, readOnly, selectedTableId]);

  useEffect(() => {
    const graph = graphRef.current;

    if (graph && fitSignal > 0) {
      fitGraphContent(graph);
    }
  }, [fitSignal]);

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

    if (!graph || !container) {
      setMinimapState(null);
      return;
    }

    let animationFrameId = 0;
    let disposed = false;

    const syncMinimapState = () => {
      if (disposed) {
        return;
      }

      const nextState = createCanvasMinimapState(graph, container, modelRef.current, selectedTableId);
      setMinimapState((currentState) =>
        areCanvasMinimapStatesEqual(currentState, nextState) ? currentState : nextState,
      );
      // Minimap mengikuti transform X6 live; state React hanya berubah saat viewport/table bounds benar-benar bergeser.
      animationFrameId = window.requestAnimationFrame(syncMinimapState);
    };

    syncMinimapState();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [readOnly, selectedTableId]);

  function handleMinimapCenter(x: number, y: number) {
    graphRef.current?.centerPoint(x, y);
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-[rgb(var(--tabliodb-canvas))]">
      <div className="tabliodb-x6-canvas absolute inset-0" ref={containerRef} />
      {minimapState && minimapOpen ? (
        <CanvasMinimap onCenter={handleMinimapCenter} onClose={() => setMinimapOpen(false)} state={minimapState} />
      ) : minimapState ? (
        <button
          aria-label="Show minimap"
          className="absolute bottom-4 right-4 z-20 h-9 cursor-pointer rounded-(--tabliodb-radius-md) border border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 text-xs font-extrabold text-[rgb(var(--tabliodb-ink))] shadow-[0_3px_0_rgb(var(--tabliodb-border-strong))] transition hover:bg-[rgb(var(--tabliodb-surface-raised))] active:translate-y-0.5 active:shadow-[0_1px_0_rgb(var(--tabliodb-border-strong))]"
          onClick={() => setMinimapOpen(true)}
          type="button"
        >
          Map
        </button>
      ) : null}
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
  onCenter,
  onClose,
  state,
}: {
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

  return (
    <section className="absolute bottom-4 right-4 z-20 w-48 rounded-(--tabliodb-radius-lg) border border-[rgb(var(--tabliodb-border-strong))] bg-white/95 p-2 shadow-[0_3px_0_rgb(var(--tabliodb-border-strong)),0_14px_30px_rgba(15,23,42,0.14)] backdrop-blur">
      <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Minimap
        </span>
        <button
          aria-label="Hide minimap"
          className="grid size-5 cursor-pointer place-items-center rounded-full text-[13px] font-extrabold leading-none text-[rgb(var(--tabliodb-ink-muted))] transition hover:bg-[rgb(var(--tabliodb-surface-raised))] hover:text-[rgb(var(--tabliodb-ink))]"
          onClick={onClose}
          type="button"
        >
          x
        </button>
      </div>
      <svg
        aria-label="Diagram minimap"
        className="block aspect-192/124 w-full cursor-crosshair rounded-[10px] border border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-canvas))]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        preserveAspectRatio="none"
        role="img"
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

function createCanvasMinimapState(
  graph: Graph,
  container: HTMLElement,
  model: DiagramModel,
  selectedTableId: string | null,
): CanvasMinimapState | null {
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

  const viewport = getCanvasViewportRect(graph, container);
  const contentBounds = getCanvasContentBounds([...groups, ...tables, ...notes, viewport]);
  const viewBox = normalizeRectToAspect(padCanvasRect(contentBounds, 96), minimapAspectRatio);

  return {
    groups: groups.map(roundCanvasMinimapTable),
    notes: notes.map(roundCanvasMinimapTable),
    tables: tables.map(roundCanvasMinimapTable),
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
  commentTargetSummaries: CommentThreadTargetSummaryDto[],
  readOnly: boolean,
): void {
  const relationshipPlan = createRelationshipPlan(model, selectedTableId);
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

function getEndpointLaneGap(laneTotal: number): number {
  if (laneTotal <= 2) return 7; // lega, default nyaman
  if (laneTotal <= 4) return 6; // masih aman di row 24px
  if (laneTotal <= 6) return 5; // mulai rapat tapi masih oke
  return 4; // emergency padat
}

function createTableNodeMetadata(
  model: DiagramModel,
  table: DatabaseTable,
  selectedTableId: string | null,
  terminals: RelationshipTerminal[],
  commentMarkerSummary: CommentMarkerSummary,
  readOnly: boolean,
): NodeMetadata {
  const columns = getVisibleTableColumns(model, table);
  const totalColumnCount = table.columnIds.length;
  const displayMode = getEffectiveTableDisplayMode(table);
  const height = getTableNodeHeight(model, table);
  const width = getTableWidth(table);

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
      readOnly,
      selected: table.id === selectedTableId,
      tableId: table.id,
      tableName: table.name,
    } satisfies TableNodeData,
    height,
    position: table.position,
    ports: createColumnPorts(model, table, terminals, readOnly, table.id === selectedTableId),
    shape: tableNodeShape,
    width,
    zIndex: table.id === selectedTableId ? 2 : 1,
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
    padding: relationshipObstaclePadding,
    startDirections: sourceSide ? [sourceSide] : ['left', 'right'],
    step: diagramVisualGridSize,
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
      return { sourceMarker: oneMarker, targetMarker: oneMarker };
    case 'one_to_many':
    default:
      return { sourceMarker: oneMarker, targetMarker: manyMarker };
  }
}

function createRelationshipEdgeMetadata(model: DiagramModel, plan: RelationshipPlan): EdgeMetadata[] {
  return Object.values(model.relationships).flatMap<EdgeMetadata>((relationship) => {
    const sourceTable = model.tables[relationship.sourceTableId];
    const targetTable = model.tables[relationship.targetTableId];
    const terminals = plan.terminalsByRelationship.get(relationship.id);

    if (!sourceTable || !targetTable || !terminals?.source || !terminals.target) {
      return [];
    }

    const stroke = terminals.source.active ? relationshipActiveColor : relationshipNeutralColor;
    const strokeWidth = terminals.source.active ? 1.7 : 1.5;
    const { sourceMarker, targetMarker } = buildRelationshipMarkers(relationship.cardinality, stroke, strokeWidth);

    return [
      {
        id: relationship.id,
        attrs: {
          line: {
            sourceMarker,
            stroke,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeWidth,
            targetMarker,
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

    const sourceCenterX = sourceTable.position.x + getTableWidth(sourceTable) / 2;
    const targetCenterX = targetTable.position.x + getTableWidth(targetTable) / 2;
    const sourceCenterY = sourceTable.position.y + getTableNodeHeight(model, sourceTable) / 2;
    const targetCenterY = targetTable.position.y + getTableNodeHeight(model, targetTable) / 2;

    const dx = Math.abs(targetCenterX - sourceCenterX);
    const dy = Math.abs(targetCenterY - sourceCenterY);

    let sourceSide: PortSide;
    let targetSide: PortSide;

    if (dy > dx * 1.5) {
      // Vertikal dominance: pakai sisi yang sama — prioritas kiri untuk alignment rapi
      if (sourceCenterX <= targetCenterX) {
        sourceSide = 'left';
        targetSide = 'left';
      } else {
        sourceSide = 'right';
        targetSide = 'right';
      }
    } else {
      // Horizontal dominance: logika asli (berhadapan)
      const sourceIsLeft = sourceCenterX <= targetCenterX;
      sourceSide = sourceIsLeft ? 'right' : 'left';
      targetSide = sourceIsLeft ? 'left' : 'right';
    }

    const active = selectedTableId === relationship.sourceTableId || selectedTableId === relationship.targetTableId;

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
  selected: boolean,
): NodeMetadata['ports'] {
  const visibleColumns = getVisibleTableColumns(model, table);

  return {
    groups: {
      absolute: {
        markup: [{ selector: 'portBody', tagName: 'circle' }],
        position: 'absolute',
      },
    },
    items: terminals.flatMap((terminal) => {
      const columnIndex = visibleColumns.findIndex((column) => column.id === terminal.columnId);
      const y =
        columnIndex >= 0
          ? tableHeaderHeight + columnIndex * tableColumnHeight + tableColumnHeight / 2
          : tableHeaderHeight / 2;

      // === GANTI DI SINI ===
      const laneGap = getEndpointLaneGap(terminal.laneTotal);
      const laneOffset = (terminal.laneIndex - (terminal.laneTotal - 1) / 2) * laneGap;
      // =====================

      const color = terminal.active ? relationshipActiveColor : relationshipNeutralColor;

      const isVisible = selected;

      return [
        {
          args: {
            x: terminal.side === 'left' ? 0 : getTableWidth(table),
            y: y + laneOffset,
          },
          attrs: {
            portBody: {
              cursor: readOnly ? 'default' : 'crosshair',
              fill: isVisible ? '#58cc02' : 'transparent',
              magnet: !readOnly && isVisible, // ← drag new relation hanya saat terlihat
              r: isVisible ? (terminal.active ? relationshipPortRadius + 1 : relationshipPortRadius) : 0,
              stroke: isVisible ? color : 'transparent',
              strokeWidth: isVisible ? (terminal.active ? 1.5 : 2) : 0,
              // magnet: !readOnly,
              // fill: '#ffffff',
              // stroke: color,
              // strokeWidth: terminal.active ? 3 : 2,
              // r: terminal.active ? relationshipPortRadius + 1 : relationshipPortRadius,
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
    current.readOnly === next.readOnly &&
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
  const rows = data.columns.map((column) => renderColumnRow(column, data.columnCommentMarkers[column.id])).join('');
  const commentMarker = renderCommentMarker(data.commentMarker, `table ${data.tableName}`, 'table', data.tableId);
  const displayClass = data.columns.length === 0 ? 'is-collapsed' : '';
  const resizeHandle = data.readOnly
    ? ''
    : '<button aria-label="Resize table" class="tabliodb-table-node__resize-handle" type="button"></button>';

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

function renderColumnRow(column: DatabaseColumn, commentMarkerCount: CommentMarkerCount | undefined): string {
  const commentMarker = renderCommentMarker(commentMarkerCount, `column ${column.name}`, 'column', column.id);
  const badges = [
    column.primaryKey ? `<span class="tabliodb-table-node__badge">${keyRoundSvg}</span>` : '',
    column.unique ? `<span class="tabliodb-table-node__badge">${SnowFlakeSvg}</span>` : '',
  ].join('');

  return `
    <div class="tabliodb-table-node__column">
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
  return value === 'table' || value === 'column';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
