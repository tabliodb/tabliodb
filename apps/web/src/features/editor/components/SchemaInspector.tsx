import { zodResolver } from '@hookform/resolvers/zod';
import {
  applyDiagramCommand,
  applyDiagramCommands,
  getRelationshipColumnPairs,
  getTableColumns,
  type ColumnTypeFamily,
  type ColumnTypeSpec,
  type DatabaseColumn,
  type DatabaseTable,
  type DiagramModel,
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
import { useForm } from 'react-hook-form';
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
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const selectedColumnIds = selectedColumns.map((column) => column.id).join('|');
  const selectedColumn = selectedColumns.find((column) => column.id === selectedColumnId) ?? null;
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

  return (
    <aside className="border-l-2 border-[rgb(var(--tabliodb-border))] bg-white">
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

function countColumnRelationships(model: DiagramModel, column: DatabaseColumn): number {
  return Object.values(model.relationships).filter(
    (relationship) =>
      relationship.sourceColumnIds.includes(column.id) || relationship.targetColumnIds.includes(column.id),
  ).length;
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
