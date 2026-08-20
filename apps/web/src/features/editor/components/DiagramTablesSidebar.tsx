import { getTableColumns, type DatabaseTable, type DiagramModel } from '@tabliodb/schema-core';
import { Badge, IconButton, Input, cn } from '@tabliodb/ui';
import { ChevronDown, PanelLeft, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeEditorDiagramModel } from '../diagram-model';
import { getDisplayTableColor } from '../table-colors';
import { TableStructureSidebar } from './TableStructureSidebar';

export function DiagramTablesSidebar({
  model: rawModel,
  onClearTableSelection,
  onColumnSelect,
  onHide,
  onModelChange,
  onTableSelect,
  readOnly,
  selectedColumnId,
  selectedTableId,
}: {
  model: DiagramModel;
  onClearTableSelection: () => void;
  onColumnSelect?: (columnId: string) => void;
  onHide: () => void;
  onModelChange: (model: DiagramModel) => void;
  onTableSelect: (tableId: string | null) => void;
  readOnly: boolean;
  selectedColumnId: string | null;
  selectedTableId: string | null;
}) {
  const model = useMemo(() => normalizeEditorDiagramModel(rawModel), [rawModel]);
  const [tableSearchTerm, setTableSearchTerm] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const tables = useMemo(
    () => Object.values(model.tables).sort((left, right) => left.name.localeCompare(right.name)),
    [model.tables],
  );
  const filteredTables = useMemo(() => {
    const search = tableSearchTerm.trim().toLowerCase();

    return search
      ? tables.filter((table) => {
          const group = table.groupId ? model.groups[table.groupId] : null;

          return [table.name, table.schema ?? '', group?.name ?? ''].some((value) =>
            value.toLowerCase().includes(search),
          );
        })
      : tables;
  }, [model.groups, tableSearchTerm, tables]);
  const selectedTable = selectedTableId ? (model.tables[selectedTableId] ?? null) : null;
  const visibleTables = useMemo(() => {
    if (!selectedTable || filteredTables.some((table) => table.id === selectedTable.id)) {
      return filteredTables;
    }

    // Table yang dipilih dari canvas tetap tampil walau search term sedang memfilter list agar user tidak kehilangan konteks.
    return [selectedTable, ...filteredTables];
  }, [filteredTables, selectedTable]);

  useEffect(() => {
    if (!selectedTableId) {
      return;
    }

    window.requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-tabliodb-table-item-id="${CSS.escape(selectedTableId)}"]`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }, [selectedTableId, visibleTables.length]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[rgb(var(--tabliodb-surface-raised))]">
      <div className="flex h-[var(--tabliodb-header-height)] shrink-0 items-center gap-2.5 border-b border-[rgb(var(--tabliodb-border))] bg-white/80 px-3 backdrop-blur">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
            Tables
          </div>
          <div className="truncate text-[13px] font-extrabold leading-5">
            {tables.length} table{tables.length === 1 ? '' : 's'}
          </div>
        </div>
        {selectedTable ? (
          <IconButton icon={X} label="Clear table selection" onClick={onClearTableSelection} variant="ghost" />
        ) : null}
        <IconButton size="lg" icon={PanelLeft} label="Hide left sidebar" onClick={onHide} variant="ghost" />
      </div>

      <div className="border-b border-[rgb(var(--tabliodb-border))] bg-white/60 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--tabliodb-ink-subtle))]" />
          <Input
            className="h-9 pl-9 text-[13px]"
            onChange={(event) => setTableSearchTerm(event.target.value)}
            placeholder="Search tables"
            value={tableSearchTerm}
          />
        </div>
      </div>

      <div ref={listRef} className="tabliodb-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-2 p-2">
          {visibleTables.length === 0 ? (
            <div className="rounded-[var(--tabliodb-radius-md)] border border-dashed border-[rgb(var(--tabliodb-border))] p-3 text-center text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
              No matching tables
            </div>
          ) : (
            visibleTables.map((table) => (
              <TableAccordionItem
                key={table.id}
                model={model}
                onClearTableSelection={onClearTableSelection}
                onColumnSelect={onColumnSelect}
                onModelChange={onModelChange}
                onSelect={() => (table.id === selectedTable?.id ? onTableSelect(null) : onTableSelect(table.id))}
                readOnly={readOnly}
                selected={table.id === selectedTable?.id}
                selectedColumnId={selectedColumnId}
                table={table}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function TableAccordionItem({
  model,
  onClearTableSelection,
  onColumnSelect,
  onModelChange,
  onSelect,
  readOnly,
  selected,
  selectedColumnId,
  table,
}: {
  model: DiagramModel;
  onClearTableSelection: () => void;
  onColumnSelect?: (columnId: string) => void;
  onModelChange: (model: DiagramModel) => void;
  onSelect: () => void;
  readOnly: boolean;
  selected: boolean;
  selectedColumnId: string | null;
  table: DatabaseTable;
}) {
  const columnCount = Math.max(getTableColumns(model, table.id).length, table.columnIds.length);
  const group = table.groupId ? model.groups[table.groupId] : null;
  const [bodyMounted, setBodyMounted] = useState(selected);
  const [bodyOpen, setBodyOpen] = useState(selected);

  useEffect(() => {
    if (selected) {
      setBodyMounted(true);
      const frameId = window.requestAnimationFrame(() => {
        // Mount satu frame lebih dulu supaya CSS grid bisa menganimasikan transisi dari 0fr ke 1fr dengan halus.
        setBodyOpen(true);
      });

      return () => window.cancelAnimationFrame(frameId);
    }

    setBodyOpen(false);
    const timeoutId = window.setTimeout(() => {
      // Body form dilepas setelah animasi close selesai agar list table tetap ringan walau jumlah tabel makin banyak.
      setBodyMounted(false);
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [selected]);

  return (
    <article
      className={cn(
        'overflow-hidden rounded-[var(--tabliodb-radius-lg)] border bg-white transition',
        selected
          ? 'border-[rgb(var(--tabliodb-active-chip-border))] bg-[rgb(var(--tabliodb-selected-surface))] shadow-[0_2px_0_rgb(var(--tabliodb-active-chip-border))]'
          : 'border-[rgb(var(--tabliodb-border))] shadow-[0_1px_0_rgb(var(--tabliodb-border))] hover:border-[rgb(var(--tabliodb-border-strong))] hover:bg-[rgb(var(--tabliodb-surface-raised))]',
      )}
      data-tabliodb-table-item-id={table.id}
    >
      <button
        aria-expanded={selected}
        className="flex min-h-13 w-full cursor-pointer items-center gap-2.5 px-2.5 py-2 text-left transition"
        onClick={onSelect}
        type="button"
      >
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: getDisplayTableColor(table.color) }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-extrabold leading-5">{table.name}</span>
          <span className="block truncate text-[11px] font-bold leading-4 text-[rgb(var(--tabliodb-ink-muted))]">
            {group?.name ?? table.schema ?? 'Main schema'}
          </span>
        </span>
        <Badge variant={selected ? 'green' : 'neutral'}>{columnCount}</Badge>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-[rgb(var(--tabliodb-ink-muted))] transition-transform',
            selected ? 'rotate-180 text-[rgb(var(--tabliodb-primary-text))]' : undefined,
          )}
        />
      </button>
      {bodyMounted ? (
        <div
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
            bodyOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="min-h-0 overflow-hidden border-t border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface))]">
            <TableStructureSidebar
              activeColumnId={selectedColumnId}
              model={model}
              onClearTableSelection={onClearTableSelection}
              onColumnSelect={onColumnSelect}
              onHide={() => undefined}
              onModelChange={onModelChange}
              readOnly={readOnly}
              selectedTableId={table.id}
              showHeader={false}
              variant="accordion"
            />
          </div>
        </div>
      ) : null}
    </article>
  );
}
