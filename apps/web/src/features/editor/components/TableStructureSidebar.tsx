import {
  applyDiagramCommand,
  createDiagramEntityId,
  getTableColumns,
  type ColumnTypeFamily,
  type ColumnTypeSpec,
  type DatabaseColumn,
  type DatabaseTable,
  type DiagramModel,
  type TableDisplayMode,
} from '@tabliodb/schema-core';
import {
  Button,
  Checkbox,
  FieldError,
  IconButton,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  WithTooltip,
  cn,
} from '@tabliodb/ui';
import {
  ChevronDown,
  ChevronUp,
  Columns3,
  GripVertical,
  KeyRound,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { z } from 'zod';
import { formatColumnType } from '../diagram-model';
import { getDisplayTableColor, getTableColorLabel, tableColorOptions } from '../table-colors';
const columnTypeFamilyOptions = [
  'bigint',
  'boolean',
  'date',
  'decimal',
  'enum',
  'float',
  'integer',
  'json',
  'text',
  'time',
  'timestamp',
  'uuid',
  'varchar',
] as const satisfies readonly ColumnTypeFamily[];

const inlineInputClassName =
  'h-[var(--tabliodb-control-sm)] rounded-[var(--tabliodb-radius-sm)] border border-[rgb(var(--tabliodb-border-strong))] bg-white px-2.5 text-[13px] font-bold shadow-none outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-[3px] focus:ring-[rgb(var(--tabliodb-focus-ring))] disabled:cursor-not-allowed disabled:opacity-60';

const compactSelectClassName =
  'h-[var(--tabliodb-control-sm)] rounded-[var(--tabliodb-radius-sm)] border border-[rgb(var(--tabliodb-border-strong))] px-2.5 text-[13px] shadow-none';
const unsetGroupValue = '__no_group__';

const inlineTableNameSchema = z
  .string()
  .trim()
  .min(1, 'Table name is required.')
  .max(64, 'Keep the table name under 64 characters.');
const inlineGroupNameSchema = z
  .string()
  .trim()
  .min(1, 'Module name is required.')
  .max(64, 'Keep the module name under 64 characters.');
const inlineColumnNameSchema = z
  .string()
  .trim()
  .min(1, 'Column name is required.')
  .max(64, 'Keep the column name under 64 characters.')
  .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, numbers, and underscores.');
const inlineColumnDefaultSchema = z.string().trim().max(120, 'Keep the default value under 120 characters.');
const inlineColumnCommentSchema = z.string().trim().max(240, 'Keep the comment under 240 characters.');

type InlineStringValidationResult = {
  error: string | null;
  value: string;
};

export type TableStructureSidebarProps = {
  activeColumnId?: string | null;
  model: DiagramModel;
  onClearTableSelection: () => void;
  onColumnSelect?: (columnId: string) => void;
  onHide: () => void;
  onModelChange: (model: DiagramModel) => void;
  readOnly?: boolean;
  selectedTableId: string;
  showHeader?: boolean;
};

export function TableStructureSidebar({
  activeColumnId = null,
  model,
  onClearTableSelection,
  onColumnSelect,
  onHide,
  onModelChange,
  readOnly = false,
  selectedTableId,
  showHeader = true,
}: TableStructureSidebarProps) {
  const table = model.tables[selectedTableId] ?? null;
  const columns = useMemo(() => (table ? getTableColumns(model, table.id) : []), [model, table]);
  const [activeAttributesColumnId, setActiveAttributesColumnId] = useState<string | null>(null);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);
  const [confirmDeleteTable, setConfirmDeleteTable] = useState(false);
  const groups = useMemo(() => Object.values(model.groups), [model.groups]);
  const tableGroup = table?.groupId ? (model.groups[table.groupId] ?? null) : null;
  const selectedColumn = columns.find((column) => column.id === selectedColumnId) ?? columns[0] ?? null;
  const columnIds = columns.map((column) => column.id).join('|');

  useEffect(() => {
    if (!table) {
      setSelectedColumnId(null);
      return;
    }

    if (!selectedColumnId || !columns.some((column) => column.id === selectedColumnId)) {
      // Column focus is local to this selected table so inline edits never target an old column after table switching.
      setSelectedColumnId(columns[0]?.id ?? null);
    }
  }, [columnIds, columns, selectedColumnId, table]);

  useEffect(() => {
    if (!activeColumnId || !columns.some((column) => column.id === activeColumnId)) {
      return;
    }

    if (selectedColumnId !== activeColumnId) {
      // Fokus eksternal dari canvas harus menang atas selection lokal supaya sidebar mengikuti row column yang user klik.
      setSelectedColumnId(activeColumnId);
    }

    window.requestAnimationFrame(() => {
      document
        .querySelector(`[data-tabliodb-sidebar-column-id="${CSS.escape(activeColumnId)}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    });
  }, [activeColumnId, columns, selectedColumnId]);

  useEffect(() => {
    setActiveAttributesColumnId(null);
    setConfirmDeleteGroup(false);
    setConfirmDeleteTable(false);
  }, [selectedTableId]);

  if (!table) {
    return (
      <div className="grid h-full place-items-center p-5 text-center text-sm font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
        Table selection is no longer available.
      </div>
    );
  }

  function apply(commandModel: DiagramModel) {
    if (!readOnly) {
      onModelChange(commandModel);
    }
  }

  function handleTableNameCommit(value: string) {
    const name = value.trim();

    if (!name || name === table.name) {
      return;
    }

    apply(applyDiagramCommand(model, { type: 'table.rename', tableId: table.id, name }));
  }

  function handleColorChange(color: string) {
    if (color === table.color) {
      return;
    }

    apply(applyDiagramCommand(model, { type: 'table.changeColor', tableId: table.id, color }));
  }

  function handleDisplayModeChange(displayMode: Extract<TableDisplayMode, 'all_columns' | 'pk_fk_only'>) {
    const currentDisplayMode = getSidebarDisplayMode(table);

    if (displayMode === currentDisplayMode && !isTableDisplayCollapsed(table)) {
      return;
    }

    apply(
      applyDiagramCommand(model, {
        changes: {
          collapsed: false,
          displayMode,
        },
        tableId: table.id,
        type: 'table.updateDisplay',
      }),
    );
  }

  function handleCollapseToggle() {
    const collapsed = isTableDisplayCollapsed(table);

    apply(
      applyDiagramCommand(model, {
        changes: {
          collapsed: !collapsed,
          displayMode: collapsed && table.displayMode === 'header_only' ? 'all_columns' : table.displayMode,
        },
        tableId: table.id,
        type: 'table.updateDisplay',
      }),
    );
  }

  function handleCreateGroup() {
    const groupId = createDiagramEntityId('group');
    const groupName = createUniqueGroupName(groups, `${titleCaseWords(table.name)} module`);

    apply(
      applyDiagramCommand(model, {
        ...createInitialGroupBounds(table),
        color: table.color,
        groupId,
        name: groupName,
        tableIds: [table.id],
        type: 'group.create',
      }),
    );
    setConfirmDeleteGroup(false);
  }

  function handleGroupMembershipChange(groupId: string) {
    if (groupId === unsetGroupValue) {
      apply(applyDiagramCommand(model, { tableId: table.id, type: 'group.removeTable' }));
      setConfirmDeleteGroup(false);
      return;
    }

    if (groupId !== table.groupId) {
      apply(applyDiagramCommand(model, { groupId, tableId: table.id, type: 'group.assignTable' }));
      setConfirmDeleteGroup(false);
    }
  }

  function handleGroupNameCommit(value: string) {
    const name = value.trim();

    if (!tableGroup || !name || name === tableGroup.name) {
      return;
    }

    apply(applyDiagramCommand(model, { changes: { name }, groupId: tableGroup.id, type: 'group.update' }));
  }

  function handleGroupColorChange(color: string) {
    if (!tableGroup || color === tableGroup.color) {
      return;
    }

    apply(applyDiagramCommand(model, { changes: { color }, groupId: tableGroup.id, type: 'group.update' }));
  }

  function handleDeleteGroup() {
    if (!tableGroup || readOnly) {
      return;
    }

    if (!confirmDeleteGroup) {
      setConfirmDeleteGroup(true);
      return;
    }

    apply(applyDiagramCommand(model, { groupId: tableGroup.id, type: 'group.delete' }));
    setConfirmDeleteGroup(false);
  }

  function handleAddColumn() {
    const columnId = createDiagramEntityId('column');
    const name = createUniqueColumnName(columns, 'new_column');

    // The sidebar creates columns directly so table editing stays in one place instead of opening a modal flow.
    apply(
      applyDiagramCommand(model, {
        type: 'column.create',
        columnId,
        tableId: table.id,
        name,
        columnType: { family: 'varchar', length: 160 },
        nullable: true,
      }),
    );
    setSelectedColumnId(columnId);
    // Column yang baru dibuat langsung menjadi anchor komentar supaya feedback tim bisa spesifik ke field baru.
    onColumnSelect?.(columnId);
  }

  function handleColumnSelect(columnId: string) {
    setSelectedColumnId(columnId);
    // Interaksi eksplisit dengan row column juga memindahkan target komentar aktif ke column tersebut.
    onColumnSelect?.(columnId);
  }

  function updateColumn(column: DatabaseColumn, changes: Partial<Omit<DatabaseColumn, 'id' | 'tableId'>>) {
    apply(applyDiagramCommand(model, { type: 'column.update', columnId: column.id, changes }));
  }

  function handleDeleteColumn(column: DatabaseColumn) {
    const nextColumnId = columns.find((currentColumn) => currentColumn.id !== column.id)?.id ?? null;

    apply(applyDiagramCommand(model, { type: 'column.delete', columnId: column.id }));
    setSelectedColumnId(nextColumnId);
    if (nextColumnId) {
      // Setelah delete, target komentar pindah ke column terdekat agar composer tidak menunjuk entity yang sudah hilang.
      onColumnSelect?.(nextColumnId);
    }
  }

  function handleDeleteTable() {
    if (readOnly) {
      return;
    }

    if (!confirmDeleteTable) {
      setConfirmDeleteTable(true);
      return;
    }

    // Deleting the table also removes its columns, indexes, checks, and relationships through schema-core normalization.
    apply(applyDiagramCommand(model, { type: 'table.delete', tableId: table.id }));
    onClearTableSelection();
  }

  const tableDisplayMode = getSidebarDisplayMode(table);
  const tableCollapsed = isTableDisplayCollapsed(table);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {showHeader ? (
        <div className="flex h-[var(--tabliodb-header-height)] shrink-0 items-center gap-2.5 border-b border-[rgb(var(--tabliodb-border))] px-3">
          <div
            className="grid size-8 shrink-0 place-items-center rounded-[13px] text-white shadow-[0_2px_0_rgb(var(--tabliodb-border-strong))]"
            style={{ backgroundColor: getDisplayTableColor(table.color) }}
          >
            <Columns3 className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Table structure
            </div>
            <div className="truncate text-[13px] font-extrabold leading-5">{table.name}</div>
          </div>
          <IconButton size="lg" icon={PanelLeft} label="Hide sidebar" onClick={onHide} variant="ghost" />
          <IconButton icon={X} label="Clear table selection" onClick={onClearTableSelection} variant="ghost" />
        </div>
      ) : null}

      <div
        className={cn(
          'tabliodb-scrollbar min-h-0 flex-1 p-3',
          activeAttributesColumnId ? 'overflow-hidden' : 'overflow-y-auto',
        )}
      >
        {readOnly ? (
          <div className="mb-3 rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] p-2.5 text-xs font-extrabold text-[rgb(var(--tabliodb-gold-text))]">
            Your role can inspect this table but cannot edit schema details.
          </div>
        ) : null}

        <section className="rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface))] p-3">
          <label className="block text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
            Table name
          </label>
          <InlineTextInput
            ariaLabel="Table name"
            className="mt-2"
            disabled={readOnly}
            onCommit={handleTableNameCommit}
            validate={createInlineStringValidator(inlineTableNameSchema)}
            value={table.name}
          />
          <div className="mt-3">
            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
              Color
            </div>
            {readOnly ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--tabliodb-border))] bg-white px-2.5 py-1 text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                <span className="size-3 rounded-full" style={{ backgroundColor: getDisplayTableColor(table.color) }} />
                {getTableColorLabel(getDisplayTableColor(table.color))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tableColorOptions.map((color) => {
                  const colorLabel = getTableColorLabel(color);

                  return (
                    <WithTooltip content={`Set table color to ${colorLabel}`} key={color}>
                      <button
                        aria-label={`Use ${colorLabel}`}
                        className="size-7 cursor-pointer rounded-full border-2 border-white transition hover:scale-105"
                        onClick={() => handleColorChange(color)}
                        style={{
                          backgroundColor: color,
                          boxShadow:
                            getDisplayTableColor(table.color) === color
                              ? `0 0 0 1px #ffffff, 0 0 0 4px ${color}, 0 2px 0 rgb(var(--tabliodb-border-strong))`
                              : '0 0 0 1px rgb(var(--tabliodb-border-strong)), 0 2px 0 rgb(var(--tabliodb-border-strong))',
                        }}
                        type="button"
                      />
                    </WithTooltip>
                  );
                })}
              </div>
            )}
          </div>
          <div className="mt-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Canvas view
              </span>
              <span className="rounded-full border border-[rgb(var(--tabliodb-border))] bg-white px-2 py-0.5 text-[10px] font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                {tableCollapsed ? 'Collapsed' : tableDisplayMode === 'pk_fk_only' ? 'Keys only' : 'All columns'}
              </span>
            </div>
            {!readOnly ? (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  <TableDisplayModeButton
                    active={!tableCollapsed && tableDisplayMode === 'all_columns'}
                    disabled={readOnly}
                    icon={Columns3}
                    label="All columns"
                    onClick={() => handleDisplayModeChange('all_columns')}
                  />
                  <TableDisplayModeButton
                    active={!tableCollapsed && tableDisplayMode === 'pk_fk_only'}
                    disabled={readOnly}
                    icon={KeyRound}
                    label="Keys only"
                    onClick={() => handleDisplayModeChange('pk_fk_only')}
                  />
                </div>
                <Button
                  className="mt-2 h-8 w-full gap-1.5 rounded-[10px] text-[12px] shadow-[0_2px_0_rgb(var(--tabliodb-border-strong))]"
                  onClick={handleCollapseToggle}
                  size="sm"
                  variant="secondary"
                >
                  {tableCollapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
                  {tableCollapsed ? 'Expand table' : 'Collapse table'}
                </Button>
              </>
            ) : null}
          </div>
          <div className="mt-3 border-t border-[rgb(var(--tabliodb-border))] pt-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Module
              </span>
              <span className="rounded-full border border-[rgb(var(--tabliodb-border))] bg-white px-2 py-0.5 text-[10px] font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                {tableGroup ? `${tableGroup.tableIds.length} tables` : 'None'}
              </span>
            </div>
            {!readOnly ? (
              <Select
                className={compactSelectClassName}
                disabled={groups.length === 0}
                onValueChange={handleGroupMembershipChange}
                options={[
                  { label: 'No module', value: unsetGroupValue },
                  ...groups.map((group) => ({
                    label: group.name,
                    value: group.id,
                  })),
                ]}
                value={tableGroup?.id ?? unsetGroupValue}
              />
            ) : (
              <div className="rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-border))] bg-white px-2.5 py-2 text-[13px] font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                {tableGroup?.name ?? 'No module'}
              </div>
            )}
            {tableGroup && !readOnly ? (
              <div className="mt-2 rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-border))] bg-white p-2">
                <InlineTextInput
                  ariaLabel="Module name"
                  disabled={readOnly}
                  onCommit={handleGroupNameCommit}
                  placeholder="Module name"
                  validate={createInlineStringValidator(inlineGroupNameSchema)}
                  value={tableGroup.name}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tableColorOptions.map((color) => {
                    const colorLabel = getTableColorLabel(color);

                    return (
                      <WithTooltip content={`Set module color to ${colorLabel}`} key={color}>
                        <button
                          aria-label={`Use ${colorLabel} for module`}
                          className="size-5 cursor-pointer rounded-full border-2 border-white transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={readOnly}
                          onClick={() => handleGroupColorChange(color)}
                          style={{
                            backgroundColor: color,
                            boxShadow:
                              getDisplayTableColor(tableGroup.color) === color
                                ? `0 0 0 1px #ffffff, 0 0 0 3px ${color}, 0 1px 0 rgb(var(--tabliodb-border-strong))`
                                : '0 0 0 1px rgb(var(--tabliodb-border-strong)), 0 1px 0 rgb(var(--tabliodb-border-strong))',
                          }}
                          type="button"
                        />
                      </WithTooltip>
                    );
                  })}
                </div>
                <Button
                  className="mt-2 h-8 w-full gap-1.5 rounded-[10px] text-[12px]"
                  disabled={readOnly}
                  onClick={handleDeleteGroup}
                  size="sm"
                  variant="secondary"
                >
                  <Trash2 className="size-3.5" />
                  {confirmDeleteGroup ? 'Confirm delete module' : 'Delete module'}
                </Button>
              </div>
            ) : !readOnly ? (
              <Button
                className="mt-2 h-8 w-full gap-1.5 rounded-[10px] text-[12px]"
                onClick={handleCreateGroup}
                size="sm"
                variant="soft"
              >
                <Plus className="size-3.5" />
                Create module from table
              </Button>
            ) : null}
          </div>
          {!readOnly ? (
            <Button
              className="mt-3 h-8 w-full gap-1.5 rounded-[10px] text-[12px] shadow-[0_2px_0_rgb(var(--tabliodb-danger-shadow))]"
              onClick={handleDeleteTable}
              size="sm"
              variant="danger"
            >
              <Trash2 className="size-3.5" />
              {confirmDeleteTable ? 'Confirm delete table' : 'Delete table'}
            </Button>
          ) : null}
        </section>

        <section className="mt-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-extrabold leading-5">Columns</h2>
              <p className="text-[12px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                {columns.length} fields in {table.name}
              </p>
            </div>
            {!readOnly ? (
              <Button onClick={handleAddColumn} size="sm" variant="soft">
                <Plus className="size-4" />
                Column
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            {columns.map((column) => (
              <ColumnEditorRow
                attributesOpen={activeAttributesColumnId === column.id}
                column={column}
                disabled={readOnly}
                enumsAvailable={Object.keys(model.enums).length > 0}
                key={column.id}
                model={model}
                onAttributesOpenChange={(open) => setActiveAttributesColumnId(open ? column.id : null)}
                onDelete={handleDeleteColumn}
                onSelect={handleColumnSelect}
                onUpdate={updateColumn}
                selected={selectedColumn?.id === column.id}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function TableDisplayModeButton({
  active,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  icon: typeof Columns3;
  label: string;
  onClick: () => void;
}) {
  return (
    <WithTooltip content={label}>
      <button
        aria-label={label}
        aria-pressed={active}
        className={cn(
          'inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border px-2 text-[11px] font-extrabold leading-none transition disabled:cursor-not-allowed disabled:opacity-60',
          active
            ? 'border-[rgb(var(--tabliodb-active-chip-border))] bg-[rgb(var(--tabliodb-active-chip-bg))] text-[rgb(var(--tabliodb-primary-text))] shadow-[0_1px_0_rgb(var(--tabliodb-active-chip-border))]'
            : 'border-[rgb(var(--tabliodb-border-strong))] bg-white text-[rgb(var(--tabliodb-ink-muted))] hover:bg-[rgb(var(--tabliodb-surface-raised))]',
        )}
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        <Icon className="size-3.5" />
        <span>{label}</span>
      </button>
    </WithTooltip>
  );
}

function getSidebarDisplayMode(table: DatabaseTable): Extract<TableDisplayMode, 'all_columns' | 'pk_fk_only'> {
  return table.displayMode === 'pk_fk_only' ? 'pk_fk_only' : 'all_columns';
}

function isTableDisplayCollapsed(table: DatabaseTable): boolean {
  return table.collapsed === true || table.displayMode === 'header_only';
}

function createInitialGroupBounds(table: DatabaseTable): {
  height: number;
  position: { x: number; y: number };
  width: number;
} {
  const tableWidth = Math.max(table.width, 288);
  const tableHeight = 38 + table.columnIds.length * 26 + 6;

  return {
    height: tableHeight + 70,
    position: {
      x: table.position.x - 36,
      y: table.position.y - 42,
    },
    width: tableWidth + 72,
  };
}

function createUniqueGroupName(groups: { name: string }[], baseName: string): string {
  const existingNames = new Set(groups.map((group) => group.name.toLowerCase()));

  if (!existingNames.has(baseName.toLowerCase())) {
    return baseName;
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${baseName} ${index}`;

    if (!existingNames.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  return `${baseName} ${Date.now()}`;
}

function titleCaseWords(value: string): string {
  const normalized = value.replace(/[_-]+/g, ' ').trim().replace(/\s+/g, ' ');

  if (!normalized) {
    return 'New';
  }

  return normalized.replace(/\b\w/g, (character) => character.toUpperCase());
}

function ColumnEditorRow({
  attributesOpen,
  column,
  disabled,
  enumsAvailable,
  model,
  onAttributesOpenChange,
  onDelete,
  onSelect,
  onUpdate,
  selected,
}: {
  attributesOpen: boolean;
  column: DatabaseColumn;
  disabled: boolean;
  enumsAvailable: boolean;
  model: DiagramModel;
  onAttributesOpenChange: (open: boolean) => void;
  onDelete: (column: DatabaseColumn) => void;
  onSelect: (columnId: string) => void;
  onUpdate: (column: DatabaseColumn, changes: Partial<Omit<DatabaseColumn, 'id' | 'tableId'>>) => void;
  selected: boolean;
}) {
  const [confirmDeleteColumn, setConfirmDeleteColumn] = useState(false);

  function handleOpenChange(open: boolean) {
    onAttributesOpenChange(open);

    if (!open) {
      setConfirmDeleteColumn(false);
    }
  }

  function handleDeleteColumn() {
    if (disabled) {
      return;
    }

    if (!confirmDeleteColumn) {
      setConfirmDeleteColumn(true);
      return;
    }

    // The second click confirms the destructive column action while keeping the primary attribute popover in one place.
    onDelete(column);
    onAttributesOpenChange(false);
  }

  return (
    <div
      className={cn(
        'rounded-[var(--tabliodb-radius-lg)] border bg-white p-2 transition',
        selected
          ? 'border-[rgb(var(--tabliodb-active-chip-border))] bg-[rgb(var(--tabliodb-selected-surface))] shadow-[inset_3px_0_0_rgb(var(--tabliodb-primary)),0_2px_0_rgb(var(--tabliodb-border))]'
          : 'border-[rgb(var(--tabliodb-border))] hover:bg-[rgb(var(--tabliodb-surface-raised))]',
      )}
      data-tabliodb-sidebar-column-id={column.id}
      onFocus={() => onSelect(column.id)}
      onMouseDown={() => onSelect(column.id)}
    >
      <div className="grid grid-cols-[12px_minmax(0,1fr)_28px] items-center gap-1.5">
        <GripVertical className="size-3.5 text-[rgb(var(--tabliodb-ink-subtle))]" />
        <InlineTextInput
          ariaLabel={`Column name ${column.name}`}
          className="min-w-0"
          disabled={disabled}
          onCommit={(value) => {
            const name = value;

            if (name && name !== column.name) {
              onUpdate(column, { name });
            }
          }}
          validate={createInlineStringValidator(inlineColumnNameSchema)}
          value={column.name}
        />
        <Popover onOpenChange={handleOpenChange} open={attributesOpen}>
          <WithTooltip content={`Open attributes and actions for ${column.name}`}>
            <PopoverTrigger asChild>
              <button
                aria-label={`Column actions for ${column.name}`}
                className="grid size-7 cursor-pointer place-items-center rounded-[var(--tabliodb-radius-sm)] text-[rgb(var(--tabliodb-ink-muted))] transition hover:bg-white"
                type="button"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </PopoverTrigger>
          </WithTooltip>
          <PopoverContent
            align="start"
            className="tabliodb-scrollbar max-h-[min(78dvh,540px)] w-[320px] overflow-y-auto overscroll-contain"
            side="right"
          >
            <ColumnAttributesPopoverContent
              column={column}
              confirmDeleteColumn={confirmDeleteColumn}
              disabled={disabled}
              model={model}
              onDelete={handleDeleteColumn}
              onUpdate={onUpdate}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_34px_34px_38px] items-center gap-1.5">
        <Select
          className={compactSelectClassName}
          disabled={disabled}
          onValueChange={(family) => {
            const nextType = createColumnTypeForFamily(family as ColumnTypeFamily, model, column.type);

            if (nextType) {
              onUpdate(column, { type: nextType });
            }
          }}
          options={columnTypeFamilyOptions.map((family) => ({
            disabled: family === 'enum' && !enumsAvailable,
            label: family,
            value: family,
          }))}
          value={column.type.family}
        />
        <ColumnToggle
          active={!column.nullable}
          disabled={disabled || column.primaryKey}
          label="Not nullable"
          onClick={() => onUpdate(column, { nullable: column.primaryKey ? false : !column.nullable })}
        >
          NN
        </ColumnToggle>
        <ColumnToggle
          active={column.primaryKey}
          disabled={disabled}
          label="Primary key"
          onClick={() =>
            onUpdate(column, { nullable: column.primaryKey ? column.nullable : false, primaryKey: !column.primaryKey })
          }
        >
          PK
        </ColumnToggle>
        <ColumnToggle
          active={column.unique}
          disabled={disabled}
          label="Unique"
          onClick={() => onUpdate(column, { unique: !column.unique })}
        >
          UQ
        </ColumnToggle>
      </div>
    </div>
  );
}

function ColumnAttributesPopoverContent({
  column,
  confirmDeleteColumn,
  disabled,
  model,
  onDelete,
  onUpdate,
}: {
  column: DatabaseColumn;
  confirmDeleteColumn: boolean;
  disabled: boolean;
  model: DiagramModel;
  onDelete: () => void;
  onUpdate: (column: DatabaseColumn, changes: Partial<Omit<DatabaseColumn, 'id' | 'tableId'>>) => void;
}) {
  const enumOptions = Object.values(model.enums);

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-extrabold leading-5">Column attributes</h2>
          <p className="truncate text-[12px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
            {column.name} / {formatColumnType(column.type)}
          </p>
        </div>
        <span className="rounded-full border border-[rgb(var(--tabliodb-active-chip-border))] bg-[rgb(var(--tabliodb-active-chip-bg))] px-2 py-1 text-[10px] font-extrabold text-[rgb(var(--tabliodb-primary-text))]">
          Active
        </span>
      </div>

      <div className="grid gap-2.5">
        {column.type.family === 'varchar' ? (
          <label className="block text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
            Length
            <InlineNumberInput
              className="mt-1"
              disabled={disabled}
              max={2048}
              min={1}
              onCommit={(length) => onUpdate(column, { type: { ...column.type, length, raw: undefined } })}
              value={column.type.length ?? 160}
            />
          </label>
        ) : null}

        {column.type.family === 'enum' ? (
          <label className="block text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
            Enum type
            <Select
              className={cn(compactSelectClassName, 'mt-1 text-[13px]')}
              disabled={disabled || enumOptions.length === 0}
              onValueChange={(enumId) => onUpdate(column, { type: { family: 'enum', enumId, raw: undefined } })}
              options={
                enumOptions.length > 0
                  ? enumOptions.map((databaseEnum) => ({ label: databaseEnum.name, value: databaseEnum.id }))
                  : [{ disabled: true, label: 'Create enum first', value: '__empty' }]
              }
              value={column.type.enumId ?? enumOptions[0]?.id}
            />
          </label>
        ) : null}

        <label className="block text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Default
          <InlineTextInput
            ariaLabel={`Column default ${column.name}`}
            className="mt-1"
            disabled={disabled}
            onCommit={(defaultValue) => onUpdate(column, { defaultValue: normalizeOptionalString(defaultValue) })}
            placeholder="Default value"
            validate={createInlineStringValidator(inlineColumnDefaultSchema)}
            value={column.defaultValue ?? ''}
          />
        </label>

        <label className="block text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Comment
          <InlineTextarea
            ariaLabel={`Column comment ${column.name}`}
            className="mt-1"
            disabled={disabled}
            onCommit={(comment) => onUpdate(column, { comment: normalizeOptionalString(comment) })}
            placeholder="Optional description for this column"
            validate={createInlineStringValidator(inlineColumnCommentSchema)}
            value={column.comment ?? ''}
          />
        </label>

        <label className="flex cursor-pointer items-center gap-2.5 rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-border))] p-2.5 text-[13px] font-bold transition hover:bg-[rgb(var(--tabliodb-surface))]">
          <Checkbox
            checked={column.autoIncrement}
            disabled={disabled}
            onCheckedChange={(checked) => onUpdate(column, { autoIncrement: checked === true })}
          />
          Auto increment
        </label>

        {!disabled ? (
          <div className="border-t border-[rgb(var(--tabliodb-border))] pt-2.5">
            <Button className="w-full justify-start" onClick={onDelete} size="sm" variant="danger">
              <Trash2 className="size-4" />
              {confirmDeleteColumn ? 'Confirm delete column' : 'Delete column'}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ColumnToggle({
  active,
  children,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <WithTooltip content={`${label}${active ? ' is enabled' : ' is disabled'}`}>
      <button
        aria-label={label}
        aria-pressed={active}
        className={cn(
          'inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-[10px] border px-1 text-[11px] font-extrabold leading-none transition disabled:cursor-not-allowed disabled:opacity-60',
          active
            ? 'border-[rgb(var(--tabliodb-active-chip-border))] bg-[rgb(var(--tabliodb-active-chip-bg))] text-[rgb(var(--tabliodb-primary-text))] shadow-[0_1px_0_rgb(var(--tabliodb-active-chip-border))]'
            : 'border-[rgb(var(--tabliodb-border-strong))] bg-white text-[rgb(var(--tabliodb-ink-muted))] hover:bg-[rgb(var(--tabliodb-surface))]',
        )}
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        {children}
      </button>
    </WithTooltip>
  );
}

function InlineTextInput({
  ariaLabel,
  className,
  disabled,
  onCommit,
  placeholder,
  validate,
  value,
}: {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  onCommit: (value: string) => void;
  placeholder?: string;
  validate?: (value: string) => InlineStringValidationResult;
  value: string;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value);
    setError(null);
  }, [value]);

  function commit() {
    const validation = validate?.(draft) ?? { error: null, value: draft };

    setError(validation.error);

    if (validation.error) {
      return;
    }

    // Inline controls normalize before committing so sidebar edits obey the same Zod contract as dialog forms.
    setDraft(validation.value);

    if (validation.value !== value) {
      onCommit(validation.value);
    }
  }

  return (
    <div className={className}>
      <Input
        aria-invalid={Boolean(error)}
        aria-label={ariaLabel}
        className={cn(
          inlineInputClassName,
          error
            ? 'border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] focus:border-[rgb(var(--tabliodb-danger))] focus:ring-[3px] focus:ring-[rgb(var(--tabliodb-danger-border))]'
            : undefined,
        )}
        disabled={disabled}
        onBlur={commit}
        onChange={(event) => {
          setDraft(event.currentTarget.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        value={draft}
      />
      <FieldError className="mt-1 text-[10px] leading-4">{error}</FieldError>
    </div>
  );
}

function InlineNumberInput({
  className,
  disabled,
  max,
  min,
  onCommit,
  value,
}: {
  className?: string;
  disabled?: boolean;
  max: number;
  min: number;
  onCommit: (value: number) => void;
  value: number;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit() {
    const parsedValue = Number(draft);

    if (!Number.isFinite(parsedValue)) {
      setDraft(String(value));
      return;
    }

    const nextValue = Math.min(Math.max(Math.round(parsedValue), min), max);

    setDraft(String(nextValue));

    if (nextValue !== value) {
      onCommit(nextValue);
    }
  }

  return (
    <Input
      className={cn(inlineInputClassName, className)}
      disabled={disabled}
      max={max}
      min={min}
      onBlur={commit}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
      }}
      type="number"
      value={draft}
    />
  );
}

function InlineTextarea({
  ariaLabel,
  className,
  disabled,
  onCommit,
  placeholder,
  validate,
  value,
}: {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  onCommit: (value: string) => void;
  placeholder?: string;
  validate?: (value: string) => InlineStringValidationResult;
  value: string;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value);
    setError(null);
  }, [value]);

  function commit() {
    const validation = validate?.(draft) ?? { error: null, value: draft };

    setError(validation.error);

    if (validation.error) {
      return;
    }

    setDraft(validation.value);

    if (validation.value !== value) {
      onCommit(validation.value);
    }
  }

  return (
    <div className={className}>
      <textarea
        aria-invalid={Boolean(error)}
        aria-label={ariaLabel}
        className={cn(
          'min-h-16 w-full resize-none rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 py-2 text-[13px] font-semibold outline-none transition placeholder:text-[rgb(var(--tabliodb-ink-subtle))] focus:border-[rgb(var(--tabliodb-primary))] focus:ring-[3px] focus:ring-[rgb(var(--tabliodb-focus-ring))] disabled:cursor-not-allowed disabled:opacity-60',
          error
            ? 'border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] focus:border-[rgb(var(--tabliodb-danger))] focus:ring-[3px] focus:ring-[rgb(var(--tabliodb-danger-border))]'
            : undefined,
        )}
        disabled={disabled}
        onBlur={commit}
        onChange={(event) => {
          setDraft(event.currentTarget.value);
          setError(null);
        }}
        placeholder={placeholder}
        value={draft}
      />
      <FieldError className="mt-1 text-[10px] leading-4">{error}</FieldError>
    </div>
  );
}

function createInlineStringValidator(schema: z.ZodType<string>) {
  return (value: string): InlineStringValidationResult => {
    const result = schema.safeParse(value);

    if (!result.success) {
      return {
        error: result.error.issues[0]?.message ?? 'Invalid value.',
        value,
      };
    }

    return {
      error: null,
      value: result.data,
    };
  };
}

function createColumnTypeForFamily(
  family: ColumnTypeFamily,
  model: DiagramModel,
  currentType: ColumnTypeSpec,
): ColumnTypeSpec | null {
  const preservedType = currentType.family === family ? currentType : undefined;

  if (family === 'varchar') {
    return { ...(preservedType ?? {}), family, length: preservedType?.length ?? 160, raw: undefined };
  }

  if (family === 'enum') {
    const enumId = currentType.enumId ?? Object.keys(model.enums)[0];

    // Enum columns require a real enum entity reference, so the disabled select option never emits an invalid update.
    return enumId ? { family, enumId, raw: undefined } : null;
  }

  return preservedType ?? { family };
}

function createUniqueColumnName(columns: DatabaseColumn[], baseName: string): string {
  const existingNames = new Set(columns.map((column) => column.name));

  if (!existingNames.has(baseName)) {
    return baseName;
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${baseName}_${index}`;

    if (!existingNames.has(candidate)) {
      return candidate;
    }
  }

  return `${baseName}_${Date.now().toString(36)}`;
}

function normalizeOptionalString(value: string): string | undefined {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}
