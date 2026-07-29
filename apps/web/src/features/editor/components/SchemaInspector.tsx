import { zodResolver } from '@hookform/resolvers/zod';
import {
  applyDiagramCommand,
  applyDiagramCommands,
  getRelationshipColumnPairs,
  getTableColumns,
  type ColumnTypeFamily,
  type ColumnTypeSpec,
  type DatabaseColumn,
  type DatabaseIndex,
  type DatabaseIndexColumn,
  type DatabaseRelationship,
  type DatabaseTable,
  type DiagramModel,
  type ReferentialAction,
} from '@tabliodb/schema-core';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FieldError,
  Input,
  Surface,
  cn,
} from '@tabliodb/ui';
import { Pencil, Plus, Save, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState, type InputHTMLAttributes } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { formatColumnType } from '../diagram-model';

const tableColorOptions = ['#58cc02', '#1cb0f6', '#ffc800', '#ff4b4b', '#8b5cf6', '#0f766e'] as const;

const editTableFormSchema = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a valid hex color.'),
  name: z.string().trim().min(1, 'Table name is required.').max(64, 'Keep the table name under 64 characters.'),
  width: z.number().int().min(240, 'Minimum width is 240px.').max(720, 'Maximum width is 720px.'),
});

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

const columnFormSchema = z.object({
  autoIncrement: z.boolean(),
  comment: z.string().trim().max(240, 'Keep the comment under 240 characters.'),
  defaultValue: z.string().trim().max(120, 'Keep the default value under 120 characters.'),
  family: z.enum(columnTypeFamilyOptions),
  length: z.number().int().min(1).max(2048).optional(),
  name: z
    .string()
    .trim()
    .min(1, 'Column name is required.')
    .max(64, 'Keep the column name under 64 characters.')
    .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, numbers, and underscores.'),
  nullable: z.boolean(),
  primaryKey: z.boolean(),
  unique: z.boolean(),
});

type EditTableFormState = z.infer<typeof editTableFormSchema>;
type ColumnFormState = z.infer<typeof columnFormSchema>;

const unsetSelectValue = '__unset' as const;

const indexMethodOptions = [unsetSelectValue, 'btree', 'hash', 'gin', 'gist', 'brin'] as const;
const indexOrderOptions = [unsetSelectValue, 'asc', 'desc'] as const;
const indexNullsOptions = [unsetSelectValue, 'first', 'last'] as const;

const indexFormSchema = z.object({
  columnIds: z.array(z.string()).min(1, 'Choose at least one index column.'),
  comment: z.string().trim().max(240, 'Keep the comment under 240 characters.'),
  includeColumnIds: z.array(z.string()),
  method: z.enum(indexMethodOptions),
  name: z
    .string()
    .trim()
    .min(1, 'Index name is required.')
    .max(96, 'Keep the index name under 96 characters.')
    .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, numbers, and underscores.'),
  nullsByColumnId: z.record(z.string(), z.enum(indexNullsOptions)),
  orderByColumnId: z.record(z.string(), z.enum(indexOrderOptions)),
  unique: z.boolean(),
  where: z.string().trim().max(240, 'Keep the WHERE expression under 240 characters.'),
});

type IndexFormState = z.infer<typeof indexFormSchema>;

const relationshipCardinalityOptions = [
  'one_to_one',
  'one_to_many',
  'many_to_many',
] as const satisfies readonly DatabaseRelationship['cardinality'][];

const referentialActionOptions = [
  unsetSelectValue,
  'cascade',
  'restrict',
  'set_null',
  'set_default',
  'no_action',
] as const;

const matchTypeOptions = [unsetSelectValue, 'simple', 'full', 'partial'] as const;

const relationshipFormSchema = z.object({
  cardinality: z.enum(relationshipCardinalityOptions),
  comment: z.string().trim().max(240, 'Keep the comment under 240 characters.'),
  deferrable: z.boolean(),
  matchType: z.enum(matchTypeOptions),
  name: z.string().trim().max(96, 'Keep the relationship name under 96 characters.'),
  onDelete: z.enum(referentialActionOptions),
  onUpdate: z.enum(referentialActionOptions),
  sourceColumnId: z.string().min(1, 'Choose a primary-key column.'),
  sourceTableId: z.string().min(1, 'Choose a primary-key table.'),
  targetColumnId: z.string().min(1, 'Choose a foreign-key column.'),
  targetTableId: z.string().min(1, 'Choose a foreign-key table.'),
});

type RelationshipFormState = z.infer<typeof relationshipFormSchema>;

export type SchemaInspectorProps = {
  latestSnapshotVersion: number;
  model: DiagramModel;
  onModelChange: (model: DiagramModel) => void;
  selectedTableId: string | null;
};

