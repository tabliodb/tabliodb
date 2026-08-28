import {
  applyDiagramCommand,
  createDiagramEntityId,
  getTableColumns,
  type DatabaseTable,
  type DiagramModel,
} from '@tabliodb/schema-core';
import { Button, IconButton, cn, toast } from '@tabliodb/ui';
import { Copy, FolderPlus, MousePointer2, PanelLeft, Trash2, X } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { createUniqueName, duplicateTablesInModel } from '../diagram-table-actions';
import { getDisplayTableColor } from '../table-colors';

export function MultiSelectTablesSidebar({
  model,
  onClearSelection,
  onDeleteRequest,
  onHide,
  onModelChange,
  onSelectedTableIdsChange,
  readOnly,
  selectedTableIds,
}: {
  model: DiagramModel;
  onClearSelection: () => void;
  onDeleteRequest: (tables: DatabaseTable[]) => void;
  onHide: () => void;
  onModelChange: (model: DiagramModel) => void;
  onSelectedTableIdsChange: (tableIds: string[]) => void;
  readOnly: boolean;
  selectedTableIds: string[];
}) {
  const selectedTables = useMemo(
    () => selectedTableIds.flatMap((tableId) => (model.tables[tableId] ? [model.tables[tableId]] : [])),
    [model.tables, selectedTableIds],
  );
  const selectedCount = selectedTables.length;

  function handleDeselect(tableId: string) {
    const nextTableIds = selectedTables.map((table) => table.id).filter((currentTableId) => currentTableId !== tableId);

    if (nextTableIds.length === 0) {
      onClearSelection();
      return;
    }

    onSelectedTableIdsChange(nextTableIds);
  }

  function handleDuplicateSelection() {
    if (readOnly || selectedTables.length === 0) {
      return;
    }

    const result = duplicateTablesInModel(
      model,
      selectedTables.map((table) => table.id),
    );

    if (result.tableIds.length === 0) {
      return;
    }

    onModelChange(result.model);
    // Duplicated tables become the new multi-selection so the user can immediately move them away as one block.
    onSelectedTableIdsChange(result.tableIds);
    toast.success({
      description: `${result.tableIds.length} duplicated table${result.tableIds.length === 1 ? '' : 's'} are selected.`,
      title: 'Tables duplicated',
    });
  }

  function handleCreateGroup() {
    if (readOnly || selectedTables.length === 0) {
      return;
    }

    const selectionBounds = getSelectedTablesBounds(model, selectedTables);
    const groupName = createUniqueName(
      new Set(Object.values(model.groups).map((group) => group.name.toLowerCase())),
      'new_group',
    );
    const nextModel = applyDiagramCommand(model, {
      color: '#ff8ac7',
      groupId: createDiagramEntityId('group'),
      height: Math.max(220, selectionBounds.height + 72),
      name: groupName,
      // Bounds disimpan tetap masuk akal untuk data model, walau renderer group akan mengikuti isi table secara dinamis.
      position: {
        x: selectionBounds.x - 36,
        y: selectionBounds.y - 48,
      },
      tableIds: selectedTables.map((table) => table.id),
      type: 'group.create',
      width: Math.max(360, selectionBounds.width + 72),
    });

    onModelChange(nextModel);
    toast.success({
      description: `${selectedTables.length} table${selectedTables.length === 1 ? '' : 's'} are now inside ${groupName}.`,
      title: 'Group created',
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[rgb(var(--tabliodb-surface-raised))]">
      <div className="flex h-[var(--tabliodb-header-height)] shrink-0 items-center gap-3 border-b border-[rgb(var(--tabliodb-border))] bg-white/80 px-3 backdrop-blur">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--tabliodb-radius-md)] border border-[#ff9ad0] bg-[#fff1f8] text-[#d61b82] shadow-[0_2px_0_#f3a3cf]">
          <MousePointer2 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-extrabold uppercase tracking-wide text-[#d61b82]">Multi-select</div>
          <div className="truncate text-[15px] font-extrabold leading-5">
            {selectedCount} node{selectedCount === 1 ? '' : 's'} selected
          </div>
        </div>
        <IconButton icon={X} label="Clear multi-selection" onClick={onClearSelection} variant="ghost" />
        <IconButton size="lg" icon={PanelLeft} label="Hide left sidebar" onClick={onHide} variant="ghost" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="border-b border-[rgb(var(--tabliodb-border))] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-[12px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink))]">
                Selected nodes
              </h2>
              <p className="text-[11px] font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                Shift-drag or Shift-click tables to refine the selection.
              </p>
            </div>
          </div>
          <div className="grid gap-2">
            {selectedTables.map((table) => (
              <div
                className="flex min-h-10 items-center gap-2 rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-border))] bg-white px-2.5 py-2 shadow-[0_1px_0_rgb(var(--tabliodb-border))]"
                key={table.id}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: getDisplayTableColor(table.color) }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-extrabold text-[rgb(var(--tabliodb-ink))]">
                    {table.name}
                  </div>
                  <div className="truncate text-[11px] font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                    {getTableColumns(model, table.id).length} column
                    {getTableColumns(model, table.id).length === 1 ? '' : 's'}
                  </div>
                </div>
                <button
                  className="cursor-pointer rounded-full px-2 py-1 text-[11px] font-extrabold text-[rgb(var(--tabliodb-ink-muted))] transition hover:bg-[rgb(var(--tabliodb-surface))] hover:text-[rgb(var(--tabliodb-ink))]"
                  onClick={() => handleDeselect(table.id)}
                  type="button"
                >
                  Deselect
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid shrink-0 grid-cols-3 gap-2 border-t border-[rgb(var(--tabliodb-border))] bg-white/86 p-2.5 backdrop-blur">
        <MultiSelectActionButton
          disabled={readOnly || selectedCount === 0}
          icon={<Trash2 className="size-4" />}
          label="Delete"
          onClick={() => onDeleteRequest(selectedTables)}
          tone="danger"
        />
        <MultiSelectActionButton
          disabled={readOnly || selectedCount === 0}
          icon={<Copy className="size-4" />}
          label="Duplicate"
          onClick={handleDuplicateSelection}
        />
        <MultiSelectActionButton
          disabled={readOnly || selectedCount === 0}
          icon={<FolderPlus className="size-4" />}
          label="Create group"
          onClick={handleCreateGroup}
        />
      </div>
    </div>
  );
}

function MultiSelectActionButton({
  disabled,
  icon,
  label,
  onClick,
  tone = 'neutral',
}: {
  disabled: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'danger' | 'neutral';
}) {
  return (
    <Button
      className={cn(
        'h-20 flex-col gap-1 rounded-[var(--tabliodb-radius-sm)] px-2 text-[12px]',
        tone === 'danger'
          ? 'border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] text-[rgb(var(--tabliodb-danger-text))] shadow-[0_2px_0_rgb(var(--tabliodb-danger-border))] hover:bg-white'
          : 'shadow-[0_2px_0_rgb(var(--tabliodb-border-strong))]',
      )}
      disabled={disabled}
      onClick={onClick}
      variant={tone === 'danger' ? 'secondary' : 'secondary'}
    >
      {icon}
      <span className="whitespace-normal text-center leading-4">{label}</span>
    </Button>
  );
}

function getSelectedTablesBounds(model: DiagramModel, tables: DatabaseTable[]) {
  const rects = tables.map((table) => ({
    height: 36 + getTableColumns(model, table.id).length * 24 + 12,
    width: Math.max(table.width, 288),
    x: table.position.x,
    y: table.position.y,
  }));
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));

  return {
    height: bottom - top,
    width: right - left,
    x: left,
    y: top,
  };
}
