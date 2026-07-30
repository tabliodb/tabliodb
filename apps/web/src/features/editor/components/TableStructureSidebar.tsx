import {
  applyDiagramCommand,
  createDiagramEntityId,
  getTableColumns,
  type ColumnTypeFamily,
  type ColumnTypeSpec,
  type DatabaseColumn,
  type DiagramModel,
} from '@tabliodb/schema-core';
import { Button, Checkbox, IconButton, Input, Popover, PopoverContent, PopoverTrigger, Select, cn } from '@tabliodb/ui';
import {
  Columns3,
  GripVertical,
  KeyRound,
  MoreHorizontal,
  PanelLeftClose,
  Palette,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { formatColumnType } from '../diagram-model';

const tableColorOptions = ['#58cc02', '#1cb0f6', '#ffc800', '#ff4b4b', '#8b5cf6', '#0f766e'] as const;
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
  'h-9 rounded-[13px] border-2 border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 text-sm font-extrabold shadow-none outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-primary)/0.16)] disabled:cursor-not-allowed disabled:opacity-60';

const compactSelectClassName =
  'h-9 rounded-[13px] border-2 border-[rgb(var(--tabliodb-border-strong))] px-3 text-sm shadow-none';

export type TableStructureSidebarProps = {
  model: DiagramModel;
  onClearTableSelection: () => void;
  onDraftChange: () => void;
  onHide: () => void;
  onModelChange: (model: DiagramModel) => void;
  readOnly?: boolean;
  selectedTableId: string;
};

export function TableStructureSidebar({
  model,
  onClearTableSelection,
  onDraftChange,
  onHide,
  onModelChange,
  readOnly = false,
  selectedTableId,
}: TableStructureSidebarProps) {
  const table = model.tables[selectedTableId] ?? null;
  const columns = useMemo(() => (table ? getTableColumns(model, table.id) : []), [model, table]);
  const [activeAttributesColumnId, setActiveAttributesColumnId] = useState<string | null>(null);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [confirmDeleteTable, setConfirmDeleteTable] = useState(false);
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
    setActiveAttributesColumnId(null);
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
  }

  function updateColumn(column: DatabaseColumn, changes: Partial<Omit<DatabaseColumn, 'id' | 'tableId'>>) {
    apply(applyDiagramCommand(model, { type: 'column.update', columnId: column.id, changes }));
  }

  function handleDeleteColumn(column: DatabaseColumn) {
    const nextColumnId = columns.find((currentColumn) => currentColumn.id !== column.id)?.id ?? null;

    apply(applyDiagramCommand(model, { type: 'column.delete', columnId: column.id }));
    setSelectedColumnId(nextColumnId);
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

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b-2 border-[rgb(var(--tabliodb-border))] px-4">
        <div
          className="grid size-9 shrink-0 place-items-center rounded-2xl text-white shadow-[0_3px_0_rgb(var(--tabliodb-border-strong))]"
          style={{ backgroundColor: table.color ?? '#0f766e' }}
        >
          <Columns3 className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
            Table structure
          </div>
          <div className="truncate text-sm font-extrabold">{table.name}</div>
        </div>
        <IconButton icon={PanelLeftClose} label="Hide sidebar" onClick={onHide} variant="ghost" />
        <IconButton icon={X} label="Back to projects" onClick={onClearTableSelection} variant="ghost" />
      </div>

      <div
        className={cn(
          'tabliodb-scrollbar min-h-0 flex-1 p-4 pb-28',
          activeAttributesColumnId ? 'overflow-hidden' : 'overflow-y-auto',
        )}
      >
        {readOnly ? (
          <div className="mb-4 rounded-[16px] border-2 border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] p-3 text-xs font-extrabold text-[rgb(var(--tabliodb-gold-text))]">
            Your role can inspect this table but cannot edit schema details.
          </div>
        ) : null}

        <section className="rounded-[18px] border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface))] p-4">
          <label className="block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
            Table name
          </label>
          <InlineTextInput
            className="mt-2"
            disabled={readOnly}
            onCommit={handleTableNameCommit}
            onDraftChange={onDraftChange}
            value={table.name}
          />
          <div className="mt-3 flex items-center gap-2.5">
            <Palette className="size-4 text-[rgb(var(--tabliodb-ink-muted))]" />
            <div className="flex flex-wrap gap-2.5">
              {tableColorOptions.map((color) => (
                <button
                  aria-label={`Use ${color}`}
                  className={cn(
                    'size-8 cursor-pointer rounded-full border-2 border-white shadow-[0_0_0_2px_rgb(var(--tabliodb-border-strong))] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60',
                    table.color === color && 'shadow-[0_0_0_3px_rgb(var(--tabliodb-primary))]',
                  )}
                  disabled={readOnly}
                  key={color}
                  onClick={() => handleColorChange(color)}
                  style={{ backgroundColor: color }}
                  type="button"
                />
              ))}
            </div>
          </div>
          <Button
            className="mt-4 h-12 w-full justify-start text-sm"
            disabled={readOnly}
            onClick={handleDeleteTable}
            variant="danger"
          >
            <Trash2 className="size-4" />
            {confirmDeleteTable ? 'Confirm delete table' : 'Delete table'}
          </Button>
        </section>

        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold">Columns</h2>
              <p className="text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                {columns.length} fields in {table.name}
              </p>
            </div>
            <Button disabled={readOnly} onClick={handleAddColumn} size="sm" variant="soft">
              <Plus className="size-4" />
              Column
            </Button>
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
                onDraftChange={onDraftChange}
                onSelect={setSelectedColumnId}
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

function ColumnEditorRow({
  attributesOpen,
  column,
  disabled,
  enumsAvailable,
  model,
  onAttributesOpenChange,
  onDelete,
  onDraftChange,
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
  onDraftChange: () => void;
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
        'rounded-[16px] border-2 bg-white p-3 transition',
        selected
          ? 'border-[rgb(var(--tabliodb-primary))] bg-[rgb(var(--tabliodb-primary-soft))] shadow-[0_3px_0_rgb(var(--tabliodb-primary-border))]'
          : 'border-[rgb(var(--tabliodb-border))] hover:bg-[rgb(var(--tabliodb-surface-raised))]',
      )}
      onFocus={() => onSelect(column.id)}
      onMouseDown={() => onSelect(column.id)}
    >
      <div className="grid grid-cols-[16px_minmax(0,1fr)_32px] items-center gap-2">
        <GripVertical className="size-4 text-[rgb(var(--tabliodb-ink-subtle))]" />
        <InlineTextInput
          className="min-w-0"
          disabled={disabled}
          onCommit={(value) => {
            const name = value.trim();

            if (name && name !== column.name) {
              onUpdate(column, { name });
            }
          }}
          onDraftChange={onDraftChange}
          value={column.name}
        />
        <Popover onOpenChange={handleOpenChange} open={attributesOpen}>
          <PopoverTrigger asChild>
            <button
              aria-label={`Column actions for ${column.name}`}
              className="grid size-8 cursor-pointer place-items-center rounded-[12px] text-[rgb(var(--tabliodb-ink-muted))] transition hover:bg-white"
              type="button"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="tabliodb-scrollbar max-h-[min(78dvh,560px)] w-[340px] overflow-y-auto overscroll-contain"
            side="right"
          >
            <ColumnAttributesPopoverContent
              column={column}
              confirmDeleteColumn={confirmDeleteColumn}
              disabled={disabled}
              model={model}
              onDelete={handleDeleteColumn}
              onDraftChange={onDraftChange}
              onUpdate={onUpdate}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_34px_34px_42px] items-center gap-2">
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
          N
        </ColumnToggle>
        <ColumnToggle
          active={column.primaryKey}
          disabled={disabled}
          label="Primary key"
          onClick={() =>
            onUpdate(column, { nullable: column.primaryKey ? column.nullable : false, primaryKey: !column.primaryKey })
          }
        >
          <KeyRound className="size-3.5" />
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
  onDraftChange,
  onUpdate,
}: {
  column: DatabaseColumn;
  confirmDeleteColumn: boolean;
  disabled: boolean;
  model: DiagramModel;
  onDelete: () => void;
  onDraftChange: () => void;
  onUpdate: (column: DatabaseColumn, changes: Partial<Omit<DatabaseColumn, 'id' | 'tableId'>>) => void;
}) {
  const enumOptions = Object.values(model.enums);

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-extrabold">Column attributes</h2>
          <p className="mt-1 truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
            {column.name} / {formatColumnType(column.type)}
          </p>
        </div>
        <span className="rounded-full bg-[rgb(var(--tabliodb-primary-soft))] px-2 py-1 text-[10px] font-extrabold text-[rgb(var(--tabliodb-primary-text))]">
          Active
        </span>
      </div>

      <div className="grid gap-3">
        {column.type.family === 'varchar' ? (
          <label className="block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
            Length
            <InlineNumberInput
              className="mt-1"
              disabled={disabled}
              max={2048}
              min={1}
              onCommit={(length) => onUpdate(column, { type: { ...column.type, length, raw: undefined } })}
              onDraftChange={onDraftChange}
              value={column.type.length ?? 160}
            />
          </label>
        ) : null}

        {column.type.family === 'enum' ? (
          <label className="block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
            Enum type
            <Select
              className={cn(compactSelectClassName, 'mt-1 h-11 text-sm')}
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

        <label className="block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Default
          <InlineTextInput
            className="mt-1"
            disabled={disabled}
            onCommit={(defaultValue) => onUpdate(column, { defaultValue: normalizeOptionalString(defaultValue) })}
            onDraftChange={onDraftChange}
            placeholder="Default value"
            value={column.defaultValue ?? ''}
          />
        </label>

        <label className="block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Comment
          <InlineTextarea
            className="mt-1"
            disabled={disabled}
            onCommit={(comment) => onUpdate(column, { comment: normalizeOptionalString(comment) })}
            onDraftChange={onDraftChange}
            placeholder="Optional description for this column"
            value={column.comment ?? ''}
          />
        </label>

        <label className="flex cursor-pointer items-center gap-3 rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] p-3 text-sm font-extrabold transition hover:bg-[rgb(var(--tabliodb-surface))]">
          <Checkbox
            checked={column.autoIncrement}
            disabled={disabled}
            onCheckedChange={(checked) => onUpdate(column, { autoIncrement: checked === true })}
          />
          Auto increment
        </label>

        <div className="border-t-2 border-[rgb(var(--tabliodb-border))] pt-3">
          <Button className="w-full justify-start" disabled={disabled} onClick={onDelete} variant="danger">
            <Trash2 className="size-4" />
            {confirmDeleteColumn ? 'Confirm delete column' : 'Delete column'}
          </Button>
        </div>
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
    <button
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'grid h-9 w-full cursor-pointer place-items-center rounded-[13px] border-2 text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60',
        active
          ? 'border-[rgb(var(--tabliodb-primary))] bg-[rgb(var(--tabliodb-primary))] text-white shadow-[0_2px_0_rgb(var(--tabliodb-primary-shadow))]'
          : 'border-[rgb(var(--tabliodb-border))] bg-white text-[rgb(var(--tabliodb-ink-muted))] hover:bg-[rgb(var(--tabliodb-surface))]',
      )}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function InlineTextInput({
  className,
  disabled,
  onCommit,
  onDraftChange,
  placeholder,
  value,
}: {
  className?: string;
  disabled?: boolean;
  onCommit: (value: string) => void;
  onDraftChange?: () => void;
  placeholder?: string;
  value: string;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit() {
    if (draft !== value) {
      onCommit(draft);
    }
  }

  function handleChange(nextValue: string) {
    setDraft(nextValue);

    if (nextValue !== value) {
      // Dirty feedback should appear while the user types, not only after blur commits the field.
      onDraftChange?.();
    }
  }

  return (
    <Input
      className={cn(inlineInputClassName, className)}
      disabled={disabled}
      onBlur={commit}
      onChange={(event) => handleChange(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
      }}
      placeholder={placeholder}
      value={draft}
    />
  );
}

function InlineNumberInput({
  className,
  disabled,
  max,
  min,
  onCommit,
  onDraftChange,
  value,
}: {
  className?: string;
  disabled?: boolean;
  max: number;
  min: number;
  onCommit: (value: number) => void;
  onDraftChange?: () => void;
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
      onChange={(event) => {
        const nextValue = event.currentTarget.value;

        setDraft(nextValue);

        if (nextValue !== String(value)) {
          // Number drafts can be temporarily invalid while typing, but they still signal that the editor has pending work.
          onDraftChange?.();
        }
      }}
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
  className,
  disabled,
  onCommit,
  onDraftChange,
  placeholder,
  value,
}: {
  className?: string;
  disabled?: boolean;
  onCommit: (value: string) => void;
  onDraftChange?: () => void;
  placeholder?: string;
  value: string;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <textarea
      className={cn(
        'min-h-20 w-full resize-none rounded-[14px] border-2 border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 py-2 text-sm font-semibold outline-none transition placeholder:text-[rgb(var(--tabliodb-ink-subtle))] focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-primary)/0.16)] disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      disabled={disabled}
      onBlur={() => {
        if (draft !== value) {
          onCommit(draft);
        }
      }}
      onChange={(event) => {
        const nextValue = event.currentTarget.value;

        setDraft(nextValue);

        if (nextValue !== value) {
          // Textarea edits use the same immediate dirty feedback as compact inline inputs.
          onDraftChange?.();
        }
      }}
      placeholder={placeholder}
      value={draft}
    />
  );
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