export function SchemaInspector({
  latestSnapshotVersion,
  model,
  onModelChange,
  selectedTableId,
}: SchemaInspectorProps) {
  const selectedTable = selectedTableId ? model.tables[selectedTableId] : null;
  const selectedColumns = selectedTable ? getTableColumns(model, selectedTable.id) : [];
  const selectedIndexes = selectedTable ? getTableIndexes(model, selectedTable) : [];
  const selectedRelationships = selectedTable ? getTableRelationships(model, selectedTable.id) : [];
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [selectedIndexId, setSelectedIndexId] = useState<string | null>(null);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null);
  const selectedColumnIds = selectedColumns.map((column) => column.id).join('|');
  const selectedIndexIds = selectedIndexes.map((index) => index.id).join('|');
  const selectedRelationshipIds = selectedRelationships.map((relationship) => relationship.id).join('|');
  const selectedColumn = selectedColumns.find((column) => column.id === selectedColumnId) ?? null;
  const selectedIndex = selectedIndexes.find((index) => index.id === selectedIndexId) ?? null;
  const selectedRelationship =
    selectedRelationships.find((relationship) => relationship.id === selectedRelationshipId) ?? null;
  const reviewSignals = useMemo(() => getReviewSignals(model), [model]);

  useEffect(() => {
    if (!selectedTable) {
      setSelectedColumnId(null);
      return;
    }

    if (!selectedColumnId || !selectedColumns.some((column) => column.id === selectedColumnId)) {
      // Keep column selection scoped to the active table so inspector actions never target a stale column id.
      setSelectedColumnId(selectedColumns[0]?.id ?? null);
    }
  }, [selectedColumnId, selectedColumnIds, selectedColumns, selectedTable]);

  useEffect(() => {
    if (!selectedTable) {
      setSelectedIndexId(null);
      return;
    }

    if (!selectedIndexId || !selectedIndexes.some((index) => index.id === selectedIndexId)) {
      // Keep index actions scoped to the active table, matching the table/column/relationship inspector behavior.
      setSelectedIndexId(selectedIndexes[0]?.id ?? null);
    }
  }, [selectedIndexId, selectedIndexIds, selectedIndexes, selectedTable]);

  useEffect(() => {
    if (!selectedTable) {
      setSelectedRelationshipId(null);
      return;
    }

    if (
      !selectedRelationshipId ||
      !selectedRelationships.some((relationship) => relationship.id === selectedRelationshipId)
    ) {
      const relationshipForColumn = selectedColumnId
        ? selectedRelationships.find((relationship) => relationshipTouchesColumn(relationship, selectedColumnId))
        : null;

      // Relationship selection follows the active table and prefers the active column when there is a direct wire.
      setSelectedRelationshipId(relationshipForColumn?.id ?? selectedRelationships[0]?.id ?? null);
    }
  }, [selectedColumnId, selectedRelationshipId, selectedRelationshipIds, selectedRelationships, selectedTable]);

  return (
    <aside className="overflow-y-auto border-l-2 border-[rgb(var(--tabliodb-border))] bg-white">
      <div className="flex h-16 items-center border-b-2 border-[rgb(var(--tabliodb-border))] px-5 text-sm font-extrabold">
        Inspector
      </div>
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap gap-2">
          <Badge variant="green">{model.dialect}</Badge>
          <Badge variant="blue">v{latestSnapshotVersion}</Badge>
        </div>
        <section>
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
            Selected table
          </h2>
          {selectedTable ? (
            <Surface className="mt-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold">{selectedTable.name}</div>
                  <div className="mt-1 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                    {selectedColumns.length} columns / {selectedTable.indexIds.length} indexes /{' '}
                    {countTableRelationships(model, selectedTable)} relationships
                  </div>
                </div>
                <span
                  className="mt-1 size-4 shrink-0 rounded-full border-2 border-white shadow-[0_0_0_2px_rgb(var(--tabliodb-border-strong))]"
                  style={{ backgroundColor: selectedTable.color ?? '#0f766e' }}
                />
              </div>
              <div className="mt-3 flex gap-2">
                <EditTableDialog model={model} onModelChange={onModelChange} table={selectedTable} />
                <AddColumnDialog model={model} onModelChange={onModelChange} table={selectedTable} />
              </div>
              <div className="mt-3 space-y-1">
                {selectedColumns.map((column) => (
                  <button
                    aria-pressed={selectedColumnId === column.id}
                    className={cn(
                      'grid w-full cursor-pointer grid-cols-[1fr_auto] gap-2 rounded-xl px-2 py-2 text-left text-xs transition hover:bg-[rgb(var(--tabliodb-surface-raised))]',
                      selectedColumnId === column.id &&
                        'bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]',
                    )}
                    key={column.id}
                    onClick={() => setSelectedColumnId(column.id)}
                    type="button"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-extrabold text-[rgb(var(--tabliodb-ink))]">{column.name}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {column.primaryKey ? <ColumnBadge>PK</ColumnBadge> : null}
                        {column.unique ? <ColumnBadge>UQ</ColumnBadge> : null}
                        {!column.nullable ? <ColumnBadge>NN</ColumnBadge> : null}
                      </div>
                    </div>
                    <span className="font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                      {formatColumnType(column.type)}
                    </span>
                  </button>
                ))}
              </div>
            </Surface>
          ) : (
            <Surface className="mt-2 border-dashed p-4 text-sm font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
              No table selected
            </Surface>
          )}
        </section>
        <ColumnInspector column={selectedColumn} model={model} onModelChange={onModelChange} table={selectedTable} />
        <IndexBuilderPanel
          columns={selectedColumns}
          index={selectedIndex}
          indexes={selectedIndexes}
          model={model}
          onIndexSelect={setSelectedIndexId}
          onModelChange={onModelChange}
          selectedIndexId={selectedIndexId}
          table={selectedTable}
        />
        <RelationshipInspector
          model={model}
          onModelChange={onModelChange}
          onRelationshipSelect={setSelectedRelationshipId}
          relationship={selectedRelationship}
          relationships={selectedRelationships}
          selectedRelationshipId={selectedRelationshipId}
        />
        <section>
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
            Review signals
          </h2>
          <div className="mt-2 space-y-2 text-sm">
            {reviewSignals.map((signal) => (
              <Surface
                className="border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] p-3 font-bold text-[rgb(var(--tabliodb-gold-text))] shadow-[0_3px_0_rgb(var(--tabliodb-gold-border))]"
                key={signal}
              >
                {signal}
              </Surface>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

function EditTableDialog({
  model,
  onModelChange,
  table,
}: {
  model: DiagramModel;
  onModelChange: (model: DiagramModel) => void;
  table: DatabaseTable;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<EditTableFormState>({
    defaultValues: getEditTableDefaults(table),
    resolver: zodResolver(editTableFormSchema),
  });
  const { errors } = form.formState;
  const selectedColor = form.watch('color');

  useEffect(() => {
    if (open) {
      form.reset(getEditTableDefaults(table));
    }
  }, [form, open, table]);

  function handleSubmit(values: EditTableFormState) {
    onModelChange(
      applyDiagramCommands(model, [
        { type: 'table.rename', tableId: table.id, name: values.name.trim() },
        { type: 'table.resize', tableId: table.id, width: values.width },
        { type: 'table.changeColor', tableId: table.id, color: values.color },
      ]),
    );
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <SlidersHorizontal className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit table</DialogTitle>
            <DialogDescription>Adjust the table identity and visual width.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-4">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Table name
              </span>
              <Input autoFocus aria-invalid={Boolean(errors.name)} {...form.register('name')} />
              <FieldError>{errors.name?.message}</FieldError>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Width
              </span>
              <Input
                aria-invalid={Boolean(errors.width)}
                min={240}
                max={720}
                type="number"
                {...form.register('width', { valueAsNumber: true })}
              />
              <FieldError>{errors.width?.message}</FieldError>
            </label>
            <div>
              <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Color
              </span>
              <div className="flex flex-wrap gap-2">
                {tableColorOptions.map((color) => (
                  <button
                    aria-label={`Use ${color}`}
                    className={cn(
                      'size-9 cursor-pointer rounded-full border-2 border-white shadow-[0_0_0_2px_rgb(var(--tabliodb-border-strong))] transition hover:scale-105',
                      selectedColor === color && 'shadow-[0_0_0_3px_rgb(var(--tabliodb-primary))]',
                    )}
                    key={color}
                    onClick={() => form.setValue('color', color, { shouldDirty: true, shouldValidate: true })}
                    style={{ backgroundColor: color }}
                    type="button"
                  />
                ))}
              </div>
              <Input className="mt-3" aria-invalid={Boolean(errors.color)} {...form.register('color')} />
              <FieldError>{errors.color?.message}</FieldError>
            </div>
          </div>
          <DialogFooter className="mt-5">
            <Button onClick={() => setOpen(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button type="submit">
              <Save className="size-4" />
              Save table
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddColumnDialog({
  model,
  onModelChange,
  table,
}: {
  model: DiagramModel;
  onModelChange: (model: DiagramModel) => void;
  table: DatabaseTable;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<ColumnFormState>({
    defaultValues: getNewColumnDefaults(),
    resolver: zodResolver(columnFormSchema),
  });
  const { errors } = form.formState;
  const family = form.watch('family');

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset(getNewColumnDefaults());
    }
  }

  function handleSubmit(values: ColumnFormState) {
    onModelChange(
      applyDiagramCommand(model, {
        type: 'column.create',
        tableId: table.id,
        name: values.name.trim(),
        columnType: createColumnType(values),
        autoIncrement: values.autoIncrement,
        comment: normalizeOptionalString(values.comment),
        defaultValue: normalizeOptionalString(values.defaultValue),
        nullable: values.primaryKey ? false : values.nullable,
        primaryKey: values.primaryKey,
        unique: values.unique,
      }),
    );
    handleOpenChange(false);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="soft">
          <Plus className="size-4" />
          Column
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>New column</DialogTitle>
            <DialogDescription>Add a typed column to {table.name}.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-4">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Column name
              </span>
              <Input
                autoFocus
                aria-invalid={Boolean(errors.name)}
                placeholder="created_at"
                {...form.register('name')}
              />
              <FieldError>{errors.name?.message}</FieldError>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Type
              </span>
              <select
                className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-primary)/0.18)]"
                {...form.register('family')}
              >
                {columnTypeFamilyOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            {family === 'varchar' ? (
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Length
                </span>
                <Input
                  aria-invalid={Boolean(errors.length)}
                  min={1}
                  max={2048}
                  type="number"
                  {...form.register('length', { valueAsNumber: true })}
                />
                <FieldError>{errors.length?.message}</FieldError>
              </label>
            ) : null}
            <div className="grid gap-2">
              <CheckboxField label="Primary key" {...form.register('primaryKey')} />
              <CheckboxField label="Unique" {...form.register('unique')} />
              <CheckboxField label="Auto increment" {...form.register('autoIncrement')} />
              <CheckboxField label="Nullable" {...form.register('nullable')} />
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Default value
              </span>
              <Input placeholder="now()" {...form.register('defaultValue')} />
              <FieldError>{errors.defaultValue?.message}</FieldError>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Comment
              </span>
              <Input placeholder="Shown in generated docs later" {...form.register('comment')} />
              <FieldError>{errors.comment?.message}</FieldError>
            </label>
          </div>
          <DialogFooter className="mt-5">
            <Button onClick={() => handleOpenChange(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button type="submit">
              <Plus className="size-4" />
              Add column
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ColumnInspector({
  column,
  model,
  onModelChange,
  table,
}: {
  column: DatabaseColumn | null;
  model: DiagramModel;
  onModelChange: (model: DiagramModel) => void;
  table: DatabaseTable | null;
}) {
  return (
    <section>
      <h2 className="text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
        Selected column
      </h2>
      {column && table ? (
        <Surface className="mt-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold">{column.name}</div>
              <div className="mt-1 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                {table.name} / {formatColumnType(column.type)}
              </div>
            </div>
            <EditColumnDialog column={column} model={model} onModelChange={onModelChange} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <ColumnFact label="Primary key" value={column.primaryKey ? 'Yes' : 'No'} />
            <ColumnFact label="Nullable" value={column.nullable ? 'Yes' : 'No'} />
            <ColumnFact label="Unique" value={column.unique ? 'Yes' : 'No'} />
            <ColumnFact label="Auto inc" value={column.autoIncrement ? 'Yes' : 'No'} />
            <ColumnFact label="Relations" value={String(countColumnRelationships(model, column))} />
            <ColumnFact label="Default" value={column.defaultValue || '-'} />
          </div>
          {column.comment ? (
            <p className="mt-3 rounded-xl bg-[rgb(var(--tabliodb-surface-raised))] p-3 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
              {column.comment}
            </p>
          ) : null}
        </Surface>
      ) : (
        <Surface className="mt-2 border-dashed p-4 text-sm font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
          No column selected
        </Surface>
      )}
    </section>
  );
}

function EditColumnDialog({
  column,
  model,
  onModelChange,
}: {
  column: DatabaseColumn;
  model: DiagramModel;
  onModelChange: (model: DiagramModel) => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<ColumnFormState>({
    defaultValues: getColumnDefaults(column),
    resolver: zodResolver(columnFormSchema),
  });
  const { errors } = form.formState;
  const family = form.watch('family');

  useEffect(() => {
    if (open) {
      form.reset(getColumnDefaults(column));
    }
  }, [column, form, open]);

  function handleSubmit(values: ColumnFormState) {
    onModelChange(
      applyDiagramCommand(model, {
        type: 'column.update',
        columnId: column.id,
        changes: {
          autoIncrement: values.autoIncrement,
          comment: normalizeOptionalString(values.comment),
          defaultValue: normalizeOptionalString(values.defaultValue),
          name: values.name.trim(),
          nullable: values.primaryKey ? false : values.nullable,
          primaryKey: values.primaryKey,
          type: createColumnType(values, column.type),
          unique: values.unique,
        },
      }),
    );
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Pencil className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit column</DialogTitle>
            <DialogDescription>Change column type, constraints, and metadata.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-4">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Column name
              </span>
              <Input autoFocus aria-invalid={Boolean(errors.name)} {...form.register('name')} />
              <FieldError>{errors.name?.message}</FieldError>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Type
              </span>
              <select
                className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-primary)/0.18)]"
                {...form.register('family')}
              >
                {columnTypeFamilyOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            {family === 'varchar' ? (
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Length
                </span>
                <Input
                  aria-invalid={Boolean(errors.length)}
                  min={1}
                  max={2048}
                  type="number"
                  {...form.register('length', { valueAsNumber: true })}
                />
                <FieldError>{errors.length?.message}</FieldError>
              </label>
            ) : null}
            <div className="grid gap-2">
              <CheckboxField label="Primary key" {...form.register('primaryKey')} />
              <CheckboxField label="Unique" {...form.register('unique')} />
              <CheckboxField label="Auto increment" {...form.register('autoIncrement')} />
              <CheckboxField label="Nullable" {...form.register('nullable')} />
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Default value
              </span>
              <Input placeholder="now()" {...form.register('defaultValue')} />
              <FieldError>{errors.defaultValue?.message}</FieldError>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Comment
              </span>
              <Input placeholder="Column note" {...form.register('comment')} />
              <FieldError>{errors.comment?.message}</FieldError>
            </label>
          </div>
          <DialogFooter className="mt-5">
            <Button onClick={() => setOpen(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button type="submit">
              <Save className="size-4" />
              Save column
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IndexBuilderPanel({
  columns,
  index,
  indexes,
  model,
  onIndexSelect,
  onModelChange,
  selectedIndexId,
  table,
}: {
  columns: DatabaseColumn[];
  index: DatabaseIndex | null;
  indexes: DatabaseIndex[];
  model: DiagramModel;
  onIndexSelect: (indexId: string) => void;
  onModelChange: (model: DiagramModel) => void;
  selectedIndexId: string | null;
  table: DatabaseTable | null;
}) {
  return (
    <section>
      <h2 className="text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">Indexes</h2>
      {table ? (
        <Surface className="mt-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-extrabold">{indexes.length} indexes</div>
              <div className="mt-1 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                Composite, unique, and partial indexes
              </div>
            </div>
            <AddIndexDialog columns={columns} model={model} onModelChange={onModelChange} table={table} />
          </div>
          {indexes.length > 0 ? (
            <div className="mt-3 space-y-1">
              {indexes.map((currentIndex) => (
                <button
                  aria-pressed={selectedIndexId === currentIndex.id}
                  className={cn(
                    'w-full cursor-pointer rounded-xl px-2 py-2 text-left transition hover:bg-[rgb(var(--tabliodb-surface-raised))]',
                    selectedIndexId === currentIndex.id &&
                      'bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]',
                  )}
                  key={currentIndex.id}
                  onClick={() => onIndexSelect(currentIndex.id)}
                  type="button"
                >
                  <div className="truncate text-xs font-extrabold">{currentIndex.name}</div>
                  <div className="mt-1 truncate text-[11px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                    {formatIndexColumns(model, currentIndex)}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border-2 border-dashed border-[rgb(var(--tabliodb-border))] p-3 text-sm font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
              No indexes yet
            </div>
          )}
          {index ? (
            <div className="mt-3 rounded-xl bg-[rgb(var(--tabliodb-surface-raised))] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold">{index.name}</div>
                  <div className="mt-1 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                    {index.unique ? 'Unique index' : 'Non-unique index'}
                  </div>
                </div>
                <EditIndexDialog columns={columns} index={index} model={model} onModelChange={onModelChange} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <ColumnFact label="Method" value={formatIndexMethod(index.method)} />
                <ColumnFact label="Columns" value={String(index.columns.length)} />
                <ColumnFact label="Include" value={String(index.includeColumnIds?.length ?? 0)} />
                <ColumnFact label="Partial" value={index.where ? 'Yes' : 'No'} />
              </div>
              {index.where ? (
                <p className="mt-3 rounded-xl bg-white p-3 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                  WHERE {index.where}
                </p>
              ) : null}
              {index.comment ? (
                <p className="mt-2 rounded-xl bg-white p-3 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                  {index.comment}
                </p>
              ) : null}
            </div>
          ) : null}
        </Surface>
      ) : (
        <Surface className="mt-2 border-dashed p-4 text-sm font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
          No table selected
        </Surface>
      )}
    </section>
  );
}

function AddIndexDialog({
  columns,
  model,
  onModelChange,
  table,
}: {
  columns: DatabaseColumn[];
  model: DiagramModel;
  onModelChange: (model: DiagramModel) => void;
  table: DatabaseTable;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<IndexFormState>({
    defaultValues: getNewIndexDefaults(table, columns),
    resolver: zodResolver(indexFormSchema),
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset(getNewIndexDefaults(table, columns));
    }
  }

  function handleSubmit(values: IndexFormState) {
    onModelChange(
      applyDiagramCommand(model, {
        type: 'index.create',
        tableId: table.id,
        name: values.name.trim(),
        columns: createIndexColumns(values),
        comment: normalizeOptionalString(values.comment),
        includeColumnIds: normalizeIncludeColumnIds(values),
        method: normalizeIndexMethod(values.method),
        unique: values.unique,
        where: normalizeOptionalString(values.where),
      }),
    );
    handleOpenChange(false);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button disabled={columns.length === 0} size="sm" variant="soft">
          <Plus className="size-4" />
          Index
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] w-[min(92vw,560px)] overflow-y-auto">
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>New index</DialogTitle>
            <DialogDescription>Build a table index from one or more columns.</DialogDescription>
          </DialogHeader>
          <IndexFormFields columns={columns} form={form} />
          <DialogFooter className="mt-5">
            <Button onClick={() => handleOpenChange(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button type="submit">
              <Plus className="size-4" />
              Add index
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditIndexDialog({
  columns,
  index,
  model,
  onModelChange,
}: {
  columns: DatabaseColumn[];
  index: DatabaseIndex;
  model: DiagramModel;
  onModelChange: (model: DiagramModel) => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<IndexFormState>({
    defaultValues: getIndexDefaults(index, columns),
    resolver: zodResolver(indexFormSchema),
  });

  useEffect(() => {
    if (open) {
      form.reset(getIndexDefaults(index, columns));
    }
  }, [columns, form, index, open]);

  function handleSubmit(values: IndexFormState) {
    onModelChange(
      applyDiagramCommand(model, {
        type: 'index.update',
        indexId: index.id,
        changes: {
          name: values.name.trim(),
          columns: createIndexColumns(values),
          comment: normalizeOptionalString(values.comment),
          includeColumnIds: normalizeIncludeColumnIds(values),
          method: normalizeIndexMethod(values.method),
          unique: values.unique,
          where: normalizeOptionalString(values.where),
        },
      }),
    );
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Pencil className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] w-[min(92vw,560px)] overflow-y-auto">
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit index</DialogTitle>
            <DialogDescription>Change indexed columns, method, and partial predicate.</DialogDescription>
          </DialogHeader>
          <IndexFormFields columns={columns} form={form} />
          <DialogFooter className="mt-5">
            <Button onClick={() => setOpen(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button type="submit">
              <Save className="size-4" />
              Save index
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IndexFormFields({ columns, form }: { columns: DatabaseColumn[]; form: UseFormReturn<IndexFormState> }) {
  const { errors } = form.formState;
  const columnIds = form.watch('columnIds');
  const includeColumnIds = form.watch('includeColumnIds');
  const nullsByColumnId = form.watch('nullsByColumnId');
  const orderByColumnId = form.watch('orderByColumnId');

  function handleColumnToggle(columnId: string, checked: boolean) {
    const nextColumnIds = checked
      ? [...form.getValues('columnIds'), columnId]
      : form.getValues('columnIds').filter((currentColumnId) => currentColumnId !== columnId);

    // Include columns must not duplicate key columns, so toggling a key column also removes it from INCLUDE.
    form.setValue('columnIds', nextColumnIds, { shouldDirty: true, shouldValidate: true });
    form.setValue(
      'includeColumnIds',
      form.getValues('includeColumnIds').filter((includeColumnId) => !nextColumnIds.includes(includeColumnId)),
      { shouldDirty: true, shouldValidate: true },
    );
  }

  function handleIncludeColumnToggle(columnId: string, checked: boolean) {
    const currentIncludeColumnIds = form.getValues('includeColumnIds');
    const nextIncludeColumnIds = checked
      ? [...currentIncludeColumnIds, columnId]
      : currentIncludeColumnIds.filter((currentColumnId) => currentColumnId !== columnId);

    // The array is controlled manually because index columns are a builder-style set, not a simple scalar input.
    form.setValue('includeColumnIds', nextIncludeColumnIds, { shouldDirty: true, shouldValidate: true });
  }

  function handleOrderChange(columnId: string, value: IndexFormState['orderByColumnId'][string]) {
    form.setValue(
      'orderByColumnId',
      {
        ...form.getValues('orderByColumnId'),
        [columnId]: value,
      },
      { shouldDirty: true, shouldValidate: true },
    );
  }

  function handleNullsChange(columnId: string, value: IndexFormState['nullsByColumnId'][string]) {
    form.setValue(
      'nullsByColumnId',
      {
        ...form.getValues('nullsByColumnId'),
        [columnId]: value,
      },
      { shouldDirty: true, shouldValidate: true },
    );
  }

  return (
    <div className="mt-4 grid gap-4">
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Index name
        </span>
        <Input autoFocus aria-invalid={Boolean(errors.name)} placeholder="users_email_idx" {...form.register('name')} />
        <FieldError>{errors.name?.message}</FieldError>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
            Method
          </span>
          <select
            className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-primary)/0.18)]"
            {...form.register('method')}
          >
            {indexMethodOptions.map((option) => (
              <option key={option} value={option}>
                {option === unsetSelectValue ? 'Default' : option}
              </option>
            ))}
          </select>
        </label>
        <div className="pt-6">
          <CheckboxField label="Unique index" {...form.register('unique')} />
        </div>
      </div>
      <div>
        <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Key columns
        </div>
        <div className="grid gap-2">
          {columns.map((column) => {
            const selected = columnIds.includes(column.id);

            return (
              <div
                className={cn(
                  'rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] p-3',
                  selected && 'border-[rgb(var(--tabliodb-primary))] bg-[rgb(var(--tabliodb-primary-soft))]',
                )}
                key={column.id}
              >
                <label className="flex cursor-pointer items-center gap-2 text-sm font-extrabold">
                  <input
                    checked={selected}
                    className="size-4 cursor-pointer accent-[rgb(var(--tabliodb-primary))]"
                    onChange={(event) => handleColumnToggle(column.id, event.currentTarget.checked)}
                    type="checkbox"
                  />
                  <span className="min-w-0 flex-1 truncate">{column.name}</span>
                  <span className="text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                    {formatColumnType(column.type)}
                  </span>
                </label>
                {selected ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className="block text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                      Order
                      <select
                        className="mt-1 h-10 w-full cursor-pointer rounded-xl border-2 border-[rgb(var(--tabliodb-border))] bg-white px-2 text-xs font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))]"
                        onChange={(event) =>
                          handleOrderChange(
                            column.id,
                            event.currentTarget.value as IndexFormState['orderByColumnId'][string],
                          )
                        }
                        value={orderByColumnId[column.id] ?? unsetSelectValue}
                      >
                        {indexOrderOptions.map((option) => (
                          <option key={option} value={option}>
                            {option === unsetSelectValue ? 'Default' : option.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                      Nulls
                      <select
                        className="mt-1 h-10 w-full cursor-pointer rounded-xl border-2 border-[rgb(var(--tabliodb-border))] bg-white px-2 text-xs font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))]"
                        onChange={(event) =>
                          handleNullsChange(
                            column.id,
                            event.currentTarget.value as IndexFormState['nullsByColumnId'][string],
                          )
                        }
                        value={nullsByColumnId[column.id] ?? unsetSelectValue}
                      >
                        {indexNullsOptions.map((option) => (
                          <option key={option} value={option}>
                            {option === unsetSelectValue ? 'Default' : option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <FieldError>{errors.columnIds?.message}</FieldError>
      </div>
      <div>
        <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Include columns
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {columns.map((column) => {
            const selectedAsKey = columnIds.includes(column.id);

            return (
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] px-3 py-2 text-sm font-extrabold transition hover:bg-[rgb(var(--tabliodb-surface-raised))]',
                  selectedAsKey && 'cursor-not-allowed opacity-50',
                )}
                key={column.id}
              >
                <input
                  checked={includeColumnIds.includes(column.id)}
                  className="size-4 cursor-pointer accent-[rgb(var(--tabliodb-primary))] disabled:cursor-not-allowed"
                  disabled={selectedAsKey}
                  onChange={(event) => handleIncludeColumnToggle(column.id, event.currentTarget.checked)}
                  type="checkbox"
                />
                <span className="min-w-0 truncate">{column.name}</span>
              </label>
            );
          })}
        </div>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Partial WHERE
        </span>
        <Input placeholder="deleted_at IS NULL" {...form.register('where')} />
        <FieldError>{errors.where?.message}</FieldError>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Comment
        </span>
        <Input placeholder="Index note" {...form.register('comment')} />
        <FieldError>{errors.comment?.message}</FieldError>
      </label>
    </div>
  );
}

function RelationshipInspector({
  model,
  onModelChange,
  onRelationshipSelect,
  relationship,
  relationships,
  selectedRelationshipId,
}: {
  model: DiagramModel;
  onModelChange: (model: DiagramModel) => void;
  onRelationshipSelect: (relationshipId: string) => void;
  relationship: DatabaseRelationship | null;
  relationships: DatabaseRelationship[];
  selectedRelationshipId: string | null;
}) {
  return (
    <section>
      <h2 className="text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
        Relationships
      </h2>
      {relationships.length > 0 ? (
        <Surface className="mt-2 p-4">
          <div className="space-y-1">
            {relationships.map((currentRelationship) => (
              <button
                aria-pressed={selectedRelationshipId === currentRelationship.id}
                className={cn(
                  'w-full cursor-pointer rounded-xl px-2 py-2 text-left transition hover:bg-[rgb(var(--tabliodb-surface-raised))]',
                  selectedRelationshipId === currentRelationship.id &&
                    'bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]',
                )}
                key={currentRelationship.id}
                onClick={() => onRelationshipSelect(currentRelationship.id)}
                type="button"
              >
                <div className="truncate text-xs font-extrabold">
                  {getRelationshipTitle(model, currentRelationship)}
                </div>
                <div className="mt-1 truncate text-[11px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                  {getRelationshipEndpointLabel(model, currentRelationship, 'source')}
                  {' -> '}
                  {getRelationshipEndpointLabel(model, currentRelationship, 'target')}
                </div>
              </button>
            ))}
          </div>
          {relationship ? (
            <div className="mt-3 rounded-xl bg-[rgb(var(--tabliodb-surface-raised))] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold">{getRelationshipTitle(model, relationship)}</div>
                  <div className="mt-1 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                    {formatRelationshipCardinality(relationship.cardinality)}
                  </div>
                </div>
                <EditRelationshipDialog model={model} onModelChange={onModelChange} relationship={relationship} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <ColumnFact label="On delete" value={formatReferentialAction(relationship.onDelete)} />
                <ColumnFact label="On update" value={formatReferentialAction(relationship.onUpdate)} />
                <ColumnFact label="Match" value={relationship.matchType ?? '-'} />
                <ColumnFact label="Deferred" value={relationship.deferrable ? 'Yes' : 'No'} />
              </div>
              {relationship.comment ? (
                <p className="mt-3 rounded-xl bg-white p-3 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                  {relationship.comment}
                </p>
              ) : null}
            </div>
          ) : null}
        </Surface>
      ) : (
        <Surface className="mt-2 border-dashed p-4 text-sm font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
          No relationship on this table
        </Surface>
      )}
    </section>
  );
}

function EditRelationshipDialog({
  model,
  onModelChange,
  relationship,
}: {
  model: DiagramModel;
  onModelChange: (model: DiagramModel) => void;
  relationship: DatabaseRelationship;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<RelationshipFormState>({
    defaultValues: getRelationshipDefaults(relationship),
    resolver: zodResolver(relationshipFormSchema),
  });
  const { errors } = form.formState;
  const tables = Object.values(model.tables);
  const sourceTableId = form.watch('sourceTableId');
  const targetTableId = form.watch('targetTableId');
  const sourceColumns = useMemo(
    () => (sourceTableId ? getTableColumns(model, sourceTableId) : []),
    [model, sourceTableId],
  );
  const targetColumns = useMemo(
    () => (targetTableId ? getTableColumns(model, targetTableId) : []),
    [model, targetTableId],
  );
  const sourceColumnIds = sourceColumns.map((column) => column.id).join('|');
  const targetColumnIds = targetColumns.map((column) => column.id).join('|');

  useEffect(() => {
    if (open) {
      form.reset(getRelationshipDefaults(relationship));
    }
  }, [form, open, relationship]);

  useEffect(() => {
    const sourceColumnId = form.getValues('sourceColumnId');

    if (!sourceColumns.some((column) => column.id === sourceColumnId)) {
      // When the source table changes, pick the first valid column so the form never submits a stale endpoint.
      form.setValue('sourceColumnId', sourceColumns[0]?.id ?? '', { shouldDirty: true, shouldValidate: true });
    }
  }, [form, sourceColumnIds, sourceColumns]);

  useEffect(() => {
    const targetColumnId = form.getValues('targetColumnId');

    if (!targetColumns.some((column) => column.id === targetColumnId)) {
      // Foreign-key endpoint follows the selected target table for the same stale-id protection as the source side.
      form.setValue('targetColumnId', targetColumns[0]?.id ?? '', { shouldDirty: true, shouldValidate: true });
    }
  }, [form, targetColumnIds, targetColumns]);

  function handleSubmit(values: RelationshipFormState) {
    onModelChange(
      applyDiagramCommand(model, {
        type: 'relationship.update',
        relationshipId: relationship.id,
        changes: {
          cardinality: values.cardinality,
          comment: normalizeOptionalString(values.comment),
          deferrable: values.deferrable ? true : undefined,
          matchType: normalizeMatchType(values.matchType),
          name: normalizeOptionalString(values.name),
          onDelete: normalizeReferentialAction(values.onDelete),
          onUpdate: normalizeReferentialAction(values.onUpdate),
          sourceColumnIds: [values.sourceColumnId],
          sourceTableId: values.sourceTableId,
          targetColumnIds: [values.targetColumnId],
          targetTableId: values.targetTableId,
        },
      }),
    );
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Pencil className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] w-[min(92vw,560px)] overflow-y-auto">
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit relationship</DialogTitle>
            <DialogDescription>Adjust endpoints and referential behavior.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-4">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Relationship name
              </span>
              <Input autoFocus placeholder="orders_user_id_fkey" {...form.register('name')} />
              <FieldError>{errors.name?.message}</FieldError>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Primary table
                </span>
                <select
                  className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-primary)/0.18)]"
                  {...form.register('sourceTableId')}
                >
                  {tables.map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.name}
                    </option>
                  ))}
                </select>
                <FieldError>{errors.sourceTableId?.message}</FieldError>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Primary column
                </span>
                <select
                  className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-primary)/0.18)]"
                  {...form.register('sourceColumnId')}
                >
                  {sourceColumns.length > 0 ? (
                    sourceColumns.map((column) => (
                      <option key={column.id} value={column.id}>
                        {column.name} ({formatColumnType(column.type)})
                      </option>
                    ))
                  ) : (
                    <option value="">No columns</option>
                  )}
                </select>
                <FieldError>{errors.sourceColumnId?.message}</FieldError>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Foreign table
                </span>
                <select
                  className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-primary)/0.18)]"
                  {...form.register('targetTableId')}
                >
                  {tables.map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.name}
                    </option>
                  ))}
                </select>
                <FieldError>{errors.targetTableId?.message}</FieldError>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Foreign column
                </span>
                <select
                  className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-primary)/0.18)]"
                  {...form.register('targetColumnId')}
                >
                  {targetColumns.length > 0 ? (
                    targetColumns.map((column) => (
                      <option key={column.id} value={column.id}>
                        {column.name} ({formatColumnType(column.type)})
                      </option>
                    ))
                  ) : (
                    <option value="">No columns</option>
                  )}
                </select>
                <FieldError>{errors.targetColumnId?.message}</FieldError>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Cardinality
                </span>
                <select
                  className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-primary)/0.18)]"
                  {...form.register('cardinality')}
                >
                  {relationshipCardinalityOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatRelationshipCardinality(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Match type
                </span>
                <select
                  className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-primary)/0.18)]"
                  {...form.register('matchType')}
                >
                  {matchTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === unsetSelectValue ? 'Not set' : option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  On delete
                </span>
                <select
                  className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-primary)/0.18)]"
                  {...form.register('onDelete')}
                >
                  {referentialActionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === unsetSelectValue ? 'Not set' : formatReferentialAction(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  On update
                </span>
                <select
                  className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-primary)/0.18)]"
                  {...form.register('onUpdate')}
                >
                  {referentialActionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === unsetSelectValue ? 'Not set' : formatReferentialAction(option)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <CheckboxField label="Deferrable" {...form.register('deferrable')} />
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Comment
              </span>
              <Input placeholder="Relationship note" {...form.register('comment')} />
              <FieldError>{errors.comment?.message}</FieldError>
            </label>
          </div>
          <DialogFooter className="mt-5">
            <Button onClick={() => setOpen(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button type="submit">
              <Save className="size-4" />
              Save relationship
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CheckboxField({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] px-3 py-2 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] transition hover:bg-[rgb(var(--tabliodb-surface-raised))]">
      <input className="size-4 cursor-pointer accent-[rgb(var(--tabliodb-primary))]" type="checkbox" {...props} />
      {label}
    </label>
  );
}

function ColumnFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[rgb(var(--tabliodb-surface-raised))] px-3 py-2">
      <div className="text-[10px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-subtle))]">
        {label}
      </div>
      <div className="mt-0.5 truncate font-extrabold text-[rgb(var(--tabliodb-ink))]">{value}</div>
    </div>
  );
}

function ColumnBadge({ children }: { children: string }) {
  return (
    <span className="rounded-md bg-[rgb(var(--tabliodb-surface-raised))] px-1.5 py-0.5 text-[10px] font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
      {children}
    </span>
  );
}

function getEditTableDefaults(table: DatabaseTable): EditTableFormState {
  return {
    color: table.color ?? '#0f766e',
    name: table.name,
    width: table.width,
  };
}

function getNewColumnDefaults(): ColumnFormState {
  return {
    autoIncrement: false,
    comment: '',
    defaultValue: '',
    family: 'varchar',
    length: 160,
    name: '',
    nullable: true,
    primaryKey: false,
    unique: false,
  };
}

function getColumnDefaults(column: DatabaseColumn): ColumnFormState {
  return {
    autoIncrement: column.autoIncrement,
    comment: column.comment ?? '',
    defaultValue: column.defaultValue ?? '',
    family: column.type.family,
    length: column.type.length ?? 160,
    name: column.name,
    nullable: column.nullable,
    primaryKey: column.primaryKey,
    unique: column.unique,
  };
}

function createColumnType(values: ColumnFormState, currentType?: ColumnTypeSpec): ColumnTypeSpec {
  const preservedType = currentType?.family === values.family ? currentType : undefined;

  if (values.family === 'varchar') {
    return {
      ...(preservedType ?? {}),
      family: values.family,
      // Length is the only type facet exposed in the first inspector form, while imported metadata stays intact.
      length: values.length ?? preservedType?.length ?? 160,
      raw: undefined,
    };
  }

  if (preservedType) {
    // Preserve precision, scale, enumId, and raw metadata when the user edits flags without changing the type family.
    return preservedType;
  }

  return { family: values.family };
}

function normalizeOptionalString(value: string): string | undefined {
  const trimmedValue = value.trim();

  // Store blank optional values as undefined so generated SQL and inspector facts do not carry empty strings.
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function countTableRelationships(model: DiagramModel, table: DatabaseTable): number {
  return Object.values(model.relationships).filter(
    (relationship) => relationship.sourceTableId === table.id || relationship.targetTableId === table.id,
  ).length;
}

function getTableIndexes(model: DiagramModel, table: DatabaseTable): DatabaseIndex[] {
  return table.indexIds.flatMap((indexId) => {
    const index = model.indexes[indexId];

    return index ? [index] : [];
  });
}

function getTableRelationships(model: DiagramModel, tableId: string): DatabaseRelationship[] {
  return Object.values(model.relationships).filter(
    (relationship) => relationship.sourceTableId === tableId || relationship.targetTableId === tableId,
  );
}

function countColumnRelationships(model: DiagramModel, column: DatabaseColumn): number {
  return Object.values(model.relationships).filter(
    (relationship) =>
      relationship.sourceColumnIds.includes(column.id) || relationship.targetColumnIds.includes(column.id),
  ).length;
}

function relationshipTouchesColumn(relationship: DatabaseRelationship, columnId: string): boolean {
  return relationship.sourceColumnIds.includes(columnId) || relationship.targetColumnIds.includes(columnId);
}

function getNewIndexDefaults(table: DatabaseTable, columns: DatabaseColumn[]): IndexFormState {
  const firstColumn = columns[0];
  const orderByColumnId: IndexFormState['orderByColumnId'] = Object.fromEntries(
    columns.map((column) => [column.id, unsetSelectValue]),
  );
  const nullsByColumnId: IndexFormState['nullsByColumnId'] = Object.fromEntries(
    columns.map((column) => [column.id, unsetSelectValue]),
  );

  return {
    columnIds: firstColumn ? [firstColumn.id] : [],
    comment: '',
    includeColumnIds: [],
    method: unsetSelectValue,
    name: getSuggestedIndexName(table, firstColumn),
    nullsByColumnId,
    orderByColumnId,
    unique: false,
    where: '',
  };
}

function getIndexDefaults(index: DatabaseIndex, columns: DatabaseColumn[]): IndexFormState {
  const orderByColumnId: IndexFormState['orderByColumnId'] = Object.fromEntries(
    columns.map((column) => [column.id, unsetSelectValue]),
  );
  const nullsByColumnId: IndexFormState['nullsByColumnId'] = Object.fromEntries(
    columns.map((column) => [column.id, unsetSelectValue]),
  );

  for (const indexColumn of index.columns) {
    orderByColumnId[indexColumn.columnId] = indexColumn.order ?? unsetSelectValue;
    nullsByColumnId[indexColumn.columnId] = indexColumn.nulls ?? unsetSelectValue;
  }

  return {
    columnIds: index.columns.map((column) => column.columnId),
    comment: index.comment ?? '',
    includeColumnIds: index.includeColumnIds ?? [],
    method: index.method ?? unsetSelectValue,
    name: index.name,
    nullsByColumnId,
    orderByColumnId,
    unique: index.unique,
    where: index.where ?? '',
  };
}

function createIndexColumns(values: IndexFormState): DatabaseIndexColumn[] {
  return values.columnIds.map((columnId) => {
    const indexColumn: DatabaseIndexColumn = { columnId };
    const order = normalizeIndexOrder(values.orderByColumnId[columnId] ?? unsetSelectValue);
    const nulls = normalizeIndexNulls(values.nullsByColumnId[columnId] ?? unsetSelectValue);

    if (order) {
      indexColumn.order = order;
    }

    if (nulls) {
      indexColumn.nulls = nulls;
    }

    return indexColumn;
  });
}

function normalizeIncludeColumnIds(values: IndexFormState): string[] | undefined {
  const keyColumnIds = new Set(values.columnIds);
  const includeColumnIds = values.includeColumnIds.filter((columnId) => !keyColumnIds.has(columnId));

  // Empty INCLUDE lists are stored as undefined to keep the serialized diagram compact.
  return includeColumnIds.length > 0 ? includeColumnIds : undefined;
}

function normalizeIndexMethod(value: IndexFormState['method']): DatabaseIndex['method'] | undefined {
  return value === unsetSelectValue ? undefined : value;
}

function normalizeIndexOrder(
  value: IndexFormState['orderByColumnId'][string],
): DatabaseIndexColumn['order'] | undefined {
  return value === unsetSelectValue ? undefined : value;
}

function normalizeIndexNulls(
  value: IndexFormState['nullsByColumnId'][string],
): DatabaseIndexColumn['nulls'] | undefined {
  return value === unsetSelectValue ? undefined : value;
}

function getSuggestedIndexName(table: DatabaseTable, column: DatabaseColumn | undefined): string {
  return normalizeIdentifier(`${table.name}_${column?.name ?? 'column'}_idx`) || `idx_${table.id}`;
}

function normalizeIdentifier(value: string): string {
  const normalizedValue = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  // Index names must start with a letter because the form schema intentionally follows common SQL identifier rules.
  return /^[a-z]/.test(normalizedValue) ? normalizedValue : `idx_${normalizedValue}`;
}

function formatIndexColumns(model: DiagramModel, index: DatabaseIndex): string {
  return index.columns.map((column) => formatIndexColumn(model, column)).join(', ');
}

function formatIndexColumn(model: DiagramModel, indexColumn: DatabaseIndexColumn): string {
  const columnName = model.columns[indexColumn.columnId]?.name ?? indexColumn.columnId;
  const facets = [
    indexColumn.order ? indexColumn.order.toUpperCase() : undefined,
    indexColumn.nulls ? `NULLS ${indexColumn.nulls.toUpperCase()}` : undefined,
  ].filter(Boolean);

  return facets.length > 0 ? `${columnName} ${facets.join(' ')}` : columnName;
}

function formatIndexMethod(method: DatabaseIndex['method']): string {
  return method ?? 'default';
}

function getRelationshipDefaults(relationship: DatabaseRelationship): RelationshipFormState {
  return {
    cardinality: relationship.cardinality,
    comment: relationship.comment ?? '',
    deferrable: relationship.deferrable ?? false,
    matchType: relationship.matchType ?? unsetSelectValue,
    name: relationship.name ?? '',
    onDelete: relationship.onDelete ?? unsetSelectValue,
    onUpdate: relationship.onUpdate ?? unsetSelectValue,
    sourceColumnId: relationship.sourceColumnIds[0] ?? '',
    sourceTableId: relationship.sourceTableId,
    targetColumnId: relationship.targetColumnIds[0] ?? '',
    targetTableId: relationship.targetTableId,
  };
}

function normalizeReferentialAction(value: RelationshipFormState['onDelete']): ReferentialAction | undefined {
  return value === unsetSelectValue ? undefined : value;
}

function normalizeMatchType(value: RelationshipFormState['matchType']): DatabaseRelationship['matchType'] | undefined {
  return value === unsetSelectValue ? undefined : value;
}

function getRelationshipTitle(model: DiagramModel, relationship: DatabaseRelationship): string {
  if (relationship.name) {
    return relationship.name;
  }

  return `${getRelationshipEndpointLabel(model, relationship, 'source')} -> ${getRelationshipEndpointLabel(
    model,
    relationship,
    'target',
  )}`;
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

function formatRelationshipCardinality(cardinality: DatabaseRelationship['cardinality']): string {
  const labels: Record<DatabaseRelationship['cardinality'], string> = {
    many_to_many: 'Many to many',
    one_to_many: 'One to many',
    one_to_one: 'One to one',
  };

  return labels[cardinality];
}

function formatReferentialAction(action: ReferentialAction | undefined): string {
  if (!action) {
    return '-';
  }

  const labels: Record<ReferentialAction, string> = {
    cascade: 'Cascade',
    no_action: 'No action',
    restrict: 'Restrict',
    set_default: 'Set default',
    set_null: 'Set null',
  };

  return labels[action];
}

function getReviewSignals(model: DiagramModel): string[] {
  const relationshipsByTargetColumn = new Set(
    Object.values(model.relationships).flatMap((relationship) =>
      getRelationshipColumnPairs(relationship).map((pair) => pair.targetColumnId),
    ),
  );

  const missingRelationshipIndexes = Object.values(model.columns)
    .filter((column) => column.name.endsWith('_id') && !relationshipsByTargetColumn.has(column.id))
    .map((column) => `${model.tables[column.tableId]?.name ?? column.tableId}.${column.name} has no relationship`);

  if (missingRelationshipIndexes.length > 0) {
    return missingRelationshipIndexes.slice(0, 2);
  }

  return ['Foreign keys are mapped', 'Unique columns are visible'];
}
